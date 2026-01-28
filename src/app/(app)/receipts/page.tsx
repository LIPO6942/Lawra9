'use client';

import Link from 'next/link';
import { UploadReceiptDialog } from '@/components/upload-receipt-dialog';
import { useReceipts } from '@/contexts/receipt-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Pencil, Receipt, Trash2, ListChecks, ShoppingCart } from 'lucide-react';
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
    <div className="space-y-6 max-w-5xl mx-auto px-4 sm:px-0 pb-12">
      {/* Ultra-Premium Compact Header */}
      <div className="relative overflow-hidden rounded-[2.5rem] bg-slate-950 p-5 sm:p-7 border border-white/10 shadow-2xl shadow-primary/20">
        {/* Animated Mesh Gradient Background */}
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-[-20%] left-[-10%] h-[140%] w-[60%] rounded-full bg-primary/30 blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-20%] right-[-10%] h-[140%] w-[60%] rounded-full bg-accent/20 blur-[100px] animate-pulse delay-700" />
        </div>

        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-white/5 backdrop-blur-xl flex items-center justify-center ring-1 ring-white/20 shadow-inner">
              <Receipt className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Mes Reçus</h1>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Intelligence Artificielle</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Button asChild variant="ghost" className="h-9 px-4 rounded-full text-xs font-bold text-white/70 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10">
              <Link href="/stats/receipts">Stats</Link>
            </Button>
            <Button variant="outline" className="h-9 px-4 rounded-full text-xs font-bold text-white/90 border-white/20 bg-white/5 hover:bg-white/10" onClick={() => {
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
              <Button size="sm" className="h-10 px-6 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/40 font-black text-xs transition-transform active:scale-95">
                + Nouveau Reçu
              </Button>
            </UploadReceiptDialog>
          </div>
        </div>
      </div>

      {/* Grid of Receipts - Premium Cards */}
      {receipts.length === 0 ? (
        <Card className="border-dashed py-16 rounded-[3rem] bg-gradient-to-b from-muted/50 to-background border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-3xl bg-background/80 flex items-center justify-center mb-6 shadow-xl border border-border/50 rotate-3">
              <Receipt className="h-8 w-8 text-primary/40" />
            </div>
            <CardTitle className="text-xl font-black tracking-tight mb-2">Prêt à numériser ?</CardTitle>
            <p className="text-sm text-muted-foreground max-w-[240px] mx-auto mb-8 font-medium">Scannez vos tickets pour obtenir une analyse instantanée de vos dépenses.</p>
            <UploadReceiptDialog><Button size="lg" className="rounded-full px-8 shadow-xl hover:shadow-primary/20 transition-all duration-500 font-black">Commencer</Button></UploadReceiptDialog>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
          {receipts.map(rcpt => {
            const displayDate = rcpt.purchaseAt ? new Date(rcpt.purchaseAt) : today;
            return (
              <Card key={rcpt.id} className="group relative overflow-hidden border border-border/40 rounded-[2.2rem] bg-white dark:bg-slate-900/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_50px_rgba(30,30,30,0.1)] transition-all duration-700 hover:-translate-y-1 hover:border-primary/20 backdrop-blur-sm">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 pt-6 px-7">
                  <div className="flex flex-col gap-1 flex-1 mr-4 overflow-hidden z-10">
                    <CardTitle className="text-base sm:text-xl font-black text-slate-800 dark:text-slate-100 whitespace-nowrap overflow-hidden tracking-tight group-hover:text-primary transition-colors">
                      {rcpt.storeName || 'Magasin'}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-500/80 tracking-tight flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse" />
                        {format(displayDate, 'dd MMMM yyyy • HH:mm', { locale: fr })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl p-1.5 border border-white/10 shadow-sm z-10">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 rounded-xl hover:bg-accent hover:text-white shadow-none transition-all duration-300"
                      title="Exporter pour Mon Assistant Courses"
                      onClick={() => {
                        const exportData = {
                          source: "Lawra9",
                          date: rcpt.purchaseAt ? format(new Date(rcpt.purchaseAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
                          products: (rcpt.lines || []).map(ln => ({
                            name: ln.normalizedLabel || ln.rawLabel,
                            price: ln.unitPrice ?? (ln.lineTotal && ln.quantity ? ln.lineTotal / ln.quantity : 0),
                            unit: ln.unit || 'pcs',
                            category: ln.category || 'Alimentation / Divers'
                          }))
                        };
                        navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
                        toast({ title: 'Copié !', description: 'Données prêtes à être collées dans Mon Assistant Courses.' });
                      }}
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-primary hover:text-white shadow-none transition-all duration-300" onClick={() => openBasicEditor(rcpt)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-primary hover:text-white shadow-none transition-all duration-300" onClick={() => openLineEditor(rcpt.id)}>
                      <ListChecks className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-destructive hover:text-white shadow-none transition-all duration-300" onClick={async () => {
                      if (confirm('Voulez-vous supprimer ce reçu ?')) await deleteReceipt(rcpt.id);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="pt-2 pb-7 px-7 z-10">
                  <div className="flex items-end justify-between mt-1">
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-1.5 items-center">
                        <div className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-white/5 border border-border/40 text-slate-500 dark:text-slate-400 text-[9px] font-black tracking-widest uppercase">{rcpt.lines?.length || 0} ARTICLES</div>
                        {rcpt.status === 'parsed' && <div className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 text-[9px] font-black tracking-widest uppercase">SYSTÈME OK</div>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-[-2px]">Total TTC</div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black tracking-tighter text-slate-900 dark:text-white">
                          {rcpt.total != null ? `${rcpt.total.toFixed(3)}` : '0.000'}
                        </span>
                        <span className="text-xs font-black text-primary/60">TND</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* BASIC EDITOR DIALOG - Glassmorphism */}
      <Dialog open={basicEditorOpen} onOpenChange={setBasicEditorOpen}>
        <DialogContent className="sm:max-w-md rounded-[3rem] border-white/20 shadow-[0_32px_120px_rgba(0,0,0,0.3)] overflow-hidden bg-white/70 dark:bg-slate-950/70 backdrop-blur-3xl p-8">
          <div className="absolute top-0 left-1/4 w-1/2 h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent shadow-[0_0_20px_rgba(var(--primary),0.5)]" />
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-black tracking-tighter text-center">Édition Rapide</DialogTitle>
            <DialogDescription className="text-center font-medium opacity-60">Mise à jour des informations de base du ticket.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 ml-2">Enseigne commerciale</label>
              <input
                className="h-14 w-full rounded-[1.5rem] border-none bg-slate-100 dark:bg-white/5 px-6 text-lg font-bold shadow-inner focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={editingStoreName}
                onChange={e => setEditingStoreName(e.target.value)}
                placeholder="Ex : Carrefour Market"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 ml-2">Date d'émission</label>
              <input
                type="datetime-local"
                className="h-14 w-full rounded-[1.5rem] border-none bg-slate-100 dark:bg-white/5 px-6 text-lg font-bold shadow-inner focus:ring-4 focus:ring-primary/10 transition-all outline-none"
                value={editingDateValue}
                onChange={e => setEditingDateValue(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex-row gap-3 mt-10">
            <Button variant="ghost" className="rounded-2xl flex-1 h-14 font-bold hover:bg-slate-200 dark:hover:bg-white/5 transition-colors" onClick={() => setBasicEditorOpen(false)}>Quitter</Button>
            <Button className="rounded-2xl flex-1 h-14 font-black shadow-2xl shadow-primary/30 transition-all active:scale-95 px-0" onClick={async () => {
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

      {/* LINE EDITOR - Ultra Responive / Zero Scroll */}
      <Dialog open={lineEditorOpen} onOpenChange={setLineEditorOpen}>
        <DialogContent className="max-w-[98vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl rounded-[3rem] border-white/20 shadow-2xl overflow-hidden flex flex-col p-0 bg-white/90 dark:bg-slate-950/90 backdrop-blur-3xl border-none">
          <DialogHeader className="p-8 pt-9 pb-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-3xl font-black tracking-tightest">Articles Détectés</DialogTitle>
                <DialogDescription className="font-bold text-slate-500">Optimisez les détails de votre panier ({lineDrafts.length})</DialogDescription>
              </div>
              <div className="hidden sm:flex h-14 w-14 rounded-3xl bg-primary/10 items-center justify-center ring-1 ring-primary/20 shadow-xl shadow-primary/5">
                <ListChecks className="h-7 w-7 text-primary" />
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 sm:px-8 pb-32 pt-2 custom-scrollbar max-h-[70vh]">
            <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
              {/* Table Header for Desktop */}
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 font-black text-[9px] text-slate-400 uppercase tracking-[0.2em] border-b border-border/30 sticky top-0 bg-transparent backdrop-blur-md z-20">
                <div className="col-span-5">Libellé Produit</div>
                <div className="col-span-2 text-center">Unités</div>
                <div className="col-span-2 text-right">P.U. (TND)</div>
                <div className="col-span-2 text-right">Montant</div>
                <div className="col-span-1"></div>
              </div>

              {lineDrafts.map((ln, i) => (
                <div key={ln.id || i}>
                  {/* Mobile Layout Card - No Scroll */}
                  <div className="md:hidden flex flex-col rounded-[1.8rem] bg-slate-100/50 dark:bg-white/5 p-5 space-y-4 border border-border/30 hover:border-primary/20 transition-all duration-300">
                    <div className="flex justify-between items-start">
                      <div className="text-sm font-black text-slate-800 dark:text-slate-100 max-w-[80%] leading-tight truncate-multiline mb-1">{ln.normalizedLabel || ln.rawLabel}</div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/40 hover:bg-destructive/10 hover:text-destructive rounded-full" onClick={() => deleteDraftLine(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Qté</span>
                        <input type="number" className="h-10 w-full rounded-2xl bg-white dark:bg-slate-800 border-none px-3 font-black text-xs shadow-inner" value={ln.quantity ?? ''} onChange={e => setField(i, 'quantity', e.target.value)} onBlur={() => autoRecalc(i)} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit</span>
                        <input type="number" className="h-10 w-full rounded-2xl bg-white dark:bg-slate-800 border-none px-3 font-black text-right text-xs shadow-inner" step="0.001" value={ln.unitPrice ?? ''} onChange={e => setField(i, 'unitPrice', e.target.value)} onBlur={() => autoRecalc(i)} />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-primary/70 uppercase tracking-widest ml-1">Total</span>
                        <input type="number" className="h-10 w-full rounded-2xl bg-primary/10 border-none px-3 font-black text-right text-xs text-primary shadow-sm" step="0.001" value={ln.lineTotal ?? ''} onChange={e => setField(i, 'lineTotal', e.target.value)} onBlur={() => autoRecalc(i)} />
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout Row */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 items-center hover:bg-slate-100/30 dark:hover:bg-white/5 transition-all rounded-[1.2rem] group border-b border-border/10">
                    <div className="col-span-5 font-bold text-sm tracking-tight truncate pr-4" title={ln.rawLabel}>{ln.normalizedLabel || ln.rawLabel}</div>
                    <div className="col-span-2">
                      <input type="number" className="h-10 w-full rounded-2xl bg-slate-100/50 dark:bg-white/5 border-none px-3 text-center font-black text-xs hover:bg-white dark:hover:bg-slate-800 transition-colors focus:ring-4 focus:ring-primary/10" value={ln.quantity ?? ''} onChange={e => setField(i, 'quantity', e.target.value)} onBlur={() => autoRecalc(i)} />
                    </div>
                    <div className="col-span-2">
                      <input type="number" className="h-10 w-full rounded-2xl bg-slate-100/50 dark:bg-white/5 border-none px-3 text-right font-black text-xs hover:bg-white dark:hover:bg-slate-800 transition-colors focus:ring-4 focus:ring-primary/10" step="0.001" value={ln.unitPrice ?? ''} onChange={e => setField(i, 'unitPrice', e.target.value)} onBlur={() => autoRecalc(i)} />
                    </div>
                    <div className="col-span-2">
                      <input type="number" className="h-10 w-full rounded-2xl bg-primary/5 border-2 border-primary/20 px-3 text-right font-black text-xs text-primary focus:ring-4 focus:ring-primary/10 outline-none" step="0.001" value={ln.lineTotal ?? ''} onChange={e => setField(i, 'lineTotal', e.target.value)} onBlur={() => autoRecalc(i)} />
                    </div>
                    <div className="col-span-1 text-right">
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/20 hover:text-destructive hover:bg-destructive/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-all duration-300" onClick={() => deleteDraftLine(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="absolute bottom-0 left-0 w-full p-6 sm:p-8 bg-white/70 dark:bg-slate-950/70 backdrop-blur-2xl border-t border-white/10 z-30 flex-row gap-4">
            <Button variant="ghost" className="rounded-2xl h-14 flex-1 font-bold text-slate-500 hover:text-slate-800 transition-all" onClick={() => setLineEditorOpen(false)}>Quitter</Button>
            <Button className="rounded-[1.4rem] h-14 flex-[2] font-black text-base shadow-2xl shadow-primary/30 group transition-all active:scale-95" onClick={async () => {
              if (lineEditorReceiptId) {
                await updateReceipt(lineEditorReceiptId, { lines: lineDrafts });
              }
              setLineEditorOpen(false);
              toast({ title: 'Analyse Finalisée', description: `${lineDrafts.length} produits enregistrés avec succès.` });
            }}>
              Valider les Modifications
            </Button>
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
