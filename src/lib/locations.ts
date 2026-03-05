import { collection, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Location } from "@/types";

const COLLECTION = "locations";

export async function createLocation(name: string): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    name: name.trim(),
    active: true,
    createdAt: new Date(),
  });
  return ref.id;
}

export async function removeLocation(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}

export async function updateLocation(id: string, data: { name?: string; active?: boolean }): Promise<void> {
  await updateDoc(doc(db, COLLECTION, id), data as Record<string, unknown>);
}

/** Map Firestore doc to Location (doc id = location id) */
export function docToLocation(docData: { id: string } & Record<string, unknown>): Location {
  return {
    id: docData.id,
    name: String(docData.name ?? ""),
    active: Boolean(docData.active !== false),
    createdAt: docData.createdAt instanceof Date ? docData.createdAt : undefined,
  };
}
