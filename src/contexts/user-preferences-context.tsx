
'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './auth-context';

export type ISP = 'Orange' | 'Topnet' | 'Ooredoo' | 'TT' | 'Hexabyte';

interface UserPreferences {
  isp: ISP | null;
  stegRef: string | null;
  sonedeRef: string | null;
  adslNumber: string | null;
}

interface UserPreferencesContextType extends UserPreferences {
  savePreferences: (newPrefs: UserPreferences) => Promise<void>;
  loading: boolean;
}

const UserPreferencesContext = createContext<UserPreferencesContextType | undefined>(undefined);

const getInitialState = (): UserPreferences => ({
  isp: null,
  stegRef: null,
  sonedeRef: null,
  adslNumber: null,
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
    } else if (userId === null) { // Explicitly check for logout/not logged in
        setPreferences(getInitialState());
        setLoading(false);
    }
  }, [userId, getLocalStorageKey]);
  
  const savePreferences = async (newPrefs: UserPreferences) => {
    const key = getLocalStorageKey();
    if (key) {
        try {
            // Update state first, then save to localStorage
            setPreferences(newPrefs);
            localStorage.setItem(key, JSON.stringify(newPrefs));
        } catch(error) {
            console.error("Failed to save preferences", error);
            throw error;
        }
    }
  };

  const value = {
    ...preferences,
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
