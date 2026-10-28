import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  Users, 
  Wrench, 
  Droplets, 
  ExternalLink,
  ShieldCheck,
  Activity,
  Megaphone
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  adminEmail: string;
  pendingDealersCount: number;
  pendingOrdersCount: number;
  openServicesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  adminEmail,
  pendingDealersCount,
  pendingOrdersCount,
  openServicesCount
}) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders Desk', icon: Package, badge: pendingOrdersCount },
    { id: 'dealers', label: 'Dealer Approvals', icon: Users, badge: pendingDealersCount, alert: pendingDealersCount > 0 },
    { id: 'services', label: 'Service Desk', icon: Wrench, badge: openServicesCount },
    { id: 'catalog', label: 'Product Catalog', icon: Droplets },
    { id: 'users', label: 'Customers & Dealers', icon: Users },
    { id: 'posts', label: 'Marketing Posts', icon: Megaphone }
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col justify-between shrink-0 border-r border-slate-800 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
            <Droplets className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Califnco</h1>
            <p className="text-xs text-sky-400 font-medium">Water Tech Admin Desk</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-4 space-y-1.5">
          {menuItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`px-2 py-0.5 text-xs rounded-full font-semibold ${
                      isActive
                        ? 'bg-white text-sky-700'
                        : item.alert
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="bg-slate-800/80 rounded-lg p-3 text-xs border border-slate-700/60">
          <div className="flex items-center justify-between text-slate-300 font-medium mb-1">
            <span className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Vercel Live Ready</span>
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-[11px] text-slate-400">Firebase Auth protected</p>
        </div>

        <div className="flex items-center space-x-3 px-2 py-1">
          <div className="w-8 h-8 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold text-xs">
            CA
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-semibold text-white truncate">{adminEmail}</p>
            <p className="text-[10px] text-slate-400 truncate">Operations Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
};
