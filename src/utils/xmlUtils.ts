import * as XLSX from 'xlsx';

interface ExcelRowData {
  'N° Facture': string;
  'Date Facture': string;
  'Client': string;
  'Montant': number;
  'Code TVA': string;
  'TVA Incluse': string;
  'Total à payer': number;
  'Référence Paiement': string;
  'Ligne': number;
  'Compte': string;
  'Centre de Coût': string;
  'Libellé': string;
}

interface ProcessedRowData extends ExcelRowData {
  GrossAmount: number;
  VatAmount: number;
  TVAIncluseXML: string;
}

const VAT_RATES: Record<string, number> = {
  '511': 0.081, // 8.1%
  '311': 0.081, // 8.1%
  '400': 0.00   // 0%
};

function roundToTwo(num: number): number {
  return Math.round(num * 100) / 100;
}

function calculateVAT(row: ExcelRowData): { grossAmount: number; vatAmount: number; tvaIncluseXML: string } {
  const vatRate = VAT_RATES[String(row['Code TVA'])] || 0.00;
  const montant = row['Montant'];
  
  if (row['TVA Incluse'] === 'E') {
    // Montant HT → calcul du TTC
    const vatAmount = roundToTwo(montant * vatRate);
    const grossAmount = roundToTwo(montant + vatAmount);
    return { grossAmount, vatAmount: -vatAmount, tvaIncluseXML: '2' };
  } else {
    // Montant TTC → extraction TVA
    const vatAmount = roundToTwo(montant * vatRate / (1 + vatRate));
    return { grossAmount: montant, vatAmount: -vatAmount, tvaIncluseXML: '2' };
  }
}

function groupByInvoice(data: ProcessedRowData[]): Map<string, ProcessedRowData[]> {
  const grouped = new Map<string, ProcessedRowData[]>();
  
  data.forEach(row => {
    const invoiceNo = row['N° Facture'];
    if (!grouped.has(invoiceNo)) {
      grouped.set(invoiceNo, []);
    }
    grouped.get(invoiceNo)!.push(row);
  });
  
  return grouped;
}

function adjustTotals(grouped: Map<string, ProcessedRowData[]>): void {
  grouped.forEach((group, invoiceNo) => {
    const totalAPayer = roundToTwo(group[0]['Total à payer']);
    const sumLines = roundToTwo(group.reduce((sum, row) => sum + row.GrossAmount, 0));
    
    // Ajustement automatique de la dernière ligne
    if (Math.abs(totalAPayer - sumLines) > 0.01) {
      const lastRow = group[group.length - 1];
      const adjustment = roundToTwo(totalAPayer - (sumLines - lastRow.GrossAmount));
      lastRow.GrossAmount = adjustment;
      
      // Recalcul précis de la TVA
      const vatRate = VAT_RATES[String(lastRow['Code TVA'])] || 0.00;
      if (lastRow['TVA Incluse'] === 'E') {
        const netAmount = adjustment / (1 + vatRate);
        lastRow.VatAmount = -roundToTwo(netAmount * vatRate);
      } else {
        lastRow.VatAmount = -roundToTwo(adjustment * vatRate / (1 + vatRate));
      }
    }
  });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
}

