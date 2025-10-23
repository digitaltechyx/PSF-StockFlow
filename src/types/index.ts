import type { User as FirebaseUser } from "firebase/auth";

export type UserRole = "admin" | "user";
export type UserStatus = "pending" | "approved" | "deleted";

export interface UserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: UserRole;
  status?: UserStatus; // Optional for backward compatibility
  createdAt?: Date;
  approvedAt?: Date;
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
}

export interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}
