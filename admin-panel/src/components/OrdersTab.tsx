import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Eye, 
  CheckCircle, 
  Truck, 
  Package, 
  Clock, 
  MapPin, 
  Phone, 
  Mail,
  ChevronRight,
  X
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { adminStore } from '../services/store';

interface OrdersTabProps {
  orders: Order[];
}

export const OrdersTab: React.FC<OrdersTabProps> = ({ orders }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'dealer'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.customerEmail.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || order.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setError('');
    try {
      await adminStore.updateOrderStatus(orderId, newStatus);
      if (selectedOrder?.id === orderId) {
        const updated = adminStore.getOrders().find(order => order.id === orderId);
        if (updated) setSelectedOrder(updated);
      }
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update order status.');
    }
  };

  const statusOptions: OrderStatus[] = [
    'Placed',
    'Confirmed',
    'Shipped',
    'Delivered',
    'Cancelled'
  ];

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {/* Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search Order ID, customer, email..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          {/* Role Filter */}
          <div className="flex bg-slate-100 p-1 rounded-xl text-xs">
            <button
              onClick={() => setRoleFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                roleFilter === 'all' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setRoleFilter('customer')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                roleFilter === 'customer' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
              }`}
            >
              B2C Retail
            </button>
            <button
              onClick={() => setRoleFilter('dealer')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                roleFilter === 'dealer' ? 'bg-white text-slate-900 shadow-sm font-semibold' : 'text-slate-600'
              }`}
            >
              B2B Wholesale
            </button>
          </div>

          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="all">All Statuses</option>
            {statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Order ID & Date</th>
                <th className="py-3.5 px-4">Customer / Business</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Items</th>
                <th className="py-3.5 px-4">Total Amount</th>
                <th className="py-3.5 px-4">Payment</th>
                <th className="py-3.5 px-4">Fulfillment Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No orders match your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{order.id}</p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(order.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{order.customerName}</p>
                      <p className="text-[11px] text-slate-400">{order.customerPhone}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        order.role === 'dealer'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}>
                        {order.role === 'dealer' ? 'Wholesale Bulk' : 'Retail'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-medium text-slate-700">
                        {order.items.reduce((acc, i) => acc + i.quantity, 0)} units
                      </span>
                      <p className="text-[11px] text-slate-400">({order.items.length} unique)</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">₹{order.total.toLocaleString('en-IN')}</p>
                      {order.discount > 0 && (
                        <p className="text-[10px] text-emerald-600 font-medium">Save ₹{order.discount}</p>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          order.paymentStatus === 'paid' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                        <span className="capitalize font-medium text-slate-700">
                          {order.paymentMethod.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 uppercase font-mono">{order.paymentStatus}</p>
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={order.status}
                        onChange={e => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1 border transition-all cursor-pointer ${
                          order.status === 'Delivered' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
                          order.status === 'Shipped' ? 'bg-blue-50 border-blue-300 text-blue-800' :
                          order.status === 'Confirmed' ? 'bg-sky-50 border-sky-300 text-sky-800' :
                          'bg-slate-50 border-slate-300 text-slate-800'
                        }`}
                      >
                        {statusOptions.map(st => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold inline-flex items-center space-x-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex justify-end transition-opacity">
          <div className="w-full max-w-lg bg-white h-full shadow-2xl p-6 overflow-y-auto space-y-6 flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="font-bold text-slate-900 text-base">{selectedOrder.id}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedOrder.role === 'dealer' ? 'bg-purple-100 text-purple-700' : 'bg-sky-100 text-sky-700'
                    }`}>
                      {selectedOrder.role}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Placed on {new Date(selectedOrder.createdAt).toLocaleString('en-IN')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Customer & Shipping Details */}
              <div className="py-4 border-b border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Customer & Delivery Info</h4>
                <div className="bg-slate-50 rounded-xl p-3.5 text-xs space-y-2">
                  <p className="font-semibold text-slate-800">{selectedOrder.customerName}</p>
                  <div className="flex items-center space-x-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedOrder.customerPhone}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span>{selectedOrder.customerEmail}</span>
                  </div>
                  <div className="flex items-start space-x-2 text-slate-600 pt-1 border-t border-slate-200/60">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span>
                      {selectedOrder.shippingAddress.street}, {selectedOrder.shippingAddress.city},{' '}
                      {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.postalCode}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="py-4 border-b border-slate-100 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Order Line Items ({selectedOrder.items.length})
                </h4>
                <div className="space-y-2.5">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-3 p-2 bg-slate-50/70 rounded-xl">
                      <img src={item.image} alt={item.name} className="w-12 h-12 rounded-lg object-cover border" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-xs truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.quantity} x ₹{item.unitPrice.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <p className="font-bold text-slate-900 text-xs shrink-0">
                        ₹{item.totalPrice.toLocaleString('en-IN')}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="bg-slate-50 rounded-xl p-3.5 text-xs space-y-1.5 mt-3">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span>₹{selectedOrder.subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  {selectedOrder.discount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Discount (Dealer / Promo)</span>
                      <span>-₹{selectedOrder.discount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>Delivery Fee</span>
                    <span>{selectedOrder.deliveryFee === 0 ? 'FREE' : `₹${selectedOrder.deliveryFee}`}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-200">
                    <span>Grand Total</span>
                    <span>₹{selectedOrder.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="py-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tracking Timeline</h4>
                <div className="space-y-3 pl-2 border-l-2 border-sky-400">
                  {selectedOrder.timeline.map((entry, idx) => (
                    <div key={idx} className="relative pl-4 text-xs">
                      <div className="absolute -left-[17px] top-1 w-2.5 h-2.5 rounded-full bg-sky-500 ring-4 ring-white" />
                      <p className="font-bold text-slate-800 uppercase">{entry.status}</p>
                      <p className="text-[11px] text-slate-600">{entry.note}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(entry.timestamp).toLocaleString('en-IN')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Status Update Footer */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-600">Update Status:</span>
              <div className="flex space-x-2">
                <button
                  onClick={() => void handleUpdateStatus(selectedOrder.id, 'Confirmed')}
                  className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => void handleUpdateStatus(selectedOrder.id, 'Shipped')}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Dispatch
                </button>
                <button
                  onClick={() => void handleUpdateStatus(selectedOrder.id, 'Delivered')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Deliver
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
