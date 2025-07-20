
'use client';

import { useState, useEffect, type ReactNode } from 'react';
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
import { PlusCircle, Upload, Loader2, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useDocuments } from '@/contexts/document-context';
import { Document, DocumentWithFile } from '@/lib/types';

interface MaisonUploadDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  documentToEdit?: Document | null;
  children?: ReactNode;
}

const maisonCategories = [
  "Contrat d'acquisition",
  "Tableau d'amortissement",
  "Contrat de mariage",
  "Plan de la maison",
  "Assurance habitation",
  "Taxe municipale",
  "Autre document maison"
];

export function MaisonUploadDialog({ open, onOpenChange, documentToEdit = null, children }: MaisonUploadDialogProps) {
  const [isOpen, setIsOpen] = useState(open || false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  
  const [formData, setFormData] = useState<Partial<Document>>({});
  const { toast } = useToast();
  const { addDocument, updateDocument } = useDocuments();
  
  const isEditMode = !!documentToEdit;

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
    if (!open) {
        resetDialog();
    }
  }, [open]);
  
  useEffect(() => {
    if (isOpen && isEditMode && documentToEdit) {
      setFormData(documentToEdit);
    } else if (isOpen && !isEditMode) {
      setFormData({ category: 'Maison' });
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

  const resetDialog = () => {
    setIsProcessing(false);
    setFileToUpload(null);
    setFormData({});
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFileToUpload(selectedFile);
      setFormData(prev => ({
        ...prev,
        name: selectedFile.name.split('.').slice(0, -1).join('.') || selectedFile.name,
      }));
    }
  };

  const handleFormChange = (field: keyof Document, value: string | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast({ variant: 'destructive', title: "Le nom du document est requis" });
      return;
    }

    setIsProcessing(true);
    
    try {
      if (isEditMode && documentToEdit) {
        // Pass fileToUpload which can be null if user didn't change the file
        await updateDocument(documentToEdit.id, formData, fileToUpload);
        toast({ title: "Document modifié !", description: `Le document "${formData.name}" a été mis à jour.`});
      } else {
        const docToAdd: DocumentWithFile = {
            name: formData.name || 'Nouveau document',
            category: 'Maison',
            subCategory: formData.subCategory,
            file: fileToUpload || undefined,
        };
        await addDocument(docToAdd);
        toast({ title: "Document archivé !", description: `"${docToAdd.name}" a été ajouté à votre espace Maison.` });
      }
        
      handleOpenChange(false);

    } catch (error: any)
      {
          console.error("Save error:", error);
          toast({
              variant: 'destructive',
              title: "Erreur de sauvegarde",
              description: error.message || "Un problème est survenu. Veuillez réessayer."
          });
      }
     finally {
      setIsProcessing(false);
    }
  };

  const dialogTitle = isEditMode ? "Modifier le document" : "Archiver un document";
  const dialogDescription = isEditMode ? "Modifiez les informations de votre document." : "Donnez un nom et une catégorie à votre document.";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <PlusCircle className="mr-2 h-4 w-4" />
            Archiver un document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        {isProcessing ? (
             <div className="flex flex-col items-center justify-center space-y-4 py-12">
                <Loader2 className="h-16 w-16 animate-spin text-accent" />
                <p className="font-semibold text-lg">Sauvegarde en cours...</p>
             </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="file-upload">Fichier</Label>
                {fileToUpload || formData.fileUrl ? (
                    <div className="flex items-center space-x-2 rounded-md bg-muted p-2">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground flex-1 truncate">{fileToUpload?.name || formData.name}</span>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                ) : (
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-8 text-center transition hover:border-accent">
                      <Upload className="h-10 w-10 text-muted-foreground" />
                      <p className="font-semibold">Choisissez un fichier</p>
                      <p className="text-xs text-muted-foreground">Nommera le document automatiquement</p>
                    </div>
                  </label>
                )}
                <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} />
              </div>
            
            <div className="space-y-2">
              <Label htmlFor="doc-name">Nom du document</Label>
              <Input id="doc-name" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="doc-maison-category">Catégorie du document</Label>
              <Select value={formData.subCategory || ''} onValueChange={(value) => handleFormChange('subCategory', value)}>
                <SelectTrigger id="doc-maison-category" className="w-full">
                    <SelectValue placeholder="Sélectionnez une catégorie" />
                </SelectTrigger>
                <SelectContent>
                      {maisonCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        
        {!isProcessing && (
          <DialogFooter>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">Enregistrer</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
