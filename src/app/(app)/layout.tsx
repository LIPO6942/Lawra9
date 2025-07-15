
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
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Bell, Files, Home, LayoutDashboard, LogOut, Settings, User } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DocumentProvider } from '@/contexts/document-context';

function Logo() {
  return (
     <h1 className="text-2xl font-bold font-headline text-primary-foreground tracking-tighter">
        Lawra9
    </h1>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <DocumentProvider>
      <SidebarProvider>
        <Sidebar>
          <SidebarHeader className="p-4">
            <div className="group-data-[collapsible=icon]:hidden">
              <Logo />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/dashboard')}>
                  <Link href="/dashboard">
                    <LayoutDashboard />
                    Tableau de bord
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/documents')}>
                   <Link href="/documents">
                    <Files />
                    Documents
                   </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/maison')}>
                  <Link href="/maison">
                    <Home />
                    Maison
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
               <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname.startsWith('/alerts')}>
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
               <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={pathname.startsWith('/settings')}>
                    <Link href="/dashboard">
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
             <div></div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src="https://placehold.co/100x100" alt="User" data-ai-hint="profile picture" />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Utilisateur</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        utilisateur@lawra9.tn
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Paramètres</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/')}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Se déconnecter</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </header>
          <main className="flex-1 overflow-y-auto">
              {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </DocumentProvider>
  );
}
