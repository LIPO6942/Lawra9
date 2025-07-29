
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useDocuments } from '@/contexts/document-context';
import { useAuth } from '@/contexts/auth-context';
import { FilePlus2, FileText, Bell, LineChart } from 'lucide-react';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { ExpensesChartCard } from '@/components/dashboard/expenses-chart-card';
import { AlertsCard } from '@/components/dashboard/alerts-card';
import { useMemo } from 'react';
import { parseISO, getMonth, getYear, isValid } from 'date-fns';
import { Document } from '@/lib/types';


const getDocumentDateForExpense = (doc: Document): Date | null => {
    // For paid invoices, issueDate is updated to payment date. We prioritize it.
    // If dueDate is present, it's not paid yet. The expense should be counted in its period, not now.
    // So we use billingEndDate or issueDate. If dueDate is NOT present, it means it's paid or doesn't have an expiry.
    // In that case, issueDate (which could be the payment date) is the one we want.
    const datePriority = doc.dueDate 
        ? [doc.billingEndDate, doc.issueDate, doc.createdAt]
        : [doc.issueDate, doc.billingEndDate, doc.createdAt];

    for (const dateStr of datePriority) {
        if (dateStr) {
            const date = parseISO(dateStr);
            if (isValid(date)) {
                return date;
            }
        }
    }
    return null;
}

export default function DashboardPage() {
  const { documents, alerts, monthlyExpenses } = useDocuments();
  const { user } = useAuth();

  const regularDocuments = useMemo(() => documents.filter(doc => doc.category !== 'Maison'), [documents]);

  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    const currentMonth = getMonth(now);
    const currentYear = getYear(now);

    return documents.reduce((total, doc) => {
        // Use a dedicated date logic for this widget to ensure accuracy
        const docDate = getDocumentDateForExpense(doc);
        if (doc.amount && docDate && getMonth(docDate) === currentMonth && getYear(docDate) === currentYear) {
            const amount = parseFloat(doc.amount.replace(',', '.'));
            if (!isNaN(amount)) {
                return total + amount;
            }
        }
        return total;
    }, 0);
  }, [documents]);
  
  const getFirstName = () => {
    if (user && user.displayName) {
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
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dépenses ce mois-ci</CardTitle>
            <LineChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
                {currentMonthExpenses.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                <span className="text-sm font-normal"> TND</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Total des factures enregistrées
            </p>
          </CardContent>
        </Card>
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
