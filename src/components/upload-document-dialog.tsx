
'use client';

import { useState, useEffect, useRef } from 'react';
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
import { Label } from '@/components/ui/label';
import { PlusCircle, UploadCloud, Loader2, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import { detectDocumentType, DetectDocumentTypeOutput } from '@/ai/flows/detect-document-type';
import { useDocuments } from '@/contexts/document-context';
import { Document } from '@/lib/types';
import { Textarea } from './ui/textarea';
import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { storage } from '@/lib/firebase';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/contexts/auth-context';

type AnalysisResult = Partial<DetectDocumentTypeOutput> & Partial<ExtractInvoiceDataOutput>;

interface UploadDocumentDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  documentToEdit?: Document | null;
  defaultCategory?: Document['category'];
}

const frenchCategories: { [key: string]: Document['category'] } = {
    'STEG': 'STEG',
    'SONEDE': 'SONEDE',
    'Reçu Bancaire': 'Reçu Bancaire',
    'Maison': 'Maison',
    'Internet': 'Internet',
    'Autre': 'Autre',
};

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
            const dateStr = result.dueDate || '';
            const date = parseISO(dateStr);
            const formattedDate = isValid(date) ? ` du ${format(date, 'dd/MM/yyyy', { locale: fr })}` : '';
            return `Reçu Bancaire${formattedDate} - ${result.amount} TND`;
         } catch(e) {
            return `Reçu Bancaire - ${result.amount} TND`;
         }
    }
    return originalFileName.split('.').slice(0, -1).join('.') || originalFileName;
}

