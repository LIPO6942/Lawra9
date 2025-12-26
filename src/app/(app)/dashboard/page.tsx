
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDocuments } from '@/contexts/document-context';
import { useAuth } from '@/contexts/auth-context';
import { FilePlus2, FileText } from 'lucide-react';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { ExpensesChartCard } from '@/components/dashboard/expenses-chart-card';
import { AlertsCard } from '@/components/dashboard/alerts-card';
import { useMemo } from 'react';
import { MonthlyExpensesCard } from '@/components/dashboard/monthly-expenses-card';


export default function DashboardPage() {
  const { documents, alerts, monthlyExpenses } = useDocuments();
  const { user } = useAuth();

  const regularDocuments = useMemo(() => documents.filter(doc => doc.category !== 'Maison'), [documents]);

  const getFirstName = () => {
    if (user && user.displayName) {
      return user.displayName.split(' ')[0];
    }
    return 'Utilisateur';
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight sm:text-4xl">
            Bonjour, <span className="text-gradient">{getFirstName()}</span>!
          </h1>
          <p className="text-muted-foreground mt-1 text-base">
            Voici un résumé de votre espace Lawra9.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <UploadDocumentDialog>
            <Button className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl px-6">
              <FilePlus2 className="mr-2 h-4 w-4" />
              Nouveau document
            </Button>
          </UploadDocumentDialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents Totaux</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{regularDocuments.length}</div>
            <p className="text-xs text-muted-foreground">
              fichiers et factures archivés
            </p>
          </CardContent>
        </Card>
        <MonthlyExpensesCard />
      </div>

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
