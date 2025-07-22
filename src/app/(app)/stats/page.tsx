
'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDocuments } from '@/contexts/document-context';
import { BarChartHorizontal, Droplets, Zap, Wifi, Landmark } from 'lucide-react';
import { getYear, format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line } from 'recharts';
import { Document } from '@/lib/types';

const monthOrder = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

const categoryConfig = {
    "STEG": { color: "hsl(var(--chart-4))", icon: Zap },
    "SONEDE": { color: "hsl(var(--chart-1))", icon: Droplets },
    "Internet": { color: "hsl(var(--chart-3))", icon: Wifi },
    "Reçu Bancaire": { color: "hsl(var(--chart-2))", icon: Landmark },
    "Autre": { color: "hsl(var(--chart-5))", icon: BarChartHorizontal },
};

const getDocumentDate = (doc: Document): Date | null => {
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

const StatsPage = () => {
    const { documents } = useDocuments();
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const { availableYears, processedData, comparisonData, averages, lastYear } = useMemo(() => {
        const dataByYearAndMonth: { [year: string]: { [month: string]: { [category: string]: number } } } = {};
        const allYears = new Set<string>();

        documents.forEach(doc => {
            const docDate = getDocumentDate(doc);
             if (!docDate || !doc.amount || doc.category === 'Maison' || doc.category === 'Assurance' || doc.category === 'Contrat') return;

            const year = getYear(docDate).toString();
            const month = format(docDate, 'MMM', { locale: fr }).replace('.', '');
            allYears.add(year);

            if (!dataByYearAndMonth[year]) dataByYearAndMonth[year] = {};
            if (!dataByYearAndMonth[year][month]) dataByYearAndMonth[year][month] = {};
            
            const categoryKey = doc.category || 'Autre';
            const amount = parseFloat(String(doc.amount).replace(',', '.'));

            if (!isNaN(amount)) {
                if (!dataByYearAndMonth[year][month][categoryKey]) {
                    dataByYearAndMonth[year][month][categoryKey] = 0;
                }
                dataByYearAndMonth[year][month][categoryKey] += amount;
            }
        });

        const availableYears = Array.from(allYears).sort((a,b) => b.localeCompare(a));
        if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
          setSelectedYear(availableYears[0]);
        }

        const currentYearData = dataByYearAndMonth[selectedYear] || {};
        const processedData = monthOrder.map(monthName => {
            const monthData = currentYearData[monthName] || {};
            const result: { month: string; [key: string]: string | number } = { month: `${monthName}.` };
            Object.keys(categoryConfig).forEach(cat => {
                result[cat] = monthData[cat] || 0;
            });
            return result;
        });

        const lastYearVal = (parseInt(selectedYear) - 1).toString();
        const lastYearData = dataByYearAndMonth[lastYearVal] || {};
        
        const comparisonData = monthOrder.map(monthName => {
            const result: { month: string; [key: string]: string | number } = { month: `${monthName}.` };
            Object.keys(categoryConfig).forEach(cat => {
                 result[`${cat} ${selectedYear}`] = currentYearData[monthName]?.[cat] || 0;
                 result[`${cat} ${lastYearVal}`] = lastYearData[monthName]?.[cat] || 0;
            });
            return result;
        });
        
        const averages: { [key: string]: number } = {};
        Object.keys(categoryConfig).forEach(cat => {
            let total = 0, count = 0;
            processedData.forEach(d => {
                const amount = d[cat] as number;
                if (amount > 0) {
                    total += amount;
                    count++;
                }
            });
            averages[cat] = count > 0 ? total / count : 0;
        });


        return { availableYears, processedData, comparisonData, averages, lastYear: lastYearVal };

    }, [documents, selectedYear]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-start justify-between space-y-4 md:space-y-0 md:items-center">
                <div className="flex items-center space-x-3">
                    <BarChartHorizontal className="h-8 w-8 text-primary"/>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Statistiques de Dépenses</h1>
                        <p className="text-muted-foreground">Analysez vos dépenses par catégorie.</p>
                    </div>
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-full sm:w-[180px] rounded-lg">
                        <SelectValue placeholder="Année" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
                {Object.entries(averages).filter(([, value]) => value > 0).map(([category, value]) => {
                     const config = categoryConfig[category as keyof typeof categoryConfig];
                     if (!config) return null;
                     return (
                        <StatCard 
                            key={category}
                            title={`Moy. Mensuelle ${category}`}
                            value={`${value.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND`}
                            icon={config.icon}
                            iconClass="text-muted-foreground"
                        />
                     )
                })}
            </div>
            
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Dépenses Annuelles ({selectedYear})</CardTitle>
                    <CardDescription>Évolution de vos dépenses mensuelles par catégorie.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] pr-8">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processedData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="left" orientation="left" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'TND', angle: -90, position: 'insideLeft', offset: 10, fill: '#888' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                             {Object.entries(categoryConfig).map(([key, value]) => (
                                <Bar key={key} yAxisId="left" dataKey={key} fill={value.color} name={key} radius={[4, 4, 0, 0]} stackId="a" />
                             ))}
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Comparaison Annuelle</CardTitle>
                    <CardDescription>Comparez vos dépenses avec l'année précédente.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] pr-8">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'TND', angle: -90, position: 'insideLeft', offset: 10, fill: '#888' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            {Object.entries(categoryConfig).map(([key, value]) => (
                                <React.Fragment key={key}>
                                    <Line type="monotone" dataKey={`${key} ${selectedYear}`} stroke={value.color} name={`${key} ${selectedYear}`} />
                                    <Line type="monotone" dataKey={`${key} ${lastYear}`} stroke={value.color} strokeDasharray="5 5" name={`${key} ${lastYear}`} opacity={0.6} />
                                </React.Fragment>
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}

const StatCard = ({ title, value, icon: Icon, iconClass }: { title: string, value: string, icon: React.ElementType, iconClass: string }) => {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-4 w-4 text-muted-foreground ${iconClass}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, p: any) => sum + p.value, 0);

    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
        <p className="text-sm font-bold text-foreground mb-2">{label}</p>
        <div className="space-y-1">
            {payload.filter((p: any) => p.value > 0).map((pld: any) => (
            <div key={pld.dataKey} className="flex items-center justify-between">
                <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: pld.stroke || pld.fill }}></div>
                    <span className="text-muted-foreground">{pld.name}:</span>
                </div>
                <span className="font-semibold ml-4">{pld.value.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND</span>
            </div>
            ))}
        </div>
        {payload.length > 1 && total > 0 && (
            <>
                <div className="my-2 h-px bg-border" />
                 <div className="flex items-center justify-between font-bold">
                    <span>Total:</span>
                    <span className="ml-4">{total.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TND</span>
                </div>
            </>
        )}
      </div>
    );
  }
  return null;
};

export default StatsPage;

    