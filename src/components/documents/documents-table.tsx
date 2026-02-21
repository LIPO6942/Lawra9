'use client';

import { useState, useMemo } from 'react';
import { Document } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, MoreHorizontal, Edit, Trash2, Home, Droplets, Zap, Landmark, CalendarDays, Wifi, Loader2, Shield, Eye, Info, MessageSquare, CircleDollarSign, AlertTriangle, FileText } from 'lucide-react';
import { format, parseISO, differenceInDays, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { UploadDocumentDialog } from '../upload-document-dialog';
import { MaisonUploadDialog } from '../maison-upload-dialog';
import { MaisonDetailsDialog } from '../maison/maison-details-dialog';
import { DocumentDetailsDialog } from './document-details-dialog';
import { useRouter } from 'next/navigation';
import { Checkbox } from '../ui/checkbox';
import { cn } from '@/lib/utils';

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

const StatusIndicator = ({ doc }: { doc: Document }) => {
    const isPaid = !!doc.paymentDate;
    const dueDate = doc.dueDate;

    if (isPaid) {
        return <div className="h-2.5 w-2.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]" title="Payé" />;
    }

    if (!dueDate) return <div className="h-2.5 w-2.5 rounded-full bg-slate-200" title="Pas de date" />;

    const date = parseISO(dueDate);
    if (!isValid(date)) return null;

    const daysDiff = differenceInDays(date, new Date());

    if (daysDiff < -3) {
        return <div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.5)]" title="En retard" />;
    }
    if (daysDiff < 0) {
        return <div className="h-2.5 w-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]" title="Légèrement en retard" />;
    }
    if (daysDiff <= 3) {
        return <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" title="À payer bientôt" />;
    }
    return <div className="h-2.5 w-2.5 rounded-full bg-green-500/40" title="Normal" />;
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
    onSelectionChange?: (selected: Document[]) => void;
    allDocumentIds?: string[];
}

