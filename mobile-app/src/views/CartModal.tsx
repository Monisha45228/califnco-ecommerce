import React, { useState } from 'react';
import { X, Trash2, Plus, Minus, MapPin, ShieldCheck, ArrowRight, ShoppingBag, Loader2 } from 'lucide-react';
import { CartItem, UserProfile, UserRole } from '../types';

interface CartModalProps {
  cart: CartItem[];
  user: UserProfile;
  role: UserRole;
  calculations: {
    subtotal: number;
    discount: number;
    deliveryFee: number;
    total: number;
  };
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onClearCart: () => void;
  onOpenMapPicker: () => void;
  onProceedToRazorpay: () => void | Promise<void>;
  onPlaceCodOrder: () => void;
  isSubmitting: boolean;
  onClose: () => void;
}

export const CartModal: React.FC<CartModalProps> = ({
  cart,
  user,
  role,
  calculations,
  onUpdateQuantity,
  onClearCart,
  onOpenMapPicker,
  onProceedToRazorpay,
  onPlaceCodOrder,
  isSubmitting,
  onClose
}) => {
  const [paymentChoice, setPaymentChoice] = useState<'razorpay' | 'cod' | 'dealer_credit'>('razorpay');

  const handleCheckout = () => {
    if (paymentChoice === 'razorpay') {
      void onProceedToRazorpay();
    } else {
      void onPlaceCodOrder();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl max-h-[92vh] flex flex-col justify-between border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-4 h-4 text-sky-600 dark:text-sky-400" />
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm">
              Your Cart ({cart.reduce((a, b) => a + b.quantity, 0)} items)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-4">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">Your cart is empty</p>
              <p className="text-xs text-slate-400">Explore 50+ water purifiers and filters to get started!</p>
            </div>
          ) : (
            <>
              {/* Items List */}
              <div className="space-y-3">
                {cart.map(item => (
                  <div
                    key={item.product.id}
                    className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center space-x-3"
                  >
                    <img
                      src={item.product.image}
                      alt={item.product.name}
                      className="w-16 h-16 rounded-xl object-cover shrink-0 border"
                    />

                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                        {item.product.name}
                      </h4>
                      <p className="text-[11px] text-sky-600 dark:text-sky-400 font-bold mt-0.5">
                        ₹{item.unitPrice.toLocaleString('en-IN')}{' '}
                        <span className="text-[10px] text-slate-400 font-normal">/ unit</span>
                      </p>

                      {/* Quantity Selector */}
                      <div className="flex items-center space-x-2 mt-2">
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity - 1)}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border flex items-center justify-center font-bold text-xs"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 dark:text-white px-1">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.product.id, item.quantity + 1)}
                          className="w-6 h-6 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border flex items-center justify-center font-bold text-xs"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        <span className="text-[10px] text-slate-400 ml-auto">
                          ₹{(item.unitPrice * item.quantity).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Address Preview (OpenStreetMap) */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>Delivery Location</span>
                  </div>
                  <button
                    onClick={onOpenMapPicker}
                    className="text-[11px] font-bold text-sky-600 hover:underline"
                  >
                    Change Pin &rarr;
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {user.address ? (
                    `${user.address.street}, ${user.address.city}, ${user.address.state} - ${user.address.postalCode}`
                  ) : (
                    'Add your complete delivery address before checkout.'
                  )}
                </p>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Select Payment Method
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => setPaymentChoice('razorpay')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      paymentChoice === 'razorpay'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <p className="font-bold">Razorpay Test</p>
                    <p className="text-[10px] text-slate-400">Cards, UPI, NetBanking</p>
                  </button>

                  <button
                    onClick={() => setPaymentChoice(role === 'dealer' ? 'dealer_credit' : 'cod')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      paymentChoice !== 'razorpay'
                        ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-bold'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <p className="font-bold">{role === 'dealer' ? 'Dealer Credit' : 'Cash on Delivery'}</p>
                    <p className="text-[10px] text-slate-400">
                      {role === 'dealer' ? '30-Day B2B Invoice' : 'Doorstep Pay'}
                    </p>
                  </button>
                </div>
              </div>

              {/* Bill Details */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Subtotal</span>
                  <span>₹{calculations.subtotal.toLocaleString('en-IN')}</span>
                </div>
                {calculations.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                    <span>Wholesale Bulk Tier Discount (5%)</span>
                    <span>-₹{calculations.discount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Delivery Charges</span>
                  <span>{calculations.deliveryFee === 0 ? 'FREE' : `₹${calculations.deliveryFee}`}</span>
                </div>
                <div className="flex justify-between text-slate-900 dark:text-white font-extrabold text-sm pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>To Pay</span>
                  <span>₹{calculations.total.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Checkout Button */}
        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <button
              onClick={handleCheckout}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-700 hover:to-cyan-600 text-white rounded-2xl text-xs font-black flex items-center justify-center space-x-2 shadow-lg shadow-sky-500/25 transition-all disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <span>
                {paymentChoice === 'razorpay' ? 'Proceed to Razorpay Test' : 'Confirm Order'} · ₹
                {calculations.total.toLocaleString('en-IN')}
              </span>}
              {!isSubmitting && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
