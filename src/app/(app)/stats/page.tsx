
'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDocuments } from '@/contexts/document-context';
import { BarChartHorizontal, Droplets, Zap, Wifi, TrendingUp, Info, Wind } from 'lucide-react';
import { getYear, format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Legend, CartesianGrid, LineChart, Line } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Document } from '@/lib/types';

const monthOrder = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

const expenseCategoryConfig = {
    steg: { label: "STEG", color: "hsl(var(--chart-4))" },
    sonede: { label: "SONEDE", color: "hsl(var(--chart-1))" },
    internet: { label: "Internet", color: "hsl(var(--chart-3))" },
    bancaire: { label: "Banque", color: "hsl(var(--chart-2))" },
    caisse: { label: "Recus de caisse", color: "hsl(var(--chart-6))" },
};

const categoryMap: Record<string, string> = {
    "STEG": "steg",
    "SONEDE": "sonede",
    "Internet": "internet",
    "Reçu Bancaire": "bancaire",
    "Recus de caisse": "caisse",
    "Autre": "autre"
};

const consumptionConfig = {
    elec: { label: "Électricité", color: "hsl(var(--chart-4))", unit: "kWh" },
    gaz: { label: "Gaz", color: "hsl(var(--chart-2))", unit: "m³" },
    eau: { label: "Eau", color: "hsl(var(--chart-1))", unit: "m³" },
};

