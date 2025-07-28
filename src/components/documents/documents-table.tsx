
'use client';

import { useState, useMemo } from 'react';
import { Document } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { FileText, MoreHorizontal, Edit, Trash2, Home, Droplets, Zap, Landmark, CalendarDays, Wifi, Loader2, Shield, Eye, Info, MessageSquare, CircleDollarSign } from 'lucide-react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UploadDocumentDialog } from '../upload-document-dialog';
import { MaisonUploadDialog } from '../maison-upload-dialog';
import { MaisonDetailsDialog } from '../maison/maison-details-dialog';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { useRouter } from 'next/navigation';
import { Checkbox } from '../ui/checkbox';

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
    const date = parseISO(dateString); // Works for 'YYYY-MM' as well, defaults to 1st day
    if (isValid(date)) {
        return format(date, dateFormat, { locale: fr });
    }
    return null;
};


interface DocumentsTableProps {
    title?: string;
    documents: Document[];
    onUpdate: (id: string, data: Partial<Document>) => void;
    onDelete: (id: string) => void;
    isMaison?: boolean;
    onSelectionChange?: (selected: Document[]) => void;
    allDocumentIds?: string[];
}

export function DocumentsTable({ title, documents, onUpdate, onDelete, isMaison = false, onSelectionChange, allDocumentIds }: DocumentsTableProps) {
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<Document | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const docIds = useMemo(() => documents.map(d => d.id), [documents]);

    // This effect ensures that selections are cleared if the underlying documents list changes (e.g., due to search)
    // but preserves selections when only the parent list of all documents changes.
    useMemo(() => {
        const currentDocIds = new Set(docIds);
        const newSelectedIds = new Set<string>();
        selectedIds.forEach(id => {
            if (currentDocIds.has(id)) {
                newSelectedIds.add(id);
            }
        });
        
        if (newSelectedIds.size !== selectedIds.size) {
            setSelectedIds(newSelectedIds);
             if (onSelectionChange) {
                const selectedDocs = documents.filter(doc => newSelectedIds.has(doc.id));
                onSelectionChange(selectedDocs);
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [docIds]);


    const handleSelect = (docId: string, isSelected: boolean) => {
        const newSelectedIds = new Set(selectedIds);
        if (isSelected) {
            newSelectedIds.add(docId);
        } else {
            newSelectedIds.delete(docId);
        }
        setSelectedIds(newSelectedIds);
        if (onSelectionChange) {
            const selectedDocs = documents.filter(doc => newSelectedIds.has(doc.id));
            onSelectionChange(selectedDocs);
        }
    };

    const openEditModal = (doc: Document) => {
        setSelectedDocument(doc);
        setIsEditModalOpen(true);
    }

    const openDetailsModal = (doc: Document) => {
        setSelectedDocument(doc);
        setIsDetailsModalOpen(true);
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
        await onDelete(docToDelete.id);
        setIsDeleting(null);
        setIsDeleteAlertOpen(false);
        setDocToDelete(null);
    };
    
    const EditDialogComponent = isMaison ? MaisonUploadDialog : UploadDocumentDialog;

    if (documents.length === 0) {
        return isMaison ? (
            <div className="flex flex-col items-center justify-center text-center py-16 rounded-lg bg-muted/50">
                <Info className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="font-semibold text-muted-foreground">Aucun document trouvé.</p>
                <p className="text-sm text-muted-foreground/80 mt-1">Ajoutez un nouveau document pour commencer.</p>
            </div>
        ) : null;
    }

    return (
        <>
            <Card>
                {title && (
                    <CardHeader>
                        <CardTitle className="font-headline text-lg flex items-center gap-3">
                             <CategoryIcon category={documents[0].category} />
                             {title}
                        </CardTitle>
                    </CardHeader>
                )}
                <CardContent className={title ? 'pt-0 p-4 sm:p-6' : 'p-4 sm:p-6'}>
                    <div className="space-y-3">
                        {documents.map(doc => {
                            const docDate = formatDateSafe(doc.issueDate || doc.createdAt);
                            const periodStart = formatDateSafe(doc.billingStartDate, 'MMM yyyy');
                            const periodEnd = formatDateSafe(doc.billingEndDate, 'MMM yyyy');
                            const fileCount = doc.files?.length || 0;

                            return (
                                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-md transition-all hover:bg-muted/50 -m-3">
                                    {!isMaison && onSelectionChange && (
                                        <Checkbox
                                            id={`select-${doc.id}`}
                                            checked={selectedIds.has(doc.id)}
                                            onCheckedChange={(checked) => handleSelect(doc.id, !!checked)}
                                            aria-label={`Sélectionner ${doc.name}`}
                                        />
                                    )}
                                    {isMaison && (
                                        <div className="hidden sm:block">
                                            <CategoryIcon category={doc.category} />
                                        </div>
                                    )}
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
                                             {doc.amount && isMaison && (
                                                <div className="flex items-center gap-1.5 font-mono text-foreground">
                                                    <CircleDollarSign className="h-4 w-4" />
                                                    <span>{doc.amount} TND</span>
                                                </div>
                                            )}
                                            {docDate && (
                                                <div className="flex items-center gap-1.5">
                                                    <CalendarDays className="h-4 w-4" />
                                                    <span>{docDate}</span>
                                                </div>
                                            )}
                                            {isMaison && fileCount > 0 && (
                                                <div className="flex items-center gap-1.5">
                                                    <FileText className="h-4 w-4" />
                                                    <span>{fileCount} fichier{fileCount > 1 ? 's' : ''}</span>
                                                </div>
                                            )}
                                            {isMaison && periodStart && periodEnd && (
                                                <div className="flex items-center gap-1.5">
                                                    <CalendarDays className="h-4 w-4 text-green-500" />
                                                    <span className="text-green-600 font-medium">{`${periodStart} - ${periodEnd}`}</span>
                                                </div>
                                            )}
                                            {isMaison && doc.notes && (
                                            <div className="flex items-center gap-1.5">
                                                <MessageSquare className="h-4 w-4" />
                                            </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0">
                                        {isDeleting === doc.id ? (
                                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                                        ) : (
                                            <div className="flex items-center">
                                                {isMaison && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openDetailsModal(doc)}>
                                                        <Info className="h-4 w-4" />
                                                    </Button>
                                                )}
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
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
            
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

            {selectedDocument && isMaison && (
                <MaisonDetailsDialog
                    open={isDetailsModalOpen}
                    onOpenChange={setIsDetailsModalOpen}
                    document={selectedDocument}
                />
            )}
        </>
    );
}
