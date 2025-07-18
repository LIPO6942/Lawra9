
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { MaisonUploadDialog } from '@/components/maison-upload-dialog';
import { DocumentsTable } from '@/components/documents/documents-table';
import { Home } from 'lucide-react';
import { useDocuments } from '@/contexts/document-context';

export default function MaisonPage() {
  const { documents, updateDocument, deleteDocument } = useDocuments();
  const maisonDocuments = documents.filter(doc => doc.category === 'Maison');

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
      <div className="flex flex-col md:flex-row items-start justify-between space-y-4 md:space-y-0 md:items-center">
          <div className="flex items-center space-x-3">
               <Home className="h-8 w-8 text-accent"/>
               <div>
                 <h2 className="text-3xl font-bold tracking-tight font-headline">Espace Maison</h2>
                 <p className="text-muted-foreground">Retrouvez ici tous les documents importants liés à votre logement.</p>
               </div>
          </div>
          <div className="flex items-center space-x-2 w-full md:w-auto">
              <MaisonUploadDialog />
          </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="pt-6">
          <DocumentsTable
             documents={maisonDocuments}
             onUpdate={updateDocument}
             onDelete={deleteDocument}
             isMaison={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
