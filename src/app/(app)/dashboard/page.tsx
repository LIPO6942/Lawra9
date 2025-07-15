import { mockAlerts, mockDocuments } from '@/lib/data';
import { Alert, Document } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Bell, FileText, AlertTriangle, CheckCircle, Clock, Files, Search } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { UploadDocumentDialog } from '@/components/upload-document-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';

function getAlertBadge(dueDate: string) {
  const daysDiff = differenceInDays(parseISO(dueDate), new Date());
  if (daysDiff < 0) {
    return <Badge variant="destructive" className="rounded-md">Urgent</Badge>;
  }
  if (daysDiff <= 7) {
    return <Badge className="bg-destructive/80 rounded-md">Urgent</Badge>;
  }
  if (daysDiff <= 15) {
    return <Badge className="bg-orange-400 text-black rounded-md">Proche</Badge>;
  }
  return <Badge variant="secondary" className="rounded-md">Normal</Badge>;
}

const CategoryIcon = ({ category }: { category: Document['category'] }) => {
  switch (category) {
    case 'Facture': return <FileText className="h-5 w-5 text-blue-500" />;
    case 'Contrat': return <FileText className="h-5 w-5 text-green-500" />;
    case 'Garantie': return <FileText className="h-5 w-5 text-yellow-500" />;
    case 'Reçu': return <FileText className="h-5 w-5 text-indigo-500" />;
    default: return <FileText className="h-5 w-5 text-gray-500" />;
  }
};

export default function DashboardPage() {
  const alerts: Alert[] = mockAlerts.sort((a,b) => differenceInDays(parseISO(a.dueDate), new Date()) - differenceInDays(parseISO(b.dueDate), new Date()));
  const documents: Document[] = mockDocuments;

  return (
    <ScrollArea className="h-full">
      <div className="flex-1 space-y-8 p-4 md:p-8 pt-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between space-y-4 md:space-y-0">
            <div>
                 <h2 className="text-3xl font-bold tracking-tight font-headline">Tableau de bord</h2>
                 <p className="text-muted-foreground">Bienvenue ! Voici un aperçu de vos documents et alertes.</p>
            </div>
            <div className="flex items-center space-x-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Rechercher (ex: 'factur sonede')" className="pl-9 rounded-lg" />
                </div>
                <UploadDocumentDialog />
            </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div >
                <CardTitle className="text-lg font-medium font-headline">Alertes à venir</CardTitle>
                <CardDescription>Vos échéances importantes.</CardDescription>
              </div>
              <Bell className="h-6 w-6 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {alerts.map((alert) => (
                  <div key={alert.id} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                        {differenceInDays(parseISO(alert.dueDate), new Date()) < 0 ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Clock className="h-5 w-5 text-accent" />}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-none">{alert.documentName}</p>
                      <p className="text-sm text-muted-foreground">{alert.type} - Échéance: {format(parseISO(alert.dueDate), 'd MMMM yyyy', { locale: fr })}</p>
                    </div>
                    {getAlertBadge(alert.dueDate)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
               <div>
                  <CardTitle className="text-lg font-medium font-headline">Documents Récents</CardTitle>
                  <CardDescription>Vos derniers documents ajoutés.</CardDescription>
               </div>
               <Files className="h-6 w-6 text-accent" />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead className="hidden sm:table-cell">Catégorie</TableHead>
                    <TableHead className="text-right">Ajouté le</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.slice(0, 5).map((doc) => (
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
                      <TableCell className="text-right text-muted-foreground">{format(parseISO(doc.createdAt), 'dd/MM/yy', { locale: fr })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}
