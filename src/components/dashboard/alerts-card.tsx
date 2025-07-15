
'use client';

import { Alert } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, Clock, CheckCircle } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDocuments } from '@/contexts/document-context';

function getAlertBadge(dueDate: string) {
  const daysDiff = differenceInDays(parseISO(dueDate), new Date());
  if (daysDiff < 0) {
    return <Badge variant="destructive" className="rounded-md">En retard</Badge>;
  }
  if (daysDiff <= 7) {
    return <Badge className="bg-destructive/80 rounded-md">Urgent</Badge>;
  }
  if (daysDiff <= 15) {
    return <Badge className="bg-orange-400 text-black rounded-md">Proche</Badge>;
  }
  return <Badge variant="secondary" className="rounded-md">Normal</Badge>;
}

interface AlertsCardProps {
    alerts: Alert[];
}

export function AlertsCard({ alerts }: AlertsCardProps) {
    const { markAsPaid } = useDocuments();

    return (
        <Card className="rounded-2xl shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div >
                <CardTitle className="text-lg font-medium font-headline">Alertes à venir</CardTitle>
                <CardDescription>Vos échéances importantes.</CardDescription>
              </div>
              <Bell className="h-6 w-6 text-accent" />
            </CardHeader>
            <CardContent>
             {alerts.length > 0 ? (
                <div className="space-y-4">
                  {alerts.map((alert) => (
                    <div key={alert.id} className="flex items-center space-x-4 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
                          {differenceInDays(parseISO(alert.dueDate), new Date()) < 0 ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Clock className="h-5 w-5 text-accent" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium leading-none">{alert.documentName}</p>
                        <p className="text-sm text-muted-foreground">{alert.type} - Échéance: {format(parseISO(alert.dueDate), 'd MMMM yyyy', { locale: fr })}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getAlertBadge(alert.dueDate)}
                        <Button variant="ghost" size="sm" onClick={() => markAsPaid(alert.documentId)} className="h-auto px-2 py-1 text-xs">
                           <CheckCircle className="mr-1 h-3 w-3" />
                           Payée
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                    <p className="text-muted-foreground">Aucune alerte pour le moment.</p>
                    <p className="text-xs text-muted-foreground/80">Ajoutez des documents avec des dates d'échéance pour en créer.</p>
                </div>
              )}
            </CardContent>
          </Card>
    );
}
