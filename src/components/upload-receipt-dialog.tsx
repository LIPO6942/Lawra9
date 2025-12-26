'use client';

import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, Loader2, PlusCircle, UploadCloud } from 'lucide-react';
import { useReceipts } from '@/contexts/receipt-context';
import { extractReceiptData } from '@/ai/flows/extract-receipt-data';
import { Receipt } from '@/lib/types';
import { mapCategoryHeuristic, normalizeUnit, computeStandardUnitPrice, normalizeProductKey, getLearnedPackQty } from '@/lib/utils';

/**
 * Fonction pour redimensionner et compresser l'image côté client
 */
async function compressImage(file: File, maxWidth = 1600, maxHeight = 1600, quality = 0.7): Promise<{ blob: Blob, dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas context error"));

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error("Compression error"));
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({ blob, dataUrl: reader.result as string });
        };
        reader.readAsDataURL(blob);
      }, 'image/jpeg', quality);
    };
    img.onerror = (e) => reject(e);
  });
}

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
    try {
      setIsProcessing(true);

      let finalDataUri: string;
      let finalFile: File = file;

      const isHeic = file.name.toLowerCase().endsWith('.heic');

      // On réduit la limite à 2.5Mo pour plus de sécurité sur Vercel Hobby
      if (isHeic || file.size > 2.5 * 1024 * 1024) {
        setProcessingMessage(isHeic ? 'Conversion iPhone supportée...' : 'Image un peu lourde, optimisation...');
        const { blob, dataUrl } = await compressImage(file);
        finalDataUri = dataUrl;
        finalFile = new File([blob], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
      } else {
        setProcessingMessage('Préparation...');
        finalDataUri = await fileToDataUrl(file);
      }

      setProcessingMessage('Analyse IA en cours (3 à 4 min)...');

      // On wrap l'appel dans un try/catch spécifique pour chopper les erreurs de timeout serveur
      const res = await extractReceiptData({ receiptDataUri: finalDataUri, mimeType: 'image/jpeg' });

      if (!res) throw new Error("Le serveur est injoignable.");
      if (res.storeName === "Échec de l'analyse") throw new Error(res.ocrText || "L'IA n'a pas pu lire le ticket.");

      setProcessingMessage('Ticket lu ! Optimisation...');
      const enhancedLines = (res.lines || []).map((l: any, idx: number) => {
        const label = l.normalizedLabel || l.rawLabel;
        const heurCat = mapCategoryHeuristic(label || '');
        const norm = normalizeUnit(l.quantity, l.unit, label);
        const line = {
          id: l.id || `ln-${idx}`,
          rawLabel: l.rawLabel,
          normalizedLabel: l.normalizedLabel,
          category: l.category || heurCat,
          quantity: l.quantity ?? 1,
          unit: l.unit ?? 'pcs',
          unitPrice: l.unitPrice,
          lineTotal: l.lineTotal,
          vatRate: l.vatRate,
          barcode: l.barcode,
          stdUnit: norm.stdUnit,
          stdQty: norm.stdQty,
          standardUnitPrice: undefined as number | undefined,
        };

        const text = (label || '').toLowerCase().replace(',', '.');
        const packMatch = text.match(/(\d{1,3})\s*[x×]\s*(\d+(?:\.\d+)?)(?:\s*=\s*(\d+(?:\.\d+)?))?/);
        if (packMatch) {
          const qty = parseInt(packMatch[1]);
          const unitP = parseFloat(packMatch[2]);
          const totalP = packMatch[3] ? parseFloat(packMatch[3]) : (isFinite(qty * unitP) ? qty * unitP : undefined);
          if (!isNaN(qty) && qty > 0 && qty <= 200) {
            line.quantity = line.quantity && line.quantity > 1 ? line.quantity : qty;
            line.unit = line.unit || 'pcs';
          }
          if (!isNaN(unitP)) line.unitPrice = line.unitPrice ?? unitP;
          if (totalP != null && !isNaN(totalP)) line.lineTotal = line.lineTotal ?? parseFloat(totalP.toFixed(3));
        }

        if ((line.quantity == null || line.quantity === 1) && line.unitPrice != null && line.lineTotal != null && line.unitPrice > 0) {
          const q = Math.round((line.lineTotal / line.unitPrice) * 1000) / 1000;
          const qi = Math.round(q);
          if (Number.isFinite(qi) && qi >= 1 && qi <= 200 && Math.abs(q - qi) < 0.05) {
            line.quantity = qi;
            line.unit = line.unit || 'pcs';
          }
        }

        const productKey = normalizeProductKey(label || '');
        const learned = productKey ? getLearnedPackQty(productKey, res.storeName) : undefined;
        if (learned && (!line.quantity || line.quantity <= 1 || line.quantity < learned)) {
          line.quantity = learned;
          line.unit = line.unit || 'pcs';
        }

        line.standardUnitPrice = computeStandardUnitPrice(line as any);
        return line as any;
      });

      setProcessingMessage('Presque fini...');
      const receipt: Omit<Receipt, 'id'> = {
        storeName: res.storeName,
        storeId: res.storeId,
        purchaseAt: res.purchaseAt || new Date().toISOString(),
        currency: res.currency,
        total: res.total,
        subtotal: res.subtotal,
        taxTotal: res.taxTotal,
        ocrText: res.ocrText,
        file: finalFile,
        status: 'parsed',
        confidence: res.confidence ?? 0.7,
        lines: enhancedLines,
      };

      await addReceipt(receipt);
      handleOpenChange(false);
    } catch (err: any) {
      console.error("Erreur détectée:", err);
      // On filtre l'erreur technique Vercel pour être plus clair
      if (err.message?.includes("digest")) {
        setProcessingMessage("Le serveur a mis trop de temps. Réessayez avec une image plus petite.");
      } else {
        setProcessingMessage(err.message || "Un problème est survenu.");
      }
      setTimeout(() => setIsProcessing(false), 8000);
    }
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
          <DialogDescription>
            Supporte iPhone (HEIC) et photos lourdes. L'IA analyse votre ticket en détail.
          </DialogDescription>
        </DialogHeader>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="font-semibold text-lg text-center px-4 transition-all duration-300">
              {processingMessage}
            </p>
          </div>
        ) : (
          <div className="py-8">
            <label htmlFor="receipt-upload" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center transition hover:border-accent">
                <UploadCloud className="h-12 w-12 text-muted-foreground" />
                <p className="font-semibold">Cliquez ou glissez-déposez</p>
                <p className="text-xs text-muted-foreground">iPhone supporté (Conversion auto)</p>
              </div>
            </label>
            <Input id="receipt-upload" type="file" className="hidden" onChange={onFileChange} accept=".heic,.png,.jpg,.jpeg" />
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
