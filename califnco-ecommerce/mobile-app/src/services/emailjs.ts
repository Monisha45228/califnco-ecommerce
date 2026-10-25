/**
 * EmailJS & SMS Notification Service (Free Tier)
 * Triggers transactional notifications for orders & service requests.
 */

export interface EmailPayload {
  toEmail: string;
  toName: string;
  subject: string;
  message: string;
  orderId?: string;
  amount?: number;
}

export const sendOrderNotificationEmail = async (payload: EmailPayload): Promise<boolean> => {
  console.log('[EmailJS Notification Triggered]', {
    to: payload.toEmail,
    recipient: payload.toName,
    subject: payload.subject,
    orderId: payload.orderId,
    total: payload.amount
  });

  // Simulated EmailJS REST dispatch (or live when VITE_EMAILJS_SERVICE_ID is provided)
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (serviceId && templateId && publicKey) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_name: payload.toName,
            to_email: payload.toEmail,
            order_id: payload.orderId,
            order_total: payload.amount,
            message: payload.message
          }
        })
      });
      return response.ok;
    } catch (err) {
      console.warn('Live EmailJS dispatch failed:', err);
      return false;
    }
  }

  return true;
};
