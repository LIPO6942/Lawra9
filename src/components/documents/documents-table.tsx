
'use client';

import { useState } from 'react';
import { Document } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { FileText, MoreHorizontal, Edit, Trash2, Home, Droplets, Zap, Landmark, CalendarDays, Wifi, Loader2, Shield, Eye, Info, MessageSquare } from 'lucide-react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UploadDocumentDialog } from '../upload-document-dialog';
import { useDocuments } from '@/contexts/document-context';
import { MaisonUploadDialog } from '../maison-upload-dialog';
import { Card } from '../ui/card';
import { useRouter } from 'next/navigation';

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
    return <Badge variant="outline" className="border-green-500/50 text-green-600 bg-green-500/10 font-normal">Payée</Badge>;
  }
  
  const date = parseISO(dueDate);
  if (!isValid(date)) return null;
  
  const daysDiff = differenceInDays(date, new Date());

  if (daysDiff < 0) {
    return <Badge variant="destructive" className="font-normal">En retard</Badge>;
  }
  if (daysDiff <= 7) {
    return <Badge className="bg-red-500 hover:bg-red-500/80 font-normal">Urgent</Badge>;
  }
  if (daysDiff <= 30) {
    return <Badge className="bg-orange-400 hover:bg-orange-400/80 text-black font-normal">À venir</Badge>;
  }
  return <Badge variant="secondary" className="font-normal">Normal</Badge>;
};

const formatDateSafe = (dateString?: string, dateFormat = 'd MMM yyyy') => {
    if (!dateString) return null;
    const date = parseISO(dateString);
    if (isValid(date)) {
        return format(date, dateFormat, { locale: fr });
    }
    return null;
};


interface DocumentsTableProps {
    documents: Document[];
    onUpdate: (id: string, data: Partial<Document>) => void;
    onDelete: (id: string) => void;
    isMaison?: boolean;
}

export function DocumentsTable({ documents, isMaison = false }: DocumentsTableProps) {
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<Document | null>(null);
    const { deleteDocument } = useDocuments();


    const openEditModal = (doc: Document) => {
        setSelectedDocument(doc);
        setIsEditModalOpen(true);
    }
    
    const handleViewFile = (docId: string, fileUrl?: string) => {
        if (fileUrl) {
            router.push(`/view?id=${docId}`);
        }
    }

    const confirmDelete = (doc: Document) => {
        setDocToDelete(doc);
        setIsDeleteAlertOpen(true);
    };

    const executeDelete = async () => {
        if (!docToDelete) return;
        setIsDeleting(docToDelete.id);
        await deleteDocument(docToDelete.id);
        setIsDeleting(null);
        setIsDeleteAlertOpen(false);
        setDocToDelete(null);
    };
    
    const EditDialogComponent = isMaison ? MaisonUploadDialog : UploadDocumentDialog;

    if (documents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-16 rounded-lg bg-muted/50">
                <Info className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="font-semibold text-muted-foreground">Aucun document trouvé.</p>
                <p className="text-sm text-muted-foreground/80 mt-1">Ajoutez un nouveau document pour commencer.</p>
            </div>
        );
    }

    return (
        <>
            <div className="grid grid-cols-1 gap-4">
                {documents.map(doc => {
                    const docDate = formatDateSafe(isMaison ? doc.issueDate : doc.issueDate || doc.createdAt);
                    const periodStart = formatDateSafe(doc.billingStartDate, 'MMM yyyy');
                    const periodEnd = formatDateSafe(doc.billingEndDate, 'MMM yyyy');

                    return (
                        <Card key={doc.id} className="p-4 transition-all hover:shadow-md">
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:block">
                                   <CategoryIcon category={doc.category} />
                                </div>
                                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleViewFile(doc.id, doc.fileUrl)}>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <p className="font-semibold pr-2 break-words">{doc.name}</p>
                                            <p className="text-sm text-muted-foreground">{isMaison ? doc.subCategory : (doc.supplier || doc.category)}</p>
                                        </div>
                                        {!isMaison && (
                                            <div className="flex-shrink-0 ml-4">
                                                <StatusBadge dueDate={doc.dueDate} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-2 text-muted-foreground">
                                        {doc.amount && !isMaison && (
                                            <span className="font-mono text-foreground">{doc.amount} TND</span>
                                        )}
                                        {docDate && (
                                            <div className="flex items-center gap-1">
                                                <CalendarDays className="h-4 w-4" />
                                                <span>{docDate}</span>
                                            </div>
                                        )}
                                        {isMaison && periodStart && periodEnd && (
                                            <div className="flex items-center gap-1">
                                                <CalendarDays className="h-4 w-4 text-green-500" />
                                                <span className="text-green-600">{`${periodStart} - ${periodEnd}`}</span>
                                            </div>
                                        )}
                                        {isMaison && doc.notes && (
                                           <div className="flex items-center gap-1">
                                               <MessageSquare className="h-4 w-4" />
                                           </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex-shrink-0">
                                     {isDeleting === doc.id ? (
                                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                    ) : (
                                        <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                            <span className="sr-only">Ouvrir le menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEditModal(doc)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Détails / Modifier
                                            </DropdownMenuItem>
                                            {doc.fileUrl && (
                                                <DropdownMenuItem onClick={() => handleViewFile(doc.id, doc.fileUrl!)}>
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
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
            
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible. Les données du document "{docToDelete?.name}" seront définitivement supprimées.
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
                <EditDialogComponent
                    open={isEditModalOpen}
                    onOpenChange={setIsEditModalOpen}
                    documentToEdit={selectedDocument}
                />
            )}
        </>
    );
}
