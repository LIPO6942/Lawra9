
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Document } from '@/lib/types';
import { useDocuments } from '@/contexts/document-context';
import { useToast } from '@/hooks/use-toast';
import { compareInvoices, CompareInvoicesOutput } from '@/ai/flows/compare-invoices-flow';
import { Loader2, GitCompareArrows, ArrowRight, FileText, Wallet, BarChart2, Zap, Wind, Lightbulb, TrendingUp, TrendingDown, CircleCheck, Info, Droplets } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';

interface CompareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentsToCompare: Document[];
}

const fileToDataUrl = (file: File | Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export function CompareDialog({ open, onOpenChange, documentsToCompare }: CompareDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<CompareInvoicesOutput | null>(null);
  const { toast } = useToast();
  const { getDocumentById } = useDocuments();

  useEffect(() => {
    if (open && documentsToCompare.length === 2) {
      handleCompare();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentsToCompare]);
  
  const handleCompare = async () => {
    setIsLoading(true);
    setResult(null);

    try {
        const [doc1, doc2] = documentsToCompare;
        
        const docWithFile1 = getDocumentById(doc1.id);
        const docWithFile2 = getDocumentById(doc2.id);

        if (!docWithFile1?.file || !docWithFile2?.file) {
            toast({ variant: 'destructive', title: 'Fichiers manquants', description: 'Impossible de comparer des documents sans leurs fichiers sources.'});
            onOpenChange(false);
            return;
        }

        const [dataUri1, dataUri2] = await Promise.all([
            fileToDataUrl(docWithFile1.file),
            fileToDataUrl(docWithFile2.file)
        ]);

      const comparisonResult = await compareInvoices({
        invoice1DataUri: dataUri1,
        invoice2DataUri: dataUri2,
        invoice1Name: docWithFile1.name,
        invoice2Name: docWithFile2.name,
      });

      setResult(comparisonResult);

    } catch (error) {
      console.error('Comparison failed:', error);
      toast({ variant: 'destructive', title: 'Erreur de comparaison', description: 'Une erreur est survenue lors de la comparaison.' });
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  const doc1 = documentsToCompare[0];
  const doc2 = documentsToCompare[1];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-headline text-xl">
            <GitCompareArrows className="h-6 w-6 text-primary"/>
            Analyse Comparative
          </DialogTitle>
          <DialogDescription>
             Analyse des différences entre les deux documents sélectionnés.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 px-1 max-h-[70vh] overflow-y-auto pr-4 -mr-4">
             <div className="flex items-center justify-center gap-4 text-sm font-semibold text-center mb-6">
                <div className="flex-1 p-2 border rounded-md bg-muted/50 min-w-0">
                    <p className="text-xs text-muted-foreground">{result?.period1 || 'Ancienne facture'}</p>
                    <p className="break-words font-bold" title={doc1.name}>{doc1.name}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0"/>
                 <div className="flex-1 p-2 border rounded-md bg-muted/50 min-w-0">
                    <p className="text-xs text-muted-foreground">{result?.period2 || 'Nouvelle facture'}</p>
                    <p className="break-words font-bold" title={doc2.name}>{doc2.name}</p>
                </div>
             </div>

            {isLoading && (
              <div className="flex flex-col items-center justify-center h-48">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 font-medium text-muted-foreground">Analyse en cours...</p>
              </div>
            )}

            {result && (
                <div className="space-y-4 animate-in fade-in-50">
                    <Alert className="bg-primary/5 border-primary/20">
                      <Info className="h-4 w-4" />
                      <AlertTitle className="font-bold text-base">Synthèse</AlertTitle>
                      <AlertDescription className="text-base text-foreground/90">
                        {result.summary}
                      </AlertDescription>
                    </Alert>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <CostCard difference={result.costDifference} percentage={result.costPercentageChange} />
                      <ConsumptionCard differences={result.consumptionDifferences} />
                    </div>

                     {result.insights && result.insights.length > 0 && (
                        <Card>
                            <CardHeader className="flex-row items-center gap-3 space-y-0 p-4">
                                <Lightbulb className="h-5 w-5 text-yellow-400"/>
                                <CardTitle className="text-base">Observations Clés</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <ul className="space-y-2 text-sm list-disc pl-5">
                                    {result.insights.map((insight, i) => <li key={i}>{insight}</li>)}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    
                     {result.recommendations && result.recommendations.length > 0 && (
                        <Card>
                            <CardHeader className="flex-row items-center gap-3 space-y-0 p-4">
                                <CircleCheck className="h-5 w-5 text-green-500"/>
                                <CardTitle className="text-base">Recommandations</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                               <ul className="space-y-2 text-sm list-disc pl-5">
                                    {result.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


const CostCard = ({ difference, percentage }: { difference?: string, percentage?: string }) => {
    if (!difference) return null;

    const isPositive = difference.startsWith('+');
    const colorClass = isPositive ? 'text-red-500' : 'text-green-600';
    const Icon = isPositive ? TrendingUp : TrendingDown;
    
    return (
         <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Variation du Coût</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                <div className={cn("text-2xl font-bold", colorClass)}>{difference}</div>
                {percentage && (
                    <p className={cn("text-xs", colorClass, "flex items-center gap-1")}>
                        <Icon className="h-4 w-4" /> {percentage}
                    </p>
                )}
            </CardContent>
        </Card>
    );
};

const ConsumptionCard = ({ differences }: { differences?: { type: string, difference: string }[] }) => {
    if (!differences || differences.length === 0) {
       return (
         <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Variation de Consommation</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center h-20">
                <p className="text-sm text-muted-foreground">Aucune donnée de consommation</p>
            </CardContent>
        </Card>
       );
    }

    const getIcon = (type: string) => {
        if (type.toLowerCase().includes('gaz')) return Wind;
        if (type.toLowerCase().includes('eau')) return Droplets;
        return Zap; // Default to electricity
    }
    
    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Variation de Consommation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
                {differences.map((item, index) => {
                    const isPositive = item.difference.startsWith('+');
                    const colorClass = isPositive ? 'text-red-500' : 'text-green-600';
                    const Icon = getIcon(item.type);
                    return (
                         <div key={index} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                                <Icon className={cn("h-4 w-4", colorClass)} />
                                <span className="font-medium">{item.type}</span>
                            </div>
                            <Badge variant={isPositive ? "destructive" : "secondary"} className={cn(isPositive ? "bg-red-500/10 text-red-600" : "bg-green-500/10 text-green-600", "font-mono border-none")}>
                                {item.difference}
                            </Badge>
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}
