import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FileX, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

interface CamtFileUploadProps {
  onFilesLoaded: (files: File[]) => void;
  isProcessing?: boolean;
}

const CamtFileUpload: React.FC<CamtFileUploadProps> = ({ onFilesLoaded, isProcessing = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateFiles = (files: FileList | File[]): File[] => {
    const fileArray = Array.from(files);
    const validFiles: File[] = [];
    
    fileArray.forEach(file => {
      if (file.name.toLowerCase().endsWith('.xml')) {
        validFiles.push(file);
      } else {
        toast({
          title: "Fichier non supporté",
          description: `Le fichier "${file.name}" n'est pas un fichier XML.`,
          variant: "destructive",
        });
      }
    });
    
    if (validFiles.length === 0) {
      toast({
        title: "Aucun fichier XML valide",
        description: "Veuillez sélectionner au moins un fichier XML CAMT.",
        variant: "destructive",
      });
    }
    
    return validFiles;
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    const validFiles = validateFiles(files);
    
    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const validFiles = validateFiles(files);
      if (validFiles.length > 0) {
        setSelectedFiles(validFiles);
      }
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (indexToRemove: number) => {
    setSelectedFiles(files => files.filter((_, index) => index !== indexToRemove));
  };

  const processFiles = () => {
    if (selectedFiles.length > 0) {
      onFilesLoaded(selectedFiles);
    }
  };

  const clearFiles = () => {
    setSelectedFiles([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400'
            } ${isProcessing ? 'opacity-50 pointer-events-none' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center space-y-4">
              {isProcessing ? (
                <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-top-transparent rounded-full"></div>
              ) : (
                <Upload className="w-12 h-12 text-gray-400" />
              )}
              
              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {isProcessing ? 'Traitement en cours...' : 'Déposez vos fichiers CAMT XML ici'}
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Vous pouvez sélectionner plusieurs fichiers XML à la fois
                </p>
                
                <Button
                  onClick={handleButtonClick}
                  variant="outline"
                  disabled={isProcessing}
                  className="mb-4"
                >
                  Sélectionner les fichiers XML
                </Button>
                
                <p className="text-xs text-gray-500">
                  Formats supportés: .xml (CAMT.054)
                </p>
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml"
              multiple
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing}
            />
          </div>
        </CardContent>
      </Card>

      {selectedFiles.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium text-gray-900">
                Fichiers sélectionnés ({selectedFiles.length})
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={clearFiles}
                disabled={isProcessing}
              >
                Effacer tout
              </Button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                >
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm font-medium truncate max-w-xs">
                      {file.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={isProcessing}
                    className="h-6 w-6 p-0"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="mt-4 pt-4 border-t">
              <Button
                onClick={processFiles}
                disabled={isProcessing || selectedFiles.length === 0}
                className="w-full"
              >
                {isProcessing ? (
                  <span className="flex items-center">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-top-transparent rounded-full mr-2"></div>
                    Traitement en cours...
                  </span>
                ) : (
                  `Traiter ${selectedFiles.length} fichier${selectedFiles.length > 1 ? 's' : ''}`
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CamtFileUpload;