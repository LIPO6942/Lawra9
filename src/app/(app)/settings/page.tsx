
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2, Settings, User, Moon, Sun, Wifi, Droplets, Zap } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUserPreferences } from '@/contexts/user-preferences-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { isp, stegRef, sonedeRef, setIsp, setStegRef, setSonedeRef, savePreferences } = useUserPreferences();

  const [displayName, setDisplayName] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingProviders, setIsSavingProviders] = useState(false);

  // Local state for provider settings form
  const [localIsp, setLocalIsp] = useState(isp || '');
  const [localStegRef, setLocalStegRef] = useState(stegRef || '');
  const [localSonedeRef, setLocalSonedeRef] = useState(sonedeRef || '');

  useEffect(() => {
    if (user?.displayName) {
      setDisplayName(user.displayName);
    }
  }, [user]);

  useEffect(() => {
    setLocalIsp(isp || '');
    setLocalStegRef(stegRef || '');
    setLocalSonedeRef(sonedeRef || '');
  }, [isp, stegRef, sonedeRef]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSavingProfile(true);
    try {
      await updateProfile(user, { displayName });
      toast({
        title: 'Profil mis à jour',
        description: 'Votre nom a été modifié avec succès.',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de mettre à jour le profil.',
      });
    } finally {
      setIsSavingProfile(false);
    }
  };
  
  const handleProviderUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProviders(true);
    try {
      setIsp(localIsp as any);
      setStegRef(localStegRef);
      setSonedeRef(localSonedeRef);
      await savePreferences();
      toast({
        title: 'Préférences enregistrées',
        description: 'Vos informations de fournisseurs ont été mises à jour.',
      });
    } catch (error) {
       toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible d\'enregistrer les préférences.',
      });
    } finally {
        setIsSavingProviders(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
      <div className="flex items-center space-x-3">
        <Settings className="h-8 w-8 text-accent" />
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-headline">Paramètres</h2>
          <p className="text-muted-foreground">Gérez les informations de votre compte et les préférences de l'application.</p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="w-full max-w-2xl mx-auto">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" /> Profil
          </TabsTrigger>
          <TabsTrigger value="providers">
            <Zap className="mr-2 h-4 w-4" /> Fournisseurs
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Sun className="mr-2 h-4 w-4" /> Apparence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Profil public</CardTitle>
              <CardDescription>Personnalisez les informations de votre profil.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nom d'affichage</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Votre nom"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={user?.email || ''} disabled />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSavingProfile}>
                    {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Enregistrer
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="providers">
            <Card className="rounded-2xl shadow-sm">
                <CardHeader>
                    <CardTitle>Informations Fournisseurs</CardTitle>
                    <CardDescription>Configurez vos fournisseurs et contrats pour un accès rapide.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleProviderUpdate} className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="isp-select">Fournisseur d'accès Internet</Label>
                             <Select value={localIsp} onValueChange={setLocalIsp}>
                                <SelectTrigger id="isp-select">
                                    <SelectValue placeholder="Sélectionnez votre FAI" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Orange">Orange</SelectItem>
                                    <SelectItem value="Ooredoo">Ooredoo</SelectItem>
                                    <SelectItem value="Topnet">Topnet</SelectItem>
                                    <SelectItem value="TT">Tunisie Telecom</SelectItem>
                                    <SelectItem value="Hexabyte">Hexabyte</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="steg-ref">Référence contrat STEG</Label>
                            <Input id="steg-ref" value={localStegRef} onChange={(e) => setLocalStegRef(e.target.value)} placeholder="Ex: 201..." />
                        </div>
                         <div className="space-y-2">
                            <Label htmlFor="sonede-ref">Référence compteur SONEDE</Label>
                            <Input id="sonede-ref" value={localSonedeRef} onChange={(e) => setLocalSonedeRef(e.target.value)} placeholder="Ex: 304..." />
                        </div>
                        <div className="flex justify-end">
                             <Button type="submit" disabled={isSavingProviders}>
                                {isSavingProviders && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Enregistrer
                             </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="appearance">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle>Apparence</CardTitle>
              <CardDescription>Personnalisez l'apparence de l'application. Changement automatique basé sur les préférences de votre système.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Thème</Label>
                <div className="flex space-x-2 rounded-lg bg-muted p-1">
                  <Button
                    variant={theme === 'light' ? 'default' : 'ghost'}
                    onClick={() => setTheme('light')}
                    className="flex-1"
                  >
                    <Sun className="mr-2 h-4 w-4" /> Clair
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'ghost'}
                    onClick={() => setTheme('dark')}
                    className="flex-1"
                  >
                    <Moon className="mr-2 h-4 w-4" /> Sombre
                  </Button>
                  <Button
                     variant={theme === 'system' ? 'default' : 'ghost'}
                    onClick={() => setTheme('system')}
                    className="flex-1"
                  >
                    <Settings className="mr-2 h-4 w-4" /> Système
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
