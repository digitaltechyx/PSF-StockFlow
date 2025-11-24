"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { UserProfile, AuthContextType } from "@/types";

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    // Set up auth state listener
    // onAuthStateChanged fires immediately with the current user if authenticated
    const unsubscribeAuth = onAuthStateChanged(
      auth,
      async (fbUser) => {
      setUser(fbUser);
        setAuthInitialized(true);
      if (!fbUser) {
          setUserProfile(null);
          setLoading(false);
        }
        // If user exists, profile will be loaded in the next useEffect
      },
      (error) => {
        console.error("Auth state error:", error);
        setUser(null);
        setUserProfile(null);
        setAuthInitialized(true);
        setLoading(false);
      }
    );
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    // Only proceed if auth has been initialized
    if (!authInitialized) {
      return;
    }

    if (user) {
      setLoading(true); // Set loading to true while fetching profile
      const unsubProfile = onSnapshot(
        doc(db, "users", user.uid),
        (docSnapshot) => {
          if (docSnapshot.exists()) {
            setUserProfile({ uid: user.uid, ...docSnapshot.data() } as UserProfile);
        } else {
          setUserProfile(null);
        }
        setLoading(false);
        },
        (error) => {
          console.error("Error fetching user profile:", error);
          setUserProfile(null);
          setLoading(false);
        }
      );
      return () => unsubProfile();
    } else {
      // If user is null, ensure loading is false
      setUserProfile(null);
      setLoading(false);
    }
  }, [user, authInitialized]);

  const signOut = async () => {
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
