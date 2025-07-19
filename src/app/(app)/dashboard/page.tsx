
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDocuments } from '@/contexts/document-context';
import { useAuth } from '@/contexts/auth-context';
import { FilePlus2, FileText, Bell, LineChart } from 'lucide-react';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { ExpensesChartCard } from '@/components/dashboard/expenses-chart-card';
import { AlertsCard } from '@/components/dashboard/alerts-card';
import { ProviderLinksCard } from '@/components/dashboard/provider-links-card';


export default function DashboardPage() {
  const { documents, alerts, monthlyExpenses } = useDocuments();
  const { user } = useAuth();
  
  const getFirstName = () => {
    if (user?.displayName) {
        return user.displayName.split(' ')[0];
    }
    return 'Utilisateur';
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline">
              Bonjour, {getFirstName()}!
            </h1>
            <p className="text-muted-foreground">
              Voici un résumé de votre espace Lawra9.
            </p>
          </div>
          <UploadDocumentDialog>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
              <FilePlus2 className="mr-2 h-4 w-4" />
              Ajouter un document
            </Button>
          </UploadDocumentDialog>
      </div>
      
       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Totaux</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-xs text-muted-foreground">
              fichiers et factures archivés
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alertes Actives</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.length}</div>
            <p className="text-xs text-muted-foreground">
                {alerts.filter(a => a.type === 'Paiement').length} paiements à venir
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dépenses ce mois-ci</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
                {monthlyExpenses.length > 0 ? Object.values(monthlyExpenses[monthlyExpenses.length-1]).reduce((acc: number, val) => typeof val === 'number' ? acc + val : acc, 0).toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) : '0,000'}
                <span className="text-sm font-normal"> TND</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Total des factures enregistrées
            </p>
          </CardContent>
        </Card>
      </div>

       <ProviderLinksCard />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
        <div className="lg:col-span-4">
            <ExpensesChartCard data={monthlyExpenses} />
        </div>
        <div className="lg:col-span-3">
            <AlertsCard alerts={alerts} />
        </div>
      </div>
    </div>
  );
}
