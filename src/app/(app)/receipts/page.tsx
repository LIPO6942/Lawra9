'use client';

import Link from 'next/link';
import { UploadReceiptDialog } from '@/components/upload-receipt-dialog';
import { useReceipts } from '@/contexts/receipt-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Pencil, Receipt, Trash2, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { inferQuantityFromLabel, normalizeProductKey } from '@/lib/utils';
import { useLearning } from '@/contexts/learning-context';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type ProposedChange = {
  receiptId: string;
  storeName?: string;
  linesUpdated: number;
  newLines: any[];
  indicesToDelete: number[];
  details: { index: number; label: string; beforeQty?: number; afterQty?: number; }[]
};

export default function ReceiptsPage() {
  const { receipts, updateReceipt, deleteReceipt } = useReceipts();
  const { learnPackQty } = useLearning();
  const { toast } = useToast();

  // Basic Editor (Store & Date)
  const [basicEditorOpen, setBasicEditorOpen] = useState(false);
  const [basicEditorReceiptId, setBasicEditorReceiptId] = useState<string | null>(null);
  const [editingStoreName, setEditingStoreName] = useState('');
  const [editingDateValue, setEditingDateValue] = useState('');

  // Line Editor
  const [lineEditorOpen, setLineEditorOpen] = useState(false);
  const [lineEditorReceiptId, setLineEditorReceiptId] = useState<string | null>(null);
  const [lineDrafts, setLineDrafts] = useState<any[]>([]);

  // Preview / Recalc
  const [previewOpen, setPreviewOpen] = useState(false);
  const [proposed, setProposed] = useState<ProposedChange[]>([]);

  function toLocalInputValue(iso?: string) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toIsoFromLocal(localVal: string) {
    if (!localVal) return undefined;
    return new Date(localVal).toISOString();
  }

  function openBasicEditor(rcpt: any) {
    setBasicEditorReceiptId(rcpt.id);
    setEditingStoreName(rcpt.storeName || '');
    setEditingDateValue(toLocalInputValue(rcpt.purchaseAt));
    setBasicEditorOpen(true);
  }

  function openLineEditor(rcptId: string) {
    const rcpt = receipts.find(r => r.id === rcptId);
    if (!rcpt) return;
    setLineEditorReceiptId(rcpt.id);
    setLineDrafts((rcpt.lines || []).map(l => ({ ...l })));
    setLineEditorOpen(true);
  }

  function setField(i: number, key: 'quantity' | 'unitPrice' | 'lineTotal', val: string) {
    setLineDrafts(prev => {
      const next = [...prev];
      const row = { ...next[i] };
      const num = val === '' ? undefined : Number(val);
      row[key] = Number.isFinite(num) ? Number(val) : undefined;
      next[i] = row;
      return next;
    });
  }

  function autoRecalc(i: number) {
    setLineDrafts(prev => {
      const next = [...prev];
      const row = { ...next[i] };
      const q = Number(row.quantity);
      const up = Number(row.unitPrice);
      const lt = Number(row.lineTotal);
      const hasQ = Number.isFinite(q) && q > 0;
      const hasUP = Number.isFinite(up) && up > 0;
      const hasLT = Number.isFinite(lt) && lt >= 0;
      if (hasQ && hasUP && !hasLT) {
        row.lineTotal = parseFloat((q * up).toFixed(3));
      } else if (hasQ && hasLT && !hasUP && q !== 0) {
        row.unitPrice = parseFloat((lt / q).toFixed(3));
      } else if (hasUP && hasLT && !hasQ && up !== 0) {
        const qf = lt / up;
        const qi = Math.round(qf);
        if (Math.abs(qf - qi) < 0.05 && qi > 0 && qi <= 200) {
          row.quantity = qi;
        }
      }
      next[i] = row;
      return next;
    });
  }

  function deleteDraftLine(i: number) {
    const ok = typeof window !== 'undefined' ? window.confirm('Supprimer cette ligne ?') : true;
    if (!ok) return;
    setLineDrafts(prev => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          Reçus
        </h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button asChild variant="outline">
            <Link href="/stats/receipts">Voir stats reçus</Link>
          </Button>
          <Button variant="secondary" onClick={() => {
            const changes: ProposedChange[] = [];
            for (const rcpt of receipts) {
              let linesUpdated = 0;
              const details: any[] = [];
              const newLines = (rcpt.lines || []).map((ln, idx) => {
                const before = { quantity: ln.quantity, unit: ln.unit, unitPrice: ln.unitPrice, lineTotal: ln.lineTotal };
                const inferred = inferQuantityFromLabel(ln.normalizedLabel || ln.rawLabel, before);
                if (inferred.quantity !== before.quantity) {
                  linesUpdated++;
                  details.push({ index: idx, label: ln.normalizedLabel || ln.rawLabel || '', beforeQty: before.quantity, afterQty: inferred.quantity });
                  return { ...ln, ...inferred };
                }
                return ln;
              });
              if (linesUpdated > 0) {
                changes.push({ receiptId: rcpt.id, storeName: rcpt.storeName, linesUpdated, newLines, details, indicesToDelete: [] });
              }
            }
            setProposed(changes);
            setPreviewOpen(true);
          }}>
            Recalculer
          </Button>
          <UploadReceiptDialog />
        </div>
      </div>
      <Separator />

      {/* Content */}
      {receipts.length === 0 ? (
        <Card>
          <CardHeader><CardTitle>Aucun reçu</CardTitle></CardHeader>
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
                <CardTitle className="text-base flex-1 mr-4 truncate">
                  {rcpt.storeName || 'Magasin inconnu'}
                </CardTitle>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="hidden sm:inline">
                    {rcpt.purchaseAt ? format(new Date(rcpt.purchaseAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Date inconnue'}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => openBasicEditor(rcpt)} title="Modifier infos">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => openLineEditor(rcpt.id)} title="Modifier lignes">
                    <ListChecks className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={async () => {
                    if (confirm('Supprimer ce reçu ?')) await deleteReceipt(rcpt.id);
                  }} title="Supprimer">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="flex items-center justify-between">
                  <div>{rcpt.lines?.length || 0} article(s)</div>
                  <div className="font-semibold text-foreground">
                    {rcpt.total != null ? `${rcpt.total.toFixed(3)} ${rcpt.currency || 'TND'}` : 'Total inconnu'}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* BASIC EDITOR DIALOG */}
      <Dialog open={basicEditorOpen} onOpenChange={setBasicEditorOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le reçu</DialogTitle>
            <DialogDescription>Ajustez le nom de l'enseigne et la date.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Magasin</label>
              <input
                className="h-10 w-full rounded-md border px-3 bg-background"
                value={editingStoreName}
                onChange={e => setEditingStoreName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Date et heure</label>
              <input
                type="datetime-local"
                className="h-10 w-full rounded-md border px-3 bg-background"
                value={editingDateValue}
                onChange={e => setEditingDateValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBasicEditorOpen(false)}>Annuler</Button>
            <Button onClick={async () => {
              if (basicEditorReceiptId) {
                await updateReceipt(basicEditorReceiptId, {
                  storeName: editingStoreName,
                  purchaseAt: toIsoFromLocal(editingDateValue)
                });
              }
              setBasicEditorOpen(false);
            }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LINE EDITOR DIALOG */}
      <Dialog open={lineEditorOpen} onOpenChange={setLineEditorOpen}>
        <DialogContent className="max-w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Modifier les lignes</DialogTitle>
            <DialogDescription>Quantité, Prix unitaire, Total ligne.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background z-10">
                <tr className="text-left border-b font-semibold">
                  <th className="py-2 pr-2">Libellé</th>
                  <th className="py-2 pr-2 w-16">Qté</th>
                  <th className="py-2 pr-2 w-24">P.U.</th>
                  <th className="py-2 pr-2 w-24">Total</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {lineDrafts.map((ln, i) => (
                  <tr key={ln.id || i} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                    <td className="py-2 pr-2 truncate max-w-[150px]" title={ln.rawLabel}>{ln.normalizedLabel || ln.rawLabel}</td>
                    <td className="py-2 pr-2"><input type="number" className="h-8 w-16 border rounded bg-background px-1" value={ln.quantity ?? ''} onChange={e => setField(i, 'quantity', e.target.value)} onBlur={() => autoRecalc(i)} /></td>
                    <td className="py-2 pr-2"><input type="number" className="h-8 w-24 border rounded bg-background px-1 text-right" step="0.001" value={ln.unitPrice ?? ''} onChange={e => setField(i, 'unitPrice', e.target.value)} onBlur={() => autoRecalc(i)} /></td>
                    <td className="py-2 pr-2"><input type="number" className="h-8 w-24 border rounded bg-background px-1 text-right font-medium" step="0.001" value={ln.lineTotal ?? ''} onChange={e => setField(i, 'lineTotal', e.target.value)} onBlur={() => autoRecalc(i)} /></td>
                    <td className="py-2 text-right"><Button variant="ghost" size="icon" onClick={() => deleteDraftLine(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLineEditorOpen(false)}>Annuler</Button>
            <Button onClick={async () => {
              if (lineEditorReceiptId) {
                await updateReceipt(lineEditorReceiptId, { lines: lineDrafts });
              }
              setLineEditorOpen(false);
              toast({ title: 'Modifié', description: 'Les lignes ont été mises à jour.' });
            }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PREVIEW DIALOG */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Aperçu des corrections</DialogTitle></DialogHeader>
          <div className="max-h-64 overflow-auto space-y-3">
            {proposed.map(p => (
              <Card key={p.receiptId} className="p-3 border-dashed">
                <div className="text-sm font-semibold mb-2">{p.storeName || 'Magasin'}</div>
                {p.details.map((d: any, i: number) => (
                  <div key={i} className="text-xs flex justify-between gap-4 py-1 border-t border-muted/50">
                    <span className="truncate flex-1">{d.label}</span>
                    <span className="shrink-0">{d.beforeQty} → <span className="font-bold">{d.afterQty}</span></span>
                  </div>
                ))}
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>Fermer</Button>
            <Button onClick={async () => {
              for (const p of proposed) {
                await updateReceipt(p.receiptId, { lines: p.newLines });
              }
              setPreviewOpen(false);
              setProposed([]);
              toast({ title: 'Terminé', description: 'Quantités recalculées.' });
            }}>Appliquer tout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
