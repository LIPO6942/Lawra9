'use client';

import Link from 'next/link';
import { UploadReceiptDialog } from '@/components/upload-receipt-dialog';
import { useReceipts } from '@/contexts/receipt-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Pencil, Save, X, Receipt, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function ReceiptsPage() {
  const { receipts, updateReceipt, deleteReceipt } = useReceipts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  function toLocalInputValue(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    // datetime-local expects 'YYYY-MM-DDTHH:mm'
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toIsoFromLocal(localVal: string) {
    // local datetime without timezone -> treat as local, convert to ISO
    if (!localVal) return undefined;
    const d = new Date(localVal);
    return d.toISOString();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          Reçus
        </h1>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/stats/receipts">Voir stats reçus</Link>
          </Button>
          <UploadReceiptDialog />
        </div>
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
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  {editingId === rcpt.id ? (
                    <>
                      <input
                        type="datetime-local"
                        className="h-8 rounded-md border px-2 text-foreground bg-background"
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                      />
                      <Button size="sm" variant="ghost" onClick={async () => {
                        const iso = toIsoFromLocal(editingValue);
                        await updateReceipt(rcpt.id, { purchaseAt: iso });
                        setEditingId(null);
                        setEditingValue('');
                      }} title="Enregistrer">
                        <Save className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingValue(''); }} title="Annuler">
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      {rcpt.purchaseAt ? format(new Date(rcpt.purchaseAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Date inconnue'}
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(rcpt.id); setEditingValue(toLocalInputValue(rcpt.purchaseAt) || toLocalInputValue(new Date().toISOString())); }} title="Modifier la date">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={async () => {
                        const ok = typeof window !== 'undefined' ? window.confirm('Supprimer ce reçu ?') : true;
                        if (!ok) return;
                        await deleteReceipt(rcpt.id);
                      }} title="Supprimer le reçu">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
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
