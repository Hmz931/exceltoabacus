
import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { validateHeaders, requiredHeaders } from '@/utils/excelUtils';
import { Separator } from '@/components/ui/separator';

interface FileUploadProps {
  onFileLoaded: (workbook: XLSX.WorkBook, jsonData: any[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const processFile = (file: File) => {
    setIsLoading(true);
    setError(null);
    
    if (!file) {
      setError('Aucun fichier sélectionné');
      setIsLoading(false);
      return;
    }

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      setError('Seuls les fichiers Excel (.xlsx, .xls) sont acceptés');
      setIsLoading(false);
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (!e.target?.result) {
          throw new Error('Erreur de lecture du fichier');
        }
        
        const data = new Uint8Array(e.target.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error('Fichier Excel vide');
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] as string[];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const missingHeaders = validateHeaders(headers);
        
        if (missingHeaders.length > 0) {
          setError(`Colonnes manquantes : ${missingHeaders.join(", ")}`);
          setIsLoading(false);
          return;
        }
        
        onFileLoaded(workbook, jsonData);
        setIsLoading(false);
      } catch (err) {
        setError('Erreur de traitement du fichier Excel');
        console.error(err);
        setIsLoading(false);
      }
    };
    
    reader.onerror = () => {
      setError('Erreur de lecture du fichier');
      setIsLoading(false);
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            isDragging ? 'bg-blue-50 border-blue-500' : 'border-gray-300 hover:border-blue-400'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".xlsx,.xls"
            className="hidden"
            id="fileInput"
          />
          
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-8 w-8 text-blue-600" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" 
                />
              </svg>
            </div>

            <div>
              <p className="text-lg font-medium">Déposez votre fichier Excel ici</p>
              <p className="text-sm text-gray-500 mt-1">ou</p>
            </div>

            <Button 
              type="button" 
              onClick={handleButtonClick}
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Chargement...
                </span>
              ) : 'Parcourir les fichiers'}
            </Button>
          </div>
        </div>

        {fileName && (
          <div className="mt-4 p-3 bg-gray-50 rounded flex items-center justify-between animate-fade-in">
            <div className="flex items-center">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 text-green-500 mr-2" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium truncate max-w-xs">{fileName}</span>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded animate-fade-in">
            <div className="flex">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5 mr-2" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        <Separator className="my-6" />

        <div className="bg-blue-50 p-4 rounded-md">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Colonnes requises:</h3>
          <div className="flex flex-wrap gap-2">
            {requiredHeaders.map(header => (
              <span key={header} className="bg-white text-blue-700 text-xs px-2 py-1 rounded border border-blue-200">
                {header}
              </span>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;
