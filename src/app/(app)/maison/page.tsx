
'use client';

import { useState } from 'react';
import { mockDocuments } from '@/lib/data';
import { Document } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { DocumentsTable } from '@/components/documents/documents-table';
import { Home } from 'lucide-react';

export default function MaisonPage() {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments.filter(doc => doc.category === 'Maison'));

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
          <div className="flex items-center space-x-3">
               <Home className="h-8 w-8 text-accent"/>
               <div>
                 <h2 className="text-3xl font-bold tracking-tight font-headline">Espace Maison</h2>
                 <p className="text-muted-foreground">Retrouvez ici tous les documents importants liés à votre logement.</p>
               </div>
          </div>
          <div className="flex items-center space-x-2 w-full md:w-auto">
              <UploadDocumentDialog />
          </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="pt-6">
          <DocumentsTable documents={documents} />
        </CardContent>
      </Card>
    </div>
  );
}
