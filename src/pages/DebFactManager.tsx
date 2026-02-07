import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Upload, Download, FileText, CheckCircle2, AlertCircle, Loader2, Info } from 'lucide-react';

// Type definitions
interface InvoiceRow {
  'N° Facture': string | number;
  'Date Facture': string | number;
  'Client': string | number;
  'Ligne': number;
  'Montant': number;
  'Code TVA': string | number;
  'TVA Incluse': string;
  'Total à payer': number;
  'Référence Paiement': string;
  'Compte': string | number;
  'Centre de Coût': string | number;
  'Libellé': string;
  GrossAmount: number;
  VatAmount: number;
  TVAIncluseXML: string;
}

interface ProcessedData {
  data: InvoiceRow[];
  invoices: Record<string, InvoiceRow[]>;
}

interface Stats {
  invoiceCount: number;
  lineCount: number;
  totalAmount: number;
}

type StatusType = 'idle' | 'processing' | 'success' | 'error';

// VAT rates configuration
const vatRates: Record<string, number> = {
  '511': 0.081,
  '512': 0.026,
  '311': 0.081,
  '312': 0.025,
  '400': 0.00,
  '126': 0.00,
  '200': 0.00,
};

const round = (num: number, decimals: number = 2): number => {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
};

const calculateVAT = (row: Partial<InvoiceRow>) => {
  const vatCode = String(row['Code TVA']);
  const vatRate = vatRates[vatCode] || 0.00;
  const montant = parseFloat(String(row['Montant'])) || 0;

  let grossAmount: number, vatAmount: number, tvaIncluseXML: string, netAmount: number;

  if (row['TVA Incluse'] === 'E') {
    netAmount = montant;
    vatAmount = round(netAmount * vatRate);
    grossAmount = round(netAmount + vatAmount);
    tvaIncluseXML = '2';
    return { grossAmount, vatAmount: -vatAmount, tvaIncluseXML, netAmount };
  } else {
    grossAmount = montant;
    netAmount = montant / (1 + vatRate);
    vatAmount = round(montant - netAmount);
    return { grossAmount, vatAmount: -vatAmount, tvaIncluseXML: '2', netAmount: round(netAmount) };
  }
};

const processExcelData = (data: any[]): ProcessedData => {
  data.forEach((row: any) => {
    const vatCalc = calculateVAT(row);
    row.GrossAmount = vatCalc.grossAmount;
    row.VatAmount = vatCalc.vatAmount;
    row.TVAIncluseXML = vatCalc.tvaIncluseXML;
  });

  const invoices: Record<string, InvoiceRow[]> = {};
  data.forEach((row: any) => {
    const invoiceNo = String(row['N° Facture']);
    if (!invoices[invoiceNo]) {
      invoices[invoiceNo] = [];
    }
    invoices[invoiceNo].push(row);
  });

  Object.keys(invoices).forEach((invoiceNo: string) => {
    const group = invoices[invoiceNo];
    const totalAPayer = round(parseFloat(String(group[0]['Total à payer'])) || 0);
    const sumLines = round(group.reduce((sum, row) => sum + row.GrossAmount, 0));

    if (Math.abs(totalAPayer - sumLines) > 0.005) {
      const lastIdx = group.length - 1;
      const lastRow = group[lastIdx];
      const vatCode = String(lastRow['Code TVA']);
      const vatRate2 = vatRates[vatCode] || 0.00;

      const otherLinesSum = group.slice(0, -1).reduce((sum, row) => sum + row.GrossAmount, 0);
      const adjustment = totalAPayer - otherLinesSum;

      group[lastIdx].GrossAmount = round(adjustment);

      if (lastRow['TVA Incluse'] === 'E') {
        const netAmount = adjustment / (1 + vatRate2);
        group[lastIdx].VatAmount = -round(netAmount * vatRate2);
      } else {
        const netAmount = adjustment / (1 + vatRate2);
        group[lastIdx].VatAmount = -round(adjustment - netAmount);
      }
    }
  });

  return { data, invoices };
};

