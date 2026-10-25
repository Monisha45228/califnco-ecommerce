import React, { useState } from 'react';
import { Package, Truck, CheckCircle2, Clock, ChevronDown, ChevronUp, MapPin, Receipt } from 'lucide-react';
import { Order } from '../types';

interface OrdersViewProps {
  orders: Order[];
  onOpenCatalog: () => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ orders, onOpenCatalog }) => {
  const [expandedId, setExpandedId] = useState<string | null>(orders[0]?.id || null);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'Delivered':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">Delivered</span>;
      case 'Shipped':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-100 text-blue-800">In Transit</span>;
      case 'Confirmed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-100 text-sky-800">Confirmed</span>;
      case 'Cancelled':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">Cancelled</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-100 text-amber-800">Placed</span>;
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div>
        <h2 className="text-base font-extrabold text-slate-900 dark:text-white">Order Tracking & History</h2>
        <p className="text-xs text-slate-500">Live order fulfillment status from warehouse to doorstep</p>
      </div>

      {orders.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 p-6">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400 flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">No orders placed yet</p>
          <p className="text-xs text-slate-400">Order from our 50+ water purifiers catalog to view tracking here.</p>
          <button
            onClick={onOpenCatalog}
            className="px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl shadow-sm"
          >
            Explore Catalog
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const isExpanded = expandedId === order.id;

            return (
              <div
                key={order.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-sm overflow-hidden transition-all"
              >
                {/* Header Summary */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-slate-900 dark:text-white text-xs">{order.id}</span>
                      {getStatusBadge(order.status)}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })} · {order.items.length} item{order.items.length > 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="font-black text-slate-900 dark:text-white text-sm">
                      ₹{order.total.toLocaleString('en-IN')}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="p-4 pt-0 border-t border-slate-100 dark:border-slate-700/60 space-y-4 text-xs">
                    {/* Fulfillment Timeline */}
                    <div className="pt-3">
                      <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-2">
                        Tracking Pipeline
                      </h4>
                      <div className="space-y-2.5 pl-2 border-l-2 border-sky-400">
                        {order.timeline.map((entry, idx) => (
                          <div key={idx} className="relative pl-3">
                            <div className="absolute -left-[15px] top-1 w-2 h-2 rounded-full bg-sky-500 ring-4 ring-white dark:ring-slate-800" />
                            <p className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[11px]">
                              {entry.status}
                            </p>
                            <p className="text-[10px] text-slate-500">{entry.note}</p>
                            <p className="text-[9px] text-slate-400">
                              {new Date(entry.timestamp).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                        Purchased Items
                      </h4>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center space-x-2.5 p-2 bg-slate-50 dark:bg-slate-700/40 rounded-xl">
                          <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-cover border" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {item.quantity} x ₹{item.unitPrice.toLocaleString('en-IN')}
                            </p>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            ₹{item.totalPrice.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Address & Payment Info */}
                    <div className="bg-slate-50 dark:bg-slate-700/40 p-3 rounded-xl space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                      <div className="flex items-center space-x-1.5 font-bold text-slate-800 dark:text-slate-200">
                        <MapPin className="w-3.5 h-3.5 text-sky-600" />
                        <span>Delivery Address</span>
                      </div>
                      <p>
                        {order.shippingAddress.street}, {order.shippingAddress.city},{' '}
                        {order.shippingAddress.state} - {order.shippingAddress.postalCode}
                      </p>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-600">
                        <span>Payment Method</span>
                        <span className="font-bold uppercase text-slate-900 dark:text-white">
                          {order.paymentMethod} ({order.paymentStatus})
                        </span>
                      </div>
                      {order.paymentMethod === 'razorpay' && order.paymentStatus === 'paid' && (
                        <div role="status" className="pt-1 text-emerald-700 dark:text-emerald-400">
                          Razorpay test payment verified · No real money charged
                          {order.razorpayPaymentId && <span className="block break-all text-[10px] text-slate-500">Payment ID: {order.razorpayPaymentId}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
