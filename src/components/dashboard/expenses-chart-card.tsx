
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart } from 'lucide-react';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, Legend } from 'recharts';

const chartConfig = {
  STEG: { label: "STEG", color: "hsl(var(--chart-1))" },
  SONEDE: { label: "SONEDE", color: "hsl(var(--chart-2))" },
  "Reçu Bancaire": { label: "Reçu Bancaire", color: "hsl(var(--chart-3))" },
  Autre: { label: "Autre", color: "hsl(var(--chart-5))" },
} satisfies import("@/components/ui/chart").ChartConfig;

interface ExpensesChartCardProps {
  data: any[];
}

export function ExpensesChartCard({ data }: ExpensesChartCardProps) {
    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <div>
                  <CardTitle className="text-lg font-medium font-headline">Analyse des Dépenses</CardTitle>
                  <CardDescription>Vos dépenses mensuelles par catégorie.</CardDescription>
               </div>
               <LineChart className="h-6 w-6 text-accent" />
            </CardHeader>
            <CardContent>
              {data.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-80 w-full">
                  <BarChart data={data} accessibilityLayer>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      tickMargin={10}
                      axisLine={false}
                    />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value} TND`} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Legend />
                    <Bar dataKey="STEG" fill="var(--color-STEG)" radius={4} stackId="a" />
                    <Bar dataKey="SONEDE" fill="var(--color-SONEDE)" radius={4} stackId="a" />
                    <Bar dataKey="Reçu Bancaire" fill="var(--color-Reçu Bancaire)" radius={4} stackId="a" />
                    <Bar dataKey="Autre" fill="var(--color-Autre)" radius={4} stackId="a" />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-80 text-center">
                    <p className="text-muted-foreground">Aucune dépense à afficher.</p>
                    <p className="text-xs text-muted-foreground/80">Ajoutez des documents avec des montants pour voir le graphique.</p>
                </div>
              )}
            </CardContent>
          </Card>
    );
}
