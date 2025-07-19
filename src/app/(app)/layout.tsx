
'use client';

import * as React from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bell, Files, Home, LayoutDashboard, LogOut, Settings, History, User, Zap, Droplets, Wifi } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DocumentProvider } from '@/contexts/document-context';
import { useAuth } from '@/contexts/auth-context';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { UserPreferencesProvider, useUserPreferences } from '@/contexts/user-preferences-context';

const PaperworkIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
    </svg>
);

const providerLinks = {
  STEG: "https://espace.steg.com.tn/fr/espace/login.php",
  SONEDE: "https://portail.sonede.com.tn/login",
  Orange: "https://www.orange.tn/espace-client",
  Ooredoo: "https://my.ooredoo.tn/",
  Topnet: "https://www.topnet.tn/home/espace-client",
  TT: "https://www.tunisietelecom.tn/particulier/espace-client-fixe-data-mobile/",
  Hexabyte: "https://client.hexabyte.tn/",
  default: "#",
};

function Logo() {
  return (
    <div className="flex items-center gap-2">
        <PaperworkIcon className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold font-headline text-primary-foreground tracking-tighter">
            Lawra9
        </h1>
    </div>
  );
}

function ProviderLinks() {
    const { isp } = useUserPreferences();
    const internetLink = isp ? providerLinks[isp] : providerLinks.default;

    return (
        <div className="hidden md:flex items-center space-x-2">
            <Button asChild variant="outline" size="sm" className="border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300">
                <Link href={providerLinks.STEG} target="_blank">
                    <Zap className="h-4 w-4" />
                    <span>STEG</span>
                </Link>
            </Button>
             <Button asChild variant="outline" size="sm" className="border-blue-500/50 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                <Link href={providerLinks.SONEDE} target="_blank">
                   <Droplets className="h-4 w-4" />
                    <span>SONEDE</span>
                </Link>
            </Button>
             <Button asChild variant="outline" size="sm" className="border-purple-500/50 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                <Link href={internetLink} target="_blank">
                     <Wifi className="h-4 w-4" />
                    <span>{isp || 'Internet'}</span>
                </Link>
            </Button>
        </div>
    );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const { isMobile, setOpenMobile } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };
  
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
      if (initials.length > 2) {
          return initials.substring(0, 2).toUpperCase();
      }
      return initials.toUpperCase();
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return 'U';
  }

  if (loading || !user) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <p>Chargement...</p>
        </div>
    );
  }

  return (
    
        <Sidebar>
        <SidebarHeader className="p-4">
            <Link href="/dashboard" className="group-data-[collapsible=icon]:hidden">
            <Logo />
            </Link>
            <Link href="/dashboard" className="hidden group-data-[collapsible=icon]:block mx-auto">
                <PaperworkIcon className="h-6 w-6 text-primary" />
            </Link>
        </SidebarHeader>
        <SidebarContent>
            <SidebarMenu>
            <SidebarMenuItem onClick={handleLinkClick}>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard')}>
                <Link href="/dashboard">
                    <LayoutDashboard />
                    Tableau de bord
                </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem onClick={handleLinkClick}>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/documents')}>
                    <Link href="/documents">
                    <Files />
                    Documents
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
                <SidebarMenuItem onClick={handleLinkClick}>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/historique')}>
                    <Link href="/historique">
                    <History />
                    Historique
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem onClick={handleLinkClick}>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/maison')}>
                <Link href="/maison">
                    <Home />
                    Maison
                </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem onClick={handleLinkClick}>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard')}>
                <Link href="/dashboard">
                    <Bell />
                    Alertes
                </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
            <SidebarMenu>
                <SidebarMenuItem onClick={handleLinkClick}>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/settings')}>
                    <Link href="/settings">
                    <Settings />
                    Paramètres
                    </Link>
                </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarFooter>
        </Sidebar>
        <SidebarInset>
        <header className="flex items-center justify-between h-16 px-6 border-b">
            <SidebarTrigger className="md:hidden" />
            <ProviderLinks />
            <div className="flex items-center space-x-4">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-9 w-9">
                    <AvatarImage src={user.photoURL || undefined} alt="User" />
                    <AvatarFallback>{getInitials(user.displayName, user.email)}</AvatarFallback>
                    </Avatar>
                </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName || 'Utilisateur'}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                    </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                    <Link href="/settings">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                    </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                    <Link href="/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Paramètres</span>
                    </Link>
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
        <main className="flex-1 overflow-y-auto">
            {children}
        </main>
        </SidebarInset>
    
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
            <p>Chargement...</p>
        </div>
    );
  }
  
  return (
      <SidebarProvider>
        <AppLayout>{children}</AppLayout>
      </SidebarProvider>
  )
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
