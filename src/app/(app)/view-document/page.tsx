
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, FileQuestion } from 'lucide-react';
import { useDocuments } from '@/contexts/document-context';

function DocumentViewer() {
    const searchParams = useSearchParams();
    const { getDocumentById } = useDocuments();
    const docId = searchParams.get('id');
    const [documentUrl, setDocumentUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!docId) {
            setError("ID de document manquant.");
            return;
        }

        const document = getDocumentById(docId);

        if (!document) {
            setError("Document non trouvé. Il a peut-être été supprimé.");
            return;
        }

        if (!document.fileUrl) {
            setError("Ce document n'a pas de fichier associé.");
            return;
        }
        
        setDocumentUrl(document.fileUrl);

    }, [docId, getDocumentById]);
    
    if (error) {
        return <ErrorDisplay message={error} />;
    }

    if (!documentUrl) {
        return <LoadingDisplay />;
    }
    
    const getMimeType = (url: string) => {
        const match = url.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
        return match ? match[1] : null;
    }

    const mimeType = getMimeType(documentUrl);
    const isPdf = mimeType === 'application/pdf';
    const isImage = mimeType?.startsWith('image/');

    if (isPdf || isImage) {
        return (
            <iframe
                src={documentUrl}
                className="w-full h-full border-0"
                title={'Visionneuse de document'}
            />
        );
    }
    
    return (
         <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-lg h-full">
            <FileQuestion className="h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-semibold">Format de fichier non supporté</h2>
            <p className="mt-2 text-muted-foreground">La prévisualisation n'est pas disponible pour ce type de fichier.</p>
            <p className="text-xs text-muted-foreground mt-1">(Type détecté: {mimeType || 'inconnu'})</p>
            <Button onClick={() => window.close()} className="mt-6">Fermer</Button>
        </div>
    );
}

function ErrorDisplay({ message }: { message: string }) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <div className="flex flex-col items-center justify-center text-center p-8 bg-card rounded-lg shadow-lg">
                <AlertTriangle className="h-12 w-12 text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">Erreur</h2>
                <p className="mt-2 text-muted-foreground">{message}</p>
                <Button onClick={() => window.close()} className="mt-6">Fermer</Button>
            </div>
        </div>
    );
}

function LoadingDisplay() {
     return (
        <div className="flex flex-col items-center justify-center text-center p-8 h-full">
            <Loader2 className="h-12 w-12 animate-spin text-accent" />
            <p className="mt-4 text-muted-foreground">Chargement du document...</p>
        </div>
    );
}

export default function ViewDocumentPage() {
    return (
        <div className="w-screen h-screen bg-muted-foreground/20">
            <Suspense fallback={<LoadingDisplay />}>
                <DocumentViewer />
            </Suspense>
        </div>
    );
}
