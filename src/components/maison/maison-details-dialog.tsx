
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Document } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Home, Calendar, CircleDollarSign, Hash, FileText, StickyNote, Eye, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MaisonDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document;
}

const formatDateSafe = (dateString?: string, dateFormat = 'd MMMM yyyy') => {
    if (!dateString) return null;
    const date = parseISO(dateString);
    if (isValid(date)) {
        return format(date, dateFormat, { locale: fr });
    }
    return 'Date invalide';
};

const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | null }) => {
    if (!value) return null;
    return (
        <div className="flex items-start gap-4">
            <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
            <div className="flex-1">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-semibold">{value}</p>
            </div>
        </div>
    )
}

export function MaisonDetailsDialog({ open, onOpenChange, document: docProp }: MaisonDetailsDialogProps) {
    const router = useRouter();
    
    const handleViewFile = () => {
        router.push(`/view?id=${docProp.id}`);
    }

    const docDate = formatDateSafe(docProp.issueDate || docProp.createdAt);
    const periodStart = formatDateSafe(docProp.billingStartDate, 'MMMM yyyy');
    const periodEnd = formatDateSafe(docProp.billingEndDate, 'MMMM yyyy');
    const period = periodStart && periodEnd ? `Du ${periodStart} au ${periodEnd}` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline break-words">{docProp.name}</DialogTitle>
          <DialogDescription>
            Détails du dossier archivé dans votre Espace Maison.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4 -mr-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailItem icon={Home} label="Catégorie" value={docProp.subCategory} />
                <DetailItem icon={Calendar} label="Date du dossier" value={docDate} />
                <DetailItem icon={CircleDollarSign} label="Montant" value={docProp.amount ? `${docProp.amount} TND` : null} />
                <DetailItem icon={Calendar} label="Période" value={period} />
            </div>

            {docProp.notes && (
                <DetailItem icon={StickyNote} label="Notes" value={docProp.notes} />
            )}

            {docProp.files && docProp.files.length > 0 && (
                <div>
                     <h4 className="text-sm font-medium text-muted-foreground mb-2">Fichiers ({docProp.files.length})</h4>
                     <div className="space-y-2 rounded-md border p-2">
                        {docProp.files.map((file, index) => (
                            <div key={file.id} className="flex items-center gap-2 p-1 rounded-md hover:bg-muted">
                                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                                <p className="text-sm font-medium flex-1 truncate" title={file.name}>{file.name}</p>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleViewFile}>
                                    <Eye className="h-4 w-4" />
                                    <span className="sr-only">Consulter le dossier (fichier {index+1})</span>
                                </Button>
                            </div>
                        ))}
                     </div>
                </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
