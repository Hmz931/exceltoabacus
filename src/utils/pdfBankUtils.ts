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
  const dateInLinePattern = /\d{2}\.\d{2}\.\d{4}/g;
  const rows: string[][] = [];
  
  const lines = text.split('\n');
  let transactionLines: string[] = [];
  
  console.log('Nombre de lignes à analyser:', lines.length);
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Check if line starts with a date
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
  
  console.log('Blocs de transactions trouvés:', rows.length);
  if (rows.length > 0) {
    console.log('Premier bloc:', rows[0]);
  }
  
  // Parse structured data
  const structuredData: { date: string; texte: string; soldeNum: number }[] = [];
  
  for (const block of rows) {
    const firstLine = block[0];
    
    // Extract date from beginning of line
    const dateMatch = firstLine.match(datePattern);
    if (!dateMatch) continue;
    
    const date = dateMatch[0];
    
    // Extract all numbers that look like amounts (with apostrophes for thousands)
    const amountPattern = /[\d']+[.,]\d{2}(?!\d)/g;
    const amounts = firstLine.match(amountPattern) || [];
    
    // The last amount is typically the balance (Solde)
    const balanceVal = amounts.length > 0 ? toFloat(amounts[amounts.length - 1]) : 0.0;
    
    // Clean the first line: remove date and amounts for the description
    let firstLineClean = firstLine.replace(datePattern, '');
    // Remove all amounts from description
    amounts.forEach(amt => {
      firstLineClean = firstLineClean.replace(amt, '');
    });
    firstLineClean = firstLineClean.trim();
    
    // Combine all text from the block
    let fullText = firstLineClean;
    if (block.length > 1) {
      fullText += ' ' + block.slice(1).join(' ');
    }
    
    // Clean text: remove CHF mentions, extra spaces, and common patterns
    fullText = fullText.replace(/CHF/gi, '');
    fullText = fullText.replace(/\s+/g, ' ').trim();
    
    // Skip header lines or non-transaction entries
    if (fullText.toLowerCase().includes('solde') && fullText.toLowerCase().includes('date')) continue;
    if (fullText.toLowerCase().includes('relevé de compte')) continue;
    if (!fullText || fullText.length < 3) continue;
    
    structuredData.push({
      date,
      texte: fullText,
      soldeNum: balanceVal
    });
  }
  
  console.log('Transactions structurées:', structuredData.length);
  if (structuredData.length > 0) {
    console.log('Première transaction:', structuredData[0]);
  }
  
  // Calculate Delta (movement) and separate Debit/Credit
  const transactions: BankTransaction[] = [];
  
  for (let i = 0; i < structuredData.length; i++) {
    const row = structuredData[i];
    let debit: number | null = null;
    let credit: number | null = null;
    
    if (i > 0) {
      const delta = row.soldeNum - structuredData[i - 1].soldeNum;
      
      // Round to 2 decimals to avoid floating point issues
      const roundedDelta = Math.round(delta * 100) / 100;
      
      if (roundedDelta < 0) {
        debit = Math.abs(roundedDelta);
      } else if (roundedDelta > 0) {
        credit = roundedDelta;
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