const escapeXml = (unsafe: string): string => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const generateXML = (processedData: ProcessedData): string => {
  const { invoices } = processedData;

  let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
  xml += '<AbaConnectContainer>\n';
  xml += '  <Task>\n';
  xml += '    <Parameter>\n';
  xml += '      <Application>DEBI</Application>\n';
  xml += '      <Id>Belege</Id>\n';
  xml += '      <MapId>AbaDefault</MapId>\n';
  xml += '      <Version>2015.00</Version>\n';
  xml += '    </Parameter>\n';
  xml += '    <Transaction id="1">\n';

  let uniqueRefCounter = 1;

  Object.keys(invoices).forEach((invoiceNo: string) => {
    const group = invoices[invoiceNo];
    const firstRow = group[0];

    let dateStr = String(firstRow['Date Facture']);
    let dateFormatted: string;

    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      dateFormatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    } else if (dateStr.includes('-')) {
      dateFormatted = dateStr.split(' ')[0];
    } else {
      const excelDate = parseFloat(dateStr);
      if (!isNaN(excelDate)) {
        const date = new Date((excelDate - 25569) * 86400 * 1000);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        dateFormatted = `${year}-${month}-${day}`;
      } else {
        dateFormatted = new Date().toISOString().split('T')[0];
      }
    }

    const amountTotal = round(group.reduce((sum, row) => sum + row.GrossAmount, 0));
    const paymentRef = firstRow['Référence Paiement'] || '';

    xml += '      <Document mode="SAVE">\n';
    xml += '        <DocumentCode>F</DocumentCode>\n';
    xml += `        <CustomerNumber>${firstRow['Client']}</CustomerNumber>\n`;
    xml += '        <Number />\n';
    xml += `        <UniqueReference>${uniqueRefCounter}</UniqueReference>\n`;
    xml += `        <AccountReceivableDate>${dateFormatted}</AccountReceivableDate>\n`;
    xml += `        <GeneralLedgerDate>${dateFormatted}</GeneralLedgerDate>\n`;
    xml += `        <DispositionDate>${dateFormatted}</DispositionDate>\n`;
    xml += '        <Currency>CHF</Currency>\n';
    xml += `        <Amount>${amountTotal.toFixed(2)}</Amount>\n`;
    xml += `        <KeyAmount>${amountTotal.toFixed(2)}</KeyAmount>\n`;
    xml += '        <ReminderProcedure>NORM</ReminderProcedure>\n';
    xml += '        <GroupNumber1>0</GroupNumber1>\n';
    xml += '        <NoTax>false</NoTax>\n';
    xml += `        <PaymentReferenceLine>${paymentRef}</PaymentReferenceLine>\n`;
    xml += '        <CollectiveAccount>1100</CollectiveAccount>\n';

    group.forEach((row: InvoiceRow) => {
      const textContent = String(row['Libellé'] || '');
      xml += '        <LineItem mode="SAVE">\n';
      xml += `          <Number>${parseInt(String(row['Ligne']))}</Number>\n`;
      xml += `          <Amount>${row.GrossAmount.toFixed(2)}</Amount>\n`;
      xml += `          <KeyAmount>${row.GrossAmount.toFixed(2)}</KeyAmount>\n`;
      xml += `          <CreditAccount>${row['Compte']}</CreditAccount>\n`;
      xml += `          <Project>0</Project>\n`;
      xml += `          <CreditCostCentre1>${row['Centre de Coût'] || '0'}</CreditCostCentre1>\n`;
      xml += `          <TaxMethod>1</TaxMethod>\n`;
      xml += `          <TaxCode>${row['Code TVA']}</TaxCode>\n`;
      xml += `          <TaxIncluded>${row.TVAIncluseXML}</TaxIncluded>\n`;
      xml += `          <TaxAmount>${row.VatAmount.toFixed(2)}</TaxAmount>\n`;
      xml += `          <TaxDateValidFrom>${dateFormatted}</TaxDateValidFrom>\n`;
      xml += `          <Text>${escapeXml(textContent.substring(0, 80))}</Text>\n`;
      xml += '        </LineItem>\n';
    });

    const referenceText = String(firstRow['Libellé'] || '').substring(0, 60);
    xml += `        <Reference>${escapeXml(referenceText)}</Reference>\n`;

    xml += '        <PaymentTerm mode="SAVE">\n';
    xml += '          <Number>1</Number>\n';
    xml += '          <CopyFromTable>true</CopyFromTable>\n';
    xml += '          <Type>0</Type>\n';
    xml += '          <PartialPaymentMonthly>false</PartialPaymentMonthly>\n';
    xml += '          <NumberOfPartialPayments>0</NumberOfPartialPayments>\n';
    xml += '          <DeadlineInDays>0</DeadlineInDays>\n';
    xml += '          <DiscountDays1>0</DiscountDays1>\n';
    xml += '          <DiscountPercentage1>0.00</DiscountPercentage1>\n';
    xml += '          <DiscountDays2>0</DiscountDays2>\n';
    xml += '          <DiscountPercentage2>0.00</DiscountPercentage2>\n';
    xml += '          <DiscountDays3>0</DiscountDays3>\n';
    xml += '          <DiscountPercentage3>0.00</DiscountPercentage3>\n';
    xml += '          <PartialPaymentTerm mode="SAVE">\n';
    xml += '            <Number>0</Number>\n';
    xml += '            <DeadlineInDays>0</DeadlineInDays>\n';
    xml += '            <DiscountDays>0</DiscountDays>\n';
    xml += '            <DiscountPercentage>0.00</DiscountPercentage>\n';
    xml += '            <AmountInPercentage>0.00</AmountInPercentage>\n';
    xml += '            <Amount>0.00</Amount>\n';
    xml += '          </PartialPaymentTerm>\n';
    xml += '        </PaymentTerm>\n';
    xml += '      </Document>\n';

    uniqueRefCounter++;
  });

  xml += '    </Transaction>\n';
  xml += '  </Task>\n';
  xml += '</AbaConnectContainer>';

  return xml;
};

