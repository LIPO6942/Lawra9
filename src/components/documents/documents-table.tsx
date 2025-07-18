
'use client';

import { useState } from 'react';
import { Document } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, MoreHorizontal, Edit, Trash2, Home, Droplets, Zap, Landmark, CalendarDays, Wifi, Loader2, Shield, Eye } from 'lucide-react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UploadDocumentDialog } from '../upload-document-dialog';
import { useDocuments } from '@/contexts/document-context';

const CategoryIcon = ({ category }: { category: Document['category'] }) => {
  switch (category) {
    case 'STEG': return <Zap className="h-5 w-5 text-yellow-500" />;
    case 'SONEDE': return <Droplets className="h-5 w-5 text-blue-500" />;
    case 'Reçu Bancaire': return <Landmark className="h-5 w-5 text-indigo-500" />;
    case 'Maison': return <Home className="h-5 w-5 text-green-500" />;
    case 'Internet': return <Wifi className="h-5 w-5 text-purple-500" />;
    case 'Assurance': return <Shield className="h-5 w-5 text-red-500" />;
    default: return <FileText className="h-5 w-5 text-gray-500" />;
  }
};

const StatusBadge = ({ dueDate }: { dueDate: string | undefined }) => {
  if (!dueDate) {
    return <Badge variant="secondary" className="rounded-md">Payée</Badge>;
  }
  
  const date = parseISO(dueDate);
  if (!isValid(date)) {
    return <Badge variant="secondary" className="rounded-md">Date invalide</Badge>;
  }
  
  const daysDiff = differenceInDays(date, new Date());

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
    if (doc.category === 'SONEDE' && doc.consumptionPeriod) {
        return (
            <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground"/>
                <span>{doc.consumptionPeriod}</span>
            </div>
        );
    }
    
    if (doc.billingStartDate && doc.billingEndDate) {
        try {
            const start = parseISO(doc.billingStartDate);
            const end = parseISO(doc.billingEndDate);

            if (!isValid(start) || !isValid(end)) {
                return <span>Période invalide</span>;
            }
            
            return (
                <div className="flex items-center gap-2">
                   <CalendarDays className="h-4 w-4 text-muted-foreground"/>
                   <span>{format(start, 'd MMM yy', { locale: fr })} - {format(end, 'd MMM yy', { locale: fr })}</span>
                </div>
            );
        } catch (e) {
            return <span>Période invalide</span>;
        }
    }
  
    if (doc.category === 'Reçu Bancaire' || doc.category === 'Autre' || doc.category === 'Maison') {
      try {
        const createdAtDate = parseISO(doc.createdAt);
        if(!isValid(createdAtDate)) return <span>Date invalide</span>
        return (
            <div className="flex items-center gap-2">
               <CalendarDays className="h-4 w-4 text-muted-foreground"/>
               <span>{format(createdAtDate, 'd MMMM yyyy', { locale: fr })}</span>
            </div>
        );
      } catch(e) {
          return <span>Date invalide</span>;
      }
    }

    return <span>N/A</span>;
}


interface DocumentsTableProps {
    documents: Document[];
    onUpdate: (id: string, data: Partial<Document>) => void;
    onDelete: (id: string) => void;
    isMaison?: boolean;
}

export function DocumentsTable({ documents, isMaison = false }: DocumentsTableProps) {
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<Document | null>(null);
    const { deleteDocument } = useDocuments();


    const handleViewOrEdit = (doc: Document) => {
        setSelectedDocument(doc);
        setIsEditModalOpen(true);
    }

    const confirmDelete = (doc: Document) => {
        setDocToDelete(doc);
        setIsDeleteAlertOpen(true);
    };
    
    const handleViewFile = (fileUrl: string) => {
        window.open(fileUrl, '_blank', 'noopener,noreferrer');
    }

    const executeDelete = async () => {
        if (!docToDelete) return;
        setIsDeleting(docToDelete.id);
        await deleteDocument(docToDelete.id);
        setIsDeleting(null);
        setIsDeleteAlertOpen(false);
        setDocToDelete(null);
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return '-';
        try {
            const date = parseISO(dateString);
            if (!isValid(date)) return 'Date invalide';
            return format(date, 'd MMMM yyyy', { locale: fr });
        } catch(e) {
            return 'Date invalide';
        }
    }
    
    return (
        <>
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isMaison ? 'Nom du document' : 'Fournisseur / Nom'}</TableHead>
                    <TableHead className="hidden sm:table-cell">{isMaison ? 'Catégorie' : 'Période / Date'}</TableHead>
                    <TableHead className="hidden md:table-cell text-right">{isMaison ? 'Date Ajout' : 'Montant'}</TableHead>
                    <TableHead className="hidden lg:table-cell text-center">{isMaison ? 'Fichier' : 'Échéance'}</TableHead>
                    <TableHead className="text-center">{isMaison ? '' : 'Statut'}</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id} onClick={() => handleViewOrEdit(doc)} className="cursor-pointer">
                      <TableCell>
                        <div className="flex items-center gap-3">
                           <CategoryIcon category={doc.category} />
                           <div className="flex flex-col">
                             <span className="font-medium">{isMaison ? doc.name : (doc.supplier || doc.category)}</span>
                             <span className="text-xs text-muted-foreground max-w-[150px] sm:max-w-xs truncate">{isMaison ? (doc.subCategory || 'Document') : doc.name}</span>
                           </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                         {isMaison ? doc.subCategory : <ConsumptionPeriod doc={doc} />}
                      </TableCell>
                       <TableCell className="hidden md:table-cell text-right font-mono">
                        {isMaison ? formatDate(doc.createdAt) : (doc.amount ? `${doc.amount} TND` : '-')}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-center">
                         {isMaison ? (
                            doc.fileUrl ? (
                                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleViewFile(doc.fileUrl!); }}>
                                    <Eye className="mr-2 h-4 w-4"/> Consulter
                                </Button>
                            ) : (
                                <span className="text-muted-foreground text-xs">Aucun</span>
                            )
                         ) : (
                            <span className="text-muted-foreground">{formatDate(doc.dueDate)}</span>
                         )}
                      </TableCell>
                      <TableCell className="text-center">
                          {!isMaison && <StatusBadge dueDate={doc.dueDate} />}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {isDeleting === doc.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                        ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <span className="sr-only">Ouvrir le menu</span>
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewOrEdit(doc)}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Détails / Modifier
                                </DropdownMenuItem>
                                {isMaison && doc.fileUrl && (
                                    <DropdownMenuItem onClick={() => handleViewFile(doc.fileUrl!)}>
                                      <Eye className="mr-2 h-4 w-4" />
                                      Consulter le fichier
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onSelect={(e) => { e.preventDefault(); confirmDelete(doc); }}>
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Supprimer
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                        )}
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
            
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible. Les données du document "{docToDelete?.name}" {docToDelete?.fileUrl ? "et le fichier associé " : ""}seront définitivement supprimées.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDelete} disabled={!!isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Supprimer
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {selectedDocument && (
                <UploadDocumentDialog
                    open={isEditModalOpen}
                    onOpenChange={setIsEditModalOpen}
                    documentToEdit={selectedDocument}
                    storageOnly={isMaison}
                />
            )}
        </>
    );
}
