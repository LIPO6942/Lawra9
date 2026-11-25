'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useDocuments } from '@/contexts/document-context';
import { getYear, getMonth, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { LineChart, Info, Clock, CheckCircle } from 'lucide-react';
import { getDocumentDate } from '@/lib/utils';

type MonthlyTotal = {
  month: string;
  year: number;
  paid: number;
  pending: number;
  total: number;
  monthIndex: number;
};

export function MonthlyExpensesCard() {
  const { documents } = useDocuments();

  const monthlyTotals = useMemo(() => {
    const totals: { [key: string]: { paid: number; pending: number; total: number } } = {};
    const currentYear = getYear(new Date());

    documents.forEach(doc => {
      // Ignore documents from 'Maison' category and those without an amount
      if (doc.category === 'Maison' || !doc.amount) return;

      const docDate = getDocumentDate(doc);
      if (docDate && getYear(docDate) === currentYear) {
        const monthKey = format(docDate, 'yyyy-MM');
        const amount = parseFloat(String(doc.amount).replace(',', '.'));
        if (!isNaN(amount) && amount > 0) {
          if (!totals[monthKey]) {
            totals[monthKey] = { paid: 0, pending: 0, total: 0 };
          }
          totals[monthKey].total += amount;
          if (doc.paymentDate || doc.status === 'paid') {
            totals[monthKey].paid += amount;
          } else {
            totals[monthKey].pending += amount;
          }
        }
      }
    });

    return Object.entries(totals)
      .map(([key, data]) => {
        const [year, month] = key.split('-');
        const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
        return {
          year: parseInt(year, 10),
          month: format(date, 'MMMM', { locale: fr }),
          paid: data.paid,
          pending: data.pending,
          total: data.total,
          monthIndex: parseInt(month, 10) - 1,
        };
      })
      .sort((a, b) => b.year - a.year || b.monthIndex - a.monthIndex);
  }, [documents]);

  const currentMonthData = useMemo(() => {
    const now = new Date();
    const current = monthlyTotals.find(m => m.monthIndex === getMonth(now));
    return current || {
      paid: 0,
      pending: 0,
      total: 0,
      month: format(now, 'MMMM', { locale: fr }),
      year: getYear(now),
      monthIndex: getMonth(now),
    };
  }, [monthlyTotals]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Dépenses ce mois-ci</CardTitle>
        <LineChart className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {currentMonthData.paid.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
          <span className="text-sm font-normal text-muted-foreground"> TND</span>
        </div>

        {currentMonthData.pending > 0 ? (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-600 dark:text-amber-400 font-medium">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>+ {currentMonthData.pending.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND à payer</span>
          </div>
        ) : currentMonthData.paid > 0 ? (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            <CheckCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Toutes les factures du mois sont payées</span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-1.5">Aucune dépense payée ce mois-ci</p>
        )}

        <Accordion type="single" collapsible className="w-full mt-2">
          <AccordionItem value="item-1" className="border-b-0">
            <AccordionTrigger className="text-xs text-muted-foreground py-1 hover:no-underline justify-start gap-1">
              Voir l'historique de l'année
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-1.5 pt-2">
                {monthlyTotals.length > 0 ? (
                  monthlyTotals.map(item => (
                    <div key={`${item.year}-${item.month}`} className="flex justify-between items-center text-sm py-1 border-b border-border/40 last:border-b-0">
                      <span className="capitalize text-muted-foreground">{item.month}</span>
                      <div className="flex flex-col items-end">
                        <span className="font-mono font-semibold">
                          {item.paid.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND
                        </span>
                        {item.pending > 0 && (
                          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                            (+{item.pending.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} Dt à payer)
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
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
