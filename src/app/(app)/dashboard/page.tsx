
'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { AlertsCard } from '@/components/dashboard/alerts-card';
import { ExpensesChartCard } from '@/components/dashboard/expenses-chart-card';
import { useDocuments } from '@/contexts/document-context';

export default function DashboardPage() {
  const { alerts, monthlyExpenses } = useDocuments();
  
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
