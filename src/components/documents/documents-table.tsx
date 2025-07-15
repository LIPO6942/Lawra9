
'use client';

import { useState } from 'react';
import { Document } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, MoreHorizontal, Eye, Edit, Trash2, Home, Droplets, Zap, Landmark, CalendarDays } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UploadDocumentDialog } from '../upload-document-dialog';

const CategoryIcon = ({ category }: { category: Document['category'] }) => {
  switch (category) {
    case 'STEG': return <Zap className="h-5 w-5 text-yellow-500" />;
    case 'SONEDE': return <Droplets className="h-5 w-5 text-blue-500" />;
    case 'Reçu Bancaire': return <Landmark className="h-5 w-5 text-indigo-500" />;
    case 'Maison': return <Home className="h-5 w-5 text-green-500" />;
    default: return <FileText className="h-5 w-5 text-gray-500" />;
  }
};

const StatusBadge = ({ dueDate }: { dueDate: string | undefined }) => {
  if (!dueDate) {
    return <Badge variant="secondary" className="rounded-md">Payée</Badge>;
  }

  const daysDiff = differenceInDays(parseISO(dueDate), new Date());

  if (daysDiff < 0) {
    return <Badge variant="destructive" className="rounded-md">En retard</Badge>;
  }
  if (daysDiff <= 7) {
    return <Badge className="bg-destructive/80 text-destructive-foreground rounded-md">Urgent</Badge>;
  }
  if (daysDiff <= 30) {
    return <Badge className="bg-orange-400 text-black rounded-md">À venir</Badge>;
  }
  return <Badge variant="outline" className="rounded-md">Normal</Badge>;
};


const ConsumptionPeriod = ({ doc }: { doc: Document }) => {
  if (doc.category === 'SONEDE' && doc.billingStartDate && doc.billingEndDate) {
      try {
          const start = parseISO(doc.billingStartDate);
          const end = parseISO(doc.billingEndDate);
          const year = format(start, 'yyyy');
          const months = [];
          let current = start;
          while (current <= end) {
              months.push(format(current, 'MMMM', { locale: fr }));
              current.setMonth(current.getMonth() + 1);
          }
          return (
              <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground"/>
                  <span>{months.join('-')} {year}</span>
              </div>
          );
      } catch (e) {
        // fallback
      }
  }

  if (doc.billingStartDate && doc.billingEndDate) {
    return (
        <div className="flex items-center gap-2">
           <CalendarDays className="h-4 w-4 text-muted-foreground"/>
           <span>{format(parseISO(doc.billingStartDate), 'd MMM yy', { locale: fr })} - {format(parseISO(doc.billingEndDate), 'd MMM yy', { locale: fr })}</span>
        </div>
    );
  }
  
  if (doc.category === 'Reçu Bancaire' || doc.category === 'Autre') {
    return (
        <div className="flex items-center gap-2">
           <CalendarDays className="h-4 w-4 text-muted-foreground"/>
           <span>{format(parseISO(doc.createdAt), 'd MMMM yyyy', { locale: fr })}</span>
        </div>
    );
  }

  return <span>N/A</span>;
}


interface DocumentsTableProps {
    documents: Document[];
    onUpdate: (id: string, data: Partial<Document>) => void;
    onDelete: (id: string) => void;
}

export function DocumentsTable({ documents, onUpdate, onDelete }: DocumentsTableProps) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

    const handleEdit = (doc: Document) => {
        setSelectedDocument(doc);
        setIsEditModalOpen(true);
    }
    
    return (
        <>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fournisseur</TableHead>
                    <TableHead className="hidden sm:table-cell">Période de consommation</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Montant</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">Échéance</TableHead>
                    <TableHead className="text-center">Statut</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                           <CategoryIcon category={doc.category} />
                           <div className="flex flex-col">
                             <span className="font-medium">{doc.supplier || doc.category}</span>
                             <span className="text-xs text-muted-foreground">{doc.name}</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                         <ConsumptionPeriod doc={doc} />
                      </TableCell>
                       <TableCell className="hidden md:table-cell text-right font-mono">
                        {doc.amount ? `${doc.amount} TND` : '-'}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center text-muted-foreground">
                        {doc.dueDate ? format(parseISO(doc.dueDate), 'd MMMM yyyy', { locale: fr }) : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                          <StatusBadge dueDate={doc.dueDate} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Ouvrir le menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => window.open(doc.fileUrl, '_blank')}>
                              <Eye className="mr-2 h-4 w-4" />
                              Consulter
                            </DropdownMenuItem>
                             <DropdownMenuItem onClick={() => handleEdit(doc)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onSelect={(e) => e.preventDefault()}>
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Supprimer
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Cette action est irréversible. Le document "{doc.name}" sera définitivement supprimé.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDelete(doc.id)} className="bg-destructive hover:bg-destructive/90">Supprimer</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
            </Table>
            {documents.length === 0 && (
                <div className="text-center py-16">
                    <p className="text-muted-foreground">Aucun document trouvé.</p>
                    <p className="text-sm text-muted-foreground/80">Ajoutez un nouveau document pour commencer.</p>
                </div>
            )}
            {selectedDocument && (
                <UploadDocumentDialog
                    open={isEditModalOpen}
                    onOpenChange={setIsEditModalOpen}
                    documentToEdit={selectedDocument}
                />
            )}
        </>
    );
}
