
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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getYear, parseISO, isValid } from 'date-fns';
import { cn } from '@/lib/utils';
import { fr } from 'date-fns/locale';

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

  const currentYear = new Date().getFullYear();

  const getDocDate = (doc: Document): Date | null => {
    const datePriority = [doc.paymentDate, doc.issueDate, doc.billingEndDate, doc.dueDate, doc.createdAt];
    for (const dateStr of datePriority) {
      if (dateStr) {
        const date = parseISO(dateStr);
        if (isValid(date)) return date;
      }
    }
    return null;
  };

  const groupedDocuments = useMemo(() => {
    return filteredDocuments.reduce((acc, doc) => {
      const date = getDocDate(doc);
      const yearKey = date ? getYear(date).toString() : 'Inconnu';
      const supplierKey = doc.supplier || doc.category || 'Autre';

      if (!acc[yearKey]) {
        acc[yearKey] = {};
      }
      if (!acc[yearKey][supplierKey]) {
        acc[yearKey][supplierKey] = [];
      }
      acc[yearKey][supplierKey].push(doc);
      return acc;
    }, {} as Record<string, Record<string, Document[]>>);
  }, [filteredDocuments]);

  const sortedYears = useMemo(() => {
    return Object.keys(groupedDocuments).sort((a, b) => b.localeCompare(a));
  }, [groupedDocuments]);

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

      {sortedYears.length > 0 ? (
        <Accordion type="multiple" defaultValue={[currentYear.toString()]} className="space-y-6">
          {sortedYears.map((yearStr) => {
            const suppliers = groupedDocuments[yearStr];
            const docCount = Object.values(suppliers).reduce((sum, docs) => sum + docs.length, 0);
            const year = parseInt(yearStr);
            const isPast = !isNaN(year) && year < currentYear;
            const age = isPast ? (currentYear - year) : 0;

            const yearHeaderClass = cn(
              "font-headline font-bold hover:no-underline transition-all",
              age === 0 ? "text-2xl" :
                age === 1 ? "text-xl opacity-90" :
                  "text-lg opacity-75"
            );

            return (
              <AccordionItem key={yearStr} value={yearStr} className="border-none">
                <div className="flex flex-col gap-4">
                  <AccordionTrigger className={cn("py-2 flex items-center gap-4", yearHeaderClass)}>
                    <span className="flex items-center gap-2">
                      {yearStr}
                      <span className="text-sm font-normal text-muted-foreground">({docCount} document{docCount > 1 ? 's' : ''})</span>
                    </span>
                  </AccordionTrigger>

                  <AccordionContent className="pt-2">
                    <div className="grid gap-4">
                      {Object.entries(suppliers).sort(([a], [b]) => a.localeCompare(b)).map(([supplierName, docs]) => (
                        <Card key={supplierName} className={cn("overflow-hidden border-muted/60", age > 0 && "bg-muted/30")}>
                          <div className="p-4 sm:px-6 py-3 bg-muted/20 border-b border-muted/40 items-center justify-between flex">
                            <h3 className="font-semibold text-base flex items-center gap-2">
                              {supplierName}
                              <span className="text-xs font-normal text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                                {docs.length}
                              </span>
                            </h3>
                          </div>
                          <div className="p-0">
                            <DocumentsTable
                              documents={docs}
                              onUpdate={updateDocument}
                              onDelete={deleteDocument}
                              onSelectionChange={handleSelectionChange}
                              allDocumentIds={allDocumentIds}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-20 rounded-lg bg-muted/50">
          <Info className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="font-semibold text-muted-foreground">Aucun document trouvé.</p>
          <p className="text-sm text-muted-foreground/80 mt-1">
            {searchTerm ? "Essayez de modifier vos termes de recherche." : "Cliquez sur 'Ajouter' pour commencer."}
          </p>
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
