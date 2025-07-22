
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import { UserPreferencesProvider, useUserPreferences, ISP } from '@/contexts/user-preferences-context';
import { DocumentProvider } from '@/contexts/document-context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LayoutDashboard, Files, History, Home, Settings, LogOut, User as UserIcon, LifeBuoy, Moon, Sun, Zap, Droplets, Wifi, BarChartHorizontal } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { Separator } from '@/components/ui/separator';

const PaperworkIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

const mainNavItems = [
    { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/documents', label: 'Documents', icon: Files },
    { href: '/historique', label: 'Historique', icon: History },
    { href: '/stats', label: 'Statistiques', icon: BarChartHorizontal },
    { href: '/maison', label: 'Espace Maison', icon: Home },
];

const providerDetails: Record<ISP, { name: string; link: string; className: string; icon: React.ElementType }> = {
    'Orange': { name: 'Orange', link: 'https://www.orange.tn/paiement-de-factures', className: 'border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400', icon: Wifi },
    'Ooredoo': { name: 'Ooredoo', link: 'https://www.ooredoo.tn/Personal/fr/content/367-facture-express', className: 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400', icon: Wifi },
    'Topnet': { name: 'Topnet', link: 'https://www.topnet.tn/paiement_express/paiement-express', className: 'border-blue-600/50 bg-blue-600/10 hover:bg-blue-600/20 text-blue-500 dark:text-blue-400', icon: Wifi },
    'TT': { name: 'Tunisie Telecom', link: 'https://mytt.tunisietelecom.tn/anonymous/paiement-facture', className: 'border-gray-500/50 bg-gray-500/10 hover:bg-gray-500/20 text-gray-600 dark:text-gray-400', icon: Wifi },
    'Hexabyte': { name: 'Hexabyte', link: 'https://espaceclient.hexabyte.tn/', className: 'border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400', icon: Wifi },
};

function ProviderQuickLinks() {
    const { isp } = useUserPreferences();
    
    const stegLink = "https://espace.steg.com.tn/fr/espace/login.php";
    const sonedeLink = "https://portail.sonede.com.tn/login";
    const ispProvider = isp ? providerDetails[isp] : null;

    return (
        <div className="flex items-center gap-2">
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button asChild variant="outline" size="icon" className="h-9 w-9 border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 dark:text-yellow-400">
                       <Link href={stegLink} target="_blank"><Zap className="h-5 w-5"/></Link>
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Espace client STEG</p></TooltipContent>
            </Tooltip>
             <Tooltip>
                <TooltipTrigger asChild>
                    <Button asChild variant="outline" size="icon" className="h-9 w-9 border-blue-500/50 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 dark:text-blue-400">
                       <Link href={sonedeLink} target="_blank"><Droplets className="h-5 w-5"/></Link>
                    </Button>
                </TooltipTrigger>
                <TooltipContent><p>Espace client SONEDE</p></TooltipContent>
             </Tooltip>
            {ispProvider && (
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Button asChild variant="outline" size="icon" className={cn("h-9 w-9", ispProvider.className)}>
                           <Link href={ispProvider.link} target="_blank"><ispProvider.icon className="h-5 w-5"/></Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Paiement facture {ispProvider.name}</p></TooltipContent>
                 </Tooltip>
            )}
        </div>
    );
}

function UserMenuContent({ onSignOut }: { onSignOut: () => void }) {
    return (
        <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{auth.currentUser?.displayName || 'Utilisateur'}</p>
                    <p className="text-xs leading-none text-muted-foreground">{auth.currentUser?.email}</p>
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
                <Link href="/settings"><UserIcon className="mr-2 h-4 w-4" /><span>Profil & Paramètres</span></Link>
            </DropdownMenuItem>
             <DropdownMenuItem asChild>
                <Link href="#"><LifeBuoy className="mr-2 h-4 w-4" /><span>Support</span></Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Se déconnecter</span>
            </DropdownMenuItem>
        </DropdownMenuContent>
    );
}


function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth(); // No loading needed here
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

  if (pathname === '/view') {
    return <>{children}</>;
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
                    <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold text-foreground">
                        <PaperworkIcon className="h-6 w-6 text-primary" />
                        <span>Lawra9</span>
                    </Link>
                 </div>

                 <div className="flex items-center gap-4">
                    <ProviderQuickLinks />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="overflow-hidden rounded-full h-9 w-9">
                                <Avatar className="h-9 w-9">
                                    <AvatarImage src={user?.photoURL || undefined} alt={user?.displayName || user?.email || "User"} />
                                    <AvatarFallback>{getInitials(user?.displayName, user?.email)}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <UserMenuContent onSignOut={handleSignOut} />
                    </DropdownMenu>
                 </div>
              </header>

              <main className="flex-1 items-start p-4 sm:px-6 sm:py-0">{children}</main>
              
              {/* Mobile Bottom Bar */}
               <nav className="sm:hidden fixed bottom-0 left-0 right-0 h-16 bg-background border-t flex items-center justify-around z-50">
                {mainNavItems.map(item => (
                     <Link key={`mobile-${item.href}`} href={item.href} className={cn(
                        "flex flex-col items-center justify-center gap-1 w-full h-full text-muted-foreground transition-colors hover:text-foreground text-xs",
                        (pathname.startsWith(item.href)) && "text-primary"
                    )}>
                        <item.icon className="h-6 w-6" />
                        <span className="sr-only">{item.label}</span>
                    </Link>
                ))}
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

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
             <div className="flex flex-col items-center gap-2">
                <PaperworkIcon className="h-8 w-8 text-primary animate-pulse"/>
                <p className="text-muted-foreground text-sm mt-2">Chargement de la session...</p>
            </div>
        </div>
    );
  }
  
  if (!user) {
    return null; 
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
