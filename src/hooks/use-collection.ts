"use client";

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, Query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useCollection<T>(path: string, firestoreQuery?: Query) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }

    try {
      const collectionRef = collection(db, path);
      const q = firestoreQuery || query(collectionRef);
      
      const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const docs: T[] = [];
        querySnapshot.forEach((doc) => {
          docs.push({ id: doc.id, ...doc.data() } as T);
        });
        setData(docs);
        setLoading(false);
      }, (err) => {
        console.error(err);
        setError(err);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err : new Error("An unknown error occurred"));
      setLoading(false);
    }
  }, [path, firestoreQuery]);

  return { data, loading, error };
}
