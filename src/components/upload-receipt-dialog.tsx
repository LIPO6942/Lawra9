'use client';

import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Loader2, PlusCircle, UploadCloud } from 'lucide-react';
import { useReceipts } from '@/contexts/receipt-context';
import { extractReceiptData } from '@/ai/flows/extract-receipt-data';
import { Receipt } from '@/lib/types';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function UploadReceiptDialog({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const { addReceipt } = useReceipts();

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setIsProcessing(false);
      setProcessingMessage('');
    }
  };

  async function processAndSaveReceipt(file: File) {
    setIsProcessing(true);
    setProcessingMessage('Analyse du reçu...');
    const dataUri = await fileToDataUrl(file);

    const res = await extractReceiptData({ receiptDataUri: dataUri, mimeType: file.type });

    setProcessingMessage('Sauvegarde...');
    const receipt: Omit<Receipt, 'id'> = {
      storeName: res.storeName,
      storeId: res.storeId,
      purchaseAt: res.purchaseAt,
      currency: res.currency,
      total: res.total,
      subtotal: res.subtotal,
      taxTotal: res.taxTotal,
      ocrText: res.ocrText,
      file,
      status: 'parsed',
      confidence: res.confidence ?? 0.7,
      lines: (res.lines || []).map((l, idx) => ({
        id: l.id || `ln-${idx}`,
        rawLabel: l.rawLabel,
        normalizedLabel: l.normalizedLabel,
        quantity: l.quantity,
        unit: l.unit,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
        vatRate: l.vatRate,
        barcode: l.barcode,
      })),
    };

    await addReceipt(receipt);
    handleOpenChange(false);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      await processAndSaveReceipt(f);
      e.target.value = '';
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter un reçu
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-headline">Ajouter un reçu</DialogTitle>
          <DialogDescription>Uploadez un reçu (image/PDF). L'analyse est automatique.</DialogDescription>
        </DialogHeader>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="font-semibold text-lg">{processingMessage || 'Traitement...'}</p>
          </div>
        ) : (
          <div className="py-8">
            <label htmlFor="receipt-upload" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center transition hover:border-accent">
                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                <p className="font-semibold">Cliquez ou glissez-déposez</p>
                <p className="text-xs text-muted-foreground">PDF, PNG, JPG (max. 10MB)</p>
              </div>
            </label>
            <Input id="receipt-upload" type="file" className="hidden" onChange={onFileChange} accept=".pdf,.png,.jpg,.jpeg" />
          </div>
        )}

        {!isProcessing && (
          <DialogFooter>
            <Button variant="outline" disabled>
              <Camera className="mr-2 h-4 w-4" /> Bientôt: Scanner
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
