
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Search, FilePlus2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { DocumentsTable } from '@/components/documents/documents-table';
import { useDocuments } from '@/contexts/document-context';
import { Document } from '@/lib/types';
import { Button } from '@/components/ui/button';

export default function DocumentsPage() {
  const { documents, updateDocument, deleteDocument } = useDocuments();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => 
      doc.category !== 'Maison' &&
      (doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.supplier && doc.supplier.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [documents, searchTerm]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
               <h1 className="text-3xl font-bold tracking-tight font-headline">Mes Documents</h1>
               <p className="text-muted-foreground">Consultez et gérez vos factures et documents quotidiens.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
              <div className="relative w-full flex-grow md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher (nom, catégorie...)" 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <UploadDocumentDialog>
                <Button className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Ajouter
                </Button>
              </UploadDocumentDialog>
          </div>
      </div>
      
      <DocumentsTable 
        documents={filteredDocuments}
        onUpdate={updateDocument}
        onDelete={deleteDocument}
      />
    </div>
  );
}