export function DocumentsTable({ documents, onUpdate, onDelete, isMaison = false, onSelectionChange, allDocumentIds }: DocumentsTableProps) {
    const router = useRouter();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [docToDelete, setDocToDelete] = useState<Document | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const docIds = useMemo(() => documents.map(d => d.id), [documents]);

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

    const handleViewFile = (docId: string) => {
        router.push(`/view?id=${docId}`);
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
    const DetailsDialogComponent = isMaison ? MaisonDetailsDialog : DocumentDetailsDialog;

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
            <div className="p-4 sm:p-6 pt-0">
                <div className="space-y-3">
                    {documents.map(doc => {
                        const docDate = formatDateSafe(doc.issueDate || doc.createdAt);
                        const dueDate = formatDateSafe(doc.dueDate);
                        const periodStart = formatDateSafe(doc.billingStartDate, 'MMM yyyy');
                        const periodEnd = formatDateSafe(doc.billingEndDate, 'MMM yyyy');
                        const fileCount = doc.files?.length || 0;
                        const daysDiff = doc.dueDate && isValid(parseISO(doc.dueDate)) ? differenceInDays(parseISO(doc.dueDate), new Date()) : null;

                        const isCoreBill = (doc.name === 'STEG' || doc.name === 'SONEDE' || doc.name === 'Internet' || doc.category === 'Internet' || doc.name === doc.category) && (doc.consumptionPeriod || (doc.billingStartDate && doc.billingEndDate));

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

                                {!isCoreBill && (
                                    <div className="shrink-0">
                                        <CategoryIcon category={doc.category} />
                                    </div>
                                )}

                                <div className="flex-1 min-w-0 flex flex-col gap-1 cursor-pointer" onClick={() => handleViewFile(doc.id)}>
                                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                                        <div className="font-semibold truncate text-[13px] sm:text-base leading-tight flex-1 flex items-center gap-2">
                                            {isCoreBill ? (
                                                <div className="flex items-center gap-1.5 w-full overflow-hidden">
                                                    <div className="shrink-0 opacity-80"><CategoryIcon category={doc.category} /></div>
                                                    <span className="truncate">
                                                        {(() => {
                                                            if (doc.consumptionPeriod) {
                                                                const parts = doc.consumptionPeriod.split('-');
                                                                if (parts.length < 2) return doc.consumptionPeriod;
                                                                const year = parts[0];
                                                                const months = parts.slice(1).map(m => {
                                                                    try {
                                                                        const d = new Date(parseInt(year), parseInt(m) - 1, 1);
                                                                        return format(d, 'MMM', { locale: fr }).replace('.', '');
                                                                    } catch (e) { return m; }
                                                                }).reverse();
                                                                const formattedMonths = months.join('-');
                                                                return formattedMonths.charAt(0).toUpperCase() + formattedMonths.slice(1) + ' ' + year;
                                                            } else if (doc.billingStartDate && doc.billingEndDate) {
                                                                const start = formatDateSafe(doc.billingStartDate, 'MMM');
                                                                const end = formatDateSafe(doc.billingEndDate, 'MMM yy');
                                                                return `${start}-${end}`;
                                                            }
                                                            return doc.name;
                                                        })()}
                                                    </span>
                                                    <div className="shrink-0 opacity-80"><CategoryIcon category={doc.category} /></div>
                                                </div>
                                            ) : (
                                                doc.name
                                            )}
                                        </div>
                                        {!isMaison && (
                                            <div className="shrink-0 flex items-center pr-1">
                                                <StatusIndicator doc={doc} />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-x-2.5 text-[10.5px] sm:text-xs text-muted-foreground/90 overflow-x-auto no-scrollbar py-0.5">
                                        {isMaison && doc.amount && (
                                            <div className="flex items-center gap-1 font-mono text-foreground shrink-0 bg-secondary/20 px-1 rounded">
                                                <CircleDollarSign className="h-2.5 w-2.5 text-blue-500" />
                                                <span>{doc.amount}</span>
                                            </div>
                                        )}

                                        {dueDate && !isMaison ? (
                                            <div className={cn("flex items-center gap-1 font-semibold shrink-0 bg-secondary/20 px-1 rounded",
                                                daysDiff !== null && daysDiff < 0 && "text-destructive",
                                                daysDiff !== null && daysDiff >= 0 && daysDiff <= 7 && "text-red-500",
                                                daysDiff !== null && daysDiff > 7 && daysDiff <= 30 && "text-orange-500",
                                            )}>
                                                <AlertTriangle className="h-2.5 w-2.5" />
                                                <span>{dueDate}</span>
                                            </div>
                                        ) : docDate && !isMaison && (
                                            <div className="flex items-center gap-1 shrink-0 bg-secondary/20 px-1 rounded">
                                                <CalendarDays className="h-2.5 w-2.5" />
                                                <span>{docDate}</span>
                                            </div>
                                        )}

                                        {!dueDate && !docDate && !isMaison && (
                                            <div className="flex items-center gap-1 shrink-0 bg-secondary/20 px-1 rounded border border-secondary/50">
                                                <CalendarDays className="h-2.5 w-2.5" />
                                                <span className="text-[10px]">Date abs.</span>
                                            </div>
                                        )}

                                        {/* Period badge - Only show if it wasn't used as title */}
                                        {!isMaison && doc.consumptionPeriod && !isCoreBill && (
                                            <div className="flex items-center gap-1 text-blue-600 font-bold shrink-0 whitespace-nowrap bg-blue-50/80 px-1.5 rounded border border-blue-100/50">
                                                <CalendarDays className="h-2.5 w-2.5 shrink-0" />
                                                <span>
                                                    {doc.consumptionPeriod.match(/^\d{4}-\d{2}-\d{2}-\d{2}$/) ? (
                                                        (() => {
                                                            const parts = doc.consumptionPeriod.split('-');
                                                            const year = parts[0].slice(-2);
                                                            const months = parts.slice(1).map(m => {
                                                                try {
                                                                    const d = new Date(parseInt(parts[0]), parseInt(m) - 1, 1);
                                                                    return format(d, 'MMM', { locale: fr }).replace('.', '').toLowerCase();
                                                                } catch (e) { return m; }
                                                            }).reverse();
                                                            return `${months.join('-')} ${year}`;
                                                        })()
                                                    ) : doc.consumptionPeriod}
                                                </span>
                                            </div>
                                        )}

                                        {doc.paymentDate && (
                                            <div className="flex items-center gap-1 text-green-700 font-bold shrink-0 bg-green-50 px-1.5 rounded border border-green-100">
                                                <CheckCircle className="h-2.5 w-2.5" />
                                                <span>Payé le {formatDateSafe(doc.paymentDate, 'dd/MM/yy')}</span>
                                            </div>
                                        )}

                                        {!isMaison && (doc.consumptionQuantity || doc.gasConsumptionQuantity) && (
                                            <div className="flex items-center gap-1 text-foreground font-medium shrink-0 bg-secondary/40 px-1.5 rounded border border-secondary/50">
                                                {doc.category === 'STEG' ? <Zap className="h-2.5 w-2.5 text-yellow-500" /> : <Droplets className="h-2.5 w-2.5 text-blue-500" />}
                                                <span>
                                                    {doc.consumptionQuantity && `${doc.consumptionQuantity}${doc.category === 'SONEDE' ? 'm³' : 'kWh'}`}
                                                    {doc.consumptionQuantity && doc.gasConsumptionQuantity && '·'}
                                                    {doc.gasConsumptionQuantity && `${doc.gasConsumptionQuantity}m³`}
                                                </span>
                                            </div>
                                        )}

                                        {isMaison && fileCount > 0 && (
                                            <div className="flex items-center gap-1 shrink-0 bg-secondary/20 px-1 rounded border border-secondary/50">
                                                <FileText className="h-2.5 w-2.5" />
                                                <span>{fileCount} f.</span>
                                            </div>
                                        )}

                                        {isMaison && periodStart && periodEnd && (
                                            <div className="flex items-center gap-1 shrink-0 text-green-700 font-medium bg-green-50 px-1 rounded border border-green-100">
                                                <CalendarDays className="h-2.5 w-2.5 text-green-600" />
                                                <span>{`${periodStart}-${periodEnd}`}</span>
                                            </div>
                                        )}

                                        {isMaison && doc.notes && (
                                            <div className="flex items-center gap-1 shrink-0 bg-secondary/20 px-1 rounded border border-secondary/50">
                                                <MessageSquare className="h-2.5 w-2.5" />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="shrink-0 flex items-center">
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => { e.stopPropagation(); openDetailsModal(doc); }}>
                                        <Info className="h-4 w-4" />
                                    </Button>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
                                                <span className="sr-only">Ouvrir le menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => openEditModal(doc)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Détails / Modifier
                                            </DropdownMenuItem>

                                            <DropdownMenuItem onClick={() => handleViewFile(doc.id)}>
                                                <Eye className="mr-2 h-4 w-4" />
                                                Consulter le fichier
                                            </DropdownMenuItem>

                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onSelect={(e) => { e.preventDefault(); confirmDelete(doc); }}>
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Supprimer
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        );
                    })}
                </div>
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

            {selectedDocument && (
                <DetailsDialogComponent
                    open={isDetailsModalOpen}
                    onOpenChange={setIsDetailsModalOpen}
                    document={selectedDocument}
                />
            )}
        </>
    );
}
