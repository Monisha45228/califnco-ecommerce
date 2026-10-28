const crypto = require('node:crypto');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const nodemailer = require('nodemailer');

initializeApp();

const razorpaySecret = defineSecret('RAZORPAY_KEY_SECRET');
const smtpPassword = defineSecret('SMTP_PASSWORD');
const smsProviderToken = defineSecret('SMS_PROVIDER_TOKEN');
const supportedOrderStatuses = ['Placed', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'];

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = razorpaySecret.value();
  if (!keyId || !/^rzp_test_/.test(keyId) || !keySecret) {
    throw new HttpsError('failed-precondition', 'Razorpay test credentials are not configured on the server.');
  }
  return { keyId, keySecret };
}

async function razorpayRequest(path, method, credentials, body) {
  let response;
  try {
    response = await fetch(`https://api.razorpay.com/v1${path}`, {
      method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${credentials.keyId}:${credentials.keySecret}`).toString('base64')}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000)
    });
  } catch (error) {
    logger.error('Razorpay API request failed.', { code: error.code || 'network_error' });
    throw new HttpsError('unavailable', 'Razorpay could not be reached. Please try again.');
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error('Razorpay API rejected a request.', { status: response.status });
    throw new HttpsError('failed-precondition', 'Razorpay could not process this payment. Please try again.');
  }
  return result;
}

function orderItemsFromInput(input) {
  if (!input || !Array.isArray(input.items) || input.items.length === 0 || input.items.length > 50) {
    throw new HttpsError('invalid-argument', 'An order must contain between 1 and 50 items.');
  }
  const quantities = new Map();
  for (const item of input.items) {
    if (!item || typeof item.productId !== 'string' || !item.productId.trim() ||
        !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new HttpsError('invalid-argument', 'Each order item needs a product ID and positive whole-number quantity.');
    }
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  return quantities;
}

async function restoreReservedStock(database, orderId, allowedUserId) {
  const orderRef = database.collection('orders').doc(orderId);
  await database.runTransaction(async transaction => {
    const orderSnapshot = await transaction.get(orderRef);
    if (!orderSnapshot.exists) return;
    const order = orderSnapshot.data();
    if ((allowedUserId && order.userId !== allowedUserId) ||
        order.paymentStatus === 'paid' || order.stockReleasedAt) return;
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const quantities = new Map();
    orderItems.forEach(item => {
      if (typeof item.productId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0) {
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
      }
    });
    const productRefs = [...quantities.keys()].map(id => database.collection('products').doc(id));
    const productSnapshots = await Promise.all(productRefs.map(reference => transaction.get(reference)));
    productSnapshots.forEach(snapshot => {
      if (!snapshot.exists) return;
      const stock = Number(snapshot.get('stock')) || 0;
      const restoredStock = stock + quantities.get(snapshot.id);
      transaction.update(snapshot.ref, {
        stock: restoredStock,
        inStock: restoredStock > 0,
        updatedAt: FieldValue.serverTimestamp()
      });
    });
    const timeline = Array.isArray(order.timeline) ? order.timeline : [];
    transaction.update(orderRef, {
      status: 'Cancelled',
      paymentStatus: 'failed',
      stockReleasedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      timeline: [...timeline, {
        status: 'Cancelled',
        timestamp: new Date().toISOString(),
        note: 'Payment was not completed; reserved stock was released.'
      }]
    });
  });
}

exports.createOrder = onCall({ secrets: [razorpaySecret] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before placing an order.');
  const input = request.data;
  if (!input || !['razorpay', 'cod', 'dealer_credit'].includes(input.paymentMethod)) {
    throw new HttpsError('invalid-argument', 'Choose a supported payment method.');
  }
  const razorpayCredentials = input.paymentMethod === 'razorpay' ? getRazorpayCredentials() : null;
  const quantities = orderItemsFromInput(input);
  const database = getFirestore();
  const userRef = database.collection('users').doc(request.auth.uid);
  const productRefs = [...quantities.keys()].map(productId => database.collection('products').doc(productId));
  const orderRef = database.collection('orders').doc();
  let orderTotal = 0;

  await database.runTransaction(async transaction => {
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists || userSnapshot.get('blocked') === true) {
      throw new HttpsError('permission-denied', 'This account cannot place orders.');
    }
    const user = userSnapshot.data();
    const role = user.role === 'dealer' ? 'dealer' : 'customer';
    const customerPhone = String(user.phone || '');
    if (!/^\d{10}$/.test(customerPhone)) {
      throw new HttpsError('failed-precondition', 'Update your profile with a 10-digit phone number before placing an order.');
    }
    if (input.paymentMethod === 'dealer_credit' && role !== 'dealer') {
      throw new HttpsError('permission-denied', 'Dealer credit is only available to approved dealer accounts.');
    }
    const address = user.address;
    if (!address || !address.street || !address.city || !address.state || !address.postalCode) {
      throw new HttpsError('failed-precondition', 'Add a complete delivery address before placing an order.');
    }

    const productSnapshots = await Promise.all(productRefs.map(reference => transaction.get(reference)));
    const items = [];
    let subtotal = 0;
    productSnapshots.forEach(snapshot => {
      if (!snapshot.exists) throw new HttpsError('not-found', `Product ${snapshot.id} is no longer available.`);
      const product = snapshot.data();
      const quantity = quantities.get(snapshot.id);
      const stock = Number(product.stock);
      if (!Number.isInteger(stock) || stock < quantity || product.inStock === false) {
        throw new HttpsError('failed-precondition', `${product.name || 'A product'} does not have enough stock.`);
      }
      if (role === 'dealer' && quantity < Number(product.moq || 1)) {
        throw new HttpsError('failed-precondition', `${product.name} requires a minimum order of ${product.moq} units.`);
      }
      const unitPrice = Number(role === 'dealer' ? product.wholesalePrice : product.retailPrice);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        throw new HttpsError('failed-precondition', `${product.name} has an invalid price.`);
      }
      const totalPrice = unitPrice * quantity;
      subtotal += totalPrice;
      items.push({
        productId: snapshot.id,
        name: String(product.name),
        quantity,
        unitPrice,
        totalPrice,
        image: String(product.image || '')
      });
      transaction.update(snapshot.ref, {
        stock: stock - quantity,
        inStock: stock - quantity > 0,
        updatedAt: FieldValue.serverTimestamp()
      });
    });

    const discount = role === 'dealer' && subtotal > 50000 ? Math.round(subtotal * 0.05) : 0;
    const deliveryFee = subtotal > 500 || subtotal === 0 ? 0 : 99;
    orderTotal = subtotal - discount + deliveryFee;
    const now = new Date().toISOString();
    transaction.set(orderRef, {
      userId: request.auth.uid,
      customerName: String(user.name || ''),
      name: String(user.name || ''),
      customerEmail: String(user.email || request.auth.token.email || ''),
      customerPhone,
      role,
      items,
      subtotal,
      discount,
      deliveryFee,
      total: orderTotal,
      address,
      shippingAddress: address,
      status: 'Placed',
      paymentMethod: input.paymentMethod,
      paymentStatus: 'pending',
      razorpayPaymentId: null,
      razorpayOrderId: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      timeline: [{ status: 'Placed', timestamp: now, note: `Order placed via ${input.paymentMethod}.` }]
    });
  });

  if (input.paymentMethod !== 'razorpay') return { orderId: orderRef.id, total: orderTotal };

  const amountPaise = Math.round(orderTotal * 100);
  if (!Number.isSafeInteger(amountPaise) || amountPaise < 1) {
    await restoreReservedStock(database, orderRef.id, request.auth.uid);
    throw new HttpsError('failed-precondition', 'This order total cannot be processed by Razorpay.');
  }
  try {
    const razorpayOrder = await razorpayRequest('/orders', 'POST', razorpayCredentials, {
      amount: amountPaise,
      currency: 'INR',
      receipt: orderRef.id,
      notes: { orderId: orderRef.id, userId: request.auth.uid }
    });
    await orderRef.update({
      razorpayOrderId: razorpayOrder.id,
      updatedAt: FieldValue.serverTimestamp()
    });
    return {
      orderId: orderRef.id,
      total: orderTotal,
      razorpayOrderId: razorpayOrder.id,
      razorpayKeyId: razorpayCredentials.keyId,
      amountPaise,
      currency: 'INR'
    };
  } catch (error) {
    await restoreReservedStock(database, orderRef.id, request.auth.uid).catch(rollbackError => {
      logger.error('Unable to release stock after Razorpay order creation failed.', {
        orderId: orderRef.id,
        error: rollbackError.message
      });
    });
    throw error instanceof HttpsError
      ? error
      : new HttpsError('internal', 'Unable to create a Razorpay order. Please try again.');
  }
});

exports.verifyRazorpayPayment = onCall({ secrets: [razorpaySecret] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before verifying payment.');
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = request.data || {};
  if (![orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature].every(value =>
    typeof value === 'string' && value.length > 0 && value.length <= 256)) {
    throw new HttpsError('invalid-argument', 'Razorpay payment details are incomplete.');
  }
  const credentials = getRazorpayCredentials();
  const expectedSignature = crypto
    .createHmac('sha256', credentials.keySecret)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  const actualSignature = Buffer.from(razorpaySignature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  if (actualBufferMismatch(actualSignature, expectedBuffer)) {
    throw new HttpsError('permission-denied', 'The Razorpay payment signature is invalid.');
  }

  const database = getFirestore();
  const orderRef = database.collection('orders').doc(orderId);
  const orderSnapshot = await orderRef.get();
  if (!orderSnapshot.exists || orderSnapshot.get('userId') !== request.auth.uid ||
      orderSnapshot.get('paymentMethod') !== 'razorpay' ||
      orderSnapshot.get('razorpayOrderId') !== razorpayOrderId) {
    throw new HttpsError('permission-denied', 'This payment does not match your order.');
  }
  if (orderSnapshot.get('paymentStatus') === 'paid' &&
      orderSnapshot.get('razorpayPaymentId') === razorpayPaymentId) {
    return { orderId, paymentStatus: 'paid' };
  }
  if (orderSnapshot.get('paymentStatus') !== 'pending') {
    throw new HttpsError('failed-precondition', 'This order is no longer awaiting payment.');
  }

  const payment = await razorpayRequest(`/payments/${encodeURIComponent(razorpayPaymentId)}`, 'GET', credentials);
  const expectedAmount = Math.round(Number(orderSnapshot.get('total')) * 100);
  if (payment.order_id !== razorpayOrderId || payment.amount !== expectedAmount ||
      payment.currency !== 'INR' || payment.status !== 'captured' || payment.captured !== true) {
    throw new HttpsError('failed-precondition', 'Razorpay has not confirmed a captured payment for this order.');
  }

  await database.runTransaction(async transaction => {
    const latest = await transaction.get(orderRef);
    if (!latest.exists || latest.get('userId') !== request.auth.uid ||
        latest.get('razorpayOrderId') !== razorpayOrderId) {
      throw new HttpsError('permission-denied', 'This payment does not match your order.');
    }
    if (latest.get('paymentStatus') === 'paid' &&
        latest.get('razorpayPaymentId') === razorpayPaymentId) return;
    if (latest.get('paymentStatus') !== 'pending') {
      throw new HttpsError('failed-precondition', 'This order is no longer awaiting payment.');
    }
    transaction.update(orderRef, {
      paymentStatus: 'paid',
      razorpayPaymentId: razorpayPaymentId,
      paymentSignatureVerified: true,
      paidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  return { orderId, paymentStatus: 'paid' };
});

function actualBufferMismatch(actual, expected) {
  return actual.length !== expected.length || !crypto.timingSafeEqual(
    actual.length === expected.length ? actual : Buffer.alloc(expected.length),
    expected
  );
}

exports.cancelRazorpayOrder = onCall({ secrets: [razorpaySecret] }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in before cancelling payment.');
  const orderId = request.data && request.data.orderId;
  if (typeof orderId !== 'string' || !orderId) {
    throw new HttpsError('invalid-argument', 'An order ID is required.');
  }
  const database = getFirestore();
  const orderRef = database.collection('orders').doc(orderId);
  const orderSnapshot = await orderRef.get();
  if (!orderSnapshot.exists || orderSnapshot.get('userId') !== request.auth.uid) {
    throw new HttpsError('not-found', 'Order not found.');
  }
  if (orderSnapshot.get('paymentStatus') === 'paid' || orderSnapshot.get('status') !== 'Placed') {
    throw new HttpsError('failed-precondition', 'This order cannot be cancelled as an unpaid payment.');
  }
  const razorpayOrderId = orderSnapshot.get('razorpayOrderId');
  if (razorpayOrderId) {
    const credentials = getRazorpayCredentials();
    const payments = await razorpayRequest(
      `/orders/${encodeURIComponent(razorpayOrderId)}/payments`,
      'GET',
      credentials
    );
    if ((payments.items || []).some(payment => payment.status !== 'failed')) {
      throw new HttpsError('failed-precondition', 'A Razorpay payment attempt is still active; verify or resolve it before cancelling this order.');
    }
  }
  await restoreReservedStock(database, orderId, request.auth.uid);
  return { orderId, status: 'Cancelled' };
});

function safeProviderError(error) {
  return String(error && (error.code || error.message) || 'provider_error').slice(0, 240);
}

async function sendTransactionalEmail(order, subject, message) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const from = process.env.SMTP_FROM;
  const user = process.env.SMTP_USER;
  const password = smtpPassword.value();
  if (!host || !from || !user || !password || !order.customerEmail) return 'skipped';
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass: password }
  });
  await transporter.sendMail({
    from,
    to: order.customerEmail,
    subject,
    text: `${message}\n\nOrder: ${order.id}\nTotal: ₹${Number(order.total || 0).toLocaleString('en-IN')}`,
    html: `<p>${message}</p><p>Order: <strong>${order.id}</strong><br>Total: ₹${Number(order.total || 0).toLocaleString('en-IN')}</p>`
  });
  return 'sent';
}

async function sendTransactionalSms(order, message) {
  const endpoint = process.env.SMS_PROVIDER_URL;
  const from = process.env.SMS_FROM;
  const token = smsProviderToken.value();
  if (!endpoint || !from || !token || !order.customerPhone) return 'skipped';
  // This adapter only sends when a real HTTP SMS gateway is configured; it does not simulate delivery.
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ to: order.customerPhone, from, message }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`SMS gateway returned HTTP ${response.status}.`);
  return 'sent';
}

async function recordNotificationFailure(database, orderRef, eventKey, provider, error) {
  const message = safeProviderError(error);
  const at = new Date().toISOString();
  try {
    await orderRef.update({
      notificationErrors: FieldValue.arrayUnion({ eventKey, provider, message, at })
    });
  } catch (writeError) {
    logger.error('Unable to record a notification provider error.', {
      eventKey,
      provider,
      error: safeProviderError(writeError)
    });
  }
  return message;
}

async function sendOrderNotifications(orderId, order, eventKey, subject, message, sendPush) {
  const database = getFirestore();
  const orderRef = database.collection('orders').doc(orderId);
  const notificationRef = database.collection('notifications').doc(eventKey);
  const results = {
    emailStatus: 'skipped',
    smsStatus: 'skipped',
    pushStatus: sendPush ? 'skipped' : 'not_applicable'
  };
  const errors = {};

  try {
    results.emailStatus = await sendTransactionalEmail({ ...order, id: orderId }, subject, message);
  } catch (error) {
    errors.emailError = await recordNotificationFailure(database, orderRef, eventKey, 'email', error);
    results.emailStatus = 'failed';
    logger.warn('Transactional email delivery failed.', { orderId, error: errors.emailError });
  }
  try {
    results.smsStatus = await sendTransactionalSms({ ...order, id: orderId }, `${message} Order ${orderId}.`);
  } catch (error) {
    errors.smsError = await recordNotificationFailure(database, orderRef, eventKey, 'sms', error);
    results.smsStatus = 'failed';
    logger.warn('Transactional SMS delivery failed.', { orderId, error: errors.smsError });
  }

  const title = subject;
  try {
    await notificationRef.set({
      userId: order.userId,
      orderId,
      title,
      message,
      type: 'order',
      read: false,
      createdAt: FieldValue.serverTimestamp(),
      ...results,
      ...errors
    }, { merge: true });
  } catch (error) {
    logger.error('Unable to store an order notification.', { orderId, error: safeProviderError(error) });
    await recordNotificationFailure(database, orderRef, eventKey, 'firestore_notification', error);
  }

  if (!sendPush) return;
  try {
    const userSnapshot = await database.collection('users').doc(order.userId).get();
    const token = userSnapshot.get('fcmToken');
    if (!token) return;
    await getMessaging().send({
      token,
      notification: { title, body: message },
      data: { orderId, status: String(order.status || '') },
      webpush: { fcmOptions: { link: '/' } }
    });
    results.pushStatus = 'sent';
  } catch (error) {
    errors.pushError = await recordNotificationFailure(database, orderRef, eventKey, 'push', error);
    results.pushStatus = 'failed';
    logger.warn('Order status push delivery failed.', { orderId, error: errors.pushError });
  }
  await notificationRef.set({ ...results, ...errors }, { merge: true }).catch(error => {
    logger.error('Unable to update push notification status.', { orderId, error: safeProviderError(error) });
  });
}

exports.notifyOrderCreated = onDocumentCreated({
  document: 'orders/{orderId}',
  secrets: [smtpPassword, smsProviderToken]
}, async event => {
  const order = event.data && event.data.data();
  if (!order || !order.userId) return;
  const orderId = event.params.orderId;
  await sendOrderNotifications(
    orderId,
    order,
    `${orderId}_created`,
    'Order confirmation — Califnco',
    order.paymentMethod === 'razorpay'
      ? 'Your order was received. Complete the Razorpay checkout to confirm payment.'
      : 'Thank you. Your order has been received and is being processed.',
    false
  );
});

exports.notifyOrderStatusChanged = onDocumentUpdated({
  document: 'orders/{orderId}',
  secrets: [smtpPassword, smsProviderToken]
}, async event => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!before || !after || before.status === after.status) return;
  if (!after.userId || !supportedOrderStatuses.includes(after.status)) {
    logger.warn('Skipping status notification for an order with invalid owner or status.', {
      orderId: event.params.orderId
    });
    return;
  }
  const orderId = event.params.orderId;
  const eventKey = `${orderId}_${String(after.status).toLowerCase().replace(/[^a-z0-9_-]/g, '_')}`;
  await sendOrderNotifications(
    orderId,
    after,
    eventKey,
    `Order ${after.status} — Califnco`,
    `Your order is now ${after.status.toLowerCase()}.`,
    true
  );
});