const consumptionMap: Record<string, string> = {
    "Électricité": "elec",
    "Gaz": "gaz",
    "Eau": "eau"
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

const parseQuantity = (quantityStr: string | undefined): number => {
    if (!quantityStr) return 0;
    // Remove all non-numeric characters except for the decimal separator (dot or comma)
    const cleaned = quantityStr.replace(/[^\d.,]/g, '').replace(',', '.');
    const value = parseFloat(cleaned);
    return isNaN(value) ? 0 : value;
};


const StatsPage = () => {
    const { documents } = useDocuments();
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const {
        availableYears,
        expenseData,
        consumptionData,
        expenseAverages,
        consumptionAverages
    } = useMemo(() => {
        const dataByYearAndMonth: { [year: string]: { [month: string]: { expenses: { [category: string]: number }, consumption: { [type: string]: number } } } } = {};
        const allYears = new Set<string>();

        documents.forEach(doc => {
            const docDate = getDocumentDate(doc);
            if (!docDate || doc.category === 'Maison' || doc.category === 'Assurance' || doc.category === 'Contrat') return;

            const year = getYear(docDate).toString();
            const month = format(docDate, 'MMM', { locale: fr }).replace('.', '');
            allYears.add(year);

            if (!dataByYearAndMonth[year]) dataByYearAndMonth[year] = {};
            if (!dataByYearAndMonth[year][month]) dataByYearAndMonth[year][month] = { expenses: {}, consumption: {} };

            // Process expenses
            if (doc.amount) {
                const category = doc.category || 'Recus de caisse';
                const categoryKey = categoryMap[category] || 'autre';
                const amount = parseFloat(String(doc.amount).replace(',', '.'));
                if (!isNaN(amount)) {
                    if (!dataByYearAndMonth[year][month].expenses[categoryKey]) dataByYearAndMonth[year][month].expenses[categoryKey] = 0;
                    dataByYearAndMonth[year][month].expenses[categoryKey] += amount;
                }
            }

            // Process consumption
            if (doc.category === 'STEG') {
                if (doc.consumptionQuantity) dataByYearAndMonth[year][month].consumption['elec'] = (dataByYearAndMonth[year][month].consumption['elec'] || 0) + parseQuantity(doc.consumptionQuantity);
                if (doc.gasConsumptionQuantity) dataByYearAndMonth[year][month].consumption['gaz'] = (dataByYearAndMonth[year][month].consumption['gaz'] || 0) + parseQuantity(doc.gasConsumptionQuantity);
            } else if (doc.category === 'SONEDE' && doc.consumptionQuantity) {
                dataByYearAndMonth[year][month].consumption['eau'] = (dataByYearAndMonth[year][month].consumption['eau'] || 0) + parseQuantity(doc.consumptionQuantity);
            }
        });

        const availableYears = Array.from(allYears).sort((a, b) => b.localeCompare(a));
        if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
            setSelectedYear(availableYears[0]);
        }

        const yearData = dataByYearAndMonth[selectedYear] || {};

        const processChartData = (dataType: 'expenses' | 'consumption', config: any) => {
            return monthOrder.map(monthName => {
                const monthData = yearData[monthName]?.[dataType] || {};
                const result: { month: string;[key: string]: string | number } = { month: `${monthName}.` };
                Object.keys(config).forEach(cat => {
                    result[cat] = monthData[cat] || 0;
                });
                return result;
            });
        };

        const expenseData = processChartData('expenses', expenseCategoryConfig);
        const consumptionData = processChartData('consumption', consumptionConfig);

        const calculateAverages = (data: any[], config: any) => {
            const averages: { [key: string]: { total: number, count: number, avg: number } } = {};
            Object.keys(config).forEach(cat => {
                averages[cat] = { total: 0, count: 0, avg: 0 };
                data.forEach(d => {
                    const amount = d[cat] as number;
                    if (amount > 0) {
                        averages[cat].total += amount;
                        averages[cat].count++;
                    }
                });
                averages[cat].avg = averages[cat].count > 0 ? averages[cat].total / averages[cat].count : 0;
            });
            return averages;
        }

        return {
            availableYears,
            expenseData,
            consumptionData,
            expenseAverages: calculateAverages(expenseData, expenseCategoryConfig),
            consumptionAverages: calculateAverages(consumptionData, consumptionConfig)
        };

    }, [documents, selectedYear]);

    const hasData = useMemo(() => documents.some(d => getDocumentDate(d) && getYear(getDocumentDate(d)!) === parseInt(selectedYear)), [documents, selectedYear]);

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-col md:flex-row items-start justify-between space-y-4 md:space-y-0 md:items-center">
                <div className="flex items-center space-x-3">
                    <BarChartHorizontal className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Statistiques Annuelles</h1>
                        <p className="text-muted-foreground">Analysez vos dépenses et consommations.</p>
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

            {!hasData ? (
                <div className="flex flex-col items-center justify-center text-center py-20 rounded-lg bg-muted/50">
                    <Info className="h-10 w-10 text-muted-foreground mb-4" />
                    <p className="font-semibold text-muted-foreground">Aucune donnée pour l'année {selectedYear}.</p>
                    <p className="text-sm text-muted-foreground/80 mt-1">Ajoutez des documents ou sélectionnez une autre année.</p>
                </div>
            ) : (
                <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                        <StatCard title="Dépense STEG / mois" value={expenseAverages['steg']?.avg} unit="TND" icon={Zap} />
                        <StatCard title="Dépense SONEDE / mois" value={expenseAverages['sonede']?.avg} unit="TND" icon={Droplets} />
                        <StatCard title="Conso. Élec / mois" value={consumptionAverages['elec']?.avg} unit="kWh" icon={Zap} />
                        <StatCard title="Conso. Gaz / mois" value={consumptionAverages['gaz']?.avg} unit="m³" icon={Wind} />
                        <StatCard title="Conso. Eau / mois" value={consumptionAverages['eau']?.avg} unit="m³" icon={Droplets} />
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <Card className="rounded-xl shadow-sm">
                            <CardHeader>
                                <CardTitle className="font-headline text-xl flex items-center gap-2"><BarChartHorizontal className="h-5 w-5" />Dépenses par Catégorie ({selectedYear})</CardTitle>
                                <CardDescription>Évolution de vos dépenses mensuelles en TND.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[350px] pr-8">
                                <ChartContainer config={expenseCategoryConfig} className="h-full w-full">
                                    <BarChart data={expenseData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'TND', angle: -90, position: 'insideLeft', offset: 10, fill: '#888' }} />
                                        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value.toLocaleString('fr-TN')} TND`} />} />
                                        <Legend />
                                        {Object.keys(expenseCategoryConfig).map((key) => (
                                            <Bar key={key} dataKey={key} fill={`var(--color-${key})`} name={key} radius={[4, 4, 0, 0]} stackId="a" />
                                        ))}
                                    </BarChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl shadow-sm">
                            <CardHeader>
                                <CardTitle className="font-headline text-xl flex items-center gap-2"><TrendingUp className="h-5 w-5" />Consommation par Ressource ({selectedYear})</CardTitle>
                                <CardDescription>Évolution de votre consommation en kWh et m³.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[350px] pr-8">
                                <ChartContainer config={consumptionConfig} className="h-full w-full">
                                    <LineChart data={consumptionData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => {
                                            const config = (consumptionConfig as any)[name];
                                            return `${value.toLocaleString('fr-TN')} ${config?.unit || ''}`;
                                        }} />} />
                                        <Legend />
                                        {Object.entries(consumptionConfig).map(([key, value]) => (
                                            <Line key={key} type="monotone" dataKey={key} stroke={`var(--color-${key})`} name={key} unit={value.unit} />
                                        ))}
                                    </LineChart>
                                </ChartContainer>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

        </div>
    );
}

const StatCard = ({ title, value, unit, icon: Icon }: { title: string; value: number; unit: string; icon: React.ElementType }) => {
    if (!value || value === 0) return null;
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">
                    {value.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">{unit}</p>
            </CardContent>
        </Card>
    )
}


export default StatsPage;
