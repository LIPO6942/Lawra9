
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDocuments } from '@/contexts/document-context';
import { History, FileText, Droplets, Zap, Landmark, Wifi, Shield, Home } from 'lucide-react';
import { Document } from '@/lib/types';
import { getYear, getMonth, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

const CategoryIcon = ({ category }: { category: Document['category'] }) => {
    switch (category) {
        case 'STEG': return <Zap className="h-6 w-6 text-yellow-400" />;
        case 'SONEDE': return <Droplets className="h-6 w-6 text-blue-400" />;
        case 'Reçu Bancaire': return <Landmark className="h-6 w-6 text-indigo-400" />;
        case 'Internet': return <Wifi className="h-6 w-6 text-purple-400" />;
        case 'Maison': return <Home className="h-6 w-6 text-green-400" />;
        case 'Assurance': return <Shield className="h-6 w-6 text-red-400" />;
        case 'Recus de caisse': return <FileText className="h-6 w-6 text-orange-400" />;
        default: return <FileText className="h-6 w-6 text-gray-400" />;
    }
};

const getDocumentDate = (doc: Document): Date | null => {
    const datePriority = [doc.issueDate, doc.billingEndDate, doc.dueDate, doc.createdAt];
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

type Month = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export default function HistoryPage() {
    const { documents } = useDocuments();
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState<string>('all');

    const { years, months, filteredExpenses, totalAmount } = useMemo(() => {
        const years = [...new Set(documents.map(doc => {
            const date = getDocumentDate(doc);
            return date ? getYear(date).toString() : null;
        }).filter(Boolean))].sort((a, b) => b!.localeCompare(a!)) as string[];

        const months = Array.from({ length: 12 }, (_, i) => ({
            value: (i).toString(),
            label: fr.localize?.month(i as Month, { width: 'wide' }).replace(/^\w/, c => c.toUpperCase())
        }));

        const filteredDocs = documents.filter(doc => {
            const date = getDocumentDate(doc);
            if (!date) return false;

            const yearMatch = getYear(date).toString() === selectedYear;
            const monthMatch = selectedMonth === 'all' || getMonth(date).toString() === selectedMonth;

            return yearMatch && monthMatch;
        });

        const expensesByCategory = filteredDocs.reduce((acc, doc) => {
            if (!doc.amount) return acc;
            const amount = parseFloat(String(doc.amount).replace(',', '.'));
            if (isNaN(amount)) return acc;

            const categoryKey = doc.category || 'Recus de caisse';

            if (!acc[categoryKey]) {
                acc[categoryKey] = { total: 0, count: 0 };
            }
            acc[categoryKey].total += amount;
            acc[categoryKey].count += 1;

            return acc;
        }, {} as Record<string, { total: number; count: number }>);

        const totalAmount = Object.values(expensesByCategory).reduce((sum, cat) => sum + cat.total, 0);

        return {
            years,
            months,
            filteredExpenses: expensesByCategory,
            totalAmount
        };
    }, [documents, selectedYear, selectedMonth]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-start justify-between space-y-4 md:space-y-0 md:items-center">
                <div className="flex items-center space-x-3">
                    <History className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Historique des dépenses</h1>
                        <p className="text-muted-foreground">Analysez vos dépenses passées par catégorie.</p>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-full sm:w-[120px] rounded-lg">
                            <SelectValue placeholder="Année" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-full sm:w-[150px] rounded-lg">
                            <SelectValue placeholder="Mois" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Toute l'année</SelectItem>
                            {months.map(month => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">
                        Résumé pour : {selectedMonth === 'all' ? `l'année ${selectedYear}` : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {Object.keys(filteredExpenses).length > 0 ? (
                        <div className="space-y-2">
                            {Object.entries(filteredExpenses).sort(([, a], [, b]) => b.total - a.total).map(([category, data]) => (
                                <div key={category} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                                    <div className="flex items-center gap-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                                            <CategoryIcon category={category as Document['category']} />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{category}</p>
                                            <p className="text-sm text-muted-foreground">{data.count} document{data.count > 1 ? 's' : ''}</p>
                                        </div>
                                    </div>
                                    <p className="font-mono text-lg font-medium">{data.total.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</p>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <p className="text-muted-foreground font-semibold">Aucune dépense trouvée pour cette période.</p>
                            <p className="text-sm text-muted-foreground/80 mt-1">Essayez de sélectionner une autre année ou un autre mois.</p>
                        </div>
                    )}
                </CardContent>
                {Object.keys(filteredExpenses).length > 0 && (
                    <CardFooter className="flex justify-end pt-6 border-t">
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Total Général</p>
                            <p className="text-2xl font-bold font-headline">{totalAmount.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</p>
                        </div>
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