function generateXML(grouped: Map<string, ProcessedRowData[]>): string {
  const doc = document.implementation.createDocument(null, null, null);
  
  const root = doc.createElement('AbaConnectContainer');
  doc.appendChild(root);
  
  const task = doc.createElement('Task');
  root.appendChild(task);
  
  const parameter = doc.createElement('Parameter');
  task.appendChild(parameter);
  
  const createElement = (parent: Element, tagName: string, textContent?: string) => {
    const element = doc.createElement(tagName);
    if (textContent !== undefined) {
      element.textContent = textContent;
    }
    parent.appendChild(element);
    return element;
  };
  
  createElement(parameter, 'Application', 'DEBI');
  createElement(parameter, 'Id', 'Belege');
  createElement(parameter, 'MapId', 'AbaDefault');
  createElement(parameter, 'Version', '2015.00');
  
  const transaction = doc.createElement('Transaction');
  transaction.setAttribute('id', '1');
  task.appendChild(transaction);
  
  let uniqueRefCounter = 1;
  
  grouped.forEach((group, invoiceNo) => {
    const docElement = doc.createElement('Document');
    docElement.setAttribute('mode', 'SAVE');
    transaction.appendChild(docElement);
    
    const dateStr = group[0]['Date Facture'];
    const dateFormatted = formatDate(dateStr);
    const amountTotal = roundToTwo(group[0]['Total à payer']);
    
    createElement(docElement, 'DocumentCode', 'F');
    createElement(docElement, 'CustomerNumber', String(group[0]['Client']));
    createElement(docElement, 'Number', '');
    createElement(docElement, 'UniqueReference', String(uniqueRefCounter));
    createElement(docElement, 'AccountReceivableDate', dateFormatted);
    createElement(docElement, 'GeneralLedgerDate', dateFormatted);
    createElement(docElement, 'DispositionDate', dateFormatted);
    createElement(docElement, 'Currency', 'CHF');
    createElement(docElement, 'Amount', amountTotal.toFixed(2));
    createElement(docElement, 'KeyAmount', amountTotal.toFixed(2));
    createElement(docElement, 'ReminderProcedure', 'NORM');
    createElement(docElement, 'GroupNumber1', '0');
    createElement(docElement, 'NoTax', 'false');
    
    const paymentRef = group[0]['Référence Paiement'];
    const paymentRefElement = createElement(docElement, 'PaymentReferenceLine');
    if (paymentRef && String(paymentRef).trim() !== '' && String(paymentRef) !== 'undefined') {
      paymentRefElement.textContent = String(paymentRef);
    }
    
    createElement(docElement, 'CollectiveAccount', '1100');
    
    group.forEach(row => {
      const line = doc.createElement('LineItem');
      line.setAttribute('mode', 'SAVE');
      docElement.appendChild(line);
      
      createElement(line, 'Number', String(row['Ligne']));
      createElement(line, 'Amount', row.GrossAmount.toFixed(2));
      createElement(line, 'KeyAmount', row.GrossAmount.toFixed(2));
      createElement(line, 'CreditAccount', String(row['Compte']));
      createElement(line, 'Project', '0');
      createElement(line, 'CreditCostCentre1', String(row['Centre de Coût']));
      createElement(line, 'CreditCostCentre2', '0');
      createElement(line, 'TaxMethod', '1');
      createElement(line, 'TaxCode', String(row['Code TVA']));
      createElement(line, 'TaxIncluded', row.TVAIncluseXML);
      createElement(line, 'TaxAmount', row.VatAmount.toFixed(2));
      createElement(line, 'TaxDateValidFrom', dateFormatted);
      
      const textContent = String(row['Libellé']);
      createElement(line, 'Text', textContent.substring(0, 80));
    });
    
    // Reference element (use first row's libellé)
    createElement(docElement, 'Reference', String(group[0]['Libellé']).substring(0, 60));
    
    // PaymentTerm section
    const paymentTerm = doc.createElement('PaymentTerm');
    paymentTerm.setAttribute('mode', 'SAVE');
    docElement.appendChild(paymentTerm);
    
    createElement(paymentTerm, 'Number', '1');
    createElement(paymentTerm, 'CopyFromTable', 'true');
    createElement(paymentTerm, 'Type', '0');
    createElement(paymentTerm, 'PartialPaymentMonthly', 'false');
    createElement(paymentTerm, 'NumberOfPartialPayments', '0');
    createElement(paymentTerm, 'DeadlineInDays', '0');
    createElement(paymentTerm, 'DiscountDays1', '0');
    createElement(paymentTerm, 'DiscountPercentage1', '0.00');
    createElement(paymentTerm, 'DiscountDays2', '0');
    createElement(paymentTerm, 'DiscountPercentage2', '0.00');
    createElement(paymentTerm, 'DiscountDays3', '0');
    createElement(paymentTerm, 'DiscountPercentage3', '0.00');
    
    const partialPayment = doc.createElement('PartialPaymentTerm');
    partialPayment.setAttribute('mode', 'SAVE');
    paymentTerm.appendChild(partialPayment);
    
    createElement(partialPayment, 'Number', '0');
    createElement(partialPayment, 'DeadlineInDays', '0');
    createElement(partialPayment, 'DiscountDays', '0');
    createElement(partialPayment, 'DiscountPercentage', '0.00');
    createElement(partialPayment, 'AmountInPercentage', '0.00');
    createElement(partialPayment, 'Amount', '0.00');
    
    uniqueRefCounter++;
  });
  
  const serializer = new XMLSerializer();
  let xmlString = serializer.serializeToString(doc);
  
  // Add XML declaration
  xmlString = '<?xml version="1.0" encoding="utf-8"?>\n' + xmlString;
  
  return xmlString;
}

export function convertExcelToXML(workbook: XLSX.WorkBook): { xml: string; summary: { totalInvoices: number; totalAmount: number } } {
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData: ExcelRowData[] = XLSX.utils.sheet_to_json(worksheet);
  
  // Process data with VAT calculations
  const processedData: ProcessedRowData[] = jsonData.map(row => {
    const { grossAmount, vatAmount, tvaIncluseXML } = calculateVAT(row);
    return {
      ...row,
      GrossAmount: grossAmount,
      VatAmount: vatAmount,
      TVAIncluseXML: tvaIncluseXML
    };
  });
  
  // Group by invoice and adjust totals
  const grouped = groupByInvoice(processedData);
  adjustTotals(grouped);
  
  // Generate XML
  const xml = generateXML(grouped);
  
  // Calculate summary
  const totalInvoices = grouped.size;
  const totalAmount = Array.from(grouped.values()).reduce((sum, group) => {
    return sum + group[0]['Total à payer'];
  }, 0);
  
  return {
    xml,
    summary: {
      totalInvoices: Math.round(totalInvoices),
      totalAmount: roundToTwo(totalAmount)
    }
  };
}

export function downloadXMLFile(xmlContent: string, filename: string = 'AbaConnect_Export.xml'): void {
  const blob = new Blob([xmlContent], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}