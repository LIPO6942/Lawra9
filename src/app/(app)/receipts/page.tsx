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
        <Card className="border-dashed py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2 uppercase tracking-tighter font-black">Aucun reçu</CardTitle>
            <p className="text-sm text-muted-foreground mb-6">Ajoutez votre premier reçu pour commencer l'analyse IA.</p>
            <UploadReceiptDialog><Button size="lg" className="rounded-full shadow-lg hover:shadow-xl transition-all">Ajouter un reçu</Button></UploadReceiptDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {receipts.map(rcpt => (
            <Card key={rcpt.id} className="group overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 ring-1 ring-border/50 hover:ring-primary/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex flex-col gap-0.5 flex-1 mr-4 truncate">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                    {rcpt.storeName || 'Magasin inconnu'}
                    <span className="h-1 w-1 rounded-full bg-primary/30 hidden sm:block" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block sm:inline">
                      {rcpt.purchaseAt ? format(new Date(rcpt.purchaseAt), 'dd MMM yyyy', { locale: fr }) : 'Date inconnue'}
                    </span>
                  </CardTitle>
                  <p className="text-[10px] font-medium text-muted-foreground/60 hidden sm:block">
                    {rcpt.purchaseAt ? format(new Date(rcpt.purchaseAt), 'HH:mm', { locale: fr }) : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => openBasicEditor(rcpt)} title="Modifier infos">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => openLineEditor(rcpt.id)} title="Modifier lignes">
                    <ListChecks className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={async () => {
                    if (confirm('Supprimer ce reçu ?')) await deleteReceipt(rcpt.id);
                  }} title="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="flex items-end justify-between">
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <div className="px-2 py-0.5 rounded-full bg-muted font-bold tracking-tight">{rcpt.lines?.length || 0} ARTICLES</div>
                    {rcpt.status === 'parsed' && <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold tracking-tight">IA OK</div>}
                  </div>
                  <div className="text-lg font-black tracking-tighter text-foreground">
                    {rcpt.total != null ? `${rcpt.total.toFixed(3)}` : '0.000'} <span className="text-[10px] font-bold text-muted-foreground align-top mt-1 inline-block">TND</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* BASIC EDITOR DIALOG */}
      <Dialog open={basicEditorOpen} onOpenChange={setBasicEditorOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Modifier le reçu</DialogTitle>
            <DialogDescription>Ajustez le nom de l'enseigne et la date de l'achat.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Magasin</label>
              <input
                className="h-11 w-full rounded-2xl border border-input shadow-sm px-4 bg-background focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={editingStoreName}
                onChange={e => setEditingStoreName(e.target.value)}
                placeholder="Ex: Carrefour, Aziza..."
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">Date et heure</label>
              <input
                type="datetime-local"
                className="h-11 w-full rounded-2xl border border-input shadow-sm px-4 bg-background focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={editingDateValue}
                onChange={e => setEditingDateValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" className="rounded-2xl" onClick={() => setBasicEditorOpen(false)}>Annuler</Button>
            <Button className="rounded-2xl px-8 shadow-lg shadow-primary/20 font-bold" onClick={async () => {
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
        <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Modifier les articles</DialogTitle>
            <DialogDescription>Ajustez les quantités et prix. Le total se recalcule automatiquement.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto -mx-1 px-1 custom-scrollbar">
            <table className="w-full text-xs sm:text-sm border-collapse">
              <thead className="sticky top-0 bg-background z-20 border-b">
                <tr className="text-left font-bold text-muted-foreground uppercase tracking-widest text-[9px]">
                  <th className="pb-3 pr-2">Article</th>
                  <th className="pb-3 pr-2 w-16 text-center">Qté</th>
                  <th className="pb-3 pr-2 w-20 text-right">P.U.</th>
                  <th className="pb-3 pr-2 w-20 text-right">Total</th>
                  <th className="pb-3 w-10 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted/30">
                {lineDrafts.map((ln, i) => (
                  <tr key={ln.id || i} className="group hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-2 font-medium truncate max-w-[100px] sm:max-w-[180px]" title={ln.rawLabel}>
                      {ln.normalizedLabel || ln.rawLabel}
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        className="h-8 w-14 border rounded-xl bg-muted/50 focus:bg-background px-1 text-center font-bold focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                        value={ln.quantity ?? ''}
                        onChange={e => setField(i, 'quantity', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        className="h-8 w-20 border rounded-xl bg-muted/50 focus:bg-background px-1 text-right focus:ring-2 focus:ring-primary/10 transition-all outline-none"
                        step="0.001"
                        value={ln.unitPrice ?? ''}
                        onChange={e => setField(i, 'unitPrice', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <input
                        type="number"
                        className="h-8 w-20 border rounded-xl bg-primary/5 px-1 text-right font-black text-primary border-primary/20 outline-none"
                        step="0.001"
                        value={ln.lineTotal ?? ''}
                        onChange={e => setField(i, 'lineTotal', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </td>
                    <td className="py-2 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive/50 hover:text-destructive hover:bg-destructive/5 transition-all" onClick={() => deleteDraftLine(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DialogFooter className="gap-2 sm:gap-2 mt-6">
            <Button variant="ghost" className="rounded-2xl" onClick={() => setLineEditorOpen(false)}>Annuler</Button>
            <Button className="rounded-2xl px-8 shadow-lg shadow-primary/20 font-bold" onClick={async () => {
              if (lineEditorReceiptId) {
                await updateReceipt(lineEditorReceiptId, { lines: lineDrafts });
              }
              setLineEditorOpen(false);
              toast({ title: 'Mis à jour', description: 'Les articles ont été enregistrés.' });
            }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PREVIEW DIALOG */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-xl rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight">Aperçu des corrections</DialogTitle>
            <DialogDescription>L'IA a identifié des anomalies exploitables dans vos tickets.</DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-auto space-y-3 pr-1 custom-scrollbar">
            {proposed.map(p => (
              <Card key={p.receiptId} className="p-4 border-dashed bg-muted/10 border-muted">
                <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-3">{p.storeName || 'Magasin'}</div>
                <div className="space-y-2">
                  {p.details.map((d: any, i: number) => (
                    <div key={i} className="text-[11px] flex justify-between gap-4 py-2 border-t border-muted/50 items-center">
                      <span className="truncate flex-1 font-semibold">{d.label}</span>
                      <span className="shrink-0 flex items-center gap-2">
                        <span className="text-muted-foreground line-through decoration-destructive/30 font-medium">{d.beforeQty}</span>
                        <span className="h-4 w-4 bg-primary/20 rounded-full flex items-center justify-center text-primary text-[10px] select-none text-center leading-none">→</span>
                        <span className="font-black text-foreground bg-primary/10 px-2 py-0.5 rounded-lg">{d.afterQty}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <DialogFooter className="mt-6">
            <Button variant="ghost" className="rounded-2xl" onClick={() => setPreviewOpen(false)}>Fermer</Button>
            <Button className="rounded-2xl shadow-xl shadow-primary/20 font-bold" onClick={async () => {
              for (const p of proposed) {
                await updateReceipt(p.receiptId, { lines: p.newLines });
              }
              setPreviewOpen(false);
              setProposed([]);
              toast({ title: 'Succès', description: 'Les quantités ont été corrigées.' });
            }}>Appliquer tout</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
