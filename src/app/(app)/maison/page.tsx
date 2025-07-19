
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MaisonUploadDialog } from '@/components/maison-upload-dialog';
import { DocumentsTable } from '@/components/documents/documents-table';
import { Home, FilePlus2, Image as ImageIcon, FileText } from 'lucide-react';
import { useDocuments } from '@/contexts/document-context';
import { Button } from '@/components/ui/button';
import { MaisonImageGallery } from '@/components/maison/image-gallery';
import { useMemo } from 'react';

export default function MaisonPage() {
  const { documents, updateDocument, deleteDocument } = useDocuments();
  
  const { imageDocuments, otherDocuments } = useMemo(() => {
    const maisonDocs = documents.filter(doc => doc.category === 'Maison');
    const imageDocs = maisonDocs.filter(doc => 
        doc.fileUrl && /\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileUrl)
    );
    const otherDocs = maisonDocs.filter(doc => 
        !doc.fileUrl || !/\.(jpg|jpeg|png|gif|webp)$/i.test(doc.fileUrl)
    );
    return { imageDocuments: imageDocs, otherDocuments: otherDocs };
  }, [documents]);


  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
               <Home className="h-8 w-8 text-primary"/>
               <div>
                 <h1 className="text-3xl font-bold tracking-tight font-headline">Espace Maison</h1>
                 <p className="text-muted-foreground">Retrouvez les documents et photos importants de votre logement.</p>
               </div>
          </div>
           <MaisonUploadDialog>
              <Button className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  Archiver un document
              </Button>
            </MaisonUploadDialog>
      </div>

      <div className="space-y-6">
        <div>
            <div className="flex items-center gap-2 mb-4">
                <ImageIcon className="h-6 w-6 text-primary"/>
                <h2 className="text-2xl font-semibold font-headline">Galerie Photos</h2>
            </div>
            <MaisonImageGallery images={imageDocuments} onUpdate={updateDocument} onDelete={deleteDocument} />
        </div>
        
        <div>
            <div className="flex items-center gap-2 mb-4">
                <FileText className="h-6 w-6 text-primary"/>
                <h2 className="text-2xl font-semibold font-headline">Documents Archivés</h2>
            </div>
             <DocumentsTable
                 documents={otherDocuments}
                 onUpdate={updateDocument}
                 onDelete={deleteDocument}
                 isMaison={true}
              />
        </div>
      </div>
    </div>
  );
}
