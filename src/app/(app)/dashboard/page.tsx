
'use client';

import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { AlertsCard } from '@/components/dashboard/alerts-card';
import { ExpensesChartCard } from '@/components/dashboard/expenses-chart-card';
import { useDocuments } from '@/contexts/document-context';
import { useUserPreferences } from '@/contexts/user-preferences-context';
import { Button } from '@/components/ui/button';
import { Zap, Droplets, Wifi, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const providerLinks = {
  STEG: "https://www.steg.com.tn/fr/espace_client.html",
  SONEDE: "https://www.sonede.com.tn/portail/index.php?act=recherche&cle=facture",
  Orange: "https://www.orange.tn/espace-client",
  Ooredoo: "https://my.ooredoo.tn/",
  Topnet: "https://www.topnet.tn/home/espace-client",
  TT: "https://www.tunisietelecom.tn/particulier/espace-client-fixe-data-mobile/",
  Hexabyte: "https://client.hexabyte.tn/",
  default: "#",
};

export default function DashboardPage() {
  const { alerts, monthlyExpenses } = useDocuments();
  const { isp } = useUserPreferences();
  
  const internetLink = isp ? providerLinks[isp] : providerLinks.default;

  return (
    <ScrollArea className="h-full">
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
        <div className="flex flex-col md:flex-row items-start justify-between space-y-4 md:space-y-0 md:items-center">
            <div>
                 <h2 className="text-3xl font-bold tracking-tight font-headline">Tableau de bord</h2>
                 <p className="text-muted-foreground">Bienvenue ! Voici un aperçu de vos activités récentes.</p>
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <UploadDocumentDialog />
            </div>
        </div>
        
        <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                     <Button asChild variant="outline" className="justify-start gap-3 h-12 rounded-lg">
                        <Link href={providerLinks.STEG} target="_blank">
                            <Zap className="h-5 w-5 text-yellow-500" />
                            <div className="flex flex-col items-start">
                                <span className="font-semibold">STEG</span>
                                <span className="text-xs text-muted-foreground">Espace Client</span>
                            </div>
                            <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                        </Link>
                    </Button>
                     <Button asChild variant="outline" className="justify-start gap-3 h-12 rounded-lg">
                        <Link href={providerLinks.SONEDE} target="_blank">
                           <Droplets className="h-5 w-5 text-blue-500" />
                            <div className="flex flex-col items-start">
                                <span className="font-semibold">SONEDE</span>
                                <span className="text-xs text-muted-foreground">Paiement en ligne</span>
                            </div>
                             <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                        </Link>
                    </Button>
                     <Button asChild variant="outline" className="justify-start gap-3 h-12 rounded-lg">
                        <Link href={internetLink} target="_blank">
                             <Wifi className="h-5 w-5 text-purple-500" />
                            <div className="flex flex-col items-start">
                                <span className="font-semibold">{isp || 'Internet'}</span>
                                <span className="text-xs text-muted-foreground">Espace Client</span>
                            </div>
                             <ExternalLink className="h-4 w-4 ml-auto text-muted-foreground" />
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>

        <div className="grid gap-6 grid-cols-1 lg:grid-cols-5">
          <div className="lg:col-span-3">
              <ExpensesChartCard data={monthlyExpenses} />
          </div>
          <div className="lg:col-span-2">
            <AlertsCard alerts={alerts} />
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
