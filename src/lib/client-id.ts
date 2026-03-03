import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";

const COUNTER_REF = "system/clientIdCounter";
const MIN_ID = 10000;
const MAX_ID = 99999;

/**
 * Generates a unique 5-digit client ID (10000–99999) using a Firestore counter.
 * Call when creating a new user so each client has a stable display ID.
 */
export async function generateClientId(): Promise<string> {
  return runTransaction(db, async (transaction) => {
    const ref = doc(db, "system", "clientIdCounter");
    // We need to read inside the transaction; Firestore transaction uses get() on the ref
    const snapshot = await transaction.get(ref);
    const next = snapshot.exists() ? (snapshot.data()?.lastUsed ?? MIN_ID - 1) + 1 : MIN_ID;
    if (next > MAX_ID) throw new Error("Client ID range exhausted");
    transaction.set(ref, { lastUsed: next }, { merge: true });
    return String(next);
  });
}
