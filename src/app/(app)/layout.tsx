
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { UserPreferencesProvider } from '@/contexts/user-preferences-context';
import { DocumentProvider } from '@/contexts/document-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LayoutDashboard, Files, History, Home, Settings, LogOut, User as UserIcon, LifeBuoy, Moon, Sun } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { Separator } from '@/components/ui/separator';

const PaperworkIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

const mainNavItems = [
    { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/documents', label: 'Documents', icon: Files },
];

const secondaryNavItems = [
    { href: '/historique', label: 'Historique', icon: History },
    { href: '/maison', label: 'Espace Maison', icon: Home },
];

function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    try {
        await signOut(auth);
        toast({ title: "Déconnexion réussie." });
        router.push('/login');
    } catch (error) {
        toast({ variant: 'destructive', title: "Erreur lors de la déconnexion." });
    }
  }

  const getInitials = (name?: string | null, email?: string | null) => {
    if (name) {
      const names = name.split(' ');
      const initials = names.map(n => n[0]).join('');
      return (initials.length > 2 ? initials.substring(0, 2) : initials).toUpperCase();
    }
    return email ? email[0].toUpperCase() : 'U';
  }

  if (loading || !user) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center gap-4">
                <PaperworkIcon className="h-10 w-10 text-primary animate-pulse"/>
                <p className="text-muted-foreground">Chargement de votre espace...</p>
            </div>
        </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen w-full bg-background text-foreground flex">
          {/* Sidebar Navigation */}
          <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
             <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
                <Link href="/dashboard" className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base">
                    <PaperworkIcon className="h-4 w-4 transition-all group-hover:scale-110" />
                    <span className="sr-only">Lawra9</span>
                </Link>
                {mainNavItems.map(item => (
                    <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                            <Link href={item.href} className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8",
                                pathname.startsWith(item.href) && "bg-accent text-accent-foreground"
                            )}>
                                <item.icon className="h-5 w-5" />
                                <span className="sr-only">{item.label}</span>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                ))}
             </nav>
             <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
                 {secondaryNavItems.map(item => (
                    <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                            <Link href={item.href} className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8",
                                pathname.startsWith(item.href) && "bg-accent text-accent-foreground"
                            )}>
                                <item.icon className="h-5 w-5" />
                                <span className="sr-only">{item.label}</span>
                            </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                 ))}
                 <Separator className="w-4/5 my-2"/>
                 <Tooltip>
                    <TooltipTrigger asChild>
                         <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9 md:h-8 md:w-8" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                            <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                            <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                            <span className="sr-only">Changer de thème</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Thème</TooltipContent>
                 </Tooltip>
                 <Tooltip>
                    <TooltipTrigger asChild>
                       <Link href="/settings" className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8">
                           <Settings className="h-5 w-5" />
                           <span className="sr-only">Paramètres</span>
                       </Link>
                    </TooltipTrigger>
                    <TooltipContent side="right">Paramètres</TooltipContent>
                 </Tooltip>
             </nav>
          </aside>
          
          <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14 flex-1">
              <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                 <div className="flex-1">
                 </div>

                 <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="overflow-hidden rounded-full h-9 w-9">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "User"} />
                                    <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{user.displayName || 'Utilisateur'}</p>
                                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                                <Link href="/settings"><UserIcon className="mr-2 h-4 w-4" /><span>Profil</span></Link>
                            </DropdownMenuItem>
                             <DropdownMenuItem asChild>
                                <Link href="#"><LifeBuoy className="mr-2 h-4 w-4" /><span>Support</span></Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSignOut}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Se déconnecter</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                 </div>
              </header>

              <main className="flex-1 items-start p-4 sm:px-6 sm:py-0">{children}</main>
              
              {/* Mobile Bottom Bar */}
              <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around">
                {[...mainNavItems, ...secondaryNavItems].map(item => (
                     <Link key={`mobile-${item.href}`} href={item.href} className={cn(
                        "flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground transition-colors hover:text-foreground",
                        pathname.startsWith(item.href) && "text-primary"
                    )}>
                        <item.icon className="h-5 w-5" />
                        <span className="text-xs font-medium">{item.label}</span>
                    </Link>
                ))}
                <Link href="/settings" className={cn(
                    "flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground transition-colors hover:text-foreground",
                     pathname.startsWith('/settings') && "text-primary"
                )}>
                    <Settings className="h-5 w-5" />
                    <span className="text-xs font-medium">Paramètres</span>
                </Link>
              </nav>
              <div className="sm:hidden h-16" /> {/* Spacer for bottom nav */}
          </div>
      </div>
    </TooltipProvider>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  if (loading || !user) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
             <div className="flex flex-col items-center gap-4">
                <PaperworkIcon className="h-10 w-10 text-primary animate-pulse"/>
                <p className="text-muted-foreground">Chargement de la session...</p>
            </div>
        </div>
    );
  }
  
  return <AppLayout>{children}</AppLayout>;
}

export default function AppLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <UserPreferencesProvider>
            <DocumentProvider>
                <ProtectedLayout>{children}</ProtectedLayout>
            </DocumentProvider>
        </UserPreferencesProvider>
    )
}
