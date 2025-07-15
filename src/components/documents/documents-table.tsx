
'use client';

import { useState } from 'react';
import { Document } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, MoreHorizontal, Eye, Edit, Trash2, Home } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { UploadDocumentDialog } from '../upload-document-dialog';

const CategoryIcon = ({ category }: { category: Document['category'] }) => {
  switch (category) {
    case 'Facture': return <FileText className="h-5 w-5 text-blue-500" />;
    case 'Reçu': return <FileText className="h-5 w-5 text-indigo-500" />;
    case 'Maison': return <Home className="h-5 w-5 text-green-500" />;
    default: return <FileText className="h-5 w-5 text-gray-500" />;
  }
};

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
                    <TableHead>Nom du document</TableHead>
                    <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                    <TableHead className="hidden md:table-cell">Fournisseur</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Montant</TableHead>
                    <TableHead className="text-right">Ajouté le</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((doc) => (
                    <TableRow key={doc.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                           <CategoryIcon category={doc.category} />
                           <span className="font-medium">{doc.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="outline" className="rounded-md">{doc.category}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{doc.supplier || 'N/A'}</TableCell>
                       <TableCell className="hidden lg:table-cell text-right font-mono">
                        {doc.amount ? `${doc.amount.toFixed(2)} TND` : '-'}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{format(parseISO(doc.createdAt), 'dd/MM/yy', { locale: fr })}</TableCell>
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
