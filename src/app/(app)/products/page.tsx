'use client';

import { useMemo, useState } from 'react';
import { useReceipts } from '@/contexts/receipt-context';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { flattenPurchasesFromReceipts, computeLastPurchaseByProduct, groupHistoryByProduct, normalizeProductKey } from '@/lib/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

function useProductAggregates() {
  const { receipts } = useReceipts();
  const purchases = useMemo(() => flattenPurchasesFromReceipts(receipts), [receipts]);
  const lastByProduct = useMemo(() => computeLastPurchaseByProduct(purchases), [purchases]);
  const historyByProduct = useMemo(() => groupHistoryByProduct(purchases), [purchases]);
  return { purchases, lastByProduct, historyByProduct };
}

function displayNameForProduct(history: ReturnType<typeof groupHistoryByProduct>[string]): string {
  // Pick most common normalizedLabel or fallback to most recent raw label
  if (!history || history.length === 0) return 'Produit';
  const freq: Record<string, number> = {};
  for (const h of history) {
    const key = (h.normalizedLabel || h.rawLabel || '').trim();
    if (!key) continue;
    freq[key] = (freq[key] || 0) + 1;
  }
  const best = Object.entries(freq).sort((a,b) => b[1]-a[1])[0]?.[0];
  return best || (history[0].normalizedLabel || history[0].rawLabel || 'Produit');
}

export default function ProductsPage() {
  const { receipts } = useReceipts();
  const { lastByProduct, historyByProduct } = useProductAggregates();
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>('ALL');

  const stores = useMemo(() => {
    const s = new Set<string>();
    receipts.forEach(r => { if (r.storeName) s.add(r.storeName); });
    return Array.from(s).sort();
  }, [receipts]);

  const productKeys = useMemo(() => {
    const keys = Object.keys(historyByProduct || {});
    const q = query.trim().toLowerCase();
    // Filter by store: keep keys that have at least one purchase in selected store
    const byStoreKeys = storeFilter === 'ALL' ? keys : keys.filter(k => (historyByProduct[k] || []).some(h => h.storeName === storeFilter));
    if (!q) return byStoreKeys;
    return byStoreKeys.filter(k => k.includes(q));
  }, [historyByProduct, query]);

  const selectedHistory = selectedKey ? (historyByProduct[selectedKey] || []).filter(h => storeFilter === 'ALL' || h.storeName === storeFilter) : [];
  const lastInfo = selectedKey ? lastByProduct[selectedKey] : undefined;
  const selectedDisplay = selectedKey ? displayNameForProduct(selectedHistory) : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Produits</h1>
      </div>
      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-4">
          <Input
            placeholder="Rechercher un produit..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrer par magasin" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tous les magasins</SelectItem>
              {stores.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
            {productKeys.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucun produit. Ajoutez des reçus.</p>
            )}
            {productKeys.map(key => {
              const hist = historyByProduct[key] || [];
              const disp = displayNameForProduct(storeFilter==='ALL' ? hist : hist.filter(h => h.storeName === storeFilter));
              const last = lastByProduct[key];
              return (
                <Card key={key} className={`cursor-pointer ${selectedKey===key ? 'border-accent' : ''}`} onClick={() => setSelectedKey(key)}>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm font-semibold">{disp}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground -mt-2 pb-3">
                    <div className="flex items-center justify-between">
                      <span>{(storeFilter==='ALL' ? hist : hist.filter(h => h.storeName === storeFilter)).length} achat(s)</span>
                      <span>
                        {last?.lastUnitPrice != null ? `${last.lastUnitPrice.toFixed(3)} ${(hist[0]?.currency)||'TND'}` : '—'}
                      </span>
                    </div>
                    <div>
                      {last?.lastPurchasedAt ? `Dernier: ${format(new Date(last.lastPurchasedAt), 'dd/MM/yyyy', { locale: fr })}` : ''}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <div className="md:col-span-2">
          {!selectedKey ? (
            <Card>
              <CardHeader>
                <CardTitle>Sélectionnez un produit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Recherchez dans la liste à gauche pour voir l'historique, le dernier prix, et les achats par magasin.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{selectedDisplay}</CardTitle>
                {lastInfo && (
                  <div className="text-sm text-muted-foreground">
                    Dernier prix: {lastInfo.lastUnitPrice != null ? `${lastInfo.lastUnitPrice.toFixed(3)} ${(selectedHistory[0]?.currency)||'TND'}` : '—'}
                    {lastInfo.lastPurchasedAt ? ` · ${format(new Date(lastInfo.lastPurchasedAt), 'dd/MM/yyyy', { locale: fr })}` : ''}
                    {lastInfo.lastStoreName ? ` · ${lastInfo.lastStoreName}` : ''}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="py-2">Date</th>
                        <th className="py-2">Magasin</th>
                        <th className="py-2">Qté</th>
                        <th className="py-2">PU</th>
                        <th className="py-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedHistory.map((h, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="py-2">{h.purchaseAt ? format(new Date(h.purchaseAt), 'dd/MM/yyyy', { locale: fr }) : '—'}</td>
                          <td className="py-2">{h.storeName || '—'}</td>
                          <td className="py-2">{h.quantity}</td>
                          <td className="py-2">{h.unitPrice != null ? h.unitPrice.toFixed(3) : (h.lineTotal != null && h.quantity ? (h.lineTotal/h.quantity).toFixed(3) : '—')}</td>
                          <td className="py-2">{h.lineTotal != null ? h.lineTotal.toFixed(3) : (h.unitPrice != null ? (h.unitPrice * h.quantity).toFixed(3) : '—')} {h.currency || 'TND'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
