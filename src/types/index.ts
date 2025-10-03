import type { User as FirebaseUser } from "firebase/auth";

export type UserRole = "admin" | "user";

export interface UserProfile {
  uid: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: UserRole;
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

export interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}
