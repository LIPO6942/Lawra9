
'use client';

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Document } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, CircleDollarSign, Hash, FileText, StickyNote, Eye, Download, Activity, Wind, Droplets } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface DocumentDetailsDialogProps {
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
        <div className="flex items-start gap-4 py-2">
            <Icon className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
            <div className="flex-1">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="font-semibold break-words">{value}</p>
            </div>
        </div>
    )
}

export function DocumentDetailsDialog({ open, onOpenChange, document }: DocumentDetailsDialogProps) {
    const router = useRouter();

    const handleViewFile = () => {
        if (document.id) {
            router.push(`/view?id=${document.id}`);
        }
    }

    const issueDate = formatDateSafe(document.issueDate);
    const dueDate = formatDateSafe(document.dueDate);

    let period = null;
    if (document.consumptionPeriod) {
        period = document.consumptionPeriod;
        // Si c'est le format SONEDE AAAA-MM-MM-MM, on le rend un peu plus beau
        if (period.match(/^\d{4}-\d{2}-\d{2}-\d{2}$/)) {
            const parts = period.split('-');
            const year = parts[0];
            const months = parts.slice(1).map(m => {
                try {
                    const d = new Date(parseInt(year), parseInt(m) - 1, 1);
                    return format(d, 'MMMM', { locale: fr });
                } catch (e) { return m; }
            });
            period = `${year} ${months.join('-')}`;
        }
    } else {
        const periodStart = formatDateSafe(document.billingStartDate, 'MMM yyyy');
        const periodEnd = formatDateSafe(document.billingEndDate, 'MMM yyyy');
        if (periodStart && periodEnd) {
            period = `Du ${periodStart} au ${periodEnd}`;
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="font-headline break-words">{document.name}</DialogTitle>
                    <DialogDescription>
                        Détails de la facture "{document.supplier || document.category}".
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-1 py-4 max-h-[60vh] overflow-y-auto pr-4 -mr-4 divide-y divide-border">
                    <DetailItem icon={CircleDollarSign} label="Montant Total" value={document.amount ? `${document.amount} TND` : null} />
                    <DetailItem icon={Calendar} label="Date d'émission" value={issueDate} />
                    <DetailItem icon={Calendar} label="Date d'échéance" value={dueDate} />
                    <DetailItem icon={Calendar} label="Date de paiement" value={formatDateSafe(document.paymentDate)} />
                    <DetailItem icon={Calendar} label="Période de facturation" value={period} />
                    <DetailItem icon={Hash} label="Numéro de facture" value={document.invoiceNumber} />

                    {(document.consumptionQuantity || document.gasConsumptionQuantity) && (
                        <div className="pt-2">
                            <div className="flex items-start gap-4">
                                <Activity className="h-5 w-5 text-muted-foreground mt-1 flex-shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm text-muted-foreground">Détails de consommation</p>
                                    <div className="font-semibold space-y-1 mt-1">
                                        {document.consumptionQuantity && <p className='flex items-center gap-2'><Droplets className='h-4 w-4 text-blue-500' /> {document.consumptionQuantity}</p>}
                                        {document.gasConsumptionQuantity && <p className='flex items-center gap-2'><Wind className='h-4 w-4 text-orange-500' /> {document.gasConsumptionQuantity}</p>}
                                        {document.gasAmount && <p className='flex items-center gap-2'><CircleDollarSign className='h-4 w-4 text-orange-500' /> {document.gasAmount} TND (Gaz)</p>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
                    {document.id && (
                        <Button onClick={handleViewFile}>
                            <Eye className="mr-2 h-4 w-4" />
                            Consulter le fichier
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
