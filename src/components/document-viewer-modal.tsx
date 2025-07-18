
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

const getMimeType = (url: string) => {
    const match = url.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
    return match ? match[1] : 'application/octet-stream';
}

export function DocumentViewerModal({ open, onOpenChange, document }: DocumentViewerModalProps) {
  if (!document || !document.fileUrl) {
    return null;
  }

  const mimeType = getMimeType(document.fileUrl);
  const isPdf = mimeType === 'application/pdf';
  const isImage = mimeType.startsWith('image/');
  const isSupported = isPdf || isImage;
  
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = document.fileUrl;
    link.download = document.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="truncate">{document.name}</DialogTitle>
           <DialogDescription>
            Prévisualisation du document.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-auto px-6">
            {isSupported ? (
                 <iframe
                    src={document.fileUrl}
                    className="w-full h-full border-0"
                    title={'Visionneuse de document'}
                />
            ) : (
                <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-lg h-full">
                    <FileQuestion className="h-12 w-12 text-destructive" />
                    <h2 className="mt-4 text-xl font-semibold">Format de fichier non supporté</h2>
                    <p className="mt-2 text-muted-foreground">La prévisualisation n'est pas disponible pour ce type de fichier.</p>
                    <p className="text-xs text-muted-foreground mt-1">(Type: {mimeType})</p>
                    <Button onClick={handleDownload} className="mt-6">Télécharger le fichier</Button>
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
