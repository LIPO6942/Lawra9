
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Search, FilePlus2, GitCompareArrows, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { DocumentsTable } from '@/components/documents/documents-table';
import { useDocuments } from '@/contexts/document-context';
import { Document } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CompareDialog } from '@/components/documents/compare-dialog';

export default function DocumentsPage() {
  const { documents, updateDocument, deleteDocument } = useDocuments();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDocs, setSelectedDocs] = useState<Document[]>([]);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => 
      doc.category !== 'Maison' &&
      (doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.supplier && doc.supplier.toLowerCase().includes(searchTerm.toLowerCase())))
    );
  }, [documents, searchTerm]);
  
  const handleSelectionChange = (selected: Document[]) => {
    setSelectedDocs(selected);
  }

  const canCompare = useMemo(() => {
    if (selectedDocs.length !== 2) return false;
    // Optional: check if documents are of the same category
    return (selectedDocs[0].supplier || selectedDocs[0].category) === (selectedDocs[1].supplier || selectedDocs[1].category);
  }, [selectedDocs]);

  const groupedDocuments = useMemo(() => {
    return filteredDocuments.reduce((acc, doc) => {
        const key = doc.supplier || doc.category || 'Autre';
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(doc);
        return acc;
    }, {} as Record<string, Document[]>);
  }, [filteredDocuments]);

  const allDocumentIds = useMemo(() => filteredDocuments.map(d => d.id), [filteredDocuments]);

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
              <Button onClick={() => setIsCompareOpen(true)} disabled={!canCompare}>
                <GitCompareArrows className="mr-2 h-4 w-4" />
                Comparer
              </Button>
              <UploadDocumentDialog>
                <Button className="w-full sm:w-auto bg-accent text-accent-foreground hover:bg-accent/90">
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    Ajouter
                </Button>
              </UploadDocumentDialog>
          </div>
      </div>
      
      {Object.keys(groupedDocuments).length > 0 ? (
        <div className="space-y-6">
            {Object.entries(groupedDocuments).sort(([a], [b]) => a.localeCompare(b)).map(([groupTitle, docs]) => (
                <DocumentsTable
                    key={groupTitle}
                    title={groupTitle}
                    documents={docs}
                    onUpdate={updateDocument}
                    onDelete={deleteDocument}
                    onSelectionChange={handleSelectionChange}
                    allDocumentIds={allDocumentIds}
                />
            ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-20 rounded-lg bg-muted/50">
            <Info className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-semibold text-muted-foreground">Aucun document ne correspond à votre recherche.</p>
            <p className="text-sm text-muted-foreground/80 mt-1">Essayez de modifier vos termes de recherche.</p>
        </div>
      )}


      {isCompareOpen && selectedDocs.length === 2 && (
        <CompareDialog
          open={isCompareOpen}
          onOpenChange={setIsCompareOpen}
          documentsToCompare={selectedDocs}
        />
      )}
    </div>
  );
}
