import React from 'react';
import { 
  TrendingUp, 
  Package, 
  Users, 
  Wrench, 
  Clock, 
  ArrowUpRight, 
  AlertCircle,
  CheckCircle2,
  Truck,
  Droplet
} from 'lucide-react';
import { Order, Product, ServiceBooking } from '../types';
import { DealerApplication } from '../services/store';

interface OverviewTabProps {
  orders: Order[];
  dealers: DealerApplication[];
  services: ServiceBooking[];
  products: Product[];
  setActiveTab: (tab: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  orders,
  dealers,
  services,
  products,
  setActiveTab
}) => {
  const totalRevenue = orders.reduce((sum, o) => sum + (o.status !== 'Cancelled' ? o.total : 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'Placed');
  const pendingDealers = dealers.filter(d => d.status === 'pending');
  const openServices = services.filter(s => s.status === 'requested' || s.status === 'assigned');
  const lowStockProducts = products.filter(p => p.stock < 50);

  const customerOrdersCount = orders.filter(o => o.role === 'customer').length;
  const dealerOrdersCount = orders.filter(o => o.role === 'dealer').length;

  return (
    <div className="space-y-6">
      {/* Alert Banner if pending dealers */}
      {pendingDealers.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 text-sm">
                {pendingDealers.length} Wholesale Dealer Application{pendingDealers.length > 1 ? 's' : ''} Awaiting Approval
              </p>
              <p className="text-xs text-slate-600">
                Review business GSTIN documents to unlock dealer wholesale pricing tiers.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('dealers')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
          >
            Review Applications
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross Volume</span>
            <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">₹{totalRevenue.toLocaleString('en-IN')}</h3>
            <p className="text-xs text-emerald-600 font-medium flex items-center mt-1">
              <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
              <span>Includes B2B wholesale bulk</span>
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Orders</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">{orders.length}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {customerOrdersCount} Retail · {dealerOrdersCount} Wholesale Bulk
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Dealers</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">
              {dealers.filter(d => d.status === 'approved').length}
            </h3>
            <p className="text-xs text-amber-600 font-medium mt-1">
              {pendingDealers.length} verification requests pending
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Service Desk</span>
            <div className="w-9 h-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-bold text-slate-900">{openServices.length}</h3>
            <p className="text-xs text-slate-500 mt-1">Active customer service calls</p>
          </div>
        </div>
      </div>

      {/* Grid: Recent Orders & Service Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders List (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Recent Orders</h3>
              <p className="text-xs text-slate-500">Live feed from Mobile App and Dealer portal</p>
            </div>
            <button
              onClick={() => setActiveTab('orders')}
              className="text-xs font-semibold text-sky-600 hover:text-sky-700 hover:underline"
            >
              View all orders &rarr;
            </button>
          </div>

          <div className="space-y-3">
            {orders.slice(0, 4).map(order => (
              <div 
                key={order.id}
                className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200 bg-slate-50/50 flex items-center justify-between transition-all"
              >
                <div className="flex items-center space-x-3.5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-xs ${
                    order.role === 'dealer'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-sky-100 text-sky-700'
                  }`}>
                    {order.role === 'dealer' ? 'B2B' : 'B2C'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-800 text-sm">{order.id}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-600">{order.customerName}</span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {order.items.length} item{order.items.length > 1 ? 's' : ''} · {order.paymentMethod.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">₹{order.total.toLocaleString('en-IN')}</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase mt-0.5 ${
                    order.status === 'Delivered' ? 'bg-emerald-100 text-emerald-700' :
                    order.status === 'Shipped' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'Confirmed' ? 'bg-sky-100 text-sky-700' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Operations Sidebar (1 Col) */}
        <div className="space-y-6">
          {/* Quick System Status */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-base mb-4">Operations Status</h3>
            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="text-slate-600">Razorpay Test Gateway</span>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-semibold">Sandbox · server keys required</span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="text-slate-600">Product Catalog</span>
                <span className="px-2 py-0.5 bg-sky-100 text-sky-700 rounded font-semibold">52 Products Seeded</span>
              </div>
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="text-slate-600">OpenStreetMap Geocoding</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold">Zero-Cost Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">AI Daily Poster (n8n/Py)</span>
                <span className="px-2 py-0.5 bg-violet-100 text-violet-700 rounded font-semibold">Ready</span>
              </div>
            </div>
          </div>

          {/* Low Stock Warning */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 text-base mb-3 flex items-center justify-between">
              <span>Inventory Watch</span>
              <span className="text-xs text-amber-600 font-medium">{lowStockProducts.length} low stock</span>
            </h3>
            <div className="space-y-2.5">
              {lowStockProducts.slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center justify-between text-xs py-1">
                  <div className="truncate pr-2">
                    <p className="font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-400 capitalize">{p.category}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-bold shrink-0">
                    {p.stock} left
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
