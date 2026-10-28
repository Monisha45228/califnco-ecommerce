export type ProductCategory = 
  | 'purifiers' 
  | 'dispensers' 
  | 'pumps' 
  | 'filters' 
  | 'spares';

export interface ProductSpecifications {
  stages?: string;
  purificationCapacity?: string;
  storageTank?: string;
  tdsReduction?: string;
  inputTds?: string;
  warranty?: string;
  coolingCapacity?: string;
  heatingCapacity?: string;
  voltage?: string;
  maxPressure?: string;
  poreSize?: string;
  flowRate?: string;
  lifespan?: string;
  material?: string;
  [key: string]: string | undefined;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  retailPrice: number;
  wholesalePrice: number;
  moq: number; // Minimum Order Quantity for dealers
  rating: number;
  reviewsCount: number;
  inStock: boolean;
  stock: number;
  image: string;
  description: string;
  caption?: string;
  hashtags?: string[];
  specifications: ProductSpecifications;
  featured?: boolean;
}

export interface MarketingPost {
  id: string;
  title: string;
  caption: string;
  image: string;
  hashtags: string[];
  active: boolean;
  createdAt?: string;
}

export type UserRole = 'customer' | 'dealer' | 'admin';

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  createdAt?: string | Date;
  fcmToken?: string | null;
  blocked?: boolean;
  address?: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
  };
  dealerDetails?: {
    businessName: string;
    gstin: string;
    status: 'pending' | 'approved' | 'rejected';
    creditLimit?: number;
    appliedAt: string;
    approvedAt?: string;
    notes?: string;
  };
  referralCode?: string;
  referredBy?: string;
  walletBalance?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number; // retailPrice for customer, wholesalePrice for dealer
}

export type OrderStatus = 'Placed' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled';

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  image: string;
}

export interface Order {
  id: string;
  userId: string;
  customerName: string;
  name?: string;
  customerEmail: string;
  customerPhone: string;
  role: UserRole;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  address?: UserProfile['address'];
  status: OrderStatus;
  paymentMethod: 'razorpay' | 'cod' | 'dealer_credit';
  paymentId?: string;
  razorpayPaymentId?: string;
  paymentStatus: 'paid' | 'pending' | 'failed';
  shippingAddress: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    latitude?: number;
    longitude?: number;
  };
  createdAt: string;
  updatedAt: string;
  timeline: {
    status: OrderStatus;
    timestamp: string;
    note: string;
  }[];
}

export type ServiceType = 
  | 'installation'
  | 'filter_replacement'
  | 'annual_maintenance_amc'
  | 'repair_breakdown'
  | 'water_tds_testing';

export type ServiceStatus = 
  | 'requested'
  | 'assigned'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface ServiceBooking {
  id: string;
  userId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  serviceType: ServiceType;
  purifierModel?: string;
  preferredDate: string;
  preferredTimeSlot: string;
  address: {
    street: string;
    city: string;
    postalCode: string;
  };
  notes?: string;
  status: ServiceStatus;
  assignedTechnician?: {
    name: string;
    phone: string;
  };
  createdAt: string;
  charge: number;
}
