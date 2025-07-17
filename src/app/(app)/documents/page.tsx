
'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { DocumentsTable } from '@/components/documents/documents-table';
import { useDocuments } from '@/contexts/document-context';
import { Document } from '@/lib/types';

export default function DocumentsPage() {
  const { documents, updateDocument, deleteDocument } = useDocuments();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocuments = documents.filter(doc => 
    doc.category !== 'Maison' &&
    (doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.supplier?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
      <div className="flex flex-col md:flex-row items-start justify-between space-y-4 md:space-y-0 md:items-center">
          <div>
               <h2 className="text-3xl font-bold tracking-tight font-headline">Mes Documents</h2>
               <p className="text-muted-foreground">Consultez et gérez vos factures et documents quotidiens.</p>
          </div>
          <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
              <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Rechercher un document..." 
                    className="pl-9 rounded-lg"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
              <UploadDocumentDialog />
          </div>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <CardContent className="pt-6">
          <DocumentsTable 
            documents={filteredDocuments}
            onUpdate={updateDocument}
            onDelete={deleteDocument}
          />
        </CardContent>
      </Card>
    </div>
  );
}
