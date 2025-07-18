
'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, FileQuestion } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ViewDocumentPage() {
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        try {
            const url = sessionStorage.getItem('documentToView');
            const name = sessionStorage.getItem('documentNameToView');
            if (url) {
                setFileUrl(url);
                setFileName(name || 'Document');
                // Clean up sessionStorage after reading
                sessionStorage.removeItem('documentToView');
                sessionStorage.removeItem('documentNameToView');
            } else {
                setError("Aucun document à afficher. La session a peut-être expiré.");
            }
        } catch (e) {
            setError("Impossible de charger le document depuis le stockage de la session.");
            console.error(e);
        }
    }, []);

    const getMimeType = (url: string) => {
        const match = url.match(/data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+).*,.*/);
        return match ? match[1] : null;
    }

    const renderContent = () => {
        if (!fileUrl) {
            return (
                <div className="flex flex-col items-center justify-center text-center p-8">
                    <Loader2 className="h-12 w-12 animate-spin text-accent" />
                    <p className="mt-4 text-muted-foreground">Chargement du document...</p>
                </div>
            );
        }

        const mimeType = getMimeType(fileUrl);
        const isPdf = mimeType === 'application/pdf';
        const isImage = mimeType?.startsWith('image/');

        if (isPdf || isImage) {
            return (
                <iframe
                    src={fileUrl}
                    className="w-full h-full border-0"
                    title={fileName || 'Document Viewer'}
                />
            );
        }

        return (
             <div className="flex flex-col items-center justify-center text-center p-8 bg-muted rounded-lg">
                <FileQuestion className="h-12 w-12 text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">Format de fichier non supporté</h2>
                <p className="mt-2 text-muted-foreground">La prévisualisation n'est pas disponible pour ce type de fichier.</p>
                <p className="text-xs text-muted-foreground mt-1">(Type détecté: {mimeType || 'inconnu'})</p>
                <Button onClick={() => window.close()} className="mt-6">Fermer</Button>
            </div>
        );
    };

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <div className="flex flex-col items-center justify-center text-center p-8 bg-card rounded-lg shadow-lg">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <h2 className="mt-4 text-xl font-semibold">Erreur</h2>
                    <p className="mt-2 text-muted-foreground">{error}</p>
                    <Button onClick={() => window.close()} className="mt-6">Fermer</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-screen h-screen bg-muted-foreground/20">
            {renderContent()}
        </div>
    );
}
