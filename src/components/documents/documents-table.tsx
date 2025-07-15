
'use client';

import { Document } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

const CategoryIcon = ({ category }: { category: Document['category'] }) => {
  switch (category) {
    case 'Facture': return <FileText className="h-5 w-5 text-blue-500" />;
    case 'Contrat': return <FileText className="h-5 w-5 text-green-500" />;
    case 'Garantie': return <FileText className="h-5 w-5 text-yellow-500" />;
    case 'Reçu': return <FileText className="h-5 w-5 text-indigo-500" />;
    default: return <FileText className="h-5 w-5 text-gray-500" />;
  }
};

interface DocumentsTableProps {
    documents: Document[];
}

export function DocumentsTable({ documents }: DocumentsTableProps) {
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
                            <DropdownMenuItem>
                              <Eye className="mr-2 h-4 w-4" />
                              Consulter
                            </DropdownMenuItem>
                             <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                             <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
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
                    <p className="text-sm text-muted-foreground/80">Essayez une autre recherche ou ajoutez un nouveau document.</p>
                </div>
            )}
        </>
    );
}
