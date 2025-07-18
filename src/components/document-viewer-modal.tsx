
'use client';

import { Document } from '@/lib/types';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from './ui/button';
import { FileQuestion } from 'lucide-react';

interface DocumentViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document | null;
}

export function DocumentViewerModal({ open, onOpenChange, document }: DocumentViewerModalProps) {
  if (!document || !document.fileUrl) {
    return null;
  }
  
  // We can infer the type from the URL for Firebase Storage links, but it's simpler to just try embedding.
  const isPdf = document.fileUrl.includes('.pdf') || document.name.toLowerCase().endsWith('.pdf');
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].some(ext => document.name.toLowerCase().endsWith(ext));

  // A simple way to check if we should even try to use an iframe
  // Firebase Storage URLs will not be data URLs.
  const isSupported = !document.fileUrl.startsWith('data:');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="truncate">{document.name}</DialogTitle>
           <DialogDescription>
            Prévisualisation du document. <a href={document.fileUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Ouvrir dans un nouvel onglet</a>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto px-6 pb-6">
            {isSupported ? (
                 <iframe
                    src={document.fileUrl}
                    className="w-full h-full border rounded-md"
                    title={'Visionneuse de document'}
                />
            ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-lg h-full">
                    <FileQuestion className="h-12 w-12 text-destructive" />
                    <h2 className="mt-4 text-xl font-semibold">Format de fichier non supporté pour la prévisualisation</h2>
                    <p className="mt-2 text-muted-foreground">Veuillez télécharger le fichier pour le consulter.</p>
                    <Button asChild className="mt-6">
                      <a href={document.fileUrl} target="_blank" rel="noopener noreferrer">Télécharger</a>
                    </Button>
                </div>
            )}
        </div>
        <div className="p-6 pt-0 mt-auto border-t">
            <DialogClose asChild>
                <Button variant="outline" className="w-full mt-4">Fermer</Button>
            </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

    