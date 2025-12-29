'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, onSnapshot, query, Timestamp } from 'firebase/firestore';
import { useAuth } from './auth-context';

interface LearnedProduct {
    productKey: string;
    storeName: string;
    quantity: number;
    updatedAt: any;
}

interface LearningContextType {
    learnedMap: Record<string, number>;
    getLearnedPackQty: (productKey: string, storeName?: string) => number | undefined;
    learnPackQty: (productKey: string, qty: number, storeName?: string) => Promise<void>;
}

const LearningContext = createContext<LearningContextType | undefined>(undefined);

export const LearningProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [learnedMap, setLearnedMap] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!user) {
            setLearnedMap({});
            return;
        }

        // Listen to the user's learned products collection
        const q = query(collection(db, 'users', user.uid, 'learned_products'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const newMap: Record<string, number> = {};
            snapshot.forEach((doc) => {
                const data = doc.data() as LearnedProduct;
                newMap[doc.id] = data.quantity;
            });
            setLearnedMap(newMap);
        });

        return () => unsubscribe();
    }, [user]);

    const getLearnedPackQty = useCallback((productKey: string, storeName?: string) => {
        const storeKey = `${storeName || 'ALL'}|${productKey}`;
        return learnedMap[storeKey] ?? learnedMap[productKey];
    }, [learnedMap]);

    const learnPackQty = useCallback(async (productKey: string, qty: number, storeName?: string) => {
        if (!user || !productKey || !Number.isFinite(qty) || qty <= 1) return;

        const storeKey = `${storeName || 'ALL'}|${productKey}`;
        const data: LearnedProduct = {
            productKey,
            storeName: storeName || 'ALL',
            quantity: qty,
            updatedAt: Timestamp.now(),
        };

        try {
            // Save store-specific key
            await setDoc(doc(db, 'users', user.uid, 'learned_products', storeKey), data);

            // Also save global fallback if this is the highest quantity seen for this product
            if (!learnedMap[productKey] || learnedMap[productKey] < qty) {
                await setDoc(doc(db, 'users', user.uid, 'learned_products', productKey), {
                    ...data,
                    storeName: 'ALL'
                });
            }
        } catch (error) {
            console.error('[Learning] Error saving to Firestore:', error);
        }
    }, [user, learnedMap]);

    return (
        <LearningContext.Provider value={{ learnedMap, getLearnedPackQty, learnPackQty }}>
            {children}
        </LearningContext.Provider>
    );
};

export const useLearning = () => {
    const context = useContext(LearningContext);
    if (!context) {
        throw new Error('useLearning must be used within a LearningProvider');
    }
    return context;
};
