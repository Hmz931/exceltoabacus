import * as XLSX from 'xlsx';

export interface BankTransaction {
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  solde: number;
}

export interface ParsedBankData {
  transactions: BankTransaction[];
  fileName: string;
}

/**
 * Convert string value to float, handling Swiss number format (apostrophe as thousand separator)
 */
export const toFloat = (value: string | null | undefined): number => {
  if (!value) return 0.0;
  
  // Remove apostrophes (Swiss thousand separator) and replace comma with dot
  let cleaned = String(value).replace(/'/g, '').replace(',', '.');
  // Remove any non-numeric characters except minus and dot
  cleaned = cleaned.replace(/[^-0-9.]/g, '');
  
  try {
    const result = parseFloat(cleaned);
    return isNaN(result) ? 0.0 : result;
  } catch {
    return 0.0;
  }
};

/**
 * Parse PDF text content and extract bank transactions
 * Follows the same logic as the Python script
 */
export const parseTransactionsFromText = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const rows: string[][] = [];
  
  const lines = text.split('\n');
  let transactionLines: string[] = [];
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    if (datePattern.test(trimmedLine)) {
      if (transactionLines.length > 0) {
        rows.push([...transactionLines]);
      }
      transactionLines = [trimmedLine];
    } else if (transactionLines.length > 0) {
      transactionLines.push(trimmedLine);
    }
  }
  
  // Don't forget the last transaction
  if (transactionLines.length > 0) {
    rows.push(transactionLines);
  }
  
  // Parse structured data
  const structuredData: { date: string; texte: string; soldeNum: number }[] = [];
  
  for (const block of rows) {
    const firstLine = block[0];
    const dateParts = firstLine.split(/\s+/);
    const date = dateParts[0];
    
    // Extract balance at the end of the first line (last number with apostrophes)
    const balanceMatch = firstLine.match(/([\d',.-]+)$/);
    const balanceVal = balanceMatch ? toFloat(balanceMatch[1]) : 0.0;
    
    // Clean the first line: remove date and balance
    let firstLineClean = firstLine.replace(datePattern, '');
    firstLineClean = firstLineClean.replace(/([\d',.-]+)$/, '').trim();
    
    // Combine all text
    let fullText = firstLineClean;
    if (block.length > 1) {
      fullText += ' ' + block.slice(1).join(' ');
    }
    
    // Clean text: remove CHF mentions and extra spaces
    fullText = fullText.replace(/CHF/gi, '');
    fullText = fullText.replace(/\s+/g, ' ').trim();
    
    structuredData.push({
      date,
      texte: fullText,
      soldeNum: balanceVal
    });
  }
  
  // Calculate Delta (movement) and separate Debit/Credit
  const transactions: BankTransaction[] = [];
  
  for (let i = 0; i < structuredData.length; i++) {
    const row = structuredData[i];
    let delta: number | null = null;
    let debit: number | null = null;
    let credit: number | null = null;
    
    if (i > 0) {
      delta = row.soldeNum - structuredData[i - 1].soldeNum;
      
      if (delta < 0) {
        debit = Math.abs(delta);
      } else if (delta > 0) {
        credit = delta;
      }
    }
    
    transactions.push({
      date: row.date,
      description: row.texte,
      debit,
      credit,
      solde: row.soldeNum
    });
  }
  
  return transactions;
};

/**
 * Create Excel file from bank transactions
 */
export const createBankExcelFile = (data: BankTransaction[]): XLSX.WorkBook => {
  const exportData = data.map(row => ({
    'Date': row.date,
    'Description / Texte': row.description,
    'Débit (-)': row.debit,
    'Crédit (+)': row.credit,
    'Solde (CHF)': row.solde
  }));
  
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  
  // Set column widths for better readability
  worksheet['!cols'] = [
    { wch: 12 },  // Date
    { wch: 60 },  // Description
    { wch: 15 },  // Débit
    { wch: 15 },  // Crédit
    { wch: 15 }   // Solde
  ];
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relevé');
  
  return workbook;
};

/**
 * Download Excel file
 */
export const downloadBankExcelFile = (workbook: XLSX.WorkBook, filename: string = 'Releve_Bancaire.xlsx'): void => {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
