
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { MaisonUploadDialog } from '@/components/maison-upload-dialog';
import { DocumentsTable } from '@/components/documents/documents-table';
import { Home, FilePlus2 } from 'lucide-react';
import { useDocuments } from '@/contexts/document-context';
import { Button } from '@/components/ui/button';

export default function MaisonPage() {
  const { documents, updateDocument, deleteDocument } = useDocuments();
  const maisonDocuments = documents.filter(doc => doc.category === 'Maison');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
               <Home className="h-8 w-8 text-primary"/>
               <div>
                 <h1 className="text-3xl font-bold tracking-tight font-headline">Espace Maison</h1>
                 <p className="text-muted-foreground">Retrouvez les documents importants de votre logement.</p>
               </div>
          </div>
           <MaisonUploadDialog>
              <Button className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Archiver un document
              </Button>
            </MaisonUploadDialog>
      </div>
      
      <DocumentsTable
         documents={maisonDocuments}
         onUpdate={updateDocument}
         onDelete={deleteDocument}
         isMaison={true}
      />
    </div>
  );
}
