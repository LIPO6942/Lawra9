
'use client';

import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import React, { useEffect } from 'react';

const PaperworkIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

function AuthLayout({
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
        <div className="flex items-center justify-center min-h-screen bg-card">
             <div className="flex flex-col items-center gap-2">
                <PaperworkIcon className="h-8 w-8 text-primary animate-pulse"/>
                <p className="text-muted-foreground text-sm mt-2">Chargement de la session...</p>
            </div>
        </div>
      )
  }

  return <>{children}</>;
}


export default AuthLayout;
