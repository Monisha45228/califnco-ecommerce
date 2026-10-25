import confetti from 'canvas-confetti';
import {
  addDoc, collection, doc, onSnapshot, orderBy, query, Query, serverTimestamp, where, writeBatch
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { app, db, functions } from './firebase';
import { Product, CartItem, Order, ServiceBooking, UserProfile, UserRole, OrderStatus, MarketingPost } from '../types';

export interface RazorpayCheckoutOrder {
  orderId: string;
  total: number;
  razorpayOrderId: string;
  razorpayKeyId: string;
  amountPaise: number;
  currency: 'INR';
}

export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'order' | 'service' | 'deal' | 'referral';
}

function firestore() {
  if (!db) throw new Error('Firebase is not configured. Set mobile-app VITE_FIREBASE_* settings.');
  return db;
}

function dateString(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return (value.toDate() as Date).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : new Date().toISOString();
}

class MobileStoreService {
  private products: Product[] = [];
  private cart: CartItem[] = [];
  private currentUser: UserProfile = { uid: '', name: '', email: '', phone: '', role: 'customer' };
  private orders: Order[] = [];
  private services: ServiceBooking[] = [];
  private notifications: AppNotification[] = [];
  private posts: MarketingPost[] = [];
  private isDarkMode = false;
  private lightboxImage: string | null = null;
  private listeners: (() => void)[] = [];
  private unsubscribers: (() => void)[] = [];

  constructor() {
    const savedTheme = localStorage.getItem('califnco_theme');
    if (savedTheme === 'dark') {
      this.isDarkMode = true;
      document.documentElement.classList.add('dark');
    }
    try {
      this.cart = JSON.parse(localStorage.getItem('califnco_cart') || '[]') as CartItem[];
    } catch (error) {
      console.error('Unable to restore the saved cart.', error);
      this.cart = [];
      localStorage.removeItem('califnco_cart');
    }
  }

