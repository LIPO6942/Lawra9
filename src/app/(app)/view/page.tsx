
'use client';

import { useSearchParams } from 'next/navigation';
import { useDocuments } from '@/contexts/document-context';
import { useEffect, useState, Suspense } from 'react';
import { Document, SubFile } from '@/lib/types';
import { Loader2, FileQuestion, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

function DocumentView() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { getDocumentById } = useDocuments();
  const [document, setDocument] = useState<Document | null | undefined>(undefined);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  useEffect(() => {
    if (id) {
      const doc = getDocumentById(id);
      setDocument(doc);
    } else {
      setDocument(null);
    }
  }, [id, getDocumentById]);

  const activeFile = useMemo((): SubFile | { fileUrl?: string, name: string, file?: Blob | File } | undefined => {
    if (!document) return undefined;
    if (document.category === 'Maison' && document.files && document.files.length > 0) {
      return document.files[activeFileIndex];
    }
    // Fallback for single-file documents
    return { fileUrl: document.fileUrl, name: document.name, file: document.file };
  }, [document, activeFileIndex]);
  
  const isImage = useMemo(() => {
    if (!activeFile) return false;
    
    // Check file type from the Blob/File if available
    if (activeFile.file && activeFile.file.type) {
        return activeFile.file.type.startsWith('image/');
    }
    // Fallback to checking URL
    const url = activeFile.fileUrl || '';
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url) || url.startsWith('data:image');
  }, [activeFile]);


  if (document === undefined) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-muted">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Chargement du document...</p>
      </div>
    );
  }
  
  const hasMultipleFiles = document?.category === 'Maison' && document.files && document.files.length > 1;

  if (!document || !activeFile?.fileUrl) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-muted text-center p-4">
        <FileQuestion className="h-16 w-16 text-destructive" />
        <h1 className="mt-6 text-2xl font-bold">Document non trouvé</h1>
        <p className="mt-2 text-muted-foreground">L'identifiant du document est manquant, invalide, ou le dossier ne contient aucun fichier.</p>
        <Button asChild className="mt-6">
          <Link href="/documents">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux documents
          </Link>
        </Button>
      </div>
    );
  }
  
  const goNext = () => {
    if (document?.files) {
      setActiveFileIndex(prev => (prev + 1) % document.files!.length);
    }
  }
  
  const goPrev = () => {
     if (document?.files) {
      setActiveFileIndex(prev => (prev - 1 + document.files!.length) % document.files!.length);
    }
  }
  
  return (
    <div className="flex h-screen w-full flex-col bg-muted">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4 sm:px-6 sticky top-0 z-10">
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate pr-4" title={document.name}>{document.name}</h1>
          {hasMultipleFiles && <p className="text-xs text-muted-foreground">{`Fichier ${activeFileIndex + 1} / ${document.files!.length} - ${activeFile.name}`}</p>}
        </div>
        <Button asChild variant="outline">
          <Link href={document.category === 'Maison' ? '/maison' : '/documents'}>
             <ArrowLeft className="mr-2 h-4 w-4" />
             Retour
          </Link>
        </Button>
      </header>
      <main className="flex-1 relative">
        {isImage ? (
            <div className="w-full h-full p-4 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={activeFile.fileUrl} alt={activeFile.name} className="max-w-full max-h-full object-contain" />
            </div>
        ) : (
          <embed src={activeFile.fileUrl} type={activeFile.file?.type || 'application/pdf'} className="h-full w-full" />
        )}
        
        {hasMultipleFiles && (
          <>
            <Button variant="outline" size="icon" className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
             <Button variant="outline" size="icon" className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}
      </main>
    </div>
  );
}

export default function DocumentViewPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full flex-col items-center justify-center bg-muted">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Chargement...</p>
            </div>
        }>
            <DocumentView />
        </Suspense>
    )
}
