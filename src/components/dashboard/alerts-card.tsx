
'use client';

import { Alert } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bell, AlertTriangle, Clock, CheckCircle, Info } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDocuments } from '@/contexts/document-context';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

function getAlertBadge(dueDate: string) {
  const daysDiff = differenceInDays(parseISO(dueDate), new Date());
  let badge;
  if (daysDiff < 0) {
    badge = <Badge variant="destructive">Retard</Badge>;
  } else if (daysDiff <= 7) {
    badge = <Badge className="bg-orange-500 hover:bg-orange-500/80 text-white">Urgent</Badge>;
  } else {
    badge = <Badge variant="secondary">À venir</Badge>;
  }
  return (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent>
                <p>{daysDiff < 0 ? `${Math.abs(daysDiff)} jours de retard` : `Dans ${daysDiff} jours`}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
  )
}

interface AlertsCardProps {
    alerts: Alert[];
}

export function AlertsCard({ alerts }: AlertsCardProps) {
    const { markAsPaid } = useDocuments();

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex items-center gap-3">
                     <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Bell className="h-6 w-6" />
                     </div>
                     <div>
                        <CardTitle className="text-lg font-medium font-headline">Centre d'Alertes</CardTitle>
                        <CardDescription>Vos échéances importantes.</CardDescription>
                     </div>
                </div>
            </CardHeader>
            <CardContent>
             {alerts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.slice(0, 5).map((alert) => (
                    <div key={alert.id} className="flex items-center space-x-4">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          {differenceInDays(parseISO(alert.dueDate), new Date()) < 0 ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <Clock className="h-5 w-5 text-orange-500" />}
                      </div>
                      <div className="flex-1 space-y-1 min-w-0">
                        <p className="text-sm font-medium leading-none break-words" title={alert.documentName}>{alert.documentName}</p>
                        <p className="text-sm text-muted-foreground">{alert.type} - {format(parseISO(alert.dueDate), 'd MMMM', { locale: fr })}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getAlertBadge(alert.dueDate)}
                        <TooltipProvider>
                          <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => markAsPaid(alert.documentId)} className="h-8 w-8 text-muted-foreground hover:bg-green-500/10 hover:text-green-600">
                                   <CheckCircle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                  <p>Marquer comme payée</p>
                              </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  ))}
                   {alerts.length > 5 && <p className="text-center text-xs text-muted-foreground pt-2">et {alerts.length - 5} autres...</p>}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center h-full">
                    <Info className="h-8 w-8 text-muted-foreground mb-4"/>
                    <p className="font-semibold text-muted-foreground">Aucune alerte pour le moment.</p>
                    <p className="text-xs text-muted-foreground/80 mt-1">Ajoutez des documents avec des dates d'échéance.</p>
                </div>
              )}
            </CardContent>
          </Card>
    );
}
