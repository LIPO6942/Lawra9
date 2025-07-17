
'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// This component acts as a gatekeeper for the root URL.
export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  // Render a loading state while checking auth status
  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Chargement...</p>
    </div>
  );
}
