
'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { getFirebaseAuth, initializeFirebaseClient } from '@/lib/firebase';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  userId: string | null;
  firebaseError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [firebaseInitialized, setFirebaseInitialized] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);

  useEffect(() => {
    const success = initializeFirebaseClient();
    if (success) {
      setFirebaseInitialized(true);
    } else {
      setFirebaseError(
        'La configuration de Firebase est manquante ou invalide. Veuillez vérifier votre fichier .env.local et redémarrer le serveur.'
      );
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!firebaseInitialized) return;

    const auth = getFirebaseAuth();
    if (!auth) {
        setLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user, error) => {
        if (error) {
            console.error('Auth state error:', error);
            setFirebaseError(error.message);
        }
        setUser(user);
        setUserId(user ? user.uid : null);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [firebaseInitialized]);

  const value = { user, loading, userId, firebaseError };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-16 w-16 animate-spin text-accent" />
      </div>
    );
  }

  return (
      <AuthContext.Provider value={value}>
        {firebaseError && (
             <div className="absolute top-4 right-4 z-[200] w-full max-w-md">
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Erreur Firebase</AlertTitle>
                    <AlertDescription>{firebaseError}</AlertDescription>
                </Alert>
            </div>
        )}
        {children}
      </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
