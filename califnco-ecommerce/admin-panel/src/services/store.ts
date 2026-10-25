import {
  collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, writeBatch
} from 'firebase/firestore';
import productsData from '../data/products.json';
import { Product, Order, ServiceBooking, OrderStatus, UserProfile, MarketingPost } from '../types';
import { db } from './firebase';
import { uploadCloudinaryImage } from './cloudinary';

export type DealerApplication = UserProfile & {
  id: string;
  businessName: string;
  gstin: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: string;
  creditLimit: number;
  city: string;
  state: string;
  notes: string;
};

function firestore() {
  if (!db) throw new Error('Firebase is not configured. Set the admin-panel VITE_FIREBASE_* settings.');
  return db;
}

function dateString(value: unknown): string {
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return (value.toDate() as Date).toISOString();
  }
  if (value instanceof Date) return value.toISOString();
  return typeof value === 'string' ? value : new Date().toISOString();
}

function parseOrder(id: string, data: Record<string, unknown>): Order {
  const createdAt = dateString(data.createdAt);
  const customerName = String(data.customerName || data.name || '');
  const shippingAddress = (data.address || data.shippingAddress || {}) as Order['shippingAddress'];
  const paymentId = String(data.razorpayPaymentId || data.paymentId || '') || undefined;
  const status = data.status as OrderStatus;
  return {
    ...data,
    id,
    userId: String(data.userId || ''),
    customerName,
    customerEmail: String(data.customerEmail || ''),
    customerPhone: String(data.customerPhone || ''),
    role: data.role === 'dealer' ? 'dealer' : 'customer',
    items: Array.isArray(data.items) ? data.items as Order['items'] : [],
    subtotal: Number(data.subtotal ?? data.total ?? 0),
    discount: Number(data.discount || 0),
    deliveryFee: Number(data.deliveryFee || 0),
    total: Number(data.total || 0),
    status: ['Placed', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled'].includes(status) ? status : 'Placed',
    paymentMethod: (data.paymentMethod as Order['paymentMethod']) || 'cod',
    paymentId,
    razorpayPaymentId: paymentId,
    paymentStatus: (data.paymentStatus as Order['paymentStatus']) || 'pending',
    address: shippingAddress,
    shippingAddress,
    createdAt,
    updatedAt: dateString(data.updatedAt || data.createdAt),
    timeline: Array.isArray(data.timeline)
      ? data.timeline as Order['timeline']
      : [{ status, timestamp: createdAt, note: 'Order placed.' }]
  };
}

class AdminStore {
  private products: Product[] = [];
  private orders: Order[] = [];
  private users: UserProfile[] = [];
  private dealers: DealerApplication[] = [];
  private services: ServiceBooking[] = [];
  private posts: MarketingPost[] = [];
  private listeners: (() => void)[] = [];
  private unsubscribers: (() => void)[] = [];

  startRealtime(onError: (message: string) => void) {
    this.stopRealtime();
    const database = firestore();
    const watch = <T,>(
      label: string,
      path: string,
      apply: (items: T[]) => void,
      sortField?: string
    ) => {
      const source = sortField
        ? query(collection(database, path), orderBy(sortField, 'desc'))
        : collection(database, path);
      this.unsubscribers.push(onSnapshot(source, snapshot => {
        apply(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as T));
        this.notify();
      }, error => onError(`${label}: ${error.message}`)));
    };

    watch<Product>('products', 'products', items => {
      this.products = items.map(product => {
        const legacy = product as Product & { imageUrl?: string };
        return {
          ...product,
          image: product.image || legacy.imageUrl || '',
          imageUrl: legacy.imageUrl || product.image || '',
          specifications: product.specifications || {}
        };
      });
    });
    watch<Order>('orders', 'orders', documents => {
      this.orders = documents.map(order => parseOrder(order.id, order as unknown as Record<string, unknown>));
    }, 'createdAt');
    watch<UserProfile>('users', 'users', items => {
      this.users = items.map(user => ({
        ...user,
        uid: String(user.uid || (user as UserProfile & { id?: string }).id || '')
      })).filter(user => user.role !== 'admin');
      this.dealers = this.users.filter(user => user.role === 'dealer').map(user => ({
        ...user,
        id: user.uid,
        businessName: user.dealerDetails?.businessName || '',
        gstin: user.dealerDetails?.gstin || '',
        status: user.dealerDetails?.status || 'pending',
        appliedAt: user.dealerDetails?.appliedAt || dateString(user.createdAt),
        creditLimit: user.dealerDetails?.creditLimit || 0,
        city: user.address?.city || '',
        state: user.address?.state || '',
        notes: user.dealerDetails?.notes || ''
      }));
    });
    watch<ServiceBooking>('services', 'services', items => { this.services = items; });
    watch<MarketingPost>('posts', 'posts', items => {
      this.posts = items.map(post => ({ ...post, createdAt: dateString(post.createdAt) }));
    }, 'createdAt');
  }

  stopRealtime() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
  }

  private notify() { this.listeners.forEach(listener => listener()); }
  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(item => item !== listener); };
  }

  getProducts() { return this.products; }
  getOrders() { return this.orders; }
  getUsers() { return this.users; }
  getDealers() { return this.dealers; }
  getServices() { return this.services; }
  getPosts() { return this.posts; }

  async seedInitialCatalog() {
    const database = firestore();
    const existingProducts = await getDocs(query(collection(database, 'products'), limit(1)));
    if (!existingProducts.empty) throw new Error('Products already exist in Firestore; initial catalog import is only available for an empty collection.');
    for (let i = 0; i < productsData.length; i += 400) {
      const batch = writeBatch(database);
      (productsData.slice(i, i + 400) as Product[]).forEach(product => {
        batch.set(doc(database, 'products', product.id), {
          ...product,
          caption: product.caption || product.description,
          hashtags: product.hashtags || [],
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    }
  }

  async saveProduct(product: Product) {
    await setDoc(doc(firestore(), 'products', product.id), {
      ...product,
      imageUrl: product.image,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  async deleteProduct(id: string) {
    await deleteDoc(doc(firestore(), 'products', id));
  }

  async savePost(post: Omit<MarketingPost, 'createdAt'>) {
    const isNew = !this.posts.some(item => item.id === post.id);
    await setDoc(doc(firestore(), 'posts', post.id), {
      ...post,
      updatedAt: serverTimestamp(),
      ...(isNew ? { createdAt: serverTimestamp() } : {})
    }, { merge: true });
  }

  async deletePost(id: string) {
    await deleteDoc(doc(firestore(), 'posts', id));
  }

    async uploadProductImage(file: File, productId: string) {
    return uploadCloudinaryImage(file, `products/${productId}-${Date.now()}`);
  }

  async uploadPostImage(file: File, postId: string) {
    return uploadCloudinaryImage(file, `posts/${postId}`);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus) {
    const order = this.orders.find(item => item.id === orderId);
    if (!order) throw new Error('This order is no longer available. Refresh and try again.');
    const now = new Date().toISOString();
    await updateDoc(doc(firestore(), 'orders', orderId), {
      status,
      updatedAt: serverTimestamp(),
      timeline: [...order.timeline, { status, timestamp: now, note: `Status updated to ${status} by admin.` }]
    });
  }

  async updateUser(userId: string, changes: Partial<Pick<UserProfile, 'name' | 'phone' | 'address' | 'role' | 'blocked'>>) {
    await updateDoc(doc(firestore(), 'users', userId), changes);
  }

  async updateDealerStatus(id: string, status: 'approved' | 'rejected', notes?: string) {
    const dealer = this.dealers.find(item => item.id === id);
    if (!dealer) throw new Error('Dealer account was not found.');
    await updateDoc(doc(firestore(), 'users', id), {
      role: status === 'approved' ? 'dealer' : dealer.role,
      dealerDetails: {
        ...dealer.dealerDetails,
        status,
        appliedAt: dealer.dealerDetails?.appliedAt || dealer.appliedAt,
        reviewedAt: new Date().toISOString(),
        notes: notes || dealer.dealerDetails?.notes || ''
      }
    });
  }

  async assignTechnician(serviceId: string, techName: string, techPhone: string) {
    await updateDoc(doc(firestore(), 'services', serviceId), {
      status: 'assigned',
      assignedTechnician: { name: techName, phone: techPhone }
    });
  }

  async updateServiceStatus(serviceId: string, status: ServiceBooking['status']) {
    await updateDoc(doc(firestore(), 'services', serviceId), { status });
  }
}

export const adminStore = new AdminStore();
