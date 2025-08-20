import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from 'xlsx';

interface XmlFileUploadProps {
  onFileLoaded: (workbook: XLSX.WorkBook, data: any[]) => void;
}

export function XmlFileUpload({ onFileLoaded }: XmlFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    setIsLoading(true);

    try {
      // Vérifier l'extension du fichier
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      if (!['xlsx', 'xls'].includes(fileExtension || '')) {
        throw new Error('Veuillez sélectionner un fichier Excel (.xlsx ou .xls)');
      }

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      if (workbook.SheetNames.length === 0) {
        throw new Error('Le fichier Excel ne contient aucune feuille');
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        throw new Error('La feuille Excel est vide');
      }

      // Vérifier les colonnes requises
      const requiredColumns = [
        'N° Facture', 'Date Facture', 'Client', 'Montant', 'Code TVA', 
        'TVA Incluse', 'Total à payer', 'Ligne', 'Compte', 'Centre de Coût', 'Libellé'
      ];
      
      const firstRow = jsonData[0] as Record<string, any>;
      const availableColumns = Object.keys(firstRow);
      const missingColumns = requiredColumns.filter(col => !availableColumns.includes(col));
      
      if (missingColumns.length > 0) {
        throw new Error(`Colonnes manquantes: ${missingColumns.join(', ')}`);
      }

      onFileLoaded(workbook, jsonData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du chargement du fichier');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />
          Importer fichier Excel
        </CardTitle>
        <CardDescription>
          Sélectionnez votre fichier Excel contenant les données de facturation à convertir en XML AbaConnect
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">
            {isLoading ? 'Chargement...' : 'Glissez votre fichier Excel ici'}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            ou cliquez pour sélectionner un fichier
          </p>
          <Button variant="outline" disabled={isLoading}>
            {isLoading ? 'Chargement...' : 'Choisir un fichier'}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 space-y-2">
          <h4 className="font-medium">Format attendu :</h4>
          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Colonnes requises :</strong> N° Facture, Date Facture, Client, Montant, Code TVA, TVA Incluse, Total à payer, Ligne, Compte, Centre de Coût, Libellé, Référence Paiement (optionnelle)</p>
            <p><strong>Codes TVA supportés :</strong> 511 (8,1%), 311 (8,1%), 400 (0%)</p>
            <p><strong>TVA Incluse :</strong> 'E' pour HT, autre valeur pour TTC</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}