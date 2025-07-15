
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart } from 'lucide-react';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar } from 'recharts';


const chartData = [
  { month: "Jan", Facture: 400, Contrat: 240, Autre: 120 },
  { month: "Fév", Facture: 300, Contrat: 139, Autre: 100 },
  { month: "Mar", Facture: 200, Contrat: 980, Autre: 50 },
  { month: "Avr", Facture: 278, Contrat: 390, Autre: 80 },
  { month: "Mai", Facture: 189, Contrat: 480, Autre: 150 },
  { month: "Juin", Facture: 239, Contrat: 380, Autre: 60 },
];

const chartConfig = {
  Facture: {
    label: "Factures",
    color: "hsl(var(--chart-1))",
  },
  Contrat: {
    label: "Contrats",
    color: "hsl(var(--chart-2))",
  },
  Autre: {
    label: "Autres",
    color: "hsl(var(--chart-4))",
  },
} satisfies import("@/components/ui/chart").ChartConfig;


export function ExpensesChartCard() {
    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <div>
                  <CardTitle className="text-lg font-medium font-headline">Dépenses par catégorie</CardTitle>
                  <CardDescription>Aperçu de vos dépenses mensuelles.</CardDescription>
               </div>
               <LineChart className="h-6 w-6 text-accent" />
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-64 w-full">
                <BarChart data={chartData} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    tickFormatter={(value) => value.slice(0, 3)}
                  />
                  <YAxis tickLine={false} axisLine={false} />
                   <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Bar dataKey="Facture" fill="var(--color-Facture)" radius={4} />
                  <Bar dataKey="Contrat" fill="var(--color-Contrat)" radius={4} />
                  <Bar dataKey="Autre" fill="var(--color-Autre)" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
    );
}
