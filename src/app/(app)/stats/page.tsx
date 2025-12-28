
'use client';

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDocuments } from '@/contexts/document-context';
import { BarChartHorizontal, Droplets, Zap, Wifi, TrendingUp, Info, Wind } from 'lucide-react';
import { getYear, format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line } from 'recharts';
import { Document } from '@/lib/types';

const monthOrder = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

const expenseCategoryConfig = {
    "STEG": { label: "STEG", color: "hsl(var(--chart-4))" },
    "SONEDE": { label: "SONEDE", color: "hsl(var(--chart-1))" },
    "Internet": { label: "Internet", color: "hsl(var(--chart-3))" },
    "Reçu Bancaire": { label: "Banque", color: "hsl(var(--chart-2))" },
    "Recus de caisse": { label: "Recus de caisse", color: "hsl(var(--chart-6, 27 87% 67%))" },
    "Autre": { label: "Autre", color: "hsl(var(--chart-5))" },
};

const consumptionConfig = {
    "Électricité": { color: "var(--color-elec)", unit: "kWh" },
    "Gaz": { color: "var(--color-gaz)", unit: "m³" },
    "Eau": { color: "var(--color-eau)", unit: "m³" },
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
                const categoryKey = doc.category || 'Autre';
                const amount = parseFloat(String(doc.amount).replace(',', '.'));
                if (!isNaN(amount)) {
                    if (!dataByYearAndMonth[year][month].expenses[categoryKey]) dataByYearAndMonth[year][month].expenses[categoryKey] = 0;
                    dataByYearAndMonth[year][month].expenses[categoryKey] += amount;
                }
            }

            // Process consumption
            if (doc.category === 'STEG') {
                if (doc.consumptionQuantity) dataByYearAndMonth[year][month].consumption['Électricité'] = (dataByYearAndMonth[year][month].consumption['Électricité'] || 0) + parseQuantity(doc.consumptionQuantity);
                if (doc.gasConsumptionQuantity) dataByYearAndMonth[year][month].consumption['Gaz'] = (dataByYearAndMonth[year][month].consumption['Gaz'] || 0) + parseQuantity(doc.gasConsumptionQuantity);
            } else if (doc.category === 'SONEDE' && doc.consumptionQuantity) {
                dataByYearAndMonth[year][month].consumption['Eau'] = (dataByYearAndMonth[year][month].consumption['Eau'] || 0) + parseQuantity(doc.consumptionQuantity);
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
                        <StatCard title="Dépense STEG / mois" value={expenseAverages['STEG']?.avg} unit="TND" icon={Zap} />
                        <StatCard title="Dépense SONEDE / mois" value={expenseAverages['SONEDE']?.avg} unit="TND" icon={Droplets} />
                        <StatCard title="Conso. Élec / mois" value={consumptionAverages['Électricité']?.avg} unit="kWh" icon={Zap} />
                        <StatCard title="Conso. Gaz / mois" value={consumptionAverages['Gaz']?.avg} unit="m³" icon={Wind} />
                        <StatCard title="Conso. Eau / mois" value={consumptionAverages['Eau']?.avg} unit="m³" icon={Droplets} />
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        <Card className="rounded-xl shadow-sm">
                            <CardHeader>
                                <CardTitle className="font-headline text-xl flex items-center gap-2"><BarChartHorizontal className="h-5 w-5" />Dépenses par Catégorie ({selectedYear})</CardTitle>
                                <CardDescription>Évolution de vos dépenses mensuelles en TND.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[350px] pr-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={expenseData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'TND', angle: -90, position: 'insideLeft', offset: 10, fill: '#888' }} />
                                        <Tooltip content={<CustomTooltip unit="TND" />} />
                                        <Legend />
                                        {Object.entries(expenseCategoryConfig).map(([key, value]) => (
                                            <Bar key={key} dataKey={key} fill={value.color} name={key} radius={[4, 4, 0, 0]} stackId="a" />
                                        ))}
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        <Card className="rounded-xl shadow-sm">
                            <CardHeader>
                                <CardTitle className="font-headline text-xl flex items-center gap-2"><TrendingUp className="h-5 w-5" />Consommation par Ressource ({selectedYear})</CardTitle>
                                <CardDescription>Évolution de votre consommation en kWh et m³.</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[350px] pr-8">
                                <style>{`
                                :root {
                                    --color-elec: hsl(var(--chart-4));
                                    --color-gaz: hsl(var(--chart-2));
                                    --color-eau: hsl(var(--chart-1));
                                }
                            `}</style>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={consumptionData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        {Object.entries(consumptionConfig).map(([key, value]) => (
                                            <Line key={key} type="monotone" dataKey={key} stroke={value.color} name={key} unit={value.unit} />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
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


const CustomTooltip = ({ active, payload, label, unit }: any) => {
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
                            <span className="font-semibold ml-4">{pld.value.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {pld.payload.unit || pld.unit || unit || ''}</span>
                        </div>
                    ))}
                </div>
                {payload.length > 1 && total > 0 && unit && (
                    <>
                        <div className="my-2 h-px bg-border" />
                        <div className="flex items-center justify-between font-bold">
                            <span>Total:</span>
                            <span className="ml-4">{total.toLocaleString('fr-TN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {unit || ''}</span>
                        </div>
                    </>
                )}
            </div>
        );
    }
    return null;
};

export default StatsPage;
