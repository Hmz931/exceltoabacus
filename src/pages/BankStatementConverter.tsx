import React, { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from '@/components/ui/separator';
import { 
  BankTransaction, 
  parseTransactionsFromText, 
  createBankExcelFile, 
  downloadBankExcelFile 
} from '@/utils/pdfBankUtils';
import { FileText, Download, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';

// Set the worker source for pdf.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

const BankStatementConverter: React.FC = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
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

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    return fullText;
  };

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    setStatus('idle');
    setTransactions([]);
    
    if (!file) {
      setError('Aucun fichier sélectionné');
      setIsLoading(false);
      return;
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Seuls les fichiers PDF sont acceptés');
      setIsLoading(false);
      return;
    }

    setFileName(file.name);

    try {
      // Extract text from PDF
      const text = await extractTextFromPDF(file);
      
      // Parse transactions
      const parsedTransactions = parseTransactionsFromText(text);
      
      if (parsedTransactions.length === 0) {
        throw new Error('Aucune transaction trouvée dans le PDF');
      }
      
      setTransactions(parsedTransactions);
      setStatus('success');
    } catch (err) {
      setError('Erreur lors du traitement du PDF: ' + (err as Error).message);
      setStatus('error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
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

  const handleDownload = () => {
    if (transactions.length === 0) return;
    
    const workbook = createBankExcelFile(transactions);
    const baseName = fileName?.replace('.pdf', '') || 'Releve';
    downloadBankExcelFile(workbook, `${baseName}_Converti.xlsx`);
  };

  const formatCurrency = (value: number | null): string => {
    if (value === null) return '';
    return new Intl.NumberFormat('fr-CH', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    }).format(value);
  };

  // Calculate totals
  const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
  const totalCredit = transactions.reduce((sum, t) => sum + (t.credit || 0), 0);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Convertisseur Relevé Bancaire PDF → Excel
          </h1>
          <p className="text-gray-600">
            Convertissez vos relevés bancaires PDF (format BCGE) en fichier Excel exploitable
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Charger un relevé bancaire PDF
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                accept=".pdf"
                className="hidden"
              />
              
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <FileText className="h-8 w-8 text-red-600" />
                </div>

                <div>
                  <p className="text-lg font-medium">Déposez votre relevé PDF ici</p>
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
                      Traitement en cours...
                    </span>
                  ) : 'Parcourir les fichiers'}
                </Button>
              </div>
            </div>

            {/* File status */}
            {fileName && status === 'success' && (
              <div className="mt-4 p-3 bg-green-50 rounded flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                  <span className="text-sm font-medium">{fileName}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({transactions.length} transactions extraites)
                  </span>
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <Separator className="my-6" />

            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Format supporté:</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Relevés bancaires BCGE (Banque Cantonale de Genève)</li>
                <li>• Format PDF avec dates au format JJ.MM.AAAA</li>
                <li>• Colonnes extraites: Date, Description, Débit, Crédit, Solde</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Results Table */}
        {transactions.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Aperçu des transactions</CardTitle>
              <Button onClick={handleDownload} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Télécharger Excel
              </Button>
            </CardHeader>
            <CardContent>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Transactions</p>
                  <p className="text-2xl font-bold">{transactions.length}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-red-600">Total Débits</p>
                  <p className="text-2xl font-bold text-red-700">
                    -{formatCurrency(totalDebit)} CHF
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-green-600">Total Crédits</p>
                  <p className="text-2xl font-bold text-green-700">
                    +{formatCurrency(totalCredit)} CHF
                  </p>
                </div>
              </div>

              {/* Table with scroll */}
              <div className="max-h-[500px] overflow-auto border rounded-lg">
                <Table>
                  <TableHeader className="sticky top-0 bg-white">
                    <TableRow>
                      <TableHead className="w-[100px]">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-[120px]">Débit (-)</TableHead>
                      <TableHead className="text-right w-[120px]">Crédit (+)</TableHead>
                      <TableHead className="text-right w-[120px]">Solde (CHF)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-sm">
                          {transaction.date}
                        </TableCell>
                        <TableCell className="max-w-md truncate" title={transaction.description}>
                          {transaction.description}
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-mono">
                          {transaction.debit ? formatCurrency(transaction.debit) : ''}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-mono">
                          {transaction.credit ? formatCurrency(transaction.credit) : ''}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCurrency(transaction.solde)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BankStatementConverter;
