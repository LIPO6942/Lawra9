
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
    case 'STEG': return <Zap className="h-5 w-5 text-yellow-500" />;
    case 'SONEDE': return <Droplets className="h-5 w-5 text-blue-500" />;
    case 'Reçu Bancaire': return <Landmark className="h-5 w-5 text-indigo-500" />;
    case 'Internet': return <Wifi className="h-5 w-5 text-purple-500" />;
    case 'Maison': return <Home className="h-5 w-5 text-green-500" />;
    case 'Assurance': return <Shield className="h-5 w-5 text-red-500" />;
    default: return <FileText className="h-5 w-5 text-gray-500" />;
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
      label: fr.localize?.month(i, { width: 'wide' }).replace(/^\w/, c => c.toUpperCase())
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
        const amount = parseFloat(doc.amount.replace(',', '.'));
        if (isNaN(amount)) return acc;
        
        const categoryKey = doc.category || 'Autre';

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
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
        <div className="flex flex-col md:flex-row items-start justify-between space-y-4 md:space-y-0 md:items-center">
            <div className="flex items-center space-x-3">
                <History className="h-8 w-8 text-accent"/>
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-headline">Historique des dépenses</h2>
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
        
        <Card className="rounded-2xl shadow-sm">
            <CardHeader>
                <CardTitle className="font-headline">
                    Résumé pour : {selectedMonth === 'all' ? `l'année ${selectedYear}` : `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`}
                </CardTitle>
                <CardDescription>
                    Total des dépenses pour la période sélectionnée.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {Object.keys(filteredExpenses).length > 0 ? (
                    <div className="space-y-4">
                        {Object.entries(filteredExpenses).map(([category, data]) => (
                            <div key={category} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg hover:bg-secondary/50 space-y-2 sm:space-y-0">
                                <div className="flex items-center gap-4">
                                    <CategoryIcon category={category as Document['category']} />
                                    <div>
                                        <p className="font-semibold">{category}</p>
                                        <p className="text-sm text-muted-foreground">{data.count} document{data.count > 1 ? 's' : ''}</p>
                                    </div>
                                </div>
                                <p className="font-mono text-lg font-medium self-end sm:self-center">{data.total.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</p>
                            </div>
                        ))}
                    </div>
                ) : (
                     <div className="flex flex-col items-center justify-center py-16 text-center">
                        <p className="text-muted-foreground">Aucune dépense trouvée pour cette période.</p>
                        <p className="text-xs text-muted-foreground/80">Essayez de sélectionner une autre année ou un autre mois.</p>
                    </div>
                )}
            </CardContent>
            {Object.keys(filteredExpenses).length > 0 && (
                <CardFooter className="flex justify-end pt-6 border-t">
                    <div className="text-right">
                        <p className="text-muted-foreground">Total général</p>
                        <p className="text-2xl font-bold font-headline">{totalAmount.toLocaleString('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} TND</p>
                    </div>
                </CardFooter>
            )}
        </Card>
    </div>
  );
}
