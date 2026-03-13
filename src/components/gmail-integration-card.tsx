'use client';

/**
 * Composant GmailIntegrationCard
 * Affiché dans la page Paramètres pour connecter/synchroniser Gmail
 */

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { auth } from '@/lib/firebase';
import { Loader2, Mail, RefreshCw, CheckCircle2, AlertCircle, Unlink } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';

type GmailStatus = 'loading' | 'not_connected' | 'active' | 'expired' | 'disconnected';

interface GmailIntegration {
  status: GmailStatus;
  connectedAt?: string;
  lastSyncAt?: any;
}

export function GmailIntegrationCard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const [integration, setIntegration] = useState<GmailIntegration>({ status: 'loading' });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Écouter le statut Gmail dans Firestore en temps réel ─────────────────
  useEffect(() => {
    if (!user) return;
    const integrationRef = doc(db, 'users', user.uid, 'integrations', 'gmail');
    const unsub = onSnapshot(
      integrationRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setIntegration({
            status: data.status || 'not_connected',
            connectedAt: data.connectedAt?.toDate?.()?.toLocaleDateString('fr-TN'),
            lastSyncAt: data.lastSyncAt?.toDate?.()?.toLocaleString('fr-TN'),
          });
        } else {
          setIntegration({ status: 'not_connected' });
        }
      },
      () => setIntegration({ status: 'not_connected' })
    );
    return () => unsub();
  }, [user]);

  // ── Gérer le retour OAuth (paramètre ?gmail=success|denied|error) ──────
  useEffect(() => {
    const gmailParam = searchParams.get('gmail');
    if (gmailParam === 'success') {
      toast({
        title: '✅ Gmail connecté !',
        description: 'Vos emails STEG et Orange TN seront maintenant importés automatiquement.',
      });
    } else if (gmailParam === 'denied') {
      toast({
        variant: 'destructive',
        title: 'Accès refusé',
        description: 'Vous avez refusé l\'accès à Gmail. La connexion n\'a pas été établie.',
      });
    } else if (gmailParam === 'error') {
      const reason = searchParams.get('reason');
      const msg = reason === 'no_refresh_token'
        ? 'Veuillez révoquer l\'autorisation sur myaccount.google.com/permissions puis réessayer.'
        : 'Une erreur s\'est produite. Veuillez réessayer.';
      toast({ variant: 'destructive', title: 'Erreur de connexion', description: msg });
    }
  }, [searchParams, toast]);

  // ── Démarrer le flux OAuth ───────────────────────────────────────────────
  const handleConnect = useCallback(async () => {
    if (!user) return;
    setIsConnecting(true);
    try {
      const idToken = await auth.currentUser!.getIdToken();
      const res = await fetch('/api/gmail/auth', {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error('Impossible de démarrer l\'autorisation');
      const { url } = await res.json();
      window.location.href = url; // Redirection vers Google
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err.message,
      });
      setIsConnecting(false);
    }
  }, [user, toast]);

  // ── Lancer la synchronisation ────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      const idToken = await auth.currentUser!.getIdToken();
      const res = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur synchronisation');

      toast({
        title: '✅ Synchronisation terminée',
        description: data.message,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur de synchronisation',
        description: err.message,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [user, toast]);

  // ── Rendu ────────────────────────────────────────────────────────────────
  const isConnected = integration.status === 'active';
  const isLoading = integration.status === 'loading';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          <CardTitle>Import Gmail automatique</CardTitle>
        </div>
        <CardDescription>
          Connectez votre Gmail pour importer automatiquement vos factures STEG et Orange TN.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Fournisseurs couverts */}
        <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
          <p className="font-medium text-foreground">Fournisseurs couverts :</p>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
            <span>STEG</span>
            <code className="text-xs bg-background px-1 rounded">facturemail@steg.com.tn</code>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block w-2 h-2 rounded-full bg-orange-500" />
            <span>Orange Tunisie</span>
            <code className="text-xs bg-background px-1 rounded">factures.otn@orange.com</code>
          </div>
        </div>

        {/* Statut de connexion */}
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Vérification du statut...</span>
          </div>
        ) : isConnected ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              <span>Gmail connecté</span>
            </div>
            {integration.connectedAt && (
              <p className="text-xs text-muted-foreground pl-6">
                Connecté le {integration.connectedAt}
              </p>
            )}
            {integration.lastSyncAt && (
              <p className="text-xs text-muted-foreground pl-6">
                Dernière sync : {integration.lastSyncAt}
              </p>
            )}
            {!integration.lastSyncAt && (
              <p className="text-xs text-muted-foreground pl-6">
                Aucune synchronisation effectuée
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <AlertCircle className="h-4 w-4" />
            <span>Gmail non connecté</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t px-6 py-4 flex gap-3 flex-wrap">
        {!isConnected ? (
          <Button onClick={handleConnect} disabled={isConnecting || isLoading} id="btn-connect-gmail">
            {isConnecting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Connexion en cours...</>
            ) : (
              <><Mail className="mr-2 h-4 w-4" /> Connecter Gmail</>
            )}
          </Button>
        ) : (
          <>
            <Button onClick={handleSync} disabled={isSyncing} id="btn-sync-gmail">
              {isSyncing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synchronisation...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Synchroniser maintenant</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleConnect}
              disabled={isConnecting}
              id="btn-reconnect-gmail"
            >
              <Unlink className="mr-2 h-4 w-4" />
              Reconnecter
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
