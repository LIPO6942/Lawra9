
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Loader2, Settings, User } from 'lucide-react';
import { useTheme } from 'next-themes';
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center space-x-3">
        <User className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Profil & Paramètres</h1>
          <p className="text-muted-foreground">Gérez votre compte et les préférences de l'application.</p>
        </div>
      </div>
      
      <div className="space-y-8 max-w-3xl">
        <Card>
           <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Informations publiques de votre compte.</CardDescription>
           </CardHeader>
           <form onSubmit={handleProfileUpdate}>
              <CardContent className="space-y-4">
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
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button type="submit" disabled={isSavingProfile}>
                  {isSavingProfile && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer les modifications
                </Button>
              </CardFooter>
            </form>
        </Card>

        <Card>
           <CardHeader>
            <CardTitle>Fournisseurs & Raccourcis</CardTitle>
            <CardDescription>Configurez vos contrats pour un accès rapide depuis l'accueil.</CardDescription>
           </CardHeader>
          <form onSubmit={handleProviderUpdate}>
              <CardContent className="space-y-4">
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
              </CardContent>
              <CardFooter className="border-t px-6 py-4">
                <Button type="submit" disabled={isSavingProviders}>
                  {isSavingProviders && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enregistrer les fournisseurs
                </Button>
              </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
