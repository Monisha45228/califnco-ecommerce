import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
import { RazorpayCheckoutOrder, RazorpayPaymentResponse } from '../services/store';

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayPaymentResponse) => void;
  modal: { ondismiss: () => void };
}

interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, handler: (response: { error?: { description?: string; reason?: string } }) => void) => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let checkoutScript: Promise<void> | undefined;

function loadRazorpayCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScript) {
    checkoutScript = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        checkoutScript = undefined;
        reject(new Error('Unable to load Razorpay Checkout. Check your connection and try again.'));
      };
      document.body.appendChild(script);
    });
  }
  return checkoutScript;
}

interface RazorpayModalProps {
  checkout: RazorpayCheckoutOrder;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  onSuccess: (payment: RazorpayPaymentResponse) => Promise<void>;
  isSubmitting: boolean;
  onClose: () => void;
}

export const RazorpayModal: React.FC<RazorpayModalProps> = ({
  checkout,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  isSubmitting,
  onClose
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentResponse, setPaymentResponse] = useState<RazorpayPaymentResponse | null>(null);
  const completed = useRef(false);
  const closeRequested = useRef(false);
  const checkoutInstance = useRef<RazorpayInstance | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onCloseRef = useRef(onClose);
  onSuccessRef.current = onSuccess;
  onCloseRef.current = onClose;

  useEffect(() => {
    let active = true;
    const openCheckout = async () => {
      try {
        await loadRazorpayCheckout();
        if (!active || !window.Razorpay) return;
        const instance = new window.Razorpay({
          key: checkout.razorpayKeyId,
          amount: checkout.amountPaise,
          currency: checkout.currency,
          name: 'Califnco Water Technologies',
          description: `Order ${checkout.orderId}`,
          order_id: checkout.razorpayOrderId,
          prefill: { name: customerName, email: customerEmail, contact: customerPhone },
          theme: { color: '#0284c7' },
          handler: payment => {
            setPaymentResponse(payment);
            setError('');
            void onSuccessRef.current(payment).then(() => {
              completed.current = true;
            }).catch(reason => {
              setError(reason instanceof Error ? reason.message : 'Payment verification is pending. Retry verification.');
            });
          },
          modal: {
            ondismiss: () => {
              if (!completed.current && !closeRequested.current) {
                closeRequested.current = true;
                onCloseRef.current();
              }
            }
          }
        });
        checkoutInstance.current = instance;
        instance.on('payment.failed', response => {
          setError(response.error?.description || response.error?.reason || 'Payment failed. You can retry or close checkout.');
        });
        setIsLoading(false);
        instance.open();
      } catch (reason) {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Unable to open Razorpay Checkout.');
          setIsLoading(false);
        }
      }
    };
    void openCheckout();
    return () => { active = false; };
  }, [checkout, customerEmail, customerName, customerPhone]);

  const retryVerification = () => {
    if (!paymentResponse) return;
    setError('');
    void onSuccessRef.current(paymentResponse).then(() => {
      completed.current = true;
    }).catch(reason => {
      setError(reason instanceof Error ? reason.message : 'Payment verification is pending. Retry verification.');
    });
  };

  const close = () => {
    if (completed.current || closeRequested.current) return;
    closeRequested.current = true;
    checkoutInstance.current?.close();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Razorpay test checkout</h2>
              <p className="text-xs text-slate-500">Order {checkout.orderId}</p>
            </div>
          </div>
          <button aria-label="Close checkout" onClick={close} className="text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-5 text-2xl font-extrabold text-slate-900 dark:text-white">
          ₹{checkout.total.toLocaleString('en-IN')}
        </p>
        <p className="mt-1 text-xs text-slate-500">Sandbox test payment only; no real money is charged. Confirmation appears after server-side verification.</p>

        {isLoading && (
          <p className="mt-5 flex items-center gap-2 text-sm text-sky-700">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading secure Razorpay Checkout…
          </p>
        )}
        {isSubmitting && (
          <p className="mt-5 flex items-center gap-2 text-sm text-sky-700">
            <Loader2 className="w-4 h-4 animate-spin" /> Verifying payment with the server…
          </p>
        )}
        {error && (
          <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
            {paymentResponse && (
              <button onClick={retryVerification} disabled={isSubmitting} className="ml-2 font-bold underline">
                Retry verification
              </button>
            )}
          </div>
        )}

        <button
          onClick={close}
          disabled={isSubmitting}
          className="mt-6 w-full rounded-xl border border-slate-200 dark:border-slate-700 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50"
        >
          {paymentResponse ? 'Close' : 'Cancel payment'}
        </button>
      </div>
    </div>
  );
};
