
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, initializeFirebaseClient } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userId: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);

  useEffect(() => {
    try {
      initializeFirebaseClient();
      setFirebaseInitialized(true);
    } catch (error) {
      console.error(error);
      setLoading(false); // Stop loading on initialization failure
    }
  }, []);

  useEffect(() => {
    if (!firebaseInitialized) return;

    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setUserId(user ? user.uid : null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseInitialized]);

  const value = { user, loading, userId };

  if (loading || !firebaseInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
      </div>
    );
  }
  
  if (!firebaseInitialized && !loading) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-background text-destructive p-4 text-center">
        Erreur de configuration Firebase. Vérifiez vos clés dans .env.local et redémarrez.
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
