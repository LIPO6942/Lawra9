
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

type AnalysisResult = Partial<ExtractInvoiceDataOutput>;

function formatDocumentName(result: AnalysisResult, originalFileName: string): string {
    const docType = result.documentType as Document['category'];

    if ((docType === 'STEG' || docType === 'SONEDE' || docType === 'Internet') && result.supplier && result.amount) {
        let period = '';
        if (docType === 'SONEDE' && result.consumptionPeriod) {
            period = result.consumptionPeriod;
        } else if (result.billingStartDate && result.billingEndDate) {
            try {
                const startDate = parseISO(result.billingStartDate);
                const endDate = parseISO(result.billingEndDate);
                 if (isValid(startDate) && isValid(endDate)) {
                    period = `${format(startDate, 'dd/MM/yy', { locale: fr })} au ${format(endDate, 'dd/MM/yy', { locale: fr })}`;
                }
            } catch (e) { /* Ignore formatting error */ }
        }
        return `Facture ${result.supplier}${period ? ` (${period})` : ''} - ${result.amount} TND`;
    }

    if (docType === 'Reçu Bancaire' && result.amount) {
         try {
            const dateStr = result.issueDate || result.dueDate || '';
            const date = parseISO(dateStr);
            const formattedDate = isValid(date) ? ` du ${format(date, 'dd/MM/yyyy', { locale: fr })}` : '';
            return `Reçu Bancaire${formattedDate} - ${result.amount} TND`;
         } catch(e) {
            return `Reçu Bancaire - ${result.amount} TND`;
         }
    }
    return originalFileName.split('.').slice(0, -1).join('.') || originalFileName;
}

const frenchCategories: Record<string, Document['category']> = {
  "STEG": "STEG",
  "SONEDE": "SONEDE",
  "Reçu Bancaire": "Reçu Bancaire",
  "Maison": "Maison",
  "Internet": "Internet",
  "Assurance": "Assurance",
  "Contrat": "Contrat",
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

export function UploadDocumentDialog({ open, onOpenChange, documentToEdit = null, children }: { open?: boolean; onOpenChange?: (open: boolean) => void; documentToEdit?: Document | null, children?: ReactNode}) {
  const [isOpen, setIsOpen] = useState(open || false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);

  const { toast } = useToast();
  const { addDocument } = useDocuments();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isEditMode = !!documentToEdit;

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
    if (documentToEdit) {
      setSelectedDocument(documentToEdit);
      setIsEditModalOpen(true);
    }
    if (!open && !documentToEdit) {
        resetDialog();
    }
  }, [open, documentToEdit]);

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
    stopCameraStream();
    setHasCameraPermission(null);
  };
  
  const processAndSaveDocument = async (file: File) => {
      setIsProcessing(true);
      const fileName = file.name;
      
      try {
          setProcessingMessage('Analyse du document...');
          const documentDataUri = await fileToDataUrl(file);
          
          const result: AnalysisResult = await extractInvoiceData({ invoiceDataUri: documentDataUri });

          const aiCategory = (result.documentType && frenchCategories[result.documentType]) || 'Autre';
          
          const newDoc: DocumentWithFile = {
              name: formatDocumentName(result, fileName),
              category: aiCategory,
              supplier: result.supplier,
              amount: result.amount,
              dueDate: result.dueDate,
              issueDate: result.issueDate,
              invoiceNumber: result.invoiceNumber,
              billingStartDate: result.billingStartDate,
              billingEndDate: result.billingEndDate,
              consumptionPeriod: result.consumptionPeriod,
              consumptionQuantity: result.consumptionQuantity,
              file: file,
          };

          setProcessingMessage('Sauvegarde du document...');
          await addDocument(newDoc);
          
          toast({ title: "Document enregistré !", description: `"${newDoc.name}" a été ajouté avec succès.` });
          handleOpenChange(false);

      } catch (error: any) {
          console.error('L\'analyse du document a échoué :', error);
          toast({ variant: 'destructive', title: "L'analyse a échoué", description: "Nous n'avons pas pu analyser votre document. Veuillez réessayer."});
          handleOpenChange(false);
      } finally {
          setIsProcessing(false);
          setProcessingMessage('');
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
              }, 'image/jpeg', 0.9); // Force JPEG format with 90% quality
          }
      }
  };

  const dialogTitle = "Ajouter un nouveau document";
  const dialogDescription = "Uploadez un fichier ou prenez une photo. Notre IA l'analysera et le sauvegardera automatiquement pour vous.";

  // This component now only handles ADDING. Editing is delegated.
  if (isEditMode) {
     return <MaisonUploadDialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen} documentToEdit={documentToEdit} />
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>

        {isProcessing ? (
             <div className="flex flex-col items-center justify-center space-y-4 py-12">
                <Loader2 className="h-16 w-16 animate-spin text-accent" />
                <p className="font-semibold text-lg">Traitement en cours...</p>
                <p className="text-sm text-muted-foreground">{processingMessage}</p>
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
                    Capturer
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
