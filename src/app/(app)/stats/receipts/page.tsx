'use client';

import { useMemo, useState, useEffect } from 'react';
import { useReceipts } from '@/contexts/receipt-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts';
import { computeKpis, monthlyTrend, spendByCategory, spendByStore, aggregateCategoryStats, computeProductInsights, computeTopProducts } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format as formatDate, parseISO, isValid as isValidDate } from 'date-fns';

function useFilteredReceipts(store: string, months: number) {
  const { receipts } = useReceipts();
  const filtered = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setMonth(start.getMonth() - months);
    return receipts.filter(r => {
      const okStore = store === 'ALL' || (r.storeName === store);
      const d = r.purchaseAt ? new Date(r.purchaseAt) : null;
      const okDate = d ? d >= start && d <= now : true;
      return okStore && okDate;
    });
  }, [receipts, store, months]);
  return filtered;
}

export default function ReceiptStatsPage() {
  const { receipts } = useReceipts();
  const [store, setStore] = useState('ALL');
  const [months, setMonths] = useState(6);

  const stores = useMemo(() => {
    const s = new Set<string>();
    receipts.forEach(r => { if (r.storeName) s.add(r.storeName); });
    return Array.from(s).sort();
  }, [receipts]);

  const data = useFilteredReceipts(store, months);
  const kpi = useMemo(() => computeKpis(data), [data]);
  const byCat = useMemo(() => Object.entries(spendByCategory(data)).map(([name, total]) => ({ name, total })), [data]);
  const byStore = useMemo(() => Object.entries(spendByStore(data)).map(([name, total]) => ({ name, total })), [data]);
  const trend = useMemo(() => monthlyTrend(data), [data]);
  const catStats = useMemo(() => aggregateCategoryStats(data), [data]);

  // Product insights over the last 3 months, but respect selected store filter
  const storeFilteredReceipts = useMemo(() => {
    if (store === 'ALL') return data; // already time-filtered for the selected months
    return data.filter(r => r.storeName === store);
  }, [data, store]);
  const productInsights = useMemo(() => computeProductInsights(storeFilteredReceipts, 3), [storeFilteredReceipts]);

  // Top Products Stats
  const topProducts = useMemo(() => computeTopProducts(storeFilteredReceipts), [storeFilteredReceipts]);
  const topProductsBySpend = useMemo(() => topProducts.sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 10), [topProducts]);
  const topProductsByQty = useMemo(() => topProducts.sort((a, b) => b.totalQty - a.totalQty).slice(0, 10), [topProducts]);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)') : null;
    const update = () => setIsMobile(!!mq && mq.matches);
    update();
    mq?.addEventListener('change', update);
    return () => mq?.removeEventListener('change', update);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Stats Reçus (V1)</h1>
      </div>
      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Période</CardTitle></CardHeader>
          <CardContent>
            <Select value={String(months)} onValueChange={(v) => setMonths(parseInt(v))}>
              <SelectTrigger><SelectValue placeholder="Période" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 mois</SelectItem>
                <SelectItem value="6">6 mois</SelectItem>
                <SelectItem value="12">12 mois</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Magasin</CardTitle></CardHeader>
          <CardContent>
            <Select value={store} onValueChange={setStore}>
              <SelectTrigger><SelectValue placeholder="Magasin" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous</SelectItem>
                {stores.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Dépense totale</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{kpi.totalSpend.toFixed(3)} TND</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Panier moyen</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{kpi.avgBasket.toFixed(3)} TND</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nb reçus</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{kpi.countReceipts}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Nb articles</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{kpi.countItems}</CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Dépense par catégorie</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ total: { label: 'Total' } }} className="h-60 sm:h-72 md:h-80">
              <BarChart data={byCat}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={isMobile ? 1 : 0} angle={isMobile ? -45 : -15} textAnchor="end" height={isMobile ? 70 : 60} tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total, hsl(var(--primary)))" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Dépense par magasin</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ total: { label: 'Total' } }} className="h-60 sm:h-72 md:h-80">
              <BarChart data={byStore}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} interval={isMobile ? 1 : 0} angle={isMobile ? -45 : -15} textAnchor="end" height={isMobile ? 70 : 60} tick={{ fontSize: isMobile ? 10 : 12 }} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="total" fill="var(--color-total, hsl(var(--primary)))" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Top 10 Produits (Coût)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ totalSpend: { label: 'Dépense' } }} className="h-60 sm:h-72 md:h-80">
              <BarChart data={topProductsBySpend} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9 }} interval={0} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="totalSpend" fill="hsl(var(--chart-1))" radius={4} barSize={20} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top 10 Produits (Quantité)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={{ totalQty: { label: 'Qté' } }} className="h-60 sm:h-72 md:h-80">
              <BarChart data={topProductsByQty} layout="vertical" margin={{ left: 0, right: 20 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9 }} interval={0} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="totalQty" fill="hsl(var(--chart-2))" radius={4} barSize={20} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Tendance mensuelle</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={{ total: { label: 'Total' } }} className="h-56 sm:h-72 md:h-80">
            <LineChart data={trend}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="total" type="monotone" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Détails par catégorie</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Catégorie</TableHead>
                    <TableHead className="text-right">Dépense</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Quantité</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Articles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {catStats.map((c) => (
                    <TableRow key={c.category}>
                      <TableCell className="font-medium text-xs sm:text-sm">{c.category}</TableCell>
                      <TableCell className="text-right text-xs sm:text-sm">{(c.totalSpend || 0).toFixed(3)} TND</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{c.totalQty}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{c.itemsCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Produits (3 derniers mois)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead className="text-right">Dernier prix</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Dernier achat</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Fréquence (3m)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productInsights.map((p) => {
                    const dateStr = p.lastPurchasedAt;
                    let dateDisp = '-';
                    if (dateStr) {
                      const d = parseISO(dateStr);
                      dateDisp = isValidDate(d) ? formatDate(d, 'dd/MM/yyyy') : dateStr;
                    }
                    return (
                      <TableRow key={p.productKey}>
                        <TableCell className="font-medium text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none" title={p.normalizedLabel || p.rawLabel || p.productKey}>{p.normalizedLabel || p.rawLabel || p.productKey}</TableCell>
                        <TableCell className="text-right text-xs sm:text-sm">{p.lastUnitPrice != null ? `${p.lastUnitPrice.toFixed(3)}` : '-'}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">{dateDisp}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">{p.frequencyCount}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
