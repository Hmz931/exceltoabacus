import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

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

const DebFactManager: React.FC = () => {
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [xmlContent, setXmlContent] = useState<string | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>('');
  const [status, setStatus] = useState<StatusType>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // VAT rates configuration (matching Python script's final values)
  const vatRates: Record<string, number> = {
    '511': 0.081,  // 8.1%
    '512': 0.026,  // 2.6%
    '311': 0.081,  // 8.1% (overwrites the 7.7% as in Python)
    '312': 0.025,  // 2.5%
    '400': 0.00,   // 0%
    '126': 0.00,   // 0%
    '200': 0.00    // 0%
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
      // Montant HT → calcul du TTC
      netAmount = montant;
      vatAmount = round(netAmount * vatRate);
      grossAmount = round(netAmount + vatAmount);
      tvaIncluseXML = '2';
      return { grossAmount, vatAmount: -vatAmount, tvaIncluseXML, netAmount };
    } else {
      // Montant TTC → extraction TVA (TVA incluse dans le montant)
      grossAmount = montant;
      netAmount = montant / (1 + vatRate);
      vatAmount = round(montant - netAmount);
      return { grossAmount, vatAmount: -vatAmount, tvaIncluseXML: '2', netAmount: round(netAmount) };
    }
  };

  const processExcelData = (data: any[]): ProcessedData => {
    // Calculate VAT and amounts for each row
    data.forEach((row: any) => {
      const vatCalc = calculateVAT(row);
      row.GrossAmount = vatCalc.grossAmount;
      row.VatAmount = vatCalc.vatAmount;
      row.TVAIncluseXML = vatCalc.tvaIncluseXML;
    });

    // Group by invoice number and adjust totals
    const invoices: Record<string, InvoiceRow[]> = {};
    data.forEach((row: any) => {
      const invoiceNo = String(row['N° Facture']);
      if (!invoices[invoiceNo]) {
        invoices[invoiceNo] = [];
      }
      invoices[invoiceNo].push(row);
    });

    // Adjust totals for each invoice
    Object.keys(invoices).forEach((invoiceNo: string) => {
      const group = invoices[invoiceNo];
      const totalAPayer = round(parseFloat(String(group[0]['Total à payer'])) || 0);
      const sumLines = round(group.reduce((sum, row) => sum + row.GrossAmount, 0));
      
      // Adjust last line if necessary
      if (Math.abs(totalAPayer - sumLines) > 0.005) {
        const lastIdx = group.length - 1;
        const lastRow = group[lastIdx];
        const vatCode = String(lastRow['Code TVA']);
        const vatRate = vatRates[vatCode] || 0.00;
        
        const otherLinesSum = group.slice(0, -1).reduce((sum, row) => sum + row.GrossAmount, 0);
        const adjustment = totalAPayer - otherLinesSum;
        
        group[lastIdx].GrossAmount = round(adjustment);
        
        // Recalculate VAT for adjusted line
        if (lastRow['TVA Incluse'] === 'E') {
          const netAmount = adjustment / (1 + vatRate);
          group[lastIdx].VatAmount = -round(netAmount * vatRate);
        } else {
          const netAmount = adjustment / (1 + vatRate);
          group[lastIdx].VatAmount = -round(adjustment - netAmount);
        }
      }
    });

    return { data, invoices };
  };

  const escapeXml = (unsafe: string): string => {
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
      
      // Format date
      let dateStr = String(firstRow['Date Facture']);
      let dateFormatted: string;
      
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/');
        dateFormatted = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      } else if (dateStr.includes('-')) {
        dateFormatted = dateStr.split(' ')[0];
      } else {
        // Excel date number
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
        xml += '          <Project>0</Project>\n';
        xml += '          <CreditCostCentre1>${row['Centre de Coût']}</CreditCostCentre1>\n';
        xml += '          <TaxMethod>1</TaxMethod>\n';
        xml += `          <TaxCode>${row['Code TVA']}</TaxCode>\n`;
        xml += `          <TaxIncluded>${row.TVAIncluseXML}</TaxIncluded>\n`;
        xml += `          <TaxAmount>${row.VatAmount.toFixed(2)}</TaxAmount>\n`;
        xml += `          <TaxDateValidFrom>${dateFormatted}</TaxDateValidFrom>\n`;
        xml += `          <Text>${escapeXml(textContent.substring(0, 80))}</Text>\n`;
        xml += '        </LineItem>\n';
        xml += `        <Reference>${escapeXml(textContent.substring(0, 60))}</Reference>\n`;
      });

      // Payment Term
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

      // Process data
      const processedData = processExcelData(jsonData);
      
      // Generate XML
      const xml = generateXML(processedData);
      setXmlContent(xml);
      
      setStatus('success');
      setStatusMessage('✓ Conversion réussie!');
      
      // Show statistics
      const invoiceCount = Object.keys(processedData.invoices).length;
      const lineCount = processedData.data.length;
      const totalAmount = Object.values(processedData.invoices).reduce((sum, group) => {
        return sum + group.reduce((s, row) => s + row.GrossAmount, 0);
      }, 0);

      setStats({ invoiceCount, lineCount, totalAmount });

    } catch (error) {
      setStatus('error');
      setStatusMessage('✗ Erreur: ' + (error as Error).message);
      console.error(error);
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

    setStatusMessage('✓ Fichier téléchargé avec succès!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'DM Sans', sans-serif;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .animate-fadeInUp {
          animation: fadeInUp 0.6s ease-out;
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div className="w-full max-w-2xl bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl p-10 animate-fadeInUp">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent" style={{ fontFamily: "'Playfair Display', serif" }}>
            Import Factures Débiteurs
          </h1>
          <p className="text-slate-600 text-sm">
            Convertissez vos fichiers Excel en format XML professionnel
          </p>
        </div>

        {/* Upload Area */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-3 border-dashed rounded-2xl p-12 text-center cursor-pointer
            transition-all duration-300 ease-in-out
            ${isDragging 
              ? 'border-purple-500 bg-purple-50 scale-105' 
              : 'border-purple-300 bg-gradient-to-br from-purple-50 to-pink-50 hover:border-purple-400 hover:bg-purple-100'
            }
          `}
        >
          <div className="text-6xl mb-4">📁</div>
          <div className="text-lg font-semibold text-slate-700 mb-2">
            Cliquez ou glissez votre fichier Excel ici
          </div>
          <div className="text-sm text-slate-500">
            Formats acceptés: .xlsx, .xls
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

        {/* File Info */}
        {currentFile && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl animate-fadeInUp">
            <div className="font-semibold text-green-700 mb-1">
              {currentFile.name}
            </div>
            <div className="text-sm text-green-600">
              Taille: {(currentFile.size / 1024).toFixed(2)} KB
            </div>
          </div>
        )}

        {/* Convert Button */}
        <button
          onClick={convertToXML}
          disabled={!currentFile || status === 'processing'}
          className={`
            w-full mt-6 py-4 rounded-xl font-bold text-lg
            transition-all duration-300 transform
            ${currentFile && status !== 'processing'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:scale-105 hover:shadow-2xl'
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }
          `}
        >
          {status === 'processing' ? 'Conversion en cours...' : 'Convertir en XML'}
        </button>

        {/* Download Button */}
        {xmlContent && (
          <button
            onClick={downloadXML}
            className="w-full mt-4 py-4 rounded-xl font-bold text-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:scale-105 hover:shadow-2xl transition-all duration-300 transform animate-fadeInUp"
          >
            📥 Télécharger le fichier XML
          </button>
        )}

        {/* Loader */}
        {status === 'processing' && (
          <div className="flex justify-center mt-6">
            <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
          </div>
        )}

        {/* Status Message */}
        {statusMessage && (
          <div className={`
            mt-6 p-4 rounded-xl text-center animate-fadeInUp
            ${status === 'processing' ? 'bg-yellow-50 border border-yellow-200 text-yellow-700' : ''}
            ${status === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : ''}
            ${status === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : ''}
          `}>
            {statusMessage}
          </div>
        )}

        {/* Statistics */}
        {stats && (
          <div className="mt-6 p-6 bg-slate-50 rounded-xl animate-fadeInUp">
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-600 font-medium">Nombre de factures:</span>
                <span className="font-bold text-slate-800 text-lg">{stats.invoiceCount}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                <span className="text-slate-600 font-medium">Nombre de lignes:</span>
                <span className="font-bold text-slate-800 text-lg">{stats.lineCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-medium">Montant total:</span>
                <span className="font-bold text-purple-600 text-lg">{stats.totalAmount.toFixed(2)} CHF</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DebFactManager;

