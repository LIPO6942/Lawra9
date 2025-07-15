
'use client';

import { useState } from 'react';
import { mockDocuments } from '@/lib/data';
import { Document } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Search, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
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

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>(mockDocuments);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocuments = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
          <div>
               <h2 className="text-3xl font-bold tracking-tight font-headline">Mes Documents</h2>
               <p className="text-muted-foreground">Consultez, gérez et organisez tous vos documents importants.</p>
          </div>
          <div className="flex items-center space-x-2 w-full md:w-auto">
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
              {filteredDocuments.map((doc) => (
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
           {filteredDocuments.length === 0 && (
            <div className="text-center py-16">
                <p className="text-muted-foreground">Aucun document trouvé.</p>
                <p className="text-sm text-muted-foreground/80">Essayez une autre recherche ou ajoutez un nouveau document.</p>
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
