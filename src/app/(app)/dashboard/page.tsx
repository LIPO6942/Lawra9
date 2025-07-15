
'use client';

import { mockAlerts, mockDocuments } from '@/lib/data';
import { Alert, Document } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, FileText, AlertTriangle, Clock, Search, LineChart } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { ResponsiveContainer, BarChart, XAxis, YAxis, Tooltip, Bar, CartesianGrid } from 'recharts';
import { ChartTooltip, ChartTooltipContent, ChartContainer } from '@/components/ui/chart';

function getAlertBadge(dueDate: string) {
  const daysDiff = differenceInDays(parseISO(dueDate), new Date());
  if (daysDiff < 0) {
    return <Badge variant="destructive" className="rounded-md">Urgent</Badge>;
  }
  if (daysDiff <= 7) {
    return <Badge className="bg-destructive/80 rounded-md">Urgent</Badge>;
  }
  if (daysDiff <= 15) {
    return <Badge className="bg-orange-400 text-black rounded-md">Proche</Badge>;
  }
  return <Badge variant="secondary" className="rounded-md">Normal</Badge>;
}

// Mock data for the chart
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


export default function DashboardPage() {
  const alerts: Alert[] = mockAlerts.sort((a,b) => differenceInDays(parseISO(a.dueDate), new Date()) - differenceInDays(parseISO(b.dueDate), new Date()));
  
  return (
    <ScrollArea className="h-full">
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
            <div>
                 <h2 className="text-3xl font-bold tracking-tight font-headline">Tableau de bord</h2>
                 <p className="text-muted-foreground">Bienvenue ! Voici un aperçu de vos activités récentes.</p>
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <UploadDocumentDialog />
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div >
                <CardTitle className="text-lg font-medium font-headline">Alertes à venir</CardTitle>
                <CardDescription>Vos échéances importantes.</CardDescription>
              </div>
              <Bell className="h-6 w-6 text-accent" />
            </CardHeader>
            <CardContent>
             {alerts.length > 0 ? (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                          {differenceInDays(parseISO(alert.dueDate), new Date()) < 0 ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Clock className="h-5 w-5 text-accent" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-none">{alert.documentName}</p>
                        <p className="text-sm text-muted-foreground">{alert.type} - Échéance: {format(parseISO(alert.dueDate), 'd MMMM yyyy', { locale: fr })}</p>
                      </div>
                      {getAlertBadge(alert.dueDate)}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-muted-foreground">Aucune alerte pour le moment.</p>
                    <p className="text-xs text-muted-foreground/80">Ajoutez des documents avec des dates d'échéance pour en créer.</p>
                </div>
              )}
            </CardContent>
          </Card>

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
        </div>
      </div>
    </ScrollArea>
  );
}
