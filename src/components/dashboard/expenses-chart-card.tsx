
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart as BarChartIcon, Info } from 'lucide-react';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const chartConfig = {
  STEG: { label: "STEG", color: "hsl(var(--chart-4))" }, // Yellow
  SONEDE: { label: "SONEDE", color: "hsl(var(--chart-1))" }, // Blue
  "Reçu Bancaire": { label: "Banque", color: "hsl(var(--chart-2))" }, // Green
  Internet: { label: "Internet", color: "hsl(var(--chart-3))" }, // Purple
  Autre: { label: "Autre", color: "hsl(var(--chart-5))" },
} satisfies import("@/components/ui/chart").ChartConfig;

interface ExpensesChartCardProps {
  data: any[];
}

export function ExpensesChartCard({ data }: ExpensesChartCardProps) {
    return (
        <Card className="h-full">
             <CardHeader>
                <div className="flex items-center gap-3">
                     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <BarChartIcon className="h-6 w-6" />
                     </div>
                     <div>
                        <CardTitle className="text-lg font-medium font-headline">Dépenses Annuelles</CardTitle>
                        <CardDescription>Vos dépenses mensuelles par catégorie.</CardDescription>
                     </div>
                </div>
            </CardHeader>
            <CardContent className="h-[350px] pt-4">
              {data.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data}>
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
                        width={30}
                    />
                    <Tooltip
                        cursor={{fill: 'hsla(var(--card-foreground), 0.1)'}}
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <div className="grid grid-cols-1 gap-2">
                                  <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-bold text-foreground">{label}</p>
                                    <div className="space-y-1">
                                        {payload.map((pld, index) => (
                                          <div key={index} className="flex items-center justify-between">
                                            <div className="flex items-center">
                                                <span className="block h-2 w-2 rounded-full mr-2" style={{backgroundColor: pld.color}}></span>
                                                <p className="text-xs text-muted-foreground">{pld.name}:</p>
                                            </div>
                                            <p className="text-xs font-semibold ml-4">{pld.value?.toLocaleString('fr-TN')} TND</p>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                    />
                    <Legend
                       iconType='circle'
                       iconSize={8}
                       wrapperStyle={{fontSize: "12px", paddingTop: '10px'}}
                    />
                    {Object.keys(chartConfig).filter(key => key !== 'Maison' && key !== 'Assurance' && key !== 'Contrat').map(key => (
                        <Bar key={key} dataKey={key} fill={chartConfig[key as keyof typeof chartConfig].color} radius={[4, 4, 0, 0]} stackId="a" />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center">
                    <Info className="h-8 w-8 text-muted-foreground mb-4"/>
                    <p className="font-semibold text-muted-foreground">Aucune dépense à afficher.</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">Ajoutez des factures pour voir le graphique.</p>
                </div>
              )}
            </CardContent>
          </Card>
    );
}