  startRealtime(userId: string, onError: (message: string) => void) {
    this.stopRealtime();
    const database = firestore();
    const watch = (label: string, listener: Query) => {
      this.unsubscribers.push(onSnapshot(listener, snapshot => {
        const docs = snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as Record<string, unknown>);
        if (label === 'products') {
          this.products = docs.map(product => ({
            ...product,
            image: String(product.image || product.imageUrl || ''),
            specifications: product.specifications || {}
          })) as unknown as Product[];
          const availableProducts = new Map(this.products.map(product => [product.id, product]));
          this.cart = this.cart.flatMap(item => {
            const product = availableProducts.get(item.product.id);
            if (!product) return [];
            return [{
              ...item,
              product,
              unitPrice: this.currentUser.role === 'dealer' ? product.wholesalePrice : product.retailPrice
            }];
          });
          localStorage.setItem('califnco_cart', JSON.stringify(this.cart));
        }
        if (label === 'orders') {
          this.orders = docs.map(item => {
            const data = item as unknown as Record<string, unknown>;
            const createdAt = dateString(data.createdAt);
            const address = (data.address || data.shippingAddress || {}) as Order['shippingAddress'];
            const status = data.status as OrderStatus;
            return {
              ...data,
              id: String(data.id),
              customerName: String(data.customerName || data.name || ''),
              customerEmail: String(data.customerEmail || ''),
              customerPhone: String(data.customerPhone || ''),
              role: data.role === 'dealer' ? 'dealer' : 'customer',
              items: Array.isArray(data.items) ? data.items as Order['items'] : [],
              subtotal: Number(data.subtotal ?? data.total ?? 0),
              discount: Number(data.discount || 0),
              deliveryFee: Number(data.deliveryFee || 0),
              total: Number(data.total || 0),
              status: ['Placed', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].includes(status) ? status : 'Placed',
              paymentMethod: (data.paymentMethod || 'cod') as Order['paymentMethod'],
              paymentId: String(data.razorpayPaymentId || data.paymentId || '') || undefined,
              razorpayPaymentId: String(data.razorpayPaymentId || data.paymentId || '') || undefined,
              paymentStatus: (data.paymentStatus || 'pending') as Order['paymentStatus'],
              address,
              shippingAddress: address,
              createdAt,
              updatedAt: dateString(data.updatedAt || data.createdAt),
              timeline: Array.isArray(data.timeline) ? data.timeline as Order['timeline'] : []
            } as Order;
          });
        }
        if (label === 'services') this.services = docs.map(item => ({
          ...item,
          createdAt: dateString(item.createdAt)
        })) as unknown as ServiceBooking[];
        if (label === 'notifications') this.notifications = docs.map(item => ({
          ...item,
          timestamp: dateString(item.timestamp || item.createdAt)
        })) as unknown as AppNotification[];
        if (label === 'posts') this.posts = docs.map(item => ({
          ...item,
          hashtags: Array.isArray(item.hashtags) ? item.hashtags as string[] : [],
          createdAt: dateString(item.createdAt)
        })) as unknown as MarketingPost[];
        this.notify();
      }, error => onError(`${label}: ${error.message}`)));
    };
    watch('products', query(collection(database, 'products'), orderBy('name')));
    watch('orders', query(collection(database, 'orders'), where('userId', '==', userId), orderBy('createdAt', 'desc')));
    watch('services', query(collection(database, 'services'), where('userId', '==', userId), orderBy('createdAt', 'desc')));
    watch('notifications', query(collection(database, 'notifications'), where('userId', '==', userId), orderBy('createdAt', 'desc')));
    watch('posts', query(collection(database, 'posts'), where('active', '==', true), orderBy('createdAt', 'desc')));
  }

  stopRealtime() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    this.products = [];
    this.orders = [];
    this.services = [];
    this.notifications = [];
    this.posts = [];
  }

  subscribe(callback: () => void) {
    this.listeners.push(callback);
    return () => { this.listeners = this.listeners.filter(listener => listener !== callback); };
  }
  private notify() { this.listeners.forEach(callback => callback()); }

  getDarkMode() { return this.isDarkMode; }
  toggleDarkMode() {
    this.isDarkMode = !this.isDarkMode;
    document.documentElement.classList.toggle('dark', this.isDarkMode);
    localStorage.setItem('califnco_theme', this.isDarkMode ? 'dark' : 'light');
    this.notify();
  }
  getLightboxImage() { return this.lightboxImage; }
  setLightboxImage(image: string | null) { this.lightboxImage = image; this.notify(); }
  getCurrentUser() { return this.currentUser; }

  setCurrentUser(user: UserProfile) {
    this.currentUser = user;
    this.cart = this.cart.map(item => ({
      ...item,
      unitPrice: user.role === 'dealer' ? item.product.wholesalePrice : item.product.retailPrice,
      product: this.products.find(product => product.id === item.product.id) || item.product
    }));
    localStorage.setItem('califnco_cart', JSON.stringify(this.cart));
    this.notify();
  }

  getProducts() { return this.products; }
  getCart() { return this.cart; }
  addToCart(product: Product, quantity?: number) {
    if (!product.inStock || product.stock <= 0) throw new Error('This product is currently out of stock.');
    const minQty = this.currentUser.role === 'dealer' ? product.moq : 1;
    const addQty = Math.max(quantity || minQty, minQty);
    const unitPrice = this.currentUser.role === 'dealer' ? product.wholesalePrice : product.retailPrice;
    const existing = this.cart.find(item => item.product.id === product.id);
    const targetQty = (existing?.quantity || 0) + addQty;
    if (targetQty > product.stock) throw new Error(`Only ${product.stock} units are available.`);
    if (existing) {
      existing.quantity = targetQty;
      existing.product = product;
      existing.unitPrice = unitPrice;
    } else this.cart.push({ product, quantity: addQty, unitPrice });
    this.persistCart();
  }

  updateCartQuantity(productId: string, quantity: number) {
    if (quantity <= 0) this.cart = this.cart.filter(item => item.product.id !== productId);
    else this.cart = this.cart.map(item => {
      if (item.product.id !== productId) return item;
      const nextQuantity = Math.max(quantity, this.currentUser.role === 'dealer' ? item.product.moq : 1);
      if (nextQuantity > item.product.stock && nextQuantity > item.quantity) {
        throw new Error(`Only ${item.product.stock} units of ${item.product.name} are available.`);
      }
      return { ...item, quantity: nextQuantity };
    });
    this.persistCart();
  }

  clearCart() { this.cart = []; this.persistCart(); }
  private persistCart() {
    localStorage.setItem('califnco_cart', JSON.stringify(this.cart));
    this.notify();
  }

  getCartCalculations() {
    const subtotal = this.cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const discount = this.currentUser.role === 'dealer' && subtotal > 50000 ? Math.round(subtotal * 0.05) : 0;
    const deliveryFee = subtotal > 500 || subtotal === 0 ? 0 : 99;
    return { subtotal, discount, deliveryFee, total: subtotal - discount + deliveryFee };
  }

  getOrders() { return this.orders; }

  async placeOrder(paymentMethod: 'razorpay' | 'cod' | 'dealer_credit'): Promise<string | RazorpayCheckoutOrder> {
    const user = this.currentUser;
    if (!user.uid) throw new Error('Log in before placing an order.');
    if (this.cart.length === 0) throw new Error('Your cart is empty.');
    if (!app || !functions) throw new Error('Firebase is not configured.');
    const createOrder = httpsCallable<
      { paymentMethod: 'razorpay' | 'cod' | 'dealer_credit'; items: { productId: string; quantity: number }[] },
      { orderId: string; total: number; razorpayOrderId?: string; razorpayKeyId?: string; amountPaise?: number; currency?: 'INR' }
    >(functions, 'createOrder');
    const result = await createOrder({
      paymentMethod,
      items: this.cart.map(item => ({ productId: item.product.id, quantity: item.quantity }))
    });
    const { orderId, total } = result.data;
    if (paymentMethod === 'razorpay') {
      const { razorpayOrderId, razorpayKeyId, amountPaise, currency } = result.data;
      if (!razorpayOrderId || !razorpayKeyId || !amountPaise || currency !== 'INR') {
        throw new Error('The server did not return a valid Razorpay test checkout order.');
      }
      return { orderId, total, razorpayOrderId, razorpayKeyId, amountPaise, currency };
    }
    this.clearCart();
    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (error) {
      console.warn('Order placed, but the celebration animation was unavailable.', error);
    }
    return orderId;
  }

  async verifyRazorpayPayment(orderId: string, payment: RazorpayPaymentResponse) {
    if (!functions) throw new Error('Firebase is not configured.');
    const verifyPayment = httpsCallable<
      {
        orderId: string;
        razorpayOrderId: string;
        razorpayPaymentId: string;
        razorpaySignature: string;
      },
      { orderId: string; paymentStatus: 'paid' }
    >(functions, 'verifyRazorpayPayment');
    const result = await verifyPayment({
      orderId,
      razorpayOrderId: payment.razorpay_order_id,
      razorpayPaymentId: payment.razorpay_payment_id,
      razorpaySignature: payment.razorpay_signature
    });
    if (result.data.paymentStatus !== 'paid') throw new Error('Razorpay payment has not been verified.');
    this.clearCart();
    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (error) {
      console.warn('Payment verified, but the celebration animation was unavailable.', error);
    }
  }

  async cancelRazorpayOrder(orderId: string) {
    if (!functions) throw new Error('Firebase is not configured.');
    const cancelOrder = httpsCallable<{ orderId: string }, { orderId: string; status: 'Cancelled' }>(
      functions,
      'cancelRazorpayOrder'
    );
    await cancelOrder({ orderId });
  }

  getServices() { return this.services; }
  async bookService(data: Omit<ServiceBooking, 'id' | 'userId' | 'customerName' | 'customerPhone' | 'customerEmail' | 'createdAt' | 'status'>) {
    const user = this.currentUser;
    if (!user.uid) throw new Error('Log in before booking a service.');
    const record = {
      ...data,
      userId: user.uid,
      customerName: user.name,
      customerPhone: user.phone,
      customerEmail: user.email,
      status: 'requested' as const,
      createdAt: serverTimestamp()
    };
    const service = await addDoc(collection(firestore(), 'services'), record);
    return { ...record, id: service.id, createdAt: new Date().toISOString() };
  }

  getNotifications() { return this.notifications; }
  getPosts() { return this.posts; }
  async markAllNotificationsRead() {
    const database = firestore();
    const unread = this.notifications.filter(item => !item.read);
    for (let offset = 0; offset < unread.length; offset += 450) {
      const batch = writeBatch(database);
      unread.slice(offset, offset + 450).forEach(item => {
        batch.update(doc(database, 'notifications', item.id), { read: true });
      });
      await batch.commit();
    }
    if (unread.length) {
      const updatedIds = new Set(unread.map(item => item.id));
      this.notifications = this.notifications.map(item =>
        updatedIds.has(item.id) ? { ...item, read: true } : item
      );
      this.notify();
    }
  }

  updateUserAddress(address: UserProfile['address']) {
    this.currentUser = { ...this.currentUser, address };
    this.notify();
  }
}

export const mobileStore = new MobileStoreService();
