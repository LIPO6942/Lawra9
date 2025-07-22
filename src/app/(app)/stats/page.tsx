
'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDocuments } from '@/contexts/document-context';
import { BarChartHorizontal, Droplets, Zap, Flame } from 'lucide-react';
import { getYear, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LineChart, Line } from 'recharts';

const monthOrder = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

const StatsPage = () => {
    const { documents } = useDocuments();
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    const { availableYears, processedData, comparisonData, averages, lastYear } = useMemo(() => {
        const dataByYearAndMonth: { [year: string]: { [month: string]: { [category: string]: number } } } = {};
        const allYears = new Set<string>();

        documents.forEach(doc => {
            const docDateStr = doc.issueDate || doc.billingEndDate || doc.createdAt;
            if (!docDateStr) return;

            const docDate = new Date(docDateStr);
            if (isNaN(docDate.getTime())) return;

            const year = getYear(docDate).toString();
            const month = format(docDate, 'MMM', { locale: fr }).replace('.', '');
            allYears.add(year);

            if (!dataByYearAndMonth[year]) dataByYearAndMonth[year] = {};
            if (!dataByYearAndMonth[year][month]) dataByYearAndMonth[year][month] = {};

            // Electricity consumption
            if (doc.category === 'STEG' && doc.consumptionQuantity) {
                const quantity = parseFloat(doc.consumptionQuantity.replace(/[^0-9.,]/g, '').replace(',', '.'));
                if (!isNaN(quantity)) {
                    if (!dataByYearAndMonth[year][month]['Électricité']) dataByYearAndMonth[year][month]['Électricité'] = 0;
                    dataByYearAndMonth[year][month]['Électricité'] += quantity;
                }
            }
            
            // Gas consumption
            if (doc.category === 'STEG' && doc.gasConsumptionQuantity) {
                 const quantity = parseFloat(doc.gasConsumptionQuantity.replace(/[^0-9.,]/g, '').replace(',', '.'));
                if (!isNaN(quantity)) {
                    if (!dataByYearAndMonth[year][month]['Gaz']) dataByYearAndMonth[year][month]['Gaz'] = 0;
                    dataByYearAndMonth[year][month]['Gaz'] += quantity;
                }
            }

            // Water consumption
            if (doc.category === 'SONEDE' && doc.consumptionQuantity) {
                 const quantity = parseFloat(doc.consumptionQuantity.replace(/[^0-9.,]/g, '').replace(',', '.'));
                if (!isNaN(quantity)) {
                    if (!dataByYearAndMonth[year][month]['Eau']) dataByYearAndMonth[year][month]['Eau'] = 0;
                    dataByYearAndMonth[year][month]['Eau'] += quantity;
                }
            }
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
                'Électricité': monthData['Électricité'] || 0,
                'Gaz': monthData['Gaz'] || 0,
                'Eau': monthData['Eau'] || 0,
            };
        });

        const lastYear = (parseInt(selectedYear) - 1).toString();
        const lastYearData = dataByYearAndMonth[lastYear] || {};
        const comparisonData = monthOrder.map(monthName => ({
            month: `${monthName}.`,
            [`Électricité ${selectedYear}`]: currentYearData[monthName]?.['Électricité'] || 0,
            [`Électricité ${lastYear}`]: lastYearData[monthName]?.['Électricité'] || 0,
            [`Gaz ${selectedYear}`]: currentYearData[monthName]?.['Gaz'] || 0,
            [`Gaz ${lastYear}`]: lastYearData[monthName]?.['Gaz'] || 0,
            [`Eau ${selectedYear}`]: currentYearData[monthName]?.['Eau'] || 0,
            [`Eau ${lastYear}`]: lastYearData[monthName]?.['Eau'] || 0,
        }));
        
        let totalElec = 0, countElec = 0;
        let totalGaz = 0, countGaz = 0;
        let totalEau = 0, countEau = 0;

        processedData.forEach(d => {
            if (d['Électricité'] > 0) { totalElec += d['Électricité']; countElec++; }
            if (d['Gaz'] > 0) { totalGaz += d['Gaz']; countGaz++; }
            if (d['Eau'] > 0) { totalEau += d['Eau']; countEau++; }
        });

        const averages = {
            elec: countElec > 0 ? totalElec / countElec : 0,
            gaz: countGaz > 0 ? totalGaz / countGaz : 0,
            eau: countEau > 0 ? totalEau / countEau : 0,
        };

        return { availableYears, processedData, comparisonData, averages, lastYear };

    }, [documents, selectedYear]);

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row items-start justify-between space-y-4 md:space-y-0 md:items-center">
                <div className="flex items-center space-x-3">
                    <BarChartHorizontal className="h-8 w-8 text-primary"/>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight font-headline">Statistiques de Consommation</h1>
                        <p className="text-muted-foreground">Analysez votre consommation d'eau, de gaz et d'électricité.</p>
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

            <div className="grid gap-4 md:grid-cols-3">
                <StatCard 
                    title="Moy. Mensuelle Électricité"
                    value={`${averages.elec.toFixed(0)} kWh`}
                    icon={Zap}
                    iconClass="text-yellow-400"
                />
                 <StatCard 
                    title="Moy. Mensuelle Gaz"
                    value={`${averages.gaz.toFixed(0)} m³`}
                    icon={Flame}
                    iconClass="text-orange-500"
                />
                 <StatCard 
                    title="Moy. Mensuelle Eau"
                    value={`${averages.eau.toFixed(0)} m³`}
                    icon={Droplets}
                    iconClass="text-blue-400"
                />
            </div>
            
            <Card className="rounded-xl shadow-sm">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">Consommation Annuelle ({selectedYear})</CardTitle>
                    <CardDescription>Évolution de votre consommation mensuelle.</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px] pr-8">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processedData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="month" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis yAxisId="left" orientation="left" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'kWh / m³', angle: -90, position: 'insideLeft', offset: 10, fill: '#888' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar yAxisId="left" dataKey="Électricité" fill="var(--color-elec)" name="Électricité (kWh)" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="left" dataKey="Gaz" fill="var(--color-gaz)" name="Gaz (m³)" radius={[4, 4, 0, 0]} />
                            <Bar yAxisId="left" dataKey="Eau" fill="var(--color-eau)" name="Eau (m³)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                    <style>{`:root { --color-elec: hsl(var(--chart-4)); --color-gaz: hsl(var(--chart-3)); --color-eau: hsl(var(--chart-1)); }`}</style>
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
                            <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} label={{ value: 'kWh / m³', angle: -90, position: 'insideLeft', offset: 10, fill: '#888' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey={`Électricité ${selectedYear}`} stroke="var(--color-elec)" name={`Élec. ${selectedYear}`} />
                            <Line type="monotone" dataKey={`Électricité ${lastYear}`} stroke="var(--color-elec)" strokeDasharray="5 5" name={`Élec. ${lastYear}`} opacity={0.6} />
                            <Line type="monotone" dataKey={`Gaz ${selectedYear}`} stroke="var(--color-gaz)" name={`Gaz ${selectedYear}`} />
                            <Line type="monotone" dataKey={`Gaz ${lastYear}`} stroke="var(--color-gaz)" strokeDasharray="5 5" name={`Gaz ${lastYear}`} opacity={0.6} />
                            <Line type="monotone" dataKey={`Eau ${selectedYear}`} stroke="var(--color-eau)" name={`Eau ${selectedYear}`} />
                            <Line type="monotone" dataKey={`Eau ${lastYear}`} stroke="var(--color-eau)" strokeDasharray="5 5" name={`Eau ${lastYear}`} opacity={0.6} />
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
