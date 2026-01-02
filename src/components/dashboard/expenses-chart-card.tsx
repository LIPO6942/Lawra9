
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart as BarChartIcon, Info } from 'lucide-react';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const chartConfig = {
  STEG: { label: "STEG", color: "#facc15" }, // bright yellow
  SONEDE: { label: "SONEDE", color: "#3b82f6" }, // bright blue
  Internet: { label: "Internet", color: "#8b5cf6" }, // violet
  "Recus de caisse": { label: "Reçus", color: "#64748b" }, // slate grey
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
                                    <span className="block h-2 w-2 rounded-full mr-2" style={{ backgroundColor: pld.color }}></span>
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
                wrapperStyle={{ fontSize: "12px", paddingTop: '10px' }}
              />
              {Object.keys(chartConfig).map(key => (
                <Bar key={key} dataKey={key} fill={chartConfig[key as keyof typeof chartConfig].color} radius={[4, 4, 0, 0]} stackId="a" barSize={32} maxBarSize={40} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Info className="h-8 w-8 text-muted-foreground mb-4" />
            <p className="font-semibold text-muted-foreground">Aucune dépense à afficher.</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Ajoutez des factures pour voir le graphique.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
