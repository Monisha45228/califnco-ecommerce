import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { OverviewTab } from './components/OverviewTab';
import { OrdersTab } from './components/OrdersTab';
import { DealersTab } from './components/DealersTab';
import { ServiceDeskTab } from './components/ServiceDeskTab';
import { CatalogTab } from './components/CatalogTab';
import { UsersTab } from './components/UsersTab';
import { PostsTab } from './components/PostsTab';
import { adminStore } from './services/store';
import { Bell } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from './services/firebase';
import { MarketingPost, UserProfile } from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [orders, setOrders] = useState(adminStore.getOrders());
  const [dealers, setDealers] = useState(adminStore.getDealers());
  const [services, setServices] = useState(adminStore.getServices());
  const [products, setProducts] = useState(adminStore.getProducts());
  const [users, setUsers] = useState<UserProfile[]>(adminStore.getUsers());
  const [posts, setPosts] = useState<MarketingPost[]>(adminStore.getPosts());
  const [dataError, setDataError] = useState('');

  useEffect(() => {
    adminStore.startRealtime(setDataError);
    const unsubscribe = adminStore.subscribe(() => {
      setOrders([...adminStore.getOrders()]);
      setDealers([...adminStore.getDealers()]);
      setServices([...adminStore.getServices()]);
      setProducts([...adminStore.getProducts()]);
      setUsers([...adminStore.getUsers()]);
      setPosts([...adminStore.getPosts()]);
    });
    return () => {
      unsubscribe();
      adminStore.stopRealtime();
    };
  }, []);

  const pendingDealersCount = dealers.filter(d => d.status === 'pending').length;
  const pendingOrdersCount = orders.filter(o => o.status === 'Placed').length;
  const openServicesCount = services.filter(s => s.status === 'requested' || s.status === 'assigned').length;

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-800">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        adminEmail={auth.currentUser?.email || ''}
        pendingDealersCount={pendingDealersCount}
        pendingOrdersCount={pendingOrdersCount}
        openServicesCount={openServicesCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between sticky top-0 z-30 shrink-0">
          <div>
            <h2 className="text-base font-bold text-slate-900 capitalize">
              {activeTab === 'overview' && 'Operations Dashboard'}
              {activeTab === 'orders' && 'Order Management Desk'}
              {activeTab === 'dealers' && 'Dealer Verification & Approvals'}
              {activeTab === 'services' && 'Customer Service Desk'}
              {activeTab === 'catalog' && 'Product Catalog'}
              {activeTab === 'users' && 'Customer & Dealer Accounts'}
              {activeTab === 'posts' && 'Marketing Posts'}
            </h2>
            <p className="text-xs text-slate-400">
              Califnco Water Technologies Enterprise Portal
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <button onClick={() => auth && signOut(auth)} className="text-xs font-semibold text-slate-600 hover:text-rose-700">Log out</button>
            <span className="hidden sm:inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
              Live Sync Active
            </span>

            <button 
              onClick={() => setActiveTab('dealers')}
              className="relative p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Bell className="w-4 h-4" />
              {pendingDealersCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white" />
              )}
            </button>
          </div>
        </header>

        {/* View Container */}
        <main className="p-8 flex-1">
          {dataError && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{dataError}</p>}
          {activeTab === 'overview' && (
            <OverviewTab
              orders={orders}
              dealers={dealers}
              services={services}
              products={products}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'orders' && <OrdersTab orders={orders} />}

          {activeTab === 'dealers' && <DealersTab dealers={dealers} />}

          {activeTab === 'services' && <ServiceDeskTab services={services} />}

          {activeTab === 'catalog' && <CatalogTab products={products} />}
          {activeTab === 'users' && <UsersTab users={users} />}
          {activeTab === 'posts' && <PostsTab posts={posts} />}
        </main>
      </div>
    </div>
  );
};

export default App;
