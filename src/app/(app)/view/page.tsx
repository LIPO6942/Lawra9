
'use client';

import { useSearchParams } from 'next/navigation';
import { useDocuments } from '@/contexts/document-context';
import { useEffect, useState, Suspense, useMemo } from 'react';
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
  const [activeFileUrl, setActiveFileUrl] = useState<string | null>(null);

  useEffect(() => {
    // This effect finds the document from context when the ID changes
    if (id) {
      const doc = getDocumentById(id);
      setDocument(doc);
    } else {
      setDocument(null);
    }
  }, [id, getDocumentById]);

  const activeFile = useMemo((): SubFile | { file?: Blob | File, name: string } | undefined => {
    if (!document) return undefined;
    if (document.category === 'Maison' && document.files && document.files.length > 0) {
      return document.files[activeFileIndex];
    }
  // Fallback for single-file documents
  if (document.file) {
    return { file: document.file, name: document.name };
  }
  
  // Gmail-imported base64 fallback
  if ((document as any).fileBase64) {
    const base64 = (document as any).fileBase64.replace(/-/g, '+').replace(/_/g, '/');
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return { file: blob, name: (document as any).fileName || document.name };
  }

  return undefined;
}, [document, activeFileIndex]);

  useEffect(() => {
    // This effect creates/revokes the object URL when the active file changes
    let fileUrl: string | null = null;
    if (activeFile?.file) {
      fileUrl = URL.createObjectURL(activeFile.file);
      setActiveFileUrl(fileUrl);
    } else {
      setActiveFileUrl(null);
    }

    return () => {
      // Cleanup by revoking the object URL when the component unmounts or the file changes
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [activeFile]);
  
  const isImage = useMemo(() => {
    if (!activeFile?.file) return false;
    return activeFile.file.type.startsWith('image/');
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

  const parsedLink = useMemo(() => {
    if (!document?.notes) return null;
    const match = document.notes.match(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/);
    if (match) {
      return { text: match[1], url: match[2] };
    }
    return null;
  }, [document?.notes]);

  if (!document || (!activeFileUrl && !document.notes)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-muted text-center p-4">
        <FileQuestion className="h-16 w-16 text-destructive" />
        <h1 className="mt-6 text-2xl font-bold">Document non trouvé</h1>
        <p className="mt-2 text-muted-foreground">Le document est introuvable ou le fichier est corrompu/manquant.</p>
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
          {hasMultipleFiles && activeFile && <p className="text-xs text-muted-foreground">{`Fichier ${activeFileIndex + 1} / ${document.files!.length} - ${activeFile.name}`}</p>}
        </div>
        <Button asChild variant="outline">
          <Link href={document.category === 'Maison' ? '/maison' : '/documents'}>
             <ArrowLeft className="mr-2 h-4 w-4" />
             Retour
          </Link>
        </Button>
      </header>
      <main className="flex-1 relative">
        {activeFileUrl ? (
          isImage ? (
              <div className="w-full h-full p-4 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeFileUrl} alt={activeFile?.name} className="max-w-full max-h-full object-contain" />
              </div>
          ) : (
            <embed src={activeFileUrl} type={activeFile?.file?.type || 'application/pdf'} className="h-full w-full" />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-muted text-center p-4">
            <FileQuestion className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Aucun fichier joint localement</h2>
            {parsedLink ? (
              <div className="flex flex-col items-center gap-4">
                <p className="text-muted-foreground">Ce document a été importé automatiquement et ne contient pas de pièce jointe, mais inclut un lien vers la facture d'origine.</p>
                <Button asChild>
                  <a href={parsedLink.url} target="_blank" rel="noopener noreferrer">Ouvrir la facture en ligne</a>
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground whitespace-pre-line max-w-md bg-background p-4 rounded-md border text-left mt-4 text-sm">
                {document?.notes || "Ce document ne possède ni fichier ni notes consultables."}
              </p>
            )}
          </div>
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
