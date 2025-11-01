'use client';

import { UploadReceiptDialog } from '@/components/upload-receipt-dialog';
import { useReceipts } from '@/contexts/receipt-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Receipt } from 'lucide-react';

export default function ReceiptsPage() {
  const { receipts } = useReceipts();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          Reçus
        </h1>
        <UploadReceiptDialog />
      </div>
      <Separator />

      {receipts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Aucun reçu</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Ajoutez votre premier reçu pour commencer l'analyse.</p>
            <div className="mt-4"><UploadReceiptDialog><Button>Ajouter un reçu</Button></UploadReceiptDialog></div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {receipts.map(rcpt => (
            <Card key={rcpt.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">
                  {rcpt.storeName || 'Magasin inconnu'}
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  {rcpt.purchaseAt ? format(new Date(rcpt.purchaseAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Date inconnue'}
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <div>
                    {rcpt.lines?.length || 0} article(s)
                  </div>
                  <div className="font-semibold text-foreground">
                    {rcpt.total != null ? `${rcpt.total.toFixed(3)} ${rcpt.currency || 'TND'}` : 'Total inconnu'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
