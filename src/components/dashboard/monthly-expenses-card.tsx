
'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useDocuments } from '@/contexts/document-context';
import { Document } from '@/lib/types';
import { parseISO, getMonth, getYear, isValid, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Info } from 'lucide-react';

const getDocumentDateForExpense = (doc: Document): Date | null => {
  // For paid invoices, issueDate is updated to payment date. Prioritize this.
  // For unpaid, use issue or billing end date.
  const datePriority = [doc.issueDate, doc.billingEndDate, doc.createdAt];
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

type MonthlyTotal = {
  month: string;
  year: number;
  total: number;
  monthIndex: number;
};

export function MonthlyExpensesCard() {
  const { documents } = useDocuments();

  const monthlyTotals = useMemo(() => {
    const totals: { [key: string]: number } = {};
    const currentYear = getYear(new Date());

    documents.forEach(doc => {
      // Ignore documents from 'Maison' category and those without an amount
      if (doc.category === 'Maison' || !doc.amount) return;

      const docDate = getDocumentDateForExpense(doc);
      if (docDate && getYear(docDate) === currentYear) {
        const monthKey = format(docDate, 'yyyy-MM');
        const amount = parseFloat(String(doc.amount).replace(',', '.'));
        if (!isNaN(amount)) {
          totals[monthKey] = (totals[monthKey] || 0) + amount;
        }
      }
    });

    return Object.entries(totals)
      .map(([key, total]) => {
        const [year, month] = key.split('-');
        return {
          year: parseInt(year),
          month: format(new Date(key), 'MMMM', { locale: fr }),
          total,
          monthIndex: parseInt(month) - 1,
        };
      })
      .sort((a, b) => b.year - a.year || b.monthIndex - a.monthIndex);
  }, [documents]);

  const currentMonthTotal = useMemo(() => {
    const now = new Date();
    const currentMonthData = monthlyTotals.find(m => m.monthIndex === getMonth(now));
    return currentMonthData?.total || 0;
  }, [monthlyTotals]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Dépenses ce mois-ci</CardTitle>
        <LineChart className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {currentMonthTotal.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
          <span className="text-sm font-normal"> TND</span>
        </div>
        <Accordion type="single" collapsible className="w-full mt-2">
          <AccordionItem value="item-1" className="border-b-0">
            <AccordionTrigger className="text-xs text-muted-foreground py-1 hover:no-underline justify-start gap-1">
              Voir l'historique de l'année
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-2 pt-2">
                {monthlyTotals.length > 0 ? monthlyTotals.map(item => (
                  <div key={`${item.year}-${item.month}`} className="flex justify-between items-center text-sm">
                    <span className="capitalize text-muted-foreground">{item.month}</span>
                    <span className="font-mono font-semibold">
                      {item.total.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND
                    </span>
                  </div>
                )) : (
                  <div className="flex items-center justify-center text-xs text-muted-foreground py-4">
                    <Info className="h-4 w-4 mr-2" />
                    <p>Aucune dépense enregistrée cette année.</p>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
