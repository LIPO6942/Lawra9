
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentsTable } from '@/components/documents/documents-table';
import { useDocuments } from '@/contexts/document-context';
import { History } from 'lucide-react';

export default function HistoryPage() {
  const { documents, updateDocument, deleteDocument } = useDocuments();
  
  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
        <div className="flex items-center space-x-3">
            <History className="h-8 w-8 text-accent"/>
            <div>
                <h2 className="text-3xl font-bold tracking-tight font-headline">Historique des documents</h2>
                <p className="text-muted-foreground">Retrouvez ici l'historique de tous vos documents ajoutés.</p>
            </div>
        </div>
        
        <Card className="rounded-2xl shadow-sm">
            <CardContent className="pt-6">
            <DocumentsTable 
                documents={documents}
                onUpdate={updateDocument}
                onDelete={deleteDocument}
            />
            </CardContent>
        </Card>
    </div>
  );
}
