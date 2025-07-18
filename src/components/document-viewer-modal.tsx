
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
  
  // This component is no longer used for viewing files, but kept in case it's needed for other purposes.
  // The functionality to view a file has been removed as we are no longer storing the file itself.

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="truncate">{document.name}</DialogTitle>
           <DialogDescription>
            Détails du document.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto px-6 pb-6">
            <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-lg h-full">
                <FileQuestion className="h-12 w-12 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Pas de prévisualisation disponible</h2>
                <p className="mt-2 text-muted-foreground">La sauvegarde des images de document n'est pas activée.</p>
            </div>
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