export function UploadDocumentDialog({ open, onOpenChange, documentToEdit = null, defaultCategory }: UploadDocumentDialogProps) {
  const [isOpen, setIsOpen] = useState(open || false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Document>>({});
  const { toast } = useToast();
  const { addDocument, updateDocument } = useDocuments();
  const { userId } = useAuth();
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const isEditMode = !!documentToEdit;

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);
  
  useEffect(() => {
    if (isOpen && isEditMode && documentToEdit) {
      setFormData(documentToEdit);
    }
  }, [isOpen, isEditMode, documentToEdit]);
  
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
    setIsAnalyzing(false);
    setFileName(null);
    setFormData({});
    stopCameraStream();
    setHasCameraPermission(null);
    if (onOpenChange && !isEditMode) {
      onOpenChange(false);
    }
  };

  const processDocument = async (documentDataUri: string, docName: string) => {
    console.log('[DEBUG] 1. Démarrage de processDocument pour :', docName);
    setIsAnalyzing(true);
    setFileName(docName);

    let fileUrl = '';
    let result: AnalysisResult = {};
    let hadError = false;

    try {
        if (!userId) {
            console.error('[DEBUG] ERREUR : User ID manquant.');
            throw new Error("Utilisateur non authentifié.");
        }
        
        console.log('[DEBUG] 2. Upload sur Firebase Storage...');
        const storageRef = ref(storage, `documents/${userId}/${Date.now()}-${docName}`);
        const snapshot = await uploadString(storageRef, documentDataUri, 'data_url');
        fileUrl = await getDownloadURL(snapshot.ref);
        console.log('[DEBUG] 3. Upload réussi. URL du fichier :', fileUrl);

        console.log('[DEBUG] 4. Appel des flux Genkit...');
        const settledResults = await Promise.allSettled([
            detectDocumentType({ documentDataUri }),
            extractInvoiceData({ invoiceDataUri: documentDataUri })
        ]);

        const typeResult = settledResults[0];
        const invoiceResult = settledResults[1];

        if (typeResult.status === 'fulfilled') {
            console.log('[DEBUG] 5a. Résultat de detectDocumentType :', typeResult.value);
            result = { ...result, ...typeResult.value };
        } else {
            console.warn("[DEBUG] 5a. ERREUR : L'API de détection de type a échoué:", typeResult.reason);
        }

        if (invoiceResult.status === 'fulfilled') {
            console.log('[DEBUG] 5b. Résultat de extractInvoiceData :', invoiceResult.value);
            result = { ...result, ...invoiceResult.value };
        } else {
            console.warn("[DEBUG] 5b. ERREUR : L'API d'extraction de données a échoué:", invoiceResult.reason);
        }
        console.log('[DEBUG] 6. Traitement des résultats de l\'IA terminé.');

    } catch (error) {
        console.error('[DEBUG] ERREUR CATCH : Le traitement du document a échoué :', error);
        hadError = true;
    } finally {
        console.log('[DEBUG] 7. Entrée dans le bloc finally. hadError =', hadError);
        setIsAnalyzing(false); 

        if (hadError || !fileUrl) {
            toast({
                variant: 'destructive',
                title: "Le traitement a échoué",
                description: "Nous n'avons pas pu sauvegarder votre document. Veuillez réessayer."
            });
            handleOpenChange(false);
        } else {
            console.log('[DEBUG] 8. Création du nouveau document...');
            const aiCategory = (result.documentType && frenchCategories[result.documentType]) || 'Autre';
            const category = defaultCategory || aiCategory;

            const newDocument: Omit<Document, 'id' | 'createdAt'> = {
                name: formatDocumentName(result, docName),
                category: category,
                supplier: result.supplier,
                amount: result.amount,
                dueDate: result.dueDate,
                billingStartDate: result.billingStartDate,
                billingEndDate: result.billingEndDate,
                consumptionPeriod: result.consumptionPeriod,
                fileUrl: fileUrl,
            };
            
            console.log('[DEBUG] 9. Document créé, ajout en cours :', newDocument);
            addDocument({
                ...newDocument,
                id: `doc-${Date.now()}`,
                createdAt: new Date().toISOString(),
            });

            toast({
                title: "Document enregistré !",
                description: `Le document "${newDocument.name}" a été ajouté avec succès.`,
            });
            handleOpenChange(false);
        }
    }
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        const reader = new FileReader();
        reader.readAsDataURL(selectedFile);
        reader.onload = () => {
          const documentDataUri = reader.result as string;
          if (!documentDataUri) {
            toast({ variant: "destructive", title: "Erreur", description: "Impossible de lire le fichier." });
            return;
          }
          processDocument(documentDataUri, selectedFile.name);
        };
        event.target.value = ''; // Reset file input
    }
  };
  
  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if(context){
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUri = canvas.toDataURL('image/jpeg');
        processDocument(dataUri, `Capture-${new Date().toISOString()}.jpg`);
      }
    }
  };

  const handleFormChange = (field: keyof Document, value: string | number | undefined) => {
    setFormData(prev => ({...prev, [field]: value}));
  }

  const handleSave = () => {
    if (isEditMode && documentToEdit) {
      updateDocument(documentToEdit.id, formData);
      toast({
        title: "Document modifié !",
        description: `Le document "${formData.name || 'sélectionné'}" a été mis à jour.`,
      });
    }
    handleOpenChange(false);
  };

  const dialogTitle = isEditMode ? "Modifier le document" : "Ajouter un nouveau document";
  const dialogDescription = isEditMode 
    ? "Modifiez les informations de votre document ci-dessous." 
    : defaultCategory === 'Maison' 
      ? "Uploadez un document à archiver dans votre Espace Maison."
      : "Uploadez un fichier ou prenez une photo. Notre IA l'analysera pour vous.";

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {!isEditMode && (
          <DialogTrigger asChild>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg">
              <PlusCircle className="mr-2 h-4 w-4" />
              Ajouter un document
            </Button>
          </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[480px] rounded-lg">
        <DialogHeader>
          <DialogTitle className="font-headline">{dialogTitle}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        
        {!isEditMode && !isAnalyzing && (
            <Tabs defaultValue="file" className="w-full" onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="file">Fichier</TabsTrigger>
                <TabsTrigger value="camera">Appareil photo</TabsTrigger>
              </TabsList>
              <TabsContent value="file">
                 <div className="py-8">
                    <label htmlFor="file-upload" className={isAnalyzing ? 'cursor-not-allowed' : 'cursor-pointer'}>
                      <div className="flex flex-col items-center justify-center space-y-2 rounded-lg border-2 border-dashed border-muted-foreground/30 p-12 text-center transition hover:border-accent">
                        <UploadCloud className="h-12 w-12 text-muted-foreground" />
                        <p className="font-semibold">Cliquez ou glissez-déposez</p>
                        <p className="text-xs text-muted-foreground">PDF, PNG, JPG (max. 5MB)</p>
                      </div>
                    </label>
                    <Input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" disabled={isAnalyzing} />
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
                  <Button onClick={handleCapture} disabled={!hasCameraPermission || isAnalyzing} className="w-full">
                    <Camera className="mr-2 h-4 w-4" />
                    Capturer
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
        )}

        {isAnalyzing && (
          <div className="flex flex-col items-center justify-center space-y-4 py-12">
            <Loader2 className="h-16 w-16 animate-spin text-accent" />
            <p className="font-semibold text-lg">Analyse en cours...</p>
            {fileName ? (
                <p className="text-sm text-muted-foreground">{fileName}</p>
            ) : (
                <p className="text-sm text-muted-foreground italic">Chargement...</p>
            )}
            <Button variant="outline" onClick={() => setIsAnalyzing(false)}>
                Annuler
            </Button>
          </div>
        )}

        {isEditMode && (
          <>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto pr-4">
              <div className="space-y-2">
                <Label htmlFor="doc-name">Nom du document</Label>
                <Input id="doc-name" value={formData.name || ''} onChange={e => handleFormChange('name', e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-category">Catégorie</Label>
                  <Select value={formData.category || ''} onValueChange={(value) => handleFormChange('category', value)}>
                      <SelectTrigger id="doc-category" className="w-full">
                          <SelectValue placeholder="Sélectionnez une catégorie" />
                      </SelectTrigger>
                      <SelectContent>
                           <SelectItem value="STEG">STEG</SelectItem>
                           <SelectItem value="SONEDE">SONEDE</SelectItem>
                           <SelectItem value="Reçu Bancaire">Reçu Bancaire</SelectItem>
                           <SelectItem value="Maison">Maison</SelectItem>
                           <SelectItem value="Internet">Internet</SelectItem>
                           <SelectItem value="Autre">Autre</SelectItem>
                      </SelectContent>
                  </Select>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-supplier">Fournisseur</Label>
                  <Input id="doc-supplier" value={formData.supplier || ''} onChange={e => handleFormChange('supplier', e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-amount">Montant (TND)</Label>
                  <Input id="doc-amount" type="text" value={formData.amount || ''} onChange={e => handleFormChange('amount', e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-due-date">Date d'échéance (AAAA-MM-JJ)</Label>
                  <Input id="doc-due-date" type="text" value={formData.dueDate || ''} onChange={e => handleFormChange('dueDate', e.target.value)} />
              </div>
               <div className="space-y-2">
                  <Label htmlFor="doc-billing-start-date">Date de début de facturation (AAAA-MM-JJ)</Label>
                  <Input id="doc-billing-start-date" type="text" value={formData.billingStartDate || ''} onChange={e => handleFormChange('billingStartDate', e.target.value)} />
              </div>
               <div className="space-y-2">
                  <Label htmlFor="doc-billing-end-date">Date de fin de facturation (AAAA-MM-JJ)</Label>
                  <Input id="doc-billing-end-date" type="text" value={formData.billingEndDate || ''} onChange={e => handleFormChange('billingEndDate', e.target.value)} />
              </div>
               <div className="space-y-2">
                  <Label htmlFor="doc-consumption-period">Période de consommation (SONEDE)</Label>
                  <Input id="doc-consumption-period" type="text" value={formData.consumptionPeriod || ''} onChange={e => handleFormChange('consumptionPeriod', e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label htmlFor="doc-summary">Résumé</Label>
                  <Textarea id="doc-summary" value={formData.summary || ''} onChange={e => handleFormChange('summary', e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSave} className="bg-accent text-accent-foreground hover:bg-accent/90 rounded-lg">Enregistrer les modifications</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
