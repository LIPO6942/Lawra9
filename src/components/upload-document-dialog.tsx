'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, UploadCloud, FileCheck, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

type AnalysisResult = {
  documentType: string;
  suggestedCategories: string[];
  supplier?: string;
  amount?: string;
  dueDate?: string;
};

export function UploadDocumentDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [fileName, setFileName] = useState('');
  const [step, setStep] = useState<'upload' | 'analyzing' | 'form'>('upload');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFileName(file.name);
      setStep('analyzing');
      // Simulate AI analysis
      setTimeout(() => {
        // Mocked AI response
        const result: AnalysisResult = {
          documentType: 'Facture',
          suggestedCategories: ['Facture', 'Finance', 'Logement'],
          supplier: 'STEG',
          amount: '145.75',
          dueDate: new Date(new Date().setDate(new Date().getDate() + 10)).toISOString().split('T')[0],
        };
        setAnalysisResult(result);
        setStep('form');
      }, 2500);
    }
  };

  const resetDialog = () => {
    setFileName('');
    setStep('upload');
    setAnalysisResult(null);
  };

  const handleSave = () => {
    toast({
      title: "Document enregistré !",
      description: `Le document "${fileName}" a été ajouté à votre espace.`,
    });
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) {
        resetDialog();
      }
    }}>
      <DialogTrigger asChild>
        <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg">
          <PlusCircle className="mr-2 h-4 w-4" />
          Ajouter un document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px] rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-headline">Ajouter un nouveau document</DialogTitle>
          <DialogDescription>
            Uploadez votre fichier. Notre IA l'analysera pour extraire les informations clés.
          </DialogDescription>
        </DialogHeader>
        
        {step === 'upload' && (
          <div className="py-8">
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center transition hover:border-accent">
                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                <p className="font-semibold">Cliquez ou glissez-déposez pour uploader</p>
                <p className="text-xs text-muted-foreground">PDF, PNG, JPG (max. 5MB)</p>
              </div>
            </label>
            <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="font-semibold text-lg">Analyse en cours...</p>
            <p className="text-sm text-muted-foreground">{fileName}</p>
          </div>
        )}

        {step === 'form' && analysisResult && (
          <div className="space-y-4 py-4">
             <div className="flex items-center space-x-3 rounded-md bg-green-50 p-3 border border-green-200 dark:bg-green-950 dark:border-green-800">
                <FileCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Analyse terminée avec succès !</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-name">Nom du document</Label>
              <Input id="doc-name" defaultValue={fileName} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="doc-category">Catégorie</Label>
                <Select defaultValue={analysisResult.documentType}>
                    <SelectTrigger id="doc-category" className="w-full">
                        <SelectValue placeholder="Sélectionnez une catégorie" />
                    </SelectTrigger>
                    <SelectContent>
                        {analysisResult.suggestedCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {analysisResult.supplier && (
                 <div className="space-y-2">
                    <Label htmlFor="doc-supplier">Fournisseur</Label>
                    <Input id="doc-supplier" defaultValue={analysisResult.supplier} />
                </div>
            )}
            {analysisResult.amount && (
                 <div className="space-y-2">
                    <Label htmlFor="doc-amount">Montant (TND)</Label>
                    <Input id="doc-amount" type="number" defaultValue={analysisResult.amount} />
                </div>
            )}
            {analysisResult.dueDate && (
                 <div className="space-y-2">
                    <Label htmlFor="doc-due-date">Date d'échéance</Label>
                    <Input id="doc-due-date" type="date" defaultValue={analysisResult.dueDate} />
                </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'form' && (
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg">Enregistrer</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
