import type { User as FirebaseUser } from "firebase/auth";

export type UserRole = "admin" | "user";
export type UserStatus = "pending" | "approved" | "deleted";

export interface UserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  password?: string | null;
  role: UserRole;
  status?: UserStatus; // Optional for backward compatibility
  createdAt?: Date;
  approvedAt?: Date;
  deletedAt?: Date;
}

export interface InventoryItem {
  id: string;
  productName: string;
  quantity: number;
  dateAdded: {
    seconds: number;
    nanoseconds: number;
  } | string;
  status: 'In Stock' | 'Out of Stock';
}

export interface ShippedItem {
  id: string;
  productName: string;
  date: {
    seconds: number;
    nanoseconds: number;
  } | string;
  shippedQty: number;
  // This is the remaining quantity in the main inventory after this shipment
  remainingQty: number; 
  packOf: number;
  unitPrice?: number;
  shipTo: string;
  remarks?: string;
}

export interface RestockHistory {
  id: string;
  productName: string;
  previousQuantity: number;
  restockedQuantity: number;
  newQuantity: number;
  restockedBy: string; // Admin name who restocked
  restockedAt: {
    seconds: number;
    nanoseconds: number;
  } | string;
}

export interface RecycledShippedItem {
  id: string;
  productName: string;
  date: {
    seconds: number;
    nanoseconds: number;
  } | string;
  shippedQty: number;
  remainingQty: number;
  packOf: number;
  shipTo: string;
  remarks?: string;
  recycledAt: {
    seconds: number;
    nanoseconds: number;
  } | string;
  recycledBy: string; // Admin name who recycled
}

export interface RecycledRestockHistory {
  id: string;
  productName: string;
  previousQuantity: number;
  restockedQuantity: number;
  newQuantity: number;
  restockedBy: string;
  restockedAt: {
    seconds: number;
    nanoseconds: number;
  } | string;
  recycledAt: {
    seconds: number;
    nanoseconds: number;
  } | string;
  recycledBy: string; // Admin name who recycled
}

export interface RecycledInventoryItem {
  id: string;
  productName: string;
  quantity: number;
  dateAdded: {
    seconds: number;
    nanoseconds: number;
  } | string;
  status: 'In Stock' | 'Out of Stock';
  recycledAt: {
    seconds: number;
    nanoseconds: number;
  } | string;
  recycledBy: string; // Admin name who recycled
  remarks?: string; // Reason for recycling
}

export interface DeleteLog {
  id: string;
  productName: string;
  quantity: number;
  dateAdded: {
    seconds: number;
    nanoseconds: number;
  } | string;
  status: 'In Stock' | 'Out of Stock';
  deletedAt: {
    seconds: number;
    nanoseconds: number;
  } | string;
  deletedBy: string; // Admin name who deleted
  reason: string; // Reason for deletion
}

export interface EditLog {
  id: string;
  productName: string;
  previousProductName?: string; // In case product name was changed
  previousQuantity: number;
  newQuantity: number;
  previousStatus: 'In Stock' | 'Out of Stock';
  newStatus: 'In Stock' | 'Out of Stock';
  dateAdded: {
    seconds: number;
    nanoseconds: number;
  } | string;
  editedAt: {
    seconds: number;
    nanoseconds: number;
  } | string;
  editedBy: string; // Admin name who edited
  reason: string; // Reason for editing
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  orderNumber: string;
  soldTo: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  fbm: string;
  items: Array<{
    quantity: number;
    productName: string;
    packaging: string;
    shipTo: string;
    unitPrice: number;
    amount: number;
  }>;
  subtotal: number;
  grandTotal: number;
  status: 'pending' | 'paid';
  createdAt: {
    seconds: number;
    nanoseconds: number;
  } | string;
  userId: string;
}

export interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}
