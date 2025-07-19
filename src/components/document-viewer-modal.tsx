
'use client';

import { Document } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from './ui/button';
import { FileQuestion, ExternalLink, FileText } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document | null;
}

export function DocumentViewerModal({ open, onOpenChange, document }: DocumentViewerModalProps) {
  if (!document) {
    return null;
  }

  const handleOpenFile = () => {
    if (document?.fileUrl) {
      window.open(document.fileUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const getDetail = (label: string, value?: string) => {
    if (!value) return null;
    let displayValue = value;
    if (label.toLowerCase().includes('date')) {
        try {
            const date = parseISO(value);
            if (isValid(date)) {
                displayValue = format(date, 'PPP', { locale: fr });
            }
        } catch(e) {/* ignore invalid date */}
    }
    return (
        <div className="flex justify-between text-sm py-2 border-b">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium text-right">{displayValue}</dd>
        </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="truncate font-headline text-xl">{document.name}</DialogTitle>
          <DialogDescription>
            Catégorie : {document.category}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto px-6 py-4">
            {document.fileUrl ? (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-lg h-full">
                    <FileText className="h-16 w-16 text-primary" />
                    <h2 className="mt-4 text-lg font-semibold">Le document est prêt.</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Ouvrez-le dans un nouvel onglet pour le consulter en toute sécurité et éviter de faire planter l'application.</p>
                    <Button onClick={handleOpenFile} className="mt-6 w-full bg-accent text-accent-foreground hover:bg-accent/90">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Consulter le fichier
                    </Button>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-lg h-full">
                    <FileQuestion className="h-16 w-16 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold">Aucun fichier associé</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Aucun fichier n'a été sauvegardé pour ce document.</p>
                </div>
            )}
        </div>
        
        <div className="p-6 pt-0 mt-auto">
            <DialogClose asChild>
                <Button variant="outline" className="w-full">Fermer</Button>
            </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
