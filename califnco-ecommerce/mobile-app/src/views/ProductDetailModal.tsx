import React, { useState } from 'react';
import { X, Star, ShieldCheck, ShoppingBag, Eye, Plus, Minus, ArrowRight } from 'lucide-react';
import { Product, UserRole } from '../types';

interface ProductDetailModalProps {
  product: Product | null;
  role: UserRole;
  onClose: () => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onOpenLightbox: (imageUrl: string) => void;
  onBuyNow: (product: Product, quantity: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  role,
  onClose,
  onAddToCart,
  onOpenLightbox,
  onBuyNow
}) => {
  if (!product) return null;

  const minQty = role === 'dealer' ? product.moq : 1;
  const [quantity, setQuantity] = useState(minQty);

  const displayPrice = role === 'dealer' ? product.wholesalePrice : product.retailPrice;
  const totalPrice = displayPrice * quantity;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full overflow-hidden shadow-2xl max-h-[92vh] flex flex-col justify-between border border-slate-200 dark:border-slate-800">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md z-10">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
            {product.category}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-4 space-y-4">
          {/* Main Image with Zoom Lightbox Pill */}
          <div className="relative h-64 rounded-2xl bg-slate-100 dark:bg-slate-950 overflow-hidden">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover"
            />
            <button
              onClick={() => onOpenLightbox(product.image)}
              className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-semibold flex items-center space-x-1.5 backdrop-blur-md shadow-lg"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Tap to Zoom Lightbox</span>
            </button>
          </div>

          {/* Title & Reviews */}
          <div>
            <div className="flex items-center space-x-1.5 text-xs text-amber-500 font-bold mb-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
              <span>{product.rating}</span>
              <span className="text-slate-400">({product.reviewsCount} verified reviews)</span>
            </div>
            <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
              {product.name}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Product ID: <span className="font-mono text-slate-700 dark:text-slate-300">{product.id}</span>
            </p>
          </div>

          {/* Price Box */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold">
                {role === 'dealer' ? 'Dealer Wholesale Unit Price' : 'Retail Price'}
              </span>
              <div className="flex items-baseline space-x-2">
                <span className="text-xl font-black text-slate-900 dark:text-white">
                  ₹{displayPrice.toLocaleString('en-IN')}
                </span>
                {role === 'dealer' ? (
                  <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">
                    (Wholesale Tier)
                  </span>
                ) : null}
              </div>
            </div>

            {role === 'dealer' && (
              <span className="px-2.5 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold">
                MOQ: {product.moq} units
              </span>
            )}
          </div>

          {/* Description */}
          <div>
            {product.caption && <p className="mb-2 text-sm font-semibold text-sky-700 dark:text-sky-300">{product.caption}</p>}
            <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
              Overview
            </h4>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {product.description}
            </p>
            {product.hashtags && product.hashtags.length > 0 && <p className="mt-2 text-[10px] text-sky-600 dark:text-sky-400">{product.hashtags.map(tag => `#${tag}`).join(' ')}</p>}
          </div>

          {/* Technical Specifications */}
          {product.specifications && (
            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Technical Specifications
              </h4>
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-3 border border-slate-100 dark:border-slate-800 text-xs divide-y divide-slate-200/60 dark:divide-slate-700">
                {Object.entries(product.specifications).map(([key, val]) => (
                  <div key={key} className="py-2 flex items-center justify-between first:pt-0 last:pb-0">
                    <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-right max-w-[60%]">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quantity Controls */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Quantity {role === 'dealer' ? `(Min. ${product.moq})` : ''}
            </span>
            <div className="flex items-center space-x-3 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setQuantity(prev => Math.max(minQty, prev - 1))}
                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold shadow-sm"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="font-extrabold text-xs px-2 text-slate-900 dark:text-white">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(prev => prev + 1)}
                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center space-x-3">
          <button
            onClick={() => {
              onAddToCart(product, quantity);
              onClose();
            }}
            className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 rounded-2xl text-xs font-bold flex items-center justify-center space-x-1.5 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Add to Cart</span>
          </button>

          <button
            onClick={() => {
              onBuyNow(product, quantity);
              onClose();
            }}
            className="flex-1 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-2xl text-xs font-extrabold flex items-center justify-center space-x-1.5 shadow-md shadow-sky-600/30 transition-all"
          >
            <span>Buy Now (₹{totalPrice.toLocaleString('en-IN')})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
