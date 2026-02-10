
'use client';

import { useState, useEffect, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { PlusCircle, UploadCloud, Loader2, Camera, FileText, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import { useDocuments } from '@/contexts/document-context';
import { Document, DocumentWithFile } from '@/lib/types';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { MaisonUploadDialog } from './maison-upload-dialog';
import { Label } from './ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { normalizeSupplierKey, compressImage } from '@/lib/utils';

type AnalysisResult = Partial<ExtractInvoiceDataOutput>;

function formatDocumentName(result: AnalysisResult, originalFileName: string): string {
  let docType = (result.documentType || 'Autre') as Document['category'];
  const amountLabel = result.amount ? ` - ${result.amount} TND` : '';

  // Heuristic: if period matches SONEDE format (YYYY-MM-MM-MM), ensure it's SONEDE
  if (result.consumptionPeriod?.match(/^\d{4}-\d{2}-\d{2}-\d{2}$/)) {
    docType = 'SONEDE';
  }

  // Supplier logic
  let supplierName = result.supplier || '';
  if (docType === 'SONEDE') supplierName = 'SONEDE';
  if (docType === 'STEG' && !supplierName) supplierName = 'STEG';

  // Specific SONEDE Period Formatting: YYYY-MM-MM-MM -> YYYY Mois-Mois-Mois
  let formattedPeriod = result.consumptionPeriod || '';
  if (docType === 'SONEDE' && result.consumptionPeriod?.match(/^\d{4}-\d{2}-\d{2}-\d{2}$/)) {
    const parts = result.consumptionPeriod.split('-');
    const year = parts[0];
    const months = parts.slice(1).map(m => {
      try {
        const d = new Date(parseInt(year), parseInt(m) - 1, 1);
        return format(d, 'MMMM', { locale: fr });
      } catch (e) { return m; }
    });
    formattedPeriod = `${year} ${months.join('-')}`;
  } else if (result.billingStartDate && result.billingEndDate) {
    try {
      const startDate = parseISO(result.billingStartDate);
      const endDate = parseISO(result.billingEndDate);
      if (isValid(startDate) && isValid(endDate)) {
        formattedPeriod = `${format(startDate, 'MMM yy', { locale: fr })} - ${format(endDate, 'MMM yy', { locale: fr })}`;
      }
    } catch (e) { /* fallback to default result.consumptionPeriod */ }
  }

  // Final naming logic for core bills
  if (supplierName) {
    // We NO LONGER include period and amount in the name for core bills 
    // because they are displayed as metadata in the UI, saving space.
    return supplierName;
  }

  // Formatting for receipts
  if ((docType === 'Reçu Bancaire' || docType === 'Recus de caisse') && result.amount) {
    const supplierPart = result.supplier ? `${result.supplier} ` : '';
    const dateStr = result.issueDate || result.dueDate || '';
    const date = parseISO(dateStr);
    const formattedDate = isValid(date) ? ` du ${format(date, 'dd/MM/yyyy', { locale: fr })}` : '';
    const typeLabel = docType === 'Recus de caisse' ? 'Reçu de caisse' : 'Reçu Bancaire';
    return `${typeLabel} ${supplierPart}${formattedDate}${amountLabel}`;
  }

  // Fallback to original filename but try to prepend docType if common
  const baseName = originalFileName.split('.').slice(0, -1).join('.') || originalFileName;
  if (docType && docType !== 'Autre') {
    return `${docType} - ${baseName}${amountLabel}`;
  }

  return baseName;
}

const frenchCategories: Record<string, Document['category']> = {
  "STEG": "STEG",
  "SONEDE": "SONEDE",
  "EAU": "SONEDE",
  "ELECTRICITE": "STEG",
  "GAZ": "STEG",
  "Reçu Bancaire": "Reçu Bancaire",
  "Banque": "Reçu Bancaire",
  "Maison": "Maison",
  "Internet": "Internet",
  "Assurance": "Assurance",
  "Contrat": "Contrat",
  "Recus de caisse": "Recus de caisse",
  "Autre": "Autre",
};

const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function UploadDocumentDialog({ open, onOpenChange, documentToEdit = null, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; documentToEdit?: Document | null, children?: ReactNode }) {
  const [isOpen, setIsOpen] = useState(open || false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  const [isSupplierMergeDialogOpen, setIsSupplierMergeDialogOpen] = useState(false);
  const [supplierMergeInfo, setSupplierMergeInfo] = useState<{ detected?: string; existing?: string; normalizedKey?: string } | null>(null);
  const [pendingNewDocData, setPendingNewDocData] = useState<DocumentWithFile | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const { toast } = useToast();
  const { documents, addDocument, updateDocument } = useDocuments();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [formData, setFormData] = useState<Partial<Document>>({});
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);

  const isEditMode = !!documentToEdit;

  useEffect(() => {
    if (open !== undefined) setIsOpen(open);
  }, [open]);

  useEffect(() => {
    if (isOpen) {
      if (documentToEdit) {
        setFormData(documentToEdit);
        setFileToUpload(null);
      } else {
        setFormData({});
        setFileToUpload(null);
      }
    } else {
      resetDialog();
    }
  }, [isOpen, documentToEdit]);

  const handleTabChange = (value: string) => {
    if (value === 'camera' && !hasCameraPermission) {
      getCameraPermission();
    }
  }

  const getCameraPermission = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        variant: 'destructive',
        title: 'Fonctionnalité non supportée',
        description: 'Votre navigateur ne supporte pas l\'accès à la caméra.',
      });
      setHasCameraPermission(false);
      return;
    }

    const videoConstraints: MediaStreamConstraints['video'] = {
      facingMode: { ideal: 'environment' }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      setHasCameraPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Error accessing rear camera, trying default:', error);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (fallbackError) {
        console.error('Error accessing any camera:', fallbackError);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Accès Caméra Refusé',
          description: 'Veuillez autoriser l\'accès à la caméra dans les paramètres de votre navigateur.',
        });
      }
    }
  };

  const stopCameraStream = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (onOpenChange) {
      onOpenChange(open);
    } else {
      setIsOpen(open);
    }
    if (!open) {
      resetDialog();
    }
  };

  const resetDialog = () => {
    setIsProcessing(false);
    setProcessingMessage('');
    setIsSupplierMergeDialogOpen(false);
    setSupplierMergeInfo(null);
    setPendingNewDocData(null);
    stopCameraStream();
    setHasCameraPermission(null);
    setFileToUpload(null);
    setFormData({});
  };

  const resolveCanonicalSupplier = (normalizedKey: string): string | undefined => {
    const freq = new Map<string, number>();
    for (const d of documents) {
      const s = (d.supplier || '').trim();
      if (!s) continue;
      if (normalizeSupplierKey(s) !== normalizedKey) continue;
      freq.set(s, (freq.get(s) || 0) + 1);
    }
    let best: string | undefined;
    let bestCount = 0;
    for (const [name, count] of freq.entries()) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    return best;
  };

  const saveNewDocument = async (docData: DocumentWithFile) => {
    setIsProcessing(true);
    setProcessingMessage('Sauvegarde en cours...');
    await addDocument(docData);
    toast({ title: "Document ajouté !", description: `"${docData.name}" a été sauvegardé avec succès.` });
    handleOpenChange(false);
  };

  const handleSupplierMergeChoice = async (choice: 'useExisting' | 'merge' | 'keepNew') => {
    if (!pendingNewDocData) {
      setIsSupplierMergeDialogOpen(false);
      setSupplierMergeInfo(null);
      return;
    }

    const detected = (pendingNewDocData.supplier || '').trim();
    const normalizedKey = supplierMergeInfo?.normalizedKey || normalizeSupplierKey(detected);
    const canonical = supplierMergeInfo?.existing || resolveCanonicalSupplier(normalizedKey) || detected;

    try {
      if (choice === 'merge') {
        const docsToUpdate = documents.filter(d => {
          const s = (d.supplier || '').trim();
          if (!s) return false;
          return normalizeSupplierKey(s) === normalizedKey && s !== canonical;
        });

        await Promise.all(
          docsToUpdate.map(d => updateDocument(d.id, { supplier: canonical }))
        );
      }

      const finalSupplier = choice === 'keepNew' ? detected : canonical;
      await saveNewDocument({ ...pendingNewDocData, supplier: finalSupplier });
    } catch (error: any) {
      console.error('Supplier merge/save failed:', error);
      toast({ variant: 'destructive', title: "L'opération a échoué", description: "Impossible de sauvegarder le document." });
      setIsProcessing(false);
    } finally {
      setIsSupplierMergeDialogOpen(false);
      setSupplierMergeInfo(null);
      setPendingNewDocData(null);
    }
  };

  const processAndSaveDocument = async (file: File) => {
    setIsProcessing(true);

    try {
      let finalFile = file;
      console.log(`[Upload] Starting process for: ${file.name} (${file.type}, ${Math.round(file.size / 1024)} KB)`);

      // Compression if large image
      if (file.type.startsWith('image/') && file.size > 1 * 1024 * 1024) {
        setProcessingMessage('Optimisation de l\'image...');
        try {
          console.log('[Upload] Compressing image...');
          const compressed = await compressImage(file, 0.8, 1600);
          finalFile = new File([compressed.blob], file.name, { type: 'image/jpeg' });
          console.log(`[Upload] Compressed: ${Math.round(finalFile.size / 1024)} KB`);
        } catch (e) {
          console.warn('Compression failed, using original', e);
        }
      }

      if (finalFile.size > 9.5 * 1024 * 1024) {
        throw new Error("Le fichier est trop volumineux même après compression. Limite: 10 Mo.");
      }

      setProcessingMessage('Analyse du document...');
      let documentDataUri = await fileToDataUrl(finalFile);

      // If PDF, convert to image for Groq
      if (finalFile.type === 'application/pdf') {
        setProcessingMessage('Conversion du PDF...');
        console.log('[Upload] Converting PDF to image...');
        try {
          console.log('[Upload] Importing pdf-utils dynamically...');
          const { convertPdfToImage } = await import('@/lib/pdf-utils');
          console.log('[Upload] Starting conversion with pdf-utils...');
          documentDataUri = await convertPdfToImage(finalFile);
          console.log('[Upload] PDF conversion successful, data URI length:', documentDataUri.length);
        } catch (e) {
          console.error('PDF conversion failed:', e);
          throw new Error(`La conversion du PDF a échoué: ${e instanceof Error ? e.message : String(e)}. Essayez de prendre une photo à la place.`);
        }
      }

      console.log('[Upload] Starting AI extraction...');
      const result: AnalysisResult = await extractInvoiceData({
        invoiceDataUri: documentDataUri,
        mimeType: finalFile.type,
      });
      console.log('[Upload] AI extraction result:', result);

      setProcessingMessage('Sauvegarde en cours...');
      let finalCategory = (result.documentType && frenchCategories[result.documentType]) || 'Autre';

      // Heuristic fallback
      if (result.consumptionPeriod?.match(/^\d{4}-\d{2}-\d{2}-\d{2}$/)) {
        finalCategory = 'SONEDE';
      }

      const aiCategory = finalCategory;

      let finalConsumptionPeriod = result.consumptionPeriod;
      if (!finalConsumptionPeriod && result.billingStartDate && result.billingEndDate) {
        try {
          const start = parseISO(result.billingStartDate);
          const end = parseISO(result.billingEndDate);
          if (isValid(start) && isValid(end)) {
            finalConsumptionPeriod = `${format(start, 'yyyy-MM', { locale: fr })}-${format(end, 'MM', { locale: fr })}`;
          }
        } catch (e) { /* ignore */ }
      }

      const newDocData: DocumentWithFile = {
        name: formatDocumentName(result, finalFile.name),
        category: aiCategory,
        supplier: result.supplier,
        amount: result.amount,
        dueDate: result.dueDate,
        issueDate: result.issueDate,
        invoiceNumber: result.invoiceNumber,
        billingStartDate: result.billingStartDate,
        billingEndDate: result.billingEndDate,
        consumptionPeriod: finalConsumptionPeriod,
        consumptionQuantity: result.consumptionQuantity,
        gasAmount: result.gasAmount,
        gasConsumptionQuantity: result.gasConsumptionQuantity,
        file: finalFile,
      };

      const detectedSupplier = (newDocData.supplier || '').trim();
      if (detectedSupplier) {
        const normalizedKey = normalizeSupplierKey(detectedSupplier);
        const canonical = resolveCanonicalSupplier(normalizedKey);
        if (canonical && canonical !== detectedSupplier) {
          setPendingNewDocData(newDocData);
          setSupplierMergeInfo({ detected: detectedSupplier, existing: canonical, normalizedKey });
          setIsSupplierMergeDialogOpen(true);
          setIsProcessing(false);
          return;
        }
      }

      await saveNewDocument(newDocData);

    } catch (error: any) {
      console.error('L\'analyse ou la sauvegarde du document a échoué :', error);
      const message = (error && (error.message || error.toString?.())) || "Nous n'avons pas pu traiter votre document. Veuillez réessayer.";
      toast({ variant: 'destructive', title: "L'opération a échoué", description: message });
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      await processAndSaveDocument(selectedFile);
      event.target.value = '';
    }
  };

  const handleCapture = async () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        canvas.toBlob(async (blob) => {
          if (blob) {
            const capturedFile = new File([blob], `Capture-${new Date().toISOString()}.jpg`, { type: 'image/jpeg' });
            await processAndSaveDocument(capturedFile);
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const handleSave = async () => {
    // This function is now only for edit mode.
    if (!isEditMode || !documentToEdit) return;

    setIsProcessing(true);
    try {
      const dataToSave = { ...formData };
      if (fileToUpload) {
        dataToSave.file = fileToUpload;
      }
      await updateDocument(documentToEdit.id, dataToSave);
      toast({ title: "Document modifié", description: "Les informations ont été mises à jour." });
      handleOpenChange(false);
    } catch (error: any) {
      console.error("Erreur de sauvegarde:", error);
      toast({ variant: 'destructive', title: "Erreur de sauvegarde", description: error.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFormChange = (field: keyof Document, value: string | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const dialogTitle = isEditMode ? "Modifier le document" : "Ajouter un document";
  const dialogDescription = isEditMode
    ? "Modifiez les informations de votre document."
    : "Uploadez ou scannez une facture ou un reçu. L'analyse et la sauvegarde sont automatiques.";


  if (isEditMode && formData.category === 'Maison') {
    return <MaisonUploadDialog open={isOpen} onOpenChange={setIsOpen} documentToEdit={documentToEdit} />;
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <PlusCircle className="mr-2 h-4 w-4" />
            Ajouter un document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-headline">{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        <AlertDialog open={isSupplierMergeDialogOpen} onOpenChange={setIsSupplierMergeDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Fournisseur déjà existant</AlertDialogTitle>
              <AlertDialogDescription>
                Le document a été détecté avec le fournisseur "{supplierMergeInfo?.detected}" mais vous avez déjà "{supplierMergeInfo?.existing}".
                Voulez-vous fusionner pour garder un seul fournisseur ?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => handleSupplierMergeChoice('keepNew')}>Garder "{supplierMergeInfo?.detected}"</AlertDialogCancel>
              <AlertDialogCancel onClick={() => handleSupplierMergeChoice('useExisting')}>Utiliser "{supplierMergeInfo?.existing}"</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleSupplierMergeChoice('merge')}>Fusionner</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {isProcessing ? (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="font-semibold text-lg">{processingMessage || 'Traitement...'}</p>
          </div>
        ) : isEditMode ? (
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Fichier (optionnel)</Label>
              {fileToUpload || formData.file ? (
                <div className="flex items-center space-x-2 rounded-md bg-muted p-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground flex-1 truncate">{fileToUpload?.name || formData.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => { setFileToUpload(null); setFormData(prev => ({ ...prev, file: undefined })) }}>Changer</Button>
                </div>
              ) : (
                <label htmlFor="file-upload-edit" className="cursor-pointer">
                  <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-4 text-center transition hover:border-accent">
                    <UploadCloud className="h-8 w-8 text-muted-foreground" />
                    <p className="font-semibold text-sm">Changer le fichier</p>
                  </div>
                </label>
              )}
              <Input id="file-upload-edit" type="file" className="hidden" onChange={(e) => setFileToUpload(e.target.files?.[0] || null)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="doc-name">Nom du document</Label>
                <Input id="doc-name" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Input value={formData.category || ''} disabled />
              </div>
              <div className="space-y-2">
                <Label>Fournisseur</Label>
                <Input value={formData.supplier || ''} onChange={e => handleFormChange('supplier', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Montant Total</Label>
                <Input value={formData.amount || ''} onChange={e => handleFormChange('amount', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date d'échéance</Label>
                <Input type="date" value={formData.dueDate || ''} onChange={e => handleFormChange('dueDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date d'émission</Label>
                <Input type="date" value={formData.issueDate || ''} onChange={e => handleFormChange('issueDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Date de paiement</Label>
                <Input type="date" value={formData.paymentDate || ''} onChange={e => handleFormChange('paymentDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Numéro de facture</Label>
                <Input value={formData.invoiceNumber || ''} onChange={e => handleFormChange('invoiceNumber', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Période (Début)</Label>
                <Input type="month" value={formData.billingStartDate || ''} onChange={e => handleFormChange('billingStartDate', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Période (Fin)</Label>
                <Input type="month" value={formData.billingEndDate || ''} onChange={e => handleFormChange('billingEndDate', e.target.value)} />
              </div>
              <hr className="col-span-2 my-2 border-dashed" />
              <h4 className="col-span-2 text-sm font-medium text-muted-foreground">Rubrique Électricité / Eau</h4>
              <div className="space-y-2 col-span-2">
                <Label>Consommation</Label>
                <Input value={formData.consumptionQuantity || ''} onChange={e => handleFormChange('consumptionQuantity', e.target.value)} placeholder="ex: 123 KWh" />
              </div>
              <hr className="col-span-2 my-2 border-dashed" />
              <h4 className="col-span-2 text-sm font-medium text-muted-foreground">Rubrique Gaz (si applicable)</h4>
              <div className="space-y-2">
                <Label>Montant Gaz</Label>
                <Input value={formData.gasAmount || ''} onChange={e => handleFormChange('gasAmount', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Consommation Gaz</Label>
                <Input value={formData.gasConsumptionQuantity || ''} onChange={e => handleFormChange('gasConsumptionQuantity', e.target.value)} placeholder="ex: 45 m³" />
              </div>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="file" className="w-full" onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="file">Fichier</TabsTrigger>
              <TabsTrigger value="camera">Appareil photo</TabsTrigger>
            </TabsList>
            <TabsContent value="file">
              <div className="py-8">
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center transition hover:border-accent">
                    <UploadCloud className="h-12 w-12 text-muted-foreground" />
                    <p className="font-semibold">Cliquez ou glissez-déposez</p>
                    <p className="text-xs text-muted-foreground">PDF, PNG, JPG (max. 10MB)</p>
                  </div>
                </label>
                <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
              </div>
            </TabsContent>
            <TabsContent value="camera">
              <div className="py-4 space-y-4">
                <div className="relative aspect-video w-full bg-muted rounded-lg overflow-hidden">
                  <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline />
                  <canvas ref={canvasRef} className="hidden" />
                </div>
                {hasCameraPermission === false && (
                  <Alert variant="destructive">
                    <AlertTitle>Accès Caméra Requis</AlertTitle>
                    <AlertDescription>
                      Veuillez autoriser l'accès à la caméra pour utiliser cette fonctionnalité.
                    </AlertDescription>
                  </Alert>
                )}
                <Button onClick={handleCapture} disabled={!hasCameraPermission} className="w-full">
                  <Camera className="mr-2 h-4 w-4" />
                  Capturer et Sauvegarder
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}

        {isEditMode && !isProcessing && (
          <DialogFooter>
            <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90">
              Enregistrer les modifications
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
