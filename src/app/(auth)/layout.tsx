
'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

// Ce layout vérifie si un utilisateur est déjà connecté et le redirige vers le tableau de bord.
// La protection des routes est gérée par le middleware.
function AuthLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (loading || user) {
      return (
        <div className="flex items-center justify-center min-h-screen">
            <p>Chargement de la session...</p>
        </div>
      )
  }

  return <>{children}</>;
}


export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
 return (
    <AuthLayoutContent>{children}</AuthLayoutContent>
 )
}
