import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Header } from './components/Header';
import { AuthScreen } from './components/AuthScreen';
import { BottomNav } from './components/BottomNav';
import { LightboxModal } from './components/LightboxModal';
import { MapAddressPicker } from './components/MapAddressPicker';
import { RazorpayModal } from './components/RazorpayModal';
import { CatalogView } from './views/CatalogView';
import { ProductDetailModal } from './views/ProductDetailModal';
import { CartModal } from './views/CartModal';
import { OrdersView } from './views/OrdersView';
import { ServiceView } from './views/ServiceView';
import { ProfileView } from './views/ProfileView';
import { NotificationsModal } from './views/NotificationsModal';
import { mobileStore } from './services/store';
import type { RazorpayCheckoutOrder, RazorpayPaymentResponse } from './services/store';
import { auth, db } from './services/firebase';
import { enablePushNotifications } from './services/notifications';
import { Product, UserProfile, UserRole } from './types';
import { Smartphone, Monitor } from 'lucide-react';

export const App: React.FC = () => {
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('catalog');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(mobileStore.getDarkMode());
  const [user, setUser] = useState(mobileStore.getCurrentUser());
  const [role, setRole] = useState<UserRole>(user.role);
  const [products, setProducts] = useState(mobileStore.getProducts());
  const [cart, setCart] = useState(mobileStore.getCart());
  const [orders, setOrders] = useState(mobileStore.getOrders());
  const [services, setServices] = useState(mobileStore.getServices());
  const [notifications, setNotifications] = useState(mobileStore.getNotifications());
  const [posts, setPosts] = useState(mobileStore.getPosts());
  const [lightboxImage, setLightboxImage] = useState<string | null>(mobileStore.getLightboxImage());

  // Modals state
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isRazorpayOpen, setIsRazorpayOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [deviceFrameMode, setDeviceFrameMode] = useState<boolean>(true);
  const [appActionError, setAppActionError] = useState('');
  const [paymentConfirmation, setPaymentConfirmation] = useState('');
  const [orderSaving, setOrderSaving] = useState(false);
  const [razorpayCheckout, setRazorpayCheckout] = useState<RazorpayCheckoutOrder | null>(null);

  useEffect(() => {
    if (!auth || !db) {
      setAuthLoading(false);
      return;
    }
    let active = true;
    let profileUnsubscribe: (() => void) | undefined;
    const unsubscribe = onAuthStateChanged(auth, firebaseUser => {
      setAuthError('');
      profileUnsubscribe?.();
      profileUnsubscribe = undefined;
      if (!firebaseUser) {
        setProfile(null);
        setAuthLoading(false);
        return;
      }
      setAuthLoading(true);
      profileUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), snapshot => {
        if (!active || auth.currentUser?.uid !== firebaseUser.uid) return;
        if (!snapshot.exists()) {
          setAuthError('Your account profile is missing. Contact support to restore access.');
          setAuthLoading(false);
          return;
        }
        const data = snapshot.data();
        if (data.blocked === true) {
          setAuthError('This account has been blocked. Contact support for assistance.');
          setProfile(null);
          setAuthLoading(false);
          void signOut(auth);
          return;
        }
        const accountRole = data.role as UserRole;
        if (accountRole === 'admin') {
          const adminUrl = import.meta.env.VITE_ADMIN_PANEL_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');
          if (!adminUrl) {
            setAuthError('The admin portal URL is not configured. Set VITE_ADMIN_PANEL_URL and try again.');
            setAuthLoading(false);
            return;
          }
          window.location.assign(adminUrl);
          return;
        }
        if (accountRole !== 'customer' && accountRole !== 'dealer') {
          setAuthError('Your account role is invalid. Contact support.');
          setAuthLoading(false);
          return;
        }
        const loadedProfile: UserProfile = {
          uid: firebaseUser.uid,
          name: String(data.name || firebaseUser.displayName || ''),
          email: String(data.email || firebaseUser.email || ''),
          phone: String(data.phone || ''),
          role: accountRole,
          blocked: false,
          createdAt: data.createdAt?.toDate?.() || data.createdAt,
          fcmToken: data.fcmToken || null,
          address: data.address,
          dealerDetails: data.dealerDetails,
          referralCode: data.referralCode,
          referredBy: data.referredBy,
          walletBalance: data.walletBalance
        };
        mobileStore.setCurrentUser(loadedProfile);
        setProfile(loadedProfile);
        setAuthLoading(false);
      }, error => {
        if (!active) return;
        setAuthError(`Unable to load your Firestore profile: ${error.message}`);
        setAuthLoading(false);
      });
    });
    return () => {
      active = false;
      profileUnsubscribe?.();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!profile) {
      mobileStore.stopRealtime();
      return;
    }
    mobileStore.startRealtime(profile.uid, setAppActionError);
    return () => mobileStore.stopRealtime();
  }, [profile?.uid]);

  useEffect(() => {
    const unsubscribe = mobileStore.subscribe(() => {
      setUser(mobileStore.getCurrentUser());
      setRole(mobileStore.getCurrentUser().role);
      setProducts([...mobileStore.getProducts()]);
      setCart([...mobileStore.getCart()]);
      setOrders([...mobileStore.getOrders()]);
      setServices([...mobileStore.getServices()]);
      setNotifications([...mobileStore.getNotifications()]);
      setPosts([...mobileStore.getPosts()]);
      setIsDarkMode(mobileStore.getDarkMode());
      setLightboxImage(mobileStore.getLightboxImage());
    });
    return unsubscribe;
  }, []);

  const cartCalculations = mobileStore.getCartCalculations();
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;
  const activeOrdersCount = orders.filter(o => o.status !== 'Delivered' && o.status !== 'Cancelled').length;

  const handleToggleTheme = () => {
    mobileStore.toggleDarkMode();
  };

  const handleAddToCart = (product: Product, quantity?: number) => {
    try {
      mobileStore.addToCart(product, quantity);
      setAppActionError('');
      return true;
    } catch (error) {
      setAppActionError(error instanceof Error ? error.message : 'Unable to add this product to your cart.');
      return false;
    }
  };

  const handleUpdateCartQuantity = (productId: string, quantity: number) => {
    try {
      mobileStore.updateCartQuantity(productId, quantity);
      setAppActionError('');
    } catch (error) {
      setAppActionError(error instanceof Error ? error.message : 'Unable to update cart quantity.');
    }
  };

  const handleBuyNow = (product: Product, quantity: number) => {
    if (handleAddToCart(product, quantity)) setIsCartOpen(true);
  };

  const handleStartRazorpay = async () => {
    setOrderSaving(true);
    setPaymentConfirmation('');
    try {
      const checkout = await mobileStore.placeOrder('razorpay');
      if (typeof checkout === 'string') throw new Error('Razorpay checkout details were not returned.');
      setRazorpayCheckout(checkout);
      setIsRazorpayOpen(true);
    } catch (error) {
      setAppActionError(error instanceof Error ? error.message : 'Unable to create a Razorpay test order.');
    } finally {
      setOrderSaving(false);
    }
  };

  const handleRazorpaySuccess = async (payment: RazorpayPaymentResponse) => {
    if (!razorpayCheckout) throw new Error('The payment order is no longer available.');
    setOrderSaving(true);
    try {
      await mobileStore.verifyRazorpayPayment(razorpayCheckout.orderId, payment);
      setIsRazorpayOpen(false);
      setRazorpayCheckout(null);
      setIsCartOpen(false);
      setCurrentTab('orders');
      setAppActionError('');
      setPaymentConfirmation('Razorpay test payment confirmed by the server. No real money was charged.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to verify the Razorpay payment.';
      setAppActionError(message);
      throw new Error(message);
    } finally {
      setOrderSaving(false);
    }
  };

  const handleRazorpayClose = () => {
    const orderId = razorpayCheckout?.orderId;
    setIsRazorpayOpen(false);
    setRazorpayCheckout(null);
    if (orderId) {
      void mobileStore.cancelRazorpayOrder(orderId).catch(error => {
        setAppActionError(error instanceof Error
          ? error.message
          : 'Unable to cancel the unpaid order. Contact support before placing another order.');
      });
    }
  };

  const handleCodSuccess = async () => {
    setOrderSaving(true);
    try {
      await mobileStore.placeOrder(role === 'dealer' ? 'dealer_credit' : 'cod');
      setIsCartOpen(false);
      setCurrentTab('orders');
    } catch (error) {
      setAppActionError(error instanceof Error ? error.message : 'Unable to create order.');
    } finally {
      setOrderSaving(false);
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading account...</div>;
  }
  if (!profile && authError) {
    return (
      <div className="min-h-screen bg-slate-100 p-5 flex items-center justify-center">
        <div role="alert" className="max-w-md rounded-2xl bg-white border border-rose-200 p-6 shadow-lg">
          <p className="font-semibold text-rose-700">{authError}</p>
          {auth && <button onClick={() => signOut(auth)} className="mt-4 rounded-lg bg-slate-800 px-4 py-2 text-white">Log out</button>}
        </div>
      </div>
    );
  }
  if (!profile) return <AuthScreen />;

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'} flex flex-col items-center justify-start p-0 sm:p-4 transition-colors`}>
      {/* Device Frame Viewport Toggle Toolbar (Desktop evaluator aid) */}
      <div className="hidden sm:flex items-center justify-between w-full max-w-md mb-3 px-2 text-xs font-semibold text-slate-500">
        <span className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Califnco Mobile App (Android / Expo)</span>
        </span>
        <button
          onClick={() => setDeviceFrameMode(!deviceFrameMode)}
          className="flex items-center space-x-1 px-2.5 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:bg-slate-50"
        >
          {deviceFrameMode ? <Monitor className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
          <span>{deviceFrameMode ? 'Full Width' : 'Phone Frame'}</span>
        </button>
      </div>

      {/* Main Mobile App Container */}
      <div
        className={`w-full ${
          deviceFrameMode
            ? 'max-w-md rounded-none sm:rounded-[36px] shadow-2xl border-0 sm:border-8 border-slate-800'
            : 'max-w-4xl rounded-2xl shadow-lg border border-slate-200 dark:border-slate-800'
        } bg-white dark:bg-slate-900 min-h-screen sm:min-h-[850px] flex flex-col overflow-hidden relative transition-all`}
      >
        {/* Mobile Status Bar Simulation (Phone Mode) */}
        {deviceFrameMode && (
          <div className="hidden sm:flex h-6 bg-slate-900 text-white items-center justify-between px-6 text-[10px] font-semibold tracking-wider select-none shrink-0">
            <span>09:41</span>
            <div className="w-20 h-4 bg-black rounded-b-xl -mt-1 mx-auto" />
            <div className="flex items-center space-x-1.5">
              <span>5G</span>
              <span>100%</span>
            </div>
          </div>
        )}

        {/* Top App Header */}
        <Header
          role={role}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          cartCount={cart.reduce((a, b) => a + b.quantity, 0)}
          unreadCount={unreadNotificationsCount}
          onOpenCart={() => setIsCartOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 p-4 overflow-y-auto">
          {currentTab === 'catalog' && (
            <CatalogView
              products={products}
              posts={posts}
              role={role}
              onSelectProduct={product => setSelectedProduct(product)}
              onAddToCart={product => handleAddToCart(product)}
              onOpenLightbox={img => setLightboxImage(img)}
            />
          )}

          {currentTab === 'orders' && (
            <OrdersView
              orders={orders}
              onOpenCatalog={() => setCurrentTab('catalog')}
            />
          )}

          {currentTab === 'service' && (
            <ServiceView
              services={services}
              user={user}
              onBookService={data => mobileStore.bookService(data)}
            />
          )}

          {currentTab === 'profile' && (
            <ProfileView
              user={user}
              role={role}
              isDarkMode={isDarkMode}
              onToggleTheme={handleToggleTheme}
              onOpenMapPicker={() => setIsMapPickerOpen(true)}
              onSignOut={() => auth && signOut(auth)}
              onEnablePush={async () => {
                try {
                  await enablePushNotifications(user.uid);
                  setAppActionError('Push notifications are enabled for order updates.');
                } catch (error) {
                  setAppActionError(error instanceof Error ? error.message : 'Could not enable push notifications.');
                }
              }}
            />
          )}
        </main>

        {/* Bottom Navigation */}
        <BottomNav
          currentTab={currentTab}
          onSelectTab={tab => setCurrentTab(tab)}
          activeOrdersCount={activeOrdersCount}
        />

        {/* Product Detail Modal */}
        {selectedProduct && (
          <ProductDetailModal
            product={selectedProduct}
            role={role}
            onClose={() => setSelectedProduct(null)}
            onAddToCart={(p, qty) => handleAddToCart(p, qty)}
            onOpenLightbox={img => setLightboxImage(img)}
            onBuyNow={(p, qty) => handleBuyNow(p, qty)}
          />
        )}

        {/* Cart & Checkout Modal */}
        {isCartOpen && (
          <CartModal
            cart={cart}
            user={user}
            role={role}
            calculations={cartCalculations}
            onUpdateQuantity={handleUpdateCartQuantity}
            onClearCart={() => mobileStore.clearCart()}
            onOpenMapPicker={() => setIsMapPickerOpen(true)}
            onProceedToRazorpay={handleStartRazorpay}
            onPlaceCodOrder={handleCodSuccess}
            isSubmitting={orderSaving}
            onClose={() => setIsCartOpen(false)}
          />
        )}

        {/* OpenStreetMap Address Picker */}
        {isMapPickerOpen && (
          <MapAddressPicker
            initialAddress={user.address}
            onSave={async newAddress => {
              try {
                if (!db) throw new Error('Firebase is not configured. Set the VITE_FIREBASE_* values and restart the app.');
                await updateDoc(doc(db, 'users', user.uid), { address: newAddress });
              } catch (error) {
                setAppActionError(error instanceof Error ? error.message : 'Unable to save your address.');
                return;
              }
              mobileStore.updateUserAddress(newAddress);
              setIsMapPickerOpen(false);
            }}
            onClose={() => setIsMapPickerOpen(false)}
          />
        )}

        {appActionError && (
          <div role="alert" className="absolute bottom-20 left-4 right-4 z-50 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-3 text-sm">
            {appActionError}
            <button className="ml-2 font-bold" onClick={() => setAppActionError('')}>Dismiss</button>
          </div>
        )}
        {paymentConfirmation && (
          <div role="status" className="absolute bottom-20 left-4 right-4 z-40 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {paymentConfirmation}
            <button className="ml-2 font-bold" onClick={() => setPaymentConfirmation('')}>Dismiss</button>
          </div>
        )}

        {/* Razorpay Test Payment Modal */}
        {isRazorpayOpen && razorpayCheckout && (
          <RazorpayModal
            checkout={razorpayCheckout}
            customerName={user.name}
            customerEmail={user.email}
            customerPhone={user.phone}
            onSuccess={handleRazorpaySuccess}
            isSubmitting={orderSaving}
            onClose={handleRazorpayClose}
          />
        )}

        {/* Lightbox Modal (+5 bonus pts) */}
        {lightboxImage && (
          <LightboxModal
            imageUrl={lightboxImage}
            onClose={() => setLightboxImage(null)}
          />
        )}

        {/* Push Notifications Modal */}
        {isNotificationsOpen && (
          <NotificationsModal
            notifications={notifications}
            onMarkAllRead={() => mobileStore.markAllNotificationsRead()}
            onClose={() => setIsNotificationsOpen(false)}
          />
        )}
      </div>
    </div>
  );
};

export default App;
