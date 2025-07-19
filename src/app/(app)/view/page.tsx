
'use client';

import { useSearchParams } from 'next/navigation';
import { useDocuments } from '@/contexts/document-context';
import { useEffect, useState } from 'react';
import { Document } from '@/lib/types';
import { Loader2, FileQuestion, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DocumentViewPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { getDocumentById } = useDocuments();
  const [document, setDocument] = useState<Document | null | undefined>(undefined);
  const [isImage, setIsImage] = useState(false);

  useEffect(() => {
    if (id) {
      const doc = getDocumentById(id);
      setDocument(doc);
      if (doc?.fileUrl) {
        const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileUrl) || doc.fileUrl.startsWith('data:image');
        setIsImage(isImg);
      }
    } else {
      setDocument(null);
    }
  }, [id, getDocumentById]);

  if (document === undefined) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-muted">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement du document...</p>
      </div>
    );
  }

  if (!document || !document.fileUrl) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-muted text-center p-4">
        <FileQuestion className="h-16 w-16 text-destructive" />
        <h1 className="mt-6 text-2xl font-bold">Document non trouvé</h1>
        <p className="mt-2 text-muted-foreground">L'identifiant du document est manquant ou invalide, ou le document n'a pas de fichier associé.</p>
        <Button asChild className="mt-6">
          <Link href="/documents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux documents
          </Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen w-full flex-col bg-muted">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6 sticky top-0 z-10">
        <h1 className="text-lg font-semibold truncate pr-4">{document.name}</h1>
        <Button asChild variant="outline">
          <Link href={document.category === 'Maison' ? '/maison' : '/documents'}>
             <ArrowLeft className="mr-2 h-4 w-4" />
             Retour
          </Link>
        </Button>
      </header>
      <main className="flex-1">
        {isImage ? (
            <div className="w-full h-full p-4 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={document.fileUrl} alt={document.name} className="max-w-full max-h-full object-contain" />
            </div>
        ) : (
          <embed src={document.fileUrl} type="application/pdf" className="h-full w-full" />
        )}
      </main>
    </div>
  );
}
