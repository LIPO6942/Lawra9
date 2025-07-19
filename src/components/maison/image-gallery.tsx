
'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Document } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { MoreHorizontal, Edit, Trash2, Expand, Info, Loader2 } from 'lucide-react';
import { MaisonUploadDialog } from '../maison-upload-dialog';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useRouter } from 'next/navigation';

interface MaisonImageGalleryProps {
    images: Document[];
    onUpdate: (id: string, data: Partial<Document>) => void;
    onDelete: (id: string) => void;
}

export function MaisonImageGallery({ images, onUpdate, onDelete }: MaisonImageGalleryProps) {
    const router = useRouter();
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState<Document | null>(null);
    const [imageToDelete, setImageToDelete] = useState<Document | null>(null);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const openViewer = (docId?: string) => {
        if (docId) {
            router.push(`/view?id=${docId}`);
        }
    };

    const openEditor = (image: Document) => {
        setSelectedImage(image);
        setIsEditorOpen(true);
    };

    const confirmDelete = (image: Document) => {
        setImageToDelete(image);
        setIsDeleteAlertOpen(true);
    };
    
    const executeDelete = async () => {
        if (!imageToDelete) return;
        setIsDeleting(imageToDelete.id);
        await onDelete(imageToDelete.id);
        setIsDeleting(null);
        setIsDeleteAlertOpen(false);
        setImageToDelete(null);
    };


    if (images.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center text-center py-16 rounded-lg bg-muted/50 border-2 border-dashed">
                <Info className="h-10 w-10 text-muted-foreground mb-4" />
                <p className="font-semibold text-muted-foreground">Aucune image trouvée.</p>
                <p className="text-sm text-muted-foreground/80 mt-1">Archivez une image (PNG, JPG...) pour la voir ici.</p>
            </div>
        );
    }
    

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {images.map(image => (
                    <Card key={image.id} className="group relative overflow-hidden rounded-lg shadow-sm hover:shadow-xl transition-shadow duration-300">
                        <CardContent className="p-0">
                           <button onClick={() => openViewer(image.id)} className="w-full aspect-square relative block">
                                <Image
                                    src={image.fileUrl!}
                                    alt={image.name}
                                    layout="fill"
                                    objectFit="cover"
                                    className="transition-transform duration-300 group-hover:scale-110"
                                />
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
                           </button>
                           
                           <div className="absolute top-2 right-2">
                             {isDeleting === image.id ? (
                                    <Loader2 className="h-5 w-5 animate-spin text-white" />
                                ) : (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full bg-black/50 hover:bg-black/70 text-white border-none">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => openViewer(image.id)}>
                                            <Expand className="mr-2 h-4 w-4" />
                                            Agrandir
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => openEditor(image)}>
                                            <Edit className="mr-2 h-4 w-4" />
                                            Détails / Modifier
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onSelect={(e) => { e.preventDefault(); confirmDelete(image); }}>
                                            <Trash2 className="mr-2 h-4 w-4" />
                                            Supprimer
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                )}
                           </div>

                           <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                               <h3 className="text-white font-semibold text-sm truncate">{image.name}</h3>
                               <p className="text-white/80 text-xs">{image.createdAt ? format(parseISO(image.createdAt), 'd MMM yyyy', { locale: fr }) : ''}</p>
                           </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {selectedImage && (
                 <MaisonUploadDialog
                    open={isEditorOpen}
                    onOpenChange={setIsEditorOpen}
                    documentToEdit={selectedImage}
                />
            )}
            
            <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr ?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Cette action est irréversible. L'image "{imageToDelete?.name}" sera définitivement supprimée.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={executeDelete} disabled={!!isDeleting} className="bg-destructive hover:bg-destructive/90">
                        {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Supprimer
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
