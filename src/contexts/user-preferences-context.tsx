
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';

export type ISP = 'Orange' | 'Topnet' | 'Ooredoo' | 'TT' | 'Hexabyte';

interface UserPreferences {
  isp: ISP | null;
  stegRef: string | null;
  sonedeRef: string | null;
}

interface UserPreferencesContextType extends UserPreferences {
  setIsp: (isp: ISP) => void;
  setStegRef: (ref: string) => void;
  setSonedeRef: (ref: string) => void;
  savePreferences: () => Promise<void>;
  loading: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

const getInitialState = (): UserPreferences => ({
  isp: null,
  stegRef: null,
  sonedeRef: null,
});

export const UserPreferencesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userId } = useAuth();
  
  const [preferences, setPreferences] = useState<UserPreferences>(getInitialState());
  const [loading, setLoading] = useState(true);

  const getLocalStorageKey = useCallback(() => {
    return userId ? `lawra9-prefs-${userId}` : null;
  }, [userId]);

  useEffect(() => {
    const key = getLocalStorageKey();
    if (key) {
      setLoading(true);
      try {
        const storedPrefs = localStorage.getItem(key);
        if (storedPrefs) {
          setPreferences(JSON.parse(storedPrefs));
        } else {
           setPreferences(getInitialState());
        }
      } catch (error) {
        console.error("Failed to load user preferences from local storage", error);
        setPreferences(getInitialState());
      } finally {
        setLoading(false);
      }
    } else if (!userId) {
        // Handle logout case
        setPreferences(getInitialState());
        setLoading(false);
    }
  }, [userId, getLocalStorageKey]);
  
  const setIsp = (isp: ISP) => {
    setPreferences(p => ({ ...p, isp }));
  };

  const setStegRef = (ref: string) => {
    setPreferences(p => ({ ...p, stegRef: ref }));
  };

  const setSonedeRef = (ref: string) => {
    setPreferences(p => ({ ...p, sonedeRef: ref }));
  };
  
  const savePreferences = async () => {
    const key = getLocalStorageKey();
    if (key) {
        try {
            localStorage.setItem(key, JSON.stringify(preferences));
        } catch(error) {
            console.error("Failed to save preferences", error);
            throw error;
        }
    }
  };

  const value = {
    ...preferences,
    setIsp,
    setStegRef,
    setSonedeRef,
    savePreferences,
    loading,
  };

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
};

export const useUserPreferences = () => {
  const context = useContext(UserPreferencesContext);
  if (context === undefined) {
    throw new Error('useUserPreferences must be used within a UserPreferencesProvider');
  }
  return context;
};
