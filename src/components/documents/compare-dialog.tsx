
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Document } from '@/lib/types';
import { useDocuments } from '@/contexts/document-context';
import { useToast } from '@/hooks/use-toast';
import { compareInvoices, CompareInvoicesOutput } from '@/ai/flows/compare-invoices-flow';
import { Loader2, GitCompareArrows, ArrowRight, FileText, Wallet, BarChart2, Zap, Wind } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

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
            Comparaison de Factures
          </DialogTitle>
          <DialogDescription>
             Analyse des différences entre les deux documents sélectionnés.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 px-1">
             <div className="flex items-center justify-center gap-4 text-sm font-semibold text-center">
                <div className="flex-1 p-2 border rounded-md bg-muted/50 min-w-0">
                    <FileText className="mx-auto mb-1 h-5 w-5"/>
                    <p className="break-words" title={doc1.name}>{doc1.name}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0"/>
                 <div className="flex-1 p-2 border rounded-md bg-muted/50 min-w-0">
                    <FileText className="mx-auto mb-1 h-5 w-5"/>
                    <p className="break-words" title={doc2.name}>{doc2.name}</p>
                </div>
             </div>

            {isLoading && (
              <div className="flex flex-col items-center justify-center h-48">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 font-medium text-muted-foreground">Analyse en cours...</p>
              </div>
            )}

            {result && (
                <div className="mt-6 space-y-4 animate-in fade-in-50">
                    <Card>
                       <CardHeader>
                         <CardTitle className="text-base">Résumé de l'analyse</CardTitle>
                       </CardHeader>
                       <CardContent>
                          <p className="text-lg font-semibold text-center leading-relaxed">"{result.summary}"</p>
                       </CardContent>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <InfoCard icon={Wallet} title="Différence de Coût" value={result.costDifference} />
                        <ConsumptionCard title="Différence de Consommation" value={result.consumptionDifference} />
                    </div>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const InfoCard = ({ icon: Icon, title, value }: { icon: React.ElementType, title: string, value?: string }) => {
    if (!value) return null;
    
    let colorClass = 'text-foreground';
    if (value.startsWith('+')) colorClass = 'text-red-500';
    if (value.startsWith('-')) colorClass = 'text-green-600';

    return (
        <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
            <Icon className="h-6 w-6 text-muted-foreground mt-1 shrink-0" />
            <div>
                <p className="font-semibold text-muted-foreground">{title}</p>
                <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
            </div>
        </div>
    )
}


const ConsumptionCard = ({ title, value }: { title: string, value?: string }) => {
    if (!value) return null;

    const parts = value.split(',').map(p => p.trim());

    return (
        <div className="p-4 rounded-lg bg-muted/50">
            <p className="font-semibold text-muted-foreground mb-3">{title}</p>
            <div className="space-y-3">
                {parts.map((part, index) => {
                    const match = part.match(/([+-][\d,.]+)\s*(.+)/);
                    if (!match) return null;

                    const [, diff, name] = match;
                    const colorClass = diff.startsWith('+') ? 'text-red-500' : 'text-green-600';
                    const Icon = name.toLowerCase().includes('gaz') ? Wind : Zap;

                    return (
                         <div key={index} className="flex items-center gap-3">
                            <Icon className={`h-5 w-5 shrink-0 ${colorClass}`} />
                            <div className="flex-1">
                                <span className="font-semibold">{name}</span>
                            </div>
                            <span className={`text-lg font-bold ${colorClass}`}>{diff}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}
