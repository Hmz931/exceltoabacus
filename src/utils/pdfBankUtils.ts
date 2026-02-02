import * as XLSX from 'xlsx';

export type BankType = 'bcge' | 'raiffeisen' | 'ubs';

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

export const BANK_OPTIONS: { value: BankType; label: string }[] = [
  { value: 'bcge', label: 'BCGE (Banque Cantonale de Genève)' },
  { value: 'raiffeisen', label: 'Raiffeisen' },
  { value: 'ubs', label: 'UBS' }
];

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
 * Parse BCGE PDF text content and extract bank transactions
 */
export const parseBCGETransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const rows: string[][] = [];
  
  const lines = text.split('\n');
  let transactionLines: string[] = [];
  
  console.log('[BCGE] Nombre de lignes à analyser:', lines.length);
  
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
  
  if (transactionLines.length > 0) {
    rows.push(transactionLines);
  }
  
  console.log('[BCGE] Blocs de transactions trouvés:', rows.length);
  
  const structuredData: { date: string; texte: string; soldeNum: number }[] = [];
  
  for (const block of rows) {
    const firstLine = block[0];
    const dateMatch = firstLine.match(datePattern);
    if (!dateMatch) continue;
    
    const date = dateMatch[0];
    const amountPattern = /[\d']+[.,]\d{2}(?!\d)/g;
    const amounts = firstLine.match(amountPattern) || [];
    const balanceVal = amounts.length > 0 ? toFloat(amounts[amounts.length - 1]) : 0.0;
    
    let firstLineClean = firstLine.replace(datePattern, '');
    amounts.forEach(amt => {
      firstLineClean = firstLineClean.replace(amt, '');
    });
    firstLineClean = firstLineClean.trim();
    
    let fullText = firstLineClean;
    if (block.length > 1) {
      fullText += ' ' + block.slice(1).join(' ');
    }
    
    fullText = fullText.replace(/CHF/gi, '');
    fullText = fullText.replace(/\s+/g, ' ').trim();
    
    if (fullText.toLowerCase().includes('solde') && fullText.toLowerCase().includes('date')) continue;
    if (fullText.toLowerCase().includes('relevé de compte')) continue;
    if (!fullText || fullText.length < 3) continue;
    
    structuredData.push({ date, texte: fullText, soldeNum: balanceVal });
  }
  
  console.log('[BCGE] Transactions structurées:', structuredData.length);
  
  const transactions: BankTransaction[] = [];
  
  for (let i = 0; i < structuredData.length; i++) {
    const row = structuredData[i];
    let debit: number | null = null;
    let credit: number | null = null;
    
    if (i > 0) {
      const delta = row.soldeNum - structuredData[i - 1].soldeNum;
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
 * Parse Raiffeisen PDF text content and extract bank transactions
 */
export const parseRaiffeisenTransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const financePattern = /([\d' ]+\.\d{2})\s+([\d' ]+\.\d{2})\s+(\d{2}\.\d{2}\.\d{4})/;
  let currentBalance = 0.0;
  let startParsing = false;
  const lines = text.split('\n');
  const transactionBlocks = [];
  let currentBlock = [];
  for (let line of lines) {
    line = line.trim();
    if (line.includes("Date Texte Débit Crédit Solde Valeur")) {
      startParsing = true;
      continue;
    }
    if (!startParsing) continue;
    if (line.includes("Solde reporté")) {
      const matchSolde = line.match(/[\d' ]+\.\d{2}/g);
      if (matchSolde) {
        currentBalance = toFloat(matchSolde[matchSolde.length - 1]);
        console.log(`💰 Solde de départ identifié : ${currentBalance}`);
      }
      continue;
    }
    if (datePattern.test(line)) {
      if (currentBlock.length > 0) {
        transactionBlocks.push(currentBlock);
      }
      currentBlock = [line];
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) {
    transactionBlocks.push(currentBlock);
  }
  let finalData = [];
  for (let block of transactionBlocks) {
    const firstLine = block[0];
    const dateA = firstLine.substring(0, 10);
    const contentFull = block.join(" ");
    const finMatch = contentFull.match(financePattern);
    if (finMatch) {
      const mouvementStr = finMatch[1];
      const nouveauSoldeStr = finMatch[2];
      const dateValeur = finMatch[3];
      const mouvement = toFloat(mouvementStr);
      const nouveauSolde = toFloat(nouveauSoldeStr);
      const delta = Math.round((nouveauSolde - currentBalance) * 100) / 100;
      const isDebit = delta < 0;
      let textB = contentFull;
      [dateA, mouvementStr, nouveauSoldeStr, dateValeur].forEach(token => {
        textB = textB.replace(token, "");
      });
      textB = textB.replace(/\s+/g, " ").trim();
      finalData.push({
        "date": dateA,
        "description": textB,
        "debit": isDebit ? mouvement : null,
        "credit": !isDebit ? mouvement : null,
        "solde": nouveauSolde,
      });
      currentBalance = nouveauSolde;
    }
  }
  return finalData;
};

/**
 * Parse UBS PDF text content and extract bank transactions
 */
export const parseUBSTransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const amountPattern = /-?[\d']+[.,]\d{2}(?!\d)/g;
  
  const lines = text.split('\n');
  const rows: string[][] = [];
  
  let transactionLines: string[] = [];
  
  console.log('[UBS] Nombre de lignes à analyser:', lines.length);
  
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
  
  if (transactionLines.length > 0) {
    rows.push(transactionLines);
  }
  
  console.log('[UBS] Blocs de transactions trouvés:', rows.length);
  
  const structuredData: { date: string; texte: string; soldeNum: number }[] = [];
  
  let initialBalance: number | null = null;
  
  // Find initial balance
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('solde initial')) {
      const amounts = line.match(amountPattern) || [];
      if (amounts.length > 0) {
        initialBalance = toFloat(amounts[amounts.length - 1]);
        console.log('[UBS] Solde initial trouvé:', initialBalance);
        break;
      }
    }
  }
  
  for (const block of rows) {
    const firstLine = block[0];
    const dateMatch = firstLine.match(datePattern);
    if (!dateMatch) continue;
    
    const date = dateMatch[0];
    const amounts = firstLine.match(amountPattern) || [];
    const balanceVal = amounts.length > 0 ? toFloat(amounts[amounts.length - 1]) : 0.0;
    
    let firstLineClean = firstLine.replace(datePattern, '');
    amounts.forEach(amt => {
      firstLineClean = firstLineClean.replace(amt, '');
    });
    firstLineClean = firstLineClean.trim();
    
    let fullText = firstLineClean;
    if (block.length > 1) {
      fullText += ' ' + block.slice(1).join(' ');
    }
    
    fullText = fullText.replace(/CHF/gi, '');
    fullText = fullText.replace(/\d{2}\.\d{2}\.\d{4}/g, '');  // Remove date de valeur
    fullText = fullText.replace(/\s+/g, ' ').trim();
    
    if (fullText.toLowerCase().includes('solde') && (fullText.toLowerCase().includes('final') || fullText.toLowerCase().includes('initial'))) continue;
    if (fullText.toLowerCase().includes('mouvements') || fullText.toLowerCase().includes('total')) continue;
    if (!fullText || fullText.length < 3) continue;
    
    structuredData.push({ date, texte: fullText, soldeNum: balanceVal });
  }
  
  console.log('[UBS] Transactions structurées:', structuredData.length);
  
  const transactions: BankTransaction[] = [];
  
  // structuredData is in reverse chronological order (recent first)
  for (let i = 0; i < structuredData.length; i++) {
    const row = structuredData[i];
    let delta: number | null = null;
    
    if (i < structuredData.length - 1) {
      delta = row.soldeNum - structuredData[i + 1].soldeNum;
    } else if (initialBalance !== null) {
      delta = row.soldeNum - initialBalance;
    }
    
    let debit: number | null = null;
    let credit: number | null = null;
    
    if (delta !== null) {
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
  
  // Reverse to chronological order (oldest first)
  transactions.reverse();
  
  return transactions;
};

/**
 * Parse PDF text based on bank type
 */
export const parseTransactionsFromText = (text: string, bankType: BankType = 'bcge'): BankTransaction[] => {
  console.log('Parsing transactions for bank type:', bankType);
  
  if (bankType === 'raiffeisen') {
    return parseRaiffeisenTransactions(text);
  } else if (bankType === 'ubs') {
    return parseUBSTransactions(text);
  }
  
  return parseBCGETransactions(text);
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
