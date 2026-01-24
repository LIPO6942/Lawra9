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

  const today = new Date();

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
    const d = iso ? new Date(iso) : new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function toIsoFromLocal(localVal: string) {
    if (!localVal) return new Date().toISOString();
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
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header with Premium Style */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/5 via-background to-accent/5 p-6 sm:p-8 border border-border/50 shadow-2xl shadow-primary/5">
        <div className="absolute top-0 right-0 -mr-12 -mt-12 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex flex-col items-center sm:items-start text-center sm:text-left">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 ring-1 ring-primary/20">
              <Receipt className="h-7 w-7 text-primary" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Gestion des Reçus</h1>
            <p className="text-muted-foreground font-medium mt-1">Analyse et organisation intelligente de vos dépenses</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Button asChild variant="ghost" className="rounded-full font-bold hover:bg-primary/5">
              <Link href="/stats/receipts">Statistiques</Link>
            </Button>
            <Button variant="outline" className="rounded-full font-bold border-2" onClick={() => {
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
              Analyser
            </Button>
            <UploadReceiptDialog>
              <Button size="lg" className="rounded-full shadow-xl shadow-primary/20 font-bold px-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
                Scanner un reçu
              </Button>
            </UploadReceiptDialog>
          </div>
        </div>
      </div>

      {/* Grid of Receipts */}
      {receipts.length === 0 ? (
        <Card className="border-dashed py-20 rounded-[2.5rem] bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 rounded-full bg-background/50 flex items-center justify-center mb-6 shadow-sm border border-border/50">
              <Receipt className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <CardTitle className="text-2xl font-black tracking-tight mb-2">Aucun reçu trouvé</CardTitle>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-8">Commencez par scanner votre premier ticket de caisse pour une gestion simplifiée.</p>
            <UploadReceiptDialog><Button size="lg" className="rounded-full px-10 shadow-lg hover:shadow-2xl transition-all duration-300">Ajouter maintenant</Button></UploadReceiptDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-5">
          {receipts.map(rcpt => {
            const displayDate = rcpt.purchaseAt ? new Date(rcpt.purchaseAt) : today;
            return (
              <Card key={rcpt.id} className="group relative overflow-hidden border-none rounded-[2rem] bg-gradient-to-tr from-background to-muted/30 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 ring-1 ring-border/50 hover:ring-primary/30">
                <div className="absolute top-0 right-0 h-32 w-32 bg-primary/5 rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity" />

                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                  <div className="flex flex-col gap-1.5 flex-1 mr-4 overflow-hidden">
                    <CardTitle className="text-xl font-black text-foreground truncate group-hover:text-primary transition-colors">
                      {rcpt.storeName || 'Magasin Inconnu'}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-background flex items-center justify-center shadow-sm border border-border/50">
                        <span className="text-[10px] font-black text-primary uppercase">{format(displayDate, 'MMM', { locale: fr })}</span>
                      </div>
                      <span className="text-xs font-bold text-muted-foreground tracking-tight">
                        {rcpt.purchaseAt ? format(displayDate, 'dd MMM yyyy • HH:mm', { locale: fr }) : format(today, 'dd MMM yyyy (Aujourd\'hui)', { locale: fr })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 bg-background/50 backdrop-blur-md rounded-full p-1 border border-border/50 shadow-sm">
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-primary hover:text-white transition-all duration-300" onClick={() => openBasicEditor(rcpt)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-primary hover:text-white transition-all duration-300" onClick={() => openLineEditor(rcpt.id)}>
                      <ListChecks className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-full hover:bg-destructive hover:text-white transition-all duration-300" onClick={async () => {
                      if (confirm('Voulez-vous supprimer ce reçu ?')) await deleteReceipt(rcpt.id);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-2">
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex gap-2">
                      <div className="px-3 py-1 rounded-xl bg-primary/10 text-primary text-[10px] font-black tracking-widest uppercase">{rcpt.lines?.length || 0} ARTICLES</div>
                      <div className="px-3 py-1 rounded-xl bg-accent/10 text-accent text-[10px] font-black tracking-widest uppercase">AUTO-OK</div>
                    </div>
                    <div className="relative">
                      <span className="text-2xl font-black tracking-tighter text-foreground pr-1">
                        {rcpt.total != null ? `${rcpt.total.toFixed(3)}` : '0.000'}
                      </span>
                      <span className="text-[10px] font-black text-muted-foreground/60 align-top mt-1 inline-block">TND</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* BASIC EDITOR DIALOG */}
      <Dialog open={basicEditorOpen} onOpenChange={setBasicEditorOpen}>
        <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden glassmorphism">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-accent to-primary animate-gradient-x" />
          <DialogHeader className="pt-6">
            <DialogTitle className="text-2xl font-black tracking-tight text-center">Détails du Reçu</DialogTitle>
            <DialogDescription className="text-center font-medium">Ajustez les métadonnées de votre dépense.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-6 px-2">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">Enseigne du magasin</label>
              <input
                className="h-14 w-full rounded-2xl border-2 border-border/50 bg-background/50 px-5 text-lg font-bold shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none placeholder:text-muted-foreground/40"
                value={editingStoreName}
                onChange={e => setEditingStoreName(e.target.value)}
                placeholder="Ex: Carrefour Market..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 ml-1">Date de la transaction</label>
              <input
                type="datetime-local"
                className="h-14 w-full rounded-2xl border-2 border-border/50 bg-background/50 px-5 text-lg font-bold shadow-sm focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={editingDateValue}
                onChange={e => setEditingDateValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-2 sm:gap-2 pb-6">
            <Button variant="ghost" className="rounded-2xl flex-1 h-12 font-bold hover:bg-muted/80 transition-colors" onClick={() => setBasicEditorOpen(false)}>Annuler</Button>
            <Button className="rounded-2xl flex-1 h-12 font-black shadow-xl shadow-primary/20 transition-all active:scale-95" onClick={async () => {
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

      {/* LINE EDITOR DIALOG - MOBILE OPTIMIZED */}
      <Dialog open={lineEditorOpen} onOpenChange={setLineEditorOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-3xl rounded-[2.5rem] border-none shadow-2xl overflow-hidden flex flex-col p-1 sm:p-6 bg-background/95 backdrop-blur-xl">
          <DialogHeader className="px-4 pt-6 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">Articles du Reçu</DialogTitle>
                <DialogDescription className="font-medium mt-0.5">Vérification et correction des lignes extraites.</DialogDescription>
              </div>
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                <ListChecks className="h-6 w-6 text-primary" />
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto mt-6 px-3 sm:px-1 space-y-3 custom-scrollbar min-h-[40vh] max-h-[65vh]">
            {/* Desktop Table Header (Shown only on Desktop) */}
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2 font-black text-[10px] text-muted-foreground uppercase tracking-widest border-b sticky top-0 bg-background/80 backdrop-blur-md z-10">
              <div className="col-span-5">Libellé</div>
              <div className="col-span-2 text-center">Quantité</div>
              <div className="col-span-2 text-right">Prix Unitaire</div>
              <div className="col-span-2 text-right">Total HT</div>
              <div className="col-span-1"></div>
            </div>

            {lineDrafts.map((ln, i) => (
              <div key={ln.id || i} className="relative group">
                {/* Mobile Variant (Card-like) */}
                <div className="md:hidden flex flex-col rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-4 hover:border-primary/30 transition-all">
                  <div className="flex justify-between items-start gap-4">
                    <span className="text-sm font-bold leading-tight flex-1">{ln.normalizedLabel || ln.rawLabel}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/50 hover:bg-destructive/10 hover:text-destructive rounded-full shrink-0" onClick={() => deleteDraftLine(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-muted-foreground/70 uppercase tracking-tighter ml-1">Qté</label>
                      <input
                        type="number"
                        className="h-10 w-full rounded-xl border border-border/60 bg-background px-1 text-center font-black text-sm"
                        value={ln.quantity ?? ''}
                        onChange={e => setField(i, 'quantity', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-muted-foreground/70 uppercase tracking-tighter ml-1">P.U.</label>
                      <input
                        type="number"
                        className="h-10 w-full rounded-xl border border-border/60 bg-background px-1 text-right font-bold text-sm"
                        step="0.001"
                        value={ln.unitPrice ?? ''}
                        onChange={e => setField(i, 'unitPrice', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] font-black text-muted-foreground/70 uppercase tracking-tighter ml-1">Total</label>
                      <input
                        type="number"
                        className="h-10 w-full rounded-xl border-2 border-primary/20 bg-primary/5 px-1 text-right font-black text-primary text-sm shadow-sm"
                        step="0.001"
                        value={ln.lineTotal ?? ''}
                        onChange={e => setField(i, 'lineTotal', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </div>
                  </div>
                </div>

                {/* Desktop Variant (Table Row) */}
                <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 items-center border-b border-border/30 hover:bg-primary/5 transition-colors rounded-xl">
                  <div className="col-span-5 font-bold text-sm truncate pr-4" title={ln.rawLabel}>{ln.normalizedLabel || ln.rawLabel}</div>
                  <div className="col-span-2">
                    <input type="number" className="h-9 w-full rounded-xl border border-border/60 bg-background px-2 text-center font-black text-sm" value={ln.quantity ?? ''} onChange={e => setField(i, 'quantity', e.target.value)} onBlur={() => autoRecalc(i)} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" className="h-9 w-full rounded-xl border border-border/60 bg-background px-2 text-right font-bold text-sm" step="0.001" value={ln.unitPrice ?? ''} onChange={e => setField(i, 'unitPrice', e.target.value)} onBlur={() => autoRecalc(i)} />
                  </div>
                  <div className="col-span-2">
                    <input type="number" className="h-9 w-full rounded-xl border-2 border-primary/20 bg-primary/5 px-2 text-right font-black text-primary text-sm" step="0.001" value={ln.lineTotal ?? ''} onChange={e => setField(i, 'lineTotal', e.target.value)} onBlur={() => autoRecalc(i)} />
                  </div>
                  <div className="col-span-1 text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/20 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all" onClick={() => deleteDraftLine(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-row gap-3 pt-6 px-4 pb-4 bg-background mt-auto shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)] flex-shrink-0">
            <Button variant="ghost" className="rounded-2xl flex-1 h-12 font-bold transition-all" onClick={() => setLineEditorOpen(false)}>Annuler</Button>
            <Button className="rounded-2xl flex-1 h-12 font-black shadow-xl shadow-primary/20 transition-all active:scale-95" onClick={async () => {
              if (lineEditorReceiptId) {
                await updateReceipt(lineEditorReceiptId, { lines: lineDrafts });
              }
              setLineEditorOpen(false);
              toast({ title: 'Succès', description: 'Les articles ont été mis à jour.' });
            }}>Enregistrer {lineDrafts.length} articles</Button>
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
