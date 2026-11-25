'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDocuments } from '@/contexts/document-context';
import { getDocumentDate, cn } from '@/lib/utils';
import { BarChart as BarChartIcon, Info } from 'lucide-react';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format, getYear } from 'date-fns';
import { fr } from 'date-fns/locale';

const chartConfig = {
  STEG: { label: "STEG", color: "#facc15" }, // bright yellow
  SONEDE: { label: "SONEDE", color: "#3b82f6" }, // bright blue
  Internet: { label: "Internet", color: "#8b5cf6" }, // violet
  Autre: { label: "Autre", color: "#10b981" }, // emerald
} satisfies import("@/components/ui/chart").ChartConfig;

interface ExpensesChartCardProps {
  data?: any[];
}

const monthOrder = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

export function ExpensesChartCard({ data }: ExpensesChartCardProps) {
  const { documents } = useDocuments();
  const currentYearStr = new Date().getFullYear().toString();

  const [statusFilter, setStatusFilter] = useState<'paid' | 'all' | 'pending'>('paid');

  // Liste de toutes les années disponibles à partir des documents
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(currentYearStr);

    documents.forEach(doc => {
      if (doc.category === 'Maison' || !doc.amount) return;
      const d = getDocumentDate(doc);
      if (d) {
        years.add(getYear(d).toString());
      }
    });

    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [documents, currentYearStr]);

  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);

  // Bascule automatique vers l'année des documents si l'année en cours n'a aucune donnée
  useEffect(() => {
    const hasCurrentYearData = documents.some(doc => {
      if (doc.category === 'Maison' || !doc.amount) return false;
      const d = getDocumentDate(doc);
      return d && getYear(d).toString() === currentYearStr;
    });

    if (!hasCurrentYearData && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[0]);
    }
  }, [documents, availableYears, currentYearStr, selectedYear]);

  // Données mensuelles calculées pour l'année et le filtre de statut sélectionnés
  const chartData = useMemo(() => {
    const expensesByMonth: {
      [month: string]: {
        categories: { [cat: string]: number };
        paid: number;
        pending: number;
        total: number;
      };
    } = {};

    monthOrder.forEach(m => {
      expensesByMonth[m] = { categories: {}, paid: 0, pending: 0, total: 0 };
    });

    documents.forEach(doc => {
      if (doc.category === 'Maison' || !doc.amount) return;

      const docDate = getDocumentDate(doc);
      if (!docDate || getYear(docDate).toString() !== selectedYear) return;

      const month = format(docDate, 'MMM', { locale: fr }).replace('.', '');
      if (!expensesByMonth[month]) return;

      const amount = parseFloat(String(doc.amount).replace(',', '.'));
      if (isNaN(amount) || amount <= 0) return;

      const isPaid = !!doc.paymentDate || doc.status === 'paid';

      // Filtrage selon le statut sélectionné
      if (statusFilter === 'paid' && !isPaid) return;
      if (statusFilter === 'pending' && isPaid) return;

      const rawCat = doc.category || 'Autre';
      const catKey = ['STEG', 'SONEDE', 'Internet'].includes(rawCat) ? rawCat : 'Autre';

      expensesByMonth[month].categories[catKey] = (expensesByMonth[month].categories[catKey] || 0) + amount;
      expensesByMonth[month].total += amount;

      if (isPaid) {
        expensesByMonth[month].paid += amount;
      } else {
        expensesByMonth[month].pending += amount;
      }
    });

    return monthOrder.map(monthName => {
      const entry: any = {
        month: `${monthName}.`,
        paidAmount: expensesByMonth[monthName].paid,
        pendingAmount: expensesByMonth[monthName].pending,
        totalAmount: expensesByMonth[monthName].total,
      };

      Object.keys(chartConfig).forEach(cat => {
        entry[cat] = expensesByMonth[monthName].categories[cat] || 0;
      });

      return entry;
    });
  }, [documents, selectedYear, statusFilter]);

  const hasExpenses = useMemo(() => {
    return chartData.some(d => (d.totalAmount || 0) > 0);
  }, [chartData]);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BarChartIcon className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-lg font-medium font-headline">
              {statusFilter === 'paid' && 'Dépenses Annuelles'}
              {statusFilter === 'pending' && 'Factures à Payer'}
              {statusFilter === 'all' && 'Factures Annuelles (Toutes)'}
            </CardTitle>
            <CardDescription>
              {statusFilter === 'paid' && `Vos dépenses payées par catégorie (${selectedYear}).`}
              {statusFilter === 'pending' && `Vos factures en attente de paiement (${selectedYear}).`}
              {statusFilter === 'all' && `Toutes vos factures par catégorie (${selectedYear}).`}
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Sélecteur de statut : Payées (dépenses) / À payer / Toutes */}
          <div className="inline-flex items-center rounded-lg bg-muted p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('paid')}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-medium",
                statusFilter === 'paid'
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Payées
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending')}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-medium",
                statusFilter === 'pending'
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              À payer
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-medium",
                statusFilter === 'all'
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Toutes
            </button>
          </div>

          {availableYears.length > 0 && (
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[85px] h-8 text-xs font-medium rounded-lg">
                <SelectValue placeholder="Année" />
              </SelectTrigger>
              <SelectContent align="end">
                {availableYears.map(year => (
                  <SelectItem key={year} value={year} className="text-xs">
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent className="h-[350px] pt-4">
        {hasExpenses ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickFormatter={(value) => `${value}`}
                width={35}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const dataPoint = payload[0]?.payload;
                    const paid = dataPoint?.paidAmount || 0;
                    const pending = dataPoint?.pendingAmount || 0;
                    const total = dataPoint?.totalAmount || 0;

                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md min-w-[190px]">
                        <div className="flex flex-col space-y-2">
                          <div className="flex items-center justify-between border-b pb-1.5">
                            <p className="text-sm font-bold text-foreground capitalize">{label} {selectedYear}</p>
                            <span className="text-xs font-semibold text-primary">{total.toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} TND</span>
                          </div>
                          <div className="space-y-1">
                            {payload.map((pld, index) => {
                              if (!pld.value || Number(pld.value) <= 0) return null;
                              return (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="flex items-center">
                                    <span className="block h-2 w-2 rounded-full mr-2" style={{ backgroundColor: pld.color }}></span>
                                    <p className="text-xs text-muted-foreground">{pld.name}:</p>
                                  </div>
                                  <p className="text-xs font-semibold ml-4">{Number(pld.value).toLocaleString('fr-TN', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} TND</p>
                                </div>
                              );
                            })}
                          </div>
                          {statusFilter === 'all' && (paid > 0 || pending > 0) && (
                            <div className="border-t pt-1.5 flex items-center justify-between text-[11px]">
                              {paid > 0 && <span className="text-emerald-600 font-medium">Payé: {paid.toLocaleString('fr-TN')} Dt</span>}
                              {pending > 0 && <span className="text-orange-500 font-medium">À payer: {pending.toLocaleString('fr-TN')} Dt</span>}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px", paddingTop: '10px' }}
              />
              {Object.keys(chartConfig).map(key => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={chartConfig[key as keyof typeof chartConfig].color}
                  radius={[4, 4, 0, 0]}
                  stackId="a"
                  barSize={24}
                  maxBarSize={32}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Info className="h-8 w-8 text-muted-foreground mb-4" />
            <p className="font-semibold text-muted-foreground">
              {statusFilter === 'paid' && `Aucune dépense payée à afficher pour ${selectedYear}.`}
              {statusFilter === 'pending' && `Aucune facture à payer pour ${selectedYear}.`}
              {statusFilter === 'all' && `Aucune facture pour ${selectedYear}.`}
            </p>
            <p className="text-xs text-muted-foreground/80 mt-1">
              {statusFilter === 'paid'
                ? "Marquez vos factures comme payées pour qu'elles apparaissent comme dépenses."
                : "Ajoutez des factures pour voir le graphique."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
