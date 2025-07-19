
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
  if (!document) {
    return null;
  }

  const isImage = document.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(document.name) || document.fileUrl.startsWith('data:image');

  const handleOpenFile = () => {
    if (document.fileUrl) {
        window.open(document.fileUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="truncate">{document.name}</DialogTitle>
           <DialogDescription>
            Catégorie: {document.category}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto px-6 pb-6">
          {document.fileUrl ? (
             isImage ? (
                <img src={document.fileUrl} alt={`Prévisualisation de ${document.name}`} className="max-w-full h-auto mx-auto rounded-md" />
             ) : (
                 <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-lg h-full">
                    <FileQuestion className="h-12 w-12 text-muted-foreground" />
                    <h2 className="mt-4 text-xl font-semibold">Aperçu non disponible</h2>
                    <p className="mt-2 text-muted-foreground">L'aperçu pour ce type de fichier n'est pas supporté.</p>
                    <Button onClick={handleOpenFile} className="mt-4">Ouvrir dans un nouvel onglet</Button>
                </div>
             )
          ) : (
            <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-lg h-full">
                <FileQuestion className="h-12 w-12 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Pas de fichier associé</h2>
                <p className="mt-2 text-muted-foreground">Aucun fichier n'a été sauvegardé pour ce document.</p>
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
