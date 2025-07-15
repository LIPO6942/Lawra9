
'use client';

import { useState, useEffect } from 'react';
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
import { PlusCircle, UploadCloud, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import { detectDocumentType, DetectDocumentTypeOutput } from '@/ai/flows/detect-document-type';
import { useDocuments } from '@/contexts/document-context';
import { Document } from '@/lib/types';
import { Textarea } from './ui/textarea';

type AnalysisResult = DetectDocumentTypeOutput & Partial<ExtractInvoiceDataOutput>;

interface UploadDocumentDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  documentToEdit?: Document | null;
}

export function UploadDocumentDialog({ open, onOpenChange, documentToEdit = null }: UploadDocumentDialogProps) {
  const [isOpen, setIsOpen] = useState(open || false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Document>>({});
  const { toast } = useToast();
  const { addDocument, updateDocument } = useDocuments();

  const isEditMode = !!documentToEdit;

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);
  
  // Effect to handle opening in edit mode
  useEffect(() => {
    if (isOpen && isEditMode && documentToEdit) {
      setFormData(documentToEdit);
    }
  }, [isOpen, isEditMode, documentToEdit]);

  const handleOpenChange = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setIsOpen(open);
    }
    if (!open) {
      resetDialog();
    }
  };
  
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFileName(selectedFile.name);
      setIsAnalyzing(true);
      
      try {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = async () => {
          const documentDataUri = reader.result as string;

          const [typeResult, invoiceResult] = await Promise.all([
            detectDocumentType({ documentDataUri }),
            extractInvoiceData({ invoiceDataUri: documentDataUri })
          ]);

          const result: AnalysisResult = { ...typeResult, ...invoiceResult };

          const newDocument: Omit<Document, 'id' | 'createdAt'> = {
              name: selectedFile.name,
              category: result.documentType as Document['category'] || 'Autre',
              supplier: result.supplier,
              amount: result.amount ? parseFloat(result.amount) : undefined,
              dueDate: result.dueDate ? new Date(result.dueDate).toISOString() : undefined,
              summary: result.summary,
              fileUrl: URL.createObjectURL(selectedFile)
          };
          
          addDocument({
              ...newDocument,
              id: `doc-${Date.now()}`,
              createdAt: new Date().toISOString(),
          });

          toast({
            title: "Document analysé et enregistré !",
            description: `Le document "${selectedFile.name}" a été ajouté avec succès.`,
          });

          handleOpenChange(false);
        };
      } catch(error) {
        console.error('Analysis failed:', error);
        toast({
            variant: 'destructive',
            title: "L'analyse a échoué",
            description: "Nous n'avons pas pu analyser votre document. Veuillez réessayer."
        });
        handleOpenChange(false);
      }
    }
  };

  const handleFormChange = (field: keyof Document, value: string | number) => {
    setFormData(prev => ({...prev, [field]: value}));
  }

  const resetDialog = () => {
    setIsAnalyzing(false);
    setFileName(null);
    setFormData({});
     if(onOpenChange && !isEditMode) {
      onOpenChange(false);
    }
  };

  const handleSave = () => {
    if (isEditMode && documentToEdit) {
      updateDocument(documentToEdit.id, formData);
      toast({
        title: "Document modifié !",
        description: `Le document "${formData.name}" a été mis à jour.`,
      });
    }
    handleOpenChange(false);
  };

  const dialogTitle = isEditMode ? "Modifier le document" : "Ajouter un nouveau document";
  const dialogDescription = isEditMode 
    ? "Modifiez les informations de votre document ci-dessous." 
    : "Uploadez votre fichier. Notre IA l'analysera et l'enregistrera automatiquement pour vous.";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!isEditMode && (
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg">
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter un document
            </Button>
          </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px] rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-headline">{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        
        {!isEditMode && !isAnalyzing && (
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

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="font-semibold text-lg">Analyse en cours...</p>
            <p className="text-sm text-muted-foreground">{fileName}</p>
          </div>
        )}

        {isEditMode && (
          <>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
              <div className="space-y-2">
                <Label htmlFor="doc-name">Nom du document</Label>
                <Input id="doc-name" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-category">Catégorie</Label>
                  <Select value={formData.category || ''} onValueChange={(value) => handleFormChange('category', value)}>
                      <SelectTrigger id="doc-category" className="w-full">
                          <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                           <SelectItem value="Facture">Facture</SelectItem>
                           <SelectItem value="Reçu">Reçu</SelectItem>
                           <SelectItem value="Maison">Maison</SelectItem>
                           <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-supplier">Fournisseur</Label>
                  <Input id="doc-supplier" value={formData.supplier || ''} onChange={e => handleFormChange('supplier', e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-amount">Montant (TND)</Label>
                  <Input id="doc-amount" type="number" value={formData.amount || ''} onChange={e => handleFormChange('amount', e.target.value ? parseFloat(e.target.value) : '')} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-due-date">Date d'échéance</Label>
                  <Input id="doc-due-date" type="date" value={formData.dueDate ? new Date(formData.dueDate).toISOString().split('T')[0] : ''} onChange={e => handleFormChange('dueDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-summary">Résumé</Label>
                  <Textarea id="doc-summary" value={formData.summary || ''} onChange={e => handleFormChange('summary', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg">Enregistrer les modifications</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
