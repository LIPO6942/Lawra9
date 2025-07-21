
'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDocuments } from '@/contexts/document-context';
import { BarChartHorizontal, Droplets, Zap, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { getYear, getMonth, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bar, BarChart, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const monthOrder = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
const monthLabels = monthOrder.map(m => `${m}.`);

const StatsPage = () => {
    const { documents } = useDocuments();
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const { availableYears, processedData, comparisonData, averages } = useMemo(() => {
        const dataByYearAndMonth: { [year: string]: { [month: string]: { [category: string]: number } } } = {};
        const allYears = new Set<string>();

        documents.forEach(doc => {
            if (!doc.consumptionQuantity || (doc.category !== 'STEG' && doc.category !== 'SONEDE')) return;
            
            const docDateStr = doc.issueDate || doc.billingEndDate || doc.createdAt;
            if (!docDateStr) return;

            const docDate = new Date(docDateStr);
            if (isNaN(docDate.getTime())) return;

            const year = getYear(docDate).toString();
            const month = format(docDate, 'MMM', { locale: fr }).replace('.', '');
            const quantity = parseFloat(doc.consumptionQuantity.replace(/[^0-9.,]/g, '').replace(',', '.'));

            if (isNaN(quantity)) return;
            allYears.add(year);

            if (!dataByYearAndMonth[year]) dataByYearAndMonth[year] = {};
            if (!dataByYearAndMonth[year][month]) dataByYearAndMonth[year][month] = {};
            if (!dataByYearAndMonth[year][month][doc.category]) dataByYearAndMonth[year][month][doc.category] = 0;
            
            dataByYearAndMonth[year][month][doc.category] += quantity;
        });

        const availableYears = Array.from(allYears).sort((a,b) => b.localeCompare(a));
        if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
          setSelectedYear(availableYears[0]);
        }

        const currentYearData = dataByYearAndMonth[selectedYear] || {};
        const processedData = monthOrder.map(monthName => {
            const monthData = currentYearData[monthName] || {};
            return {
                month: `${monthName}.`,
                STEG: monthData['STEG'] || 0,
                SONEDE: monthData['SONEDE'] || 0,
            };
        });

        const lastYear = (parseInt(selectedYear) - 1).toString();
        const lastYearData = dataByYearAndMonth[lastYear] || {};
        const comparisonData = monthOrder.map(monthName => ({
            month: `${monthName}.`,
            [`STEG ${selectedYear}`]: currentYearData[monthName]?.['STEG'] || 0,
            [`STEG ${lastYear}`]: lastYearData[monthName]?.['STEG'] || 0,
            [`SONEDE ${selectedYear}`]: currentYearData[monthName]?.['SONEDE'] || 0,
            [`SONEDE ${lastYear}`]: lastYearData[monthName]?.['SONEDE'] || 0,
        }));
        
        let totalSteg = 0, countSteg = 0;
        let totalSonede = 0, countSonede = 0;
        processedData.forEach(d => {
            if (d.STEG > 0) { totalSteg += d.STEG; countSteg++; }
            if (d.SONEDE > 0) { totalSonede += d.SONEDE; countSonede++; }
        });

        const averages = {
            steg: countSteg > 0 ? totalSteg / countSteg : 0,
            sonede: countSonede > 0 ? totalSonede / countSonede : 0,
        };

        return { availableYears, processedData, comparisonData, averages };

    }, [documents, selectedYear]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-start justify-between space-y-4 md:space-y-0 md:items-center">
                <div className="flex items-center space-x-3">
                    <BarChartHorizontal className="h-8 w-8 text-primary"/>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Statistiques de Consommation</h1>
                        <p className="text-muted-foreground">Analysez votre consommation d'eau et d'électricité.</p>
                    </div>
                </div>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-full sm:w-[180px] rounded-lg">
                        <SelectValue placeholder="Année" />
                    </SelectTrigger>
                    <SelectContent>
                        {availableYears.map(year => <SelectItem key={year} value={year}>{year}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <StatCard 
                    title="Moyenne Mensuelle STEG"
                    value={`${averages.steg.toFixed(0)} kWh`}
                    icon={Zap}
                    iconClass="text-yellow-400"
                />
                 <StatCard 
                    title="Moyenne Mensuelle SONEDE"
                    value={`${averages.sonede.toFixed(0)} m³`}
                    icon={Droplets}
                    iconClass="text-blue-400"
                />
            </div>
            
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Consommation Annuelle ({selectedYear})</CardTitle>
                    <CardDescription>Évolution de votre consommation mensuelle d'eau et d'électricité.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] pr-8">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processedData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="left" orientation="left" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'kWh', angle: -90, position: 'insideLeft', offset: 10, fill: '#888' }} />
                            <YAxis yAxisId="right" orientation="right" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'm³', angle: -90, position: 'insideRight', offset: -10, fill: '#888' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar yAxisId="left" dataKey="STEG" fill="var(--color-steg)" name="Électricité (kWh)" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="right" dataKey="SONEDE" fill="var(--color-sonede)" name="Eau (m³)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    <style>{`:root { --color-steg: hsl(var(--chart-4)); --color-sonede: hsl(var(--chart-1)); }`}</style>
                </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Comparaison Annuelle</CardTitle>
                    <CardDescription>Comparez votre consommation avec l'année précédente.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] pr-8">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey={`STEG ${selectedYear}`} stroke="var(--color-steg)" name={`STEG ${selectedYear}`} />
                            <Line type="monotone" dataKey={`STEG ${(parseInt(selectedYear)-1)}`} stroke="var(--color-steg)" strokeDasharray="5 5" name={`STEG ${(parseInt(selectedYear)-1)}`} opacity={0.6} />
                            <Line type="monotone" dataKey={`SONEDE ${selectedYear}`} stroke="var(--color-sonede)" name={`SONEDE ${selectedYear}`} />
                            <Line type="monotone" dataKey={`SONEDE ${(parseInt(selectedYear)-1)}`} stroke="var(--color-sonede)" strokeDasharray="5 5" name={`SONEDE ${(parseInt(selectedYear)-1)}`} opacity={0.6} />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    );
}

const StatCard = ({ title, value, icon: Icon, iconClass }: { title: string, value: string, icon: React.ElementType, iconClass: string }) => {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className={`h-4 w-4 text-muted-foreground ${iconClass}`} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value}</div>
            </CardContent>
        </Card>
    );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <p className="text-sm font-bold text-foreground mb-2">{label}</p>
        {payload.map((pld: any) => (
          <div key={pld.dataKey} className="flex items-center justify-between text-xs">
            <div className="flex items-center">
                <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: pld.stroke || pld.fill }}></div>
                <span className="text-muted-foreground">{pld.name}:</span>
            </div>
            <span className="font-semibold ml-4">{pld.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};


export default StatsPage;
