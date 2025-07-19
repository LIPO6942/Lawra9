
'use client';

import { useUserPreferences, ISP } from '@/contexts/user-preferences-context';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, Wifi } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '../ui/skeleton';

const providerDetails: Record<ISP, { name: string; link: string; className: string }> = {
    'Orange': { name: 'Orange', link: 'https://www.orange.tn/espace-client', className: 'border-orange-500/50 hover:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300' },
    'Ooredoo': { name: 'Ooredoo', link: 'https://my.ooredoo.tn/', className: 'border-red-500/50 hover:bg-red-500/10 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300' },
    'Topnet': { name: 'Topnet', link: 'https://www.topnet.tn/mon-compte', className: 'border-blue-500/50 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300' },
    'TT': { name: 'Tunisie Telecom', link: 'https://www.tunisietelecom.tn/particulier/espace-client-fixe-jedidi/', className: 'border-gray-500/50 hover:bg-gray-500/10 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300' },
    'Hexabyte': { name: 'Hexabyte', link: 'https://client.hexabyte.tn/', className: 'border-purple-500/50 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300' },
};

export const ProviderLinksCard = () => {
    const { isp, stegRef, sonedeRef, loading } = useUserPreferences();

    if (loading) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle className="text-base font-medium flex items-center gap-2"><Wifi className="h-4 w-4"/> Accès Rapide Fournisseurs</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                   <Skeleton className="h-9 w-full" />
                   <Skeleton className="h-9 w-full" />
                   <Skeleton className="h-9 w-full" />
                </CardContent>
            </Card>
        )
    }

    const stegLink = stegRef ? `https://www.steg.com.tn/fr/services_en_ligne/facture_en_ligne.html?contrat=${stegRef}` : 'https://www.steg.com.tn/fr/services_en_ligne/facture_en_ligne.html';
    const sonedeLink = sonedeRef ? `http://www.sonede.com.tn/onl/facture/saisie_ident.php?id=${sonedeRef}` : 'http://www.sonede.com.tn/onl/facture/saisie_ident.php';
    
    const ispProvider = isp ? providerDetails[isp] : null;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base font-medium flex items-center gap-2"><Wifi className="h-4 w-4"/> Accès Rapide Fournisseurs</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                 <Button asChild variant="outline" size="sm" className="border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300">
                    <Link href={stegLink} target="_blank">STEG <ExternalLink className="h-3 w-3 ml-auto"/></Link>
                </Button>
                <Button asChild variant="outline" size="sm" className="border-blue-500/50 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                    <Link href={sonedeLink} target="_blank">SONEDE <ExternalLink className="h-3 w-3 ml-auto"/></Link>
                </Button>
                 {ispProvider ? (
                    <Button asChild variant="outline" size="sm" className={ispProvider.className}>
                        <Link href={ispProvider.link} target="_blank">{ispProvider.name} <ExternalLink className="h-3 w-3 ml-auto"/></Link>
                    </Button>
                 ) : (
                    <Button variant="outline" size="sm" disabled>
                        FAI non configuré
                    </Button>
                 )}
            </CardContent>
        </Card>
    );
}
