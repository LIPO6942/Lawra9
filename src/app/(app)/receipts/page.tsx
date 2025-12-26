'use client';

import Link from 'next/link';
import { UploadReceiptDialog } from '@/components/upload-receipt-dialog';
import { useReceipts } from '@/contexts/receipt-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Pencil, Save, X, Receipt, Trash2, ListChecks } from 'lucide-react';
import { useState } from 'react';
import { inferQuantityFromLabel, learnPackQty, normalizeProductKey } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type ProposedChange = { receiptId: string; storeName?: string; linesUpdated: number; newLines: any[]; indicesToDelete: number[]; details: { index: number; label: string; beforeQty?: number; afterQty?: number; }[] };

export default function ReceiptsPage() {
  const { receipts, updateReceipt, deleteReceipt } = useReceipts();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [proposed, setProposed] = useState<ProposedChange[]>([]);
  const { toast } = useToast();

  // Per-receipt line editor state
  const [lineEditorOpen, setLineEditorOpen] = useState(false);
  const [lineEditorReceiptId, setLineEditorReceiptId] = useState<string | null>(null);
  const [lineEditorStoreName, setLineEditorStoreName] = useState<string | undefined>(undefined);
  const [lineDrafts, setLineDrafts] = useState<any[]>([]);

  function openLineEditor(rcptId: string) {
    const rcpt = receipts.find(r => r.id === rcptId);
    if (!rcpt) return;
    setLineEditorReceiptId(rcpt.id);
    setLineEditorStoreName(rcpt.storeName);
    setLineDrafts((rcpt.lines || []).map(l => ({ ...l })));
    setLineEditorOpen(true);
  }

  function deleteDraftLine(i: number) {
    const ok = typeof window !== 'undefined' ? window.confirm('Supprimer cette ligne ?') : true;
    if (!ok) return;
    setLineDrafts(prev => prev.filter((_, idx) => idx !== i));
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
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Receipt className="h-6 w-6 text-primary" />
          Reçus
        </h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Button asChild variant="outline">
            <Link href="/stats/receipts">Voir stats reçus</Link>
          </Button>
          <Button variant="secondary" onClick={async () => {
            // Build preview of changes first
            const changes: ProposedChange[] = [];
            for (const rcpt of receipts) {
              let linesUpdated = 0;
              const details: { index: number; label: string; beforeQty?: number; afterQty?: number }[] = [];
              const newLines = (rcpt.lines || []).map((ln, idx) => {
                const before = { quantity: ln.quantity, unit: ln.unit, unitPrice: ln.unitPrice, lineTotal: ln.lineTotal };
                const inferred = inferQuantityFromLabel(ln.normalizedLabel || ln.rawLabel, before);
                const changed = (
                  inferred.quantity !== before.quantity ||
                  inferred.unit !== before.unit ||
                  inferred.unitPrice !== before.unitPrice ||
                  inferred.lineTotal !== before.lineTotal
                );
                if (changed) {
                  linesUpdated += (inferred.quantity !== before.quantity) ? 1 : 0;
                  details.push({ index: idx, label: ln.normalizedLabel || ln.rawLabel || '', beforeQty: before.quantity, afterQty: inferred.quantity });
                  return { ...ln, ...inferred } as typeof ln;
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
            Recalculer quantités
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
                      <Button size="sm" variant="ghost" onClick={() => openLineEditor(rcpt.id)} title="Modifier les lignes">
                        <ListChecks className="h-4 w-4" />
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

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-full sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Aperçu des changements</DialogTitle>
            <DialogDescription>
              {proposed.length === 0 ? 'Aucun changement proposé.' : `Des corrections de quantités sont proposées pour ${proposed.length} reçu(x).`}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-64 overflow-auto space-y-3">
            {proposed.map(p => (
              <Card key={p.receiptId} className="border-dashed">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Reçu {p.storeName || 'Magasin'} – {p.linesUpdated} ligne(s) impactée(s)</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  {p.details.slice(0, 8).map((d, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={p.indicesToDelete.includes(d.index)}
                          onChange={(e) => {
                            setProposed(prev => prev.map(pp => {
                              if (pp.receiptId !== p.receiptId) return pp;
                              const set = new Set(pp.indicesToDelete);
                              if (e.target.checked) set.add(d.index); else set.delete(d.index);
                              return { ...pp, indicesToDelete: Array.from(set).sort((a, b) => a - b) };
                            }));
                          }}
                          className="h-4 w-4"
                        />
                        <span className="truncate" title={d.label}>{d.label}</span>
                      </label>
                      <span className="shrink-0">{d.beforeQty ?? '-'} → <span className="text-foreground font-medium">{d.afterQty ?? '-'}</span></span>
                      <button
                        className="text-destructive text-xs underline shrink-0"
                        onClick={() => {
                          setProposed(prev => prev.map(pp => {
                            if (pp.receiptId !== p.receiptId) return pp;
                            const set = new Set(pp.indicesToDelete);
                            set.add(d.index);
                            return { ...pp, indicesToDelete: Array.from(set).sort((a, b) => a - b) };
                          }));
                        }}
                        title="Marquer pour suppression"
                      >Supprimer</button>
                    </div>
                  ))}
                  {p.details.length > 5 && <div className="text-right">… et {p.details.length - 5} de plus</div>}
                </CardContent>
              </Card>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>Annuler</Button>
            <Button onClick={async () => {
              let total = 0;
              for (const change of proposed) {
                // learn per store while applying
                const rcpt = receipts.find(r => r.id === change.receiptId);
                const toDelete = new Set(change.indicesToDelete);
                const filtered = change.newLines.filter((_, idx) => !toDelete.has(idx));
                if (rcpt) {
                  filtered.forEach((newL, idx) => {
                    const pk = normalizeProductKey(newL.normalizedLabel || newL.rawLabel || '');
                    if (pk && newL.quantity && newL.quantity > 1) {
                      learnPackQty(pk, newL.quantity, rcpt.storeName);
                    }
                  });
                }
                await updateReceipt(change.receiptId, { lines: filtered });
                total += change.linesUpdated + change.indicesToDelete.length;
              }
              setPreviewOpen(false);
              setProposed([]);
              toast({ title: 'Recalcul terminé', description: `${total} ligne(s) mise(s) à jour (y compris suppressions).` });
            }}
              disabled={proposed.length === 0}
            >
              Appliquer les changements
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Line Editor Dialog */}
      <Dialog open={lineEditorOpen} onOpenChange={setLineEditorOpen}>
        <DialogContent className="max-w-full sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Modifier les lignes</DialogTitle>
            <DialogDescription>Quantité, Prix unitaire, Total ligne. Deux champs remplis recalculent le troisième.</DialogDescription>
          </DialogHeader>
          {(() => {
            const rcpt = receipts.find(r => r.id === lineEditorReceiptId);
            const curr = (lineDrafts || []).reduce((sum, ln) => {
              const lt = typeof ln.lineTotal === 'number' ? ln.lineTotal : (Number(ln.quantity) && Number(ln.unitPrice) ? Number(ln.quantity) * Number(ln.unitPrice) : 0);
              return sum + (Number.isFinite(lt) ? lt : 0);
            }, 0);
            const orig = rcpt ? (typeof rcpt.total === 'number' ? rcpt.total : (rcpt.lines || []).reduce((s, ln) => s + (ln.lineTotal || 0), 0)) : 0;
            const currency = rcpt?.currency || 'TND';
            return (
              <div className="mb-2 text-sm flex items-center justify-between">
                <div className="text-muted-foreground">Total original: <span className="text-foreground font-medium">{orig.toFixed(3)} {currency}</span></div>
                <div className="text-muted-foreground">Total actuel: <span className="text-foreground font-medium">{curr.toFixed(3)} {currency}</span></div>
              </div>
            );
          })()}
          <div className="max-h-[60vh] overflow-auto">
            {/* Desktop Table View */}
            <table className="w-full hidden sm:table text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-3 pr-2 font-semibold">Libellé</th>
                  <th className="py-3 pr-2 w-20 font-semibold">Qté</th>
                  <th className="py-3 pr-2 w-24 font-semibold">PU</th>
                  <th className="py-3 pr-2 w-24 font-semibold">Total</th>
                  <th className="py-3 pr-2 w-16 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {lineDrafts.map((ln, i) => (
                  <tr key={ln.id || i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-2 truncate max-w-[200px]" title={ln.normalizedLabel || ln.rawLabel}>
                      <div className="font-medium">{ln.normalizedLabel || ln.rawLabel}</div>
                    </td>
                    <td className="py-3 pr-2">
                      <input className="h-9 w-16 rounded-lg border bg-background px-2 focus:ring-2 focus:ring-primary/20 transition-all"
                        type="number" step="1" min="0" value={ln.quantity ?? ''}
                        onChange={(e) => setField(i, 'quantity', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </td>
                    <td className="py-3 pr-2">
                      <input className="h-9 w-24 rounded-lg border bg-background px-2 focus:ring-2 focus:ring-primary/20 transition-all text-right"
                        type="number" step="0.001" min="0" value={ln.unitPrice ?? ''}
                        onChange={(e) => setField(i, 'unitPrice', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </td>
                    <td className="py-3 pr-2">
                      <input className="h-9 w-24 rounded-lg border bg-background px-2 focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-right"
                        type="number" step="0.001" min="0" value={ln.lineTotal ?? ''}
                        onChange={(e) => setField(i, 'lineTotal', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteDraftLine(i)} className="hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-4">
              {lineDrafts.map((ln, i) => (
                <Card key={ln.id || i} className="p-3 border shadow-none bg-muted/20">
                  <div className="flex justify-between items-start mb-3">
                    <div className="font-semibold text-sm line-clamp-2 pr-6">{ln.normalizedLabel || ln.rawLabel}</div>
                    <Button variant="ghost" size="icon" onClick={() => deleteDraftLine(i)} className="h-8 w-8 text-destructive shrink-0">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Qté</label>
                      <input className="h-9 w-full rounded-lg border bg-background px-2 text-sm"
                        type="number" step="1" min="0" value={ln.quantity ?? ''}
                        onChange={(e) => setField(i, 'quantity', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">P.U</label>
                      <input className="h-9 w-full rounded-lg border bg-background px-2 text-sm text-right"
                        type="number" step="0.001" min="0" value={ln.unitPrice ?? ''}
                        onChange={(e) => setField(i, 'unitPrice', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-muted-foreground">Total</label>
                      <input className="h-9 w-full rounded-lg border bg-background px-2 text-sm font-bold text-right"
                        type="number" step="0.001" min="0" value={ln.lineTotal ?? ''}
                        onChange={(e) => setField(i, 'lineTotal', e.target.value)}
                        onBlur={() => autoRecalc(i)}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLineEditorOpen(false)}>Annuler</Button>
            <Button onClick={async () => {
              if (!lineEditorReceiptId) return;
              // Apply learning per line where quantity > 1
              let changed = 0;
              const rcpt = receipts.find(r => r.id === lineEditorReceiptId);
              const originalLines = rcpt?.lines || [];
              const newLines = lineDrafts.map((ln, idx) => {
                const before = originalLines[idx];
                if (!before) return ln;
                if (
                  ln.quantity !== before.quantity ||
                  ln.unitPrice !== before.unitPrice ||
                  ln.lineTotal !== before.lineTotal
                ) {
                  changed += 1;
                }
                const pk = normalizeProductKey(ln.normalizedLabel || ln.rawLabel || '');
                if (pk && ln.quantity && ln.quantity > 1) {
                  learnPackQty(pk, ln.quantity, lineEditorStoreName);
                }
                return ln;
              });
              await updateReceipt(lineEditorReceiptId, { lines: newLines });
              setLineEditorOpen(false);
              toast({ title: 'Modifications enregistrées', description: `${changed} ligne(s) mise(s) à jour.` });
            }}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