const DebFactManager: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>('');
  const [status, setStatus] = useState<StatusType>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      setStatus('error');
      setStatusMessage('Format de fichier non valide. Veuillez sélectionner un fichier Excel (.xlsx ou .xls)');
      return;
    }

    setCurrentFile(file);
    setOutputFileName(file.name.replace(/\.(xlsx|xls)$/i, '.xml'));
    setXmlContent(null);
    setStats(null);
    setStatus('idle');
    setStatusMessage('');
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  const convertToXML = async () => {
    if (!currentFile) return;

    setStatus('processing');
    setStatusMessage('Traitement du fichier en cours...');

    try {
      const arrayBuffer = await currentFile.arrayBuffer();
      const data = new Uint8Array(arrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet);

      if (jsonData.length === 0) {
        throw new Error('Le fichier Excel est vide');
      }

      console.log('Colonnes disponibles:', Object.keys(jsonData[0] || {}));

      const processedData = processExcelData(jsonData);

      const firstInvoiceKey = Object.keys(processedData.invoices)[0];
      if (firstInvoiceKey) {
        console.log('Première facture - valeurs Centre de Coût:');
        processedData.invoices[firstInvoiceKey].forEach((row, index) => {
          console.log(`Ligne ${index}: Centre de Coût = "${row['Centre de Coût']}"`);
        });
      }

      const xml = generateXML(processedData);
      setXmlContent(xml);

      console.log('Aperçu XML généré:');
      console.log(xml.substring(xml.indexOf('<LineItem'), xml.indexOf('<LineItem') + 1000));

      setStatus('success');
      setStatusMessage('Conversion réussie !');

      const invoiceCount = Object.keys(processedData.invoices).length;
      const lineCount = processedData.data.length;
      const totalAmount = Object.values(processedData.invoices).reduce((sum, group) => {
        return sum + group.reduce((s, row) => s + row.GrossAmount, 0);
      }, 0);

      setStats({ invoiceCount, lineCount, totalAmount });
    } catch (error) {
      setStatus('error');
      setStatusMessage('Erreur: ' + (error as Error).message);
      console.error('Erreur détaillée:', error);
    }
  };

  const downloadXML = () => {
    if (!xmlContent) return;

    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Import Factures Débiteurs
          </h1>
          <p className="text-gray-600">
            Convertissez vos fichiers Excel en format XML AbaConnect
          </p>
        </div>

        {/* Upload Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Charger un fichier Excel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'bg-blue-50 border-blue-500'
                  : 'border-gray-300 hover:border-blue-400'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-medium">Cliquez ou glissez votre fichier Excel ici</p>
                  <p className="text-sm text-gray-500 mt-1">Formats acceptés : .xlsx, .xls</p>
                </div>
              </div>
            </div>

            {/* File info */}
            {currentFile && (
              <div className="mt-4 p-3 bg-green-50 rounded flex items-center">
                <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                <div>
                  <span className="text-sm font-medium">{currentFile.name}</span>
                  <span className="text-sm text-gray-500 ml-2">
                    ({(currentFile.size / 1024).toFixed(2)} KB)
                  </span>
                </div>
              </div>
            )}

            {/* Status messages */}
            {status === 'error' && statusMessage && (
              <div className="mt-4 p-3 bg-red-50 text-red-700 rounded flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{statusMessage}</span>
              </div>
            )}

            {status === 'success' && statusMessage && (
              <div className="mt-4 p-3 bg-green-50 text-green-700 rounded flex items-center">
                <CheckCircle2 className="h-5 w-5 mr-2 flex-shrink-0" />
                <span className="text-sm">{statusMessage}</span>
              </div>
            )}

            <Separator className="my-6" />

            {/* Instructions */}
            <div className="bg-blue-50 p-4 rounded-md">
              <h3 className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Format Excel requis
              </h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Colonnes obligatoires : <span className="font-mono text-xs bg-blue-100 px-1 rounded">N° Facture</span>, <span className="font-mono text-xs bg-blue-100 px-1 rounded">Date Facture</span>, <span className="font-mono text-xs bg-blue-100 px-1 rounded">Client</span>, <span className="font-mono text-xs bg-blue-100 px-1 rounded">Montant</span></li>
                <li>• Colonne <span className="font-mono text-xs bg-blue-100 px-1 rounded">Centre de Coût</span> doit être présente</li>
                <li>• Codes TVA supportés : 511, 512, 311, 312, 400, 126, 200</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            onClick={convertToXML}
            disabled={!currentFile || status === 'processing'}
            className="flex-1"
            size="lg"
          >
            {status === 'processing' ? (
              <span className="flex items-center">
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Conversion en cours...
              </span>
            ) : (
              'Convertir en XML'
            )}
          </Button>

          {xmlContent && (
            <Button
              onClick={downloadXML}
              variant="outline"
              className="flex-1 flex items-center gap-2"
              size="lg"
            >
              <Download className="h-4 w-4" />
              Télécharger {outputFileName}
            </Button>
          )}
        </div>

        {/* Statistics */}
        {stats && (
          <Card>
            <CardHeader>
              <CardTitle>Résumé de la conversion</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Factures</p>
                  <p className="text-2xl font-bold">{stats.invoiceCount}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-gray-500">Lignes</p>
                  <p className="text-2xl font-bold">{stats.lineCount}</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-sm text-blue-600">Montant total</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {stats.totalAmount.toFixed(2)} CHF
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DebFactManager;
