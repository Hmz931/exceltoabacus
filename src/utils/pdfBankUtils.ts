import * as XLSX from 'xlsx';

export type BankType = 'bcge' | 'raiffeisen' | 'ubs' | 'postfinance' | 'creditsuisse' | 'migros';

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
  { value: 'ubs', label: 'UBS' },
  { value: 'postfinance', label: 'PostFinance' },
  { value: 'creditsuisse', label: 'Credit Suisse' },
  { value: 'migros', label: 'Banque Migros' }
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
 * Raiffeisen has a table format with columns: Date, Texte, Débit, Crédit, Solde, Valeur
 */
export const parseRaiffeisenTransactions = (text: string): BankTransaction[] => {
  const DATE_RX = /^\d{2}\.\d{2}\.\d{4}/;
  const SOLDE_RX = /[\d' ]+\.\d{2}/g;
  const FIN_RX = /([\d' ]+\.\d{2})\s+([\d' ]+\.\d{2})\s+(\d{2}\.\d{2}\.\d{4})/;

  console.log('[Raiffeisen] Nombre de lignes à analyser:', text.split('\n').length);

  // Split and clean lines
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  let startParsing = false;
  let currentBalance: number | null = null;
  const blocks: string[][] = [];
  let block: string[] = [];

  for (const line of lines) {
    const norm = line.replace(/\s+/g, '').toLowerCase();

    // Start when we see the table header
    if (!startParsing && norm.includes('date') && norm.includes('solde')) {
      startParsing = true;
      continue;
    }

    if (!startParsing) continue;

    // Detect initial balance
    if (norm.includes('soldereporte') || norm.includes('soldereporté')) {
      const matches = line.match(SOLDE_RX);
      if (matches && matches.length > 0) {
        currentBalance = toFloat(matches[matches.length - 1]);
        console.log(`[Raiffeisen] Solde reporté détecté : ${currentBalance?.toFixed(2)}`);
      }
      continue;
    }

    if (DATE_RX.test(line)) {
      if (block.length > 0) {
        blocks.push([...block]);
      }
      block = [line];
    } else if (block.length > 0) {
      block.push(line);
    }
  }

  if (block.length > 0) {
    blocks.push(block);
  }

  if (currentBalance === null) {
    console.warn('[Raiffeisen] Solde reporté non trouvé');
    return [];
  }

  const transactions: BankTransaction[] = [];

  for (const block of blocks) {
    if (block.length === 0) continue;

    const date = block[0].slice(0, 10);
    if (!DATE_RX.test(date)) continue;

    // Join block and clean
    let fullText = block.join('  ').replace(/\s{2,}/g, ' ').trim();

    const m = fullText.match(FIN_RX);
    if (!m) continue;

    const soldeStr = m[2];
    const valeur = m[3];

    const newSolde = toFloat(soldeStr);
    const delta = Math.round((newSolde - currentBalance) * 100) / 100;
    const montant = Math.abs(delta);
    const isDebit = delta < 0;

    let description = fullText
      .replace(date, '')
      .replace(soldeStr, '')
      .replace(valeur, '')
      .replace(/Détails supprimés/gi, '')
      .replace(/EUR\s*\d+[,.]\d{2}/gi, '')     // remove foreign currency currency lines noise
      .replace(/taux de change\s*[\d.]+/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!description) description = '(paiement / virement non décrit)';

    transactions.push({
      date,
      description,
      debit: isDebit ? montant : null,
      credit: !isDebit ? montant : null,
      solde: newSolde
    });

    currentBalance = newSolde;
  }

  console.log('[Raiffeisen] Transactions extraites:', transactions.length);

  return transactions.filter(t => 
    t.description.length > 2 && 
    !t.description.toLowerCase().includes('solde reporté')
  );
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
 * Parse PostFinance PDF text content and extract bank transactions
 */
export const parsePostFinanceTransactions = (text: string): BankTransaction[] => {
  const DATE_RX = /^\d{2}\.\d{2}\.\d{2}/;  // Note: PostFinance uses YY instead of YYYY in some cases
  const SOLDE_RX = /[\d' ]+\.\d{2}/g;
  const FIN_RX = /([\d' ]+\.\d{2})\s+([\d' ]+\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})/;  // Adjusted for YY

  console.log('[PostFinance] Nombre de lignes à analyser:', text.split('\n').length);

  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  let startParsing = false;
  let currentBalance: number | null = null;
  const blocks: string[][] = [];
  let block: string[] = [];

  for (const line of lines) {
    const norm = line.replace(/\s+/g, '').toLowerCase();

    if (!startParsing && norm.includes('date') && norm.includes('solde')) {
      startParsing = true;
      continue;
    }

    if (!startParsing) continue;

    if (norm.includes('etatdecompte') || norm.includes('soldereporte')) {  // PostFinance uses "Etat de compte"
      const matches = line.match(SOLDE_RX);
      if (matches && matches.length > 0) {
        currentBalance = toFloat(matches[matches.length - 1]);
        console.log(`[PostFinance] Solde initial détecté : ${currentBalance?.toFixed(2)}`);
      }
      continue;
    }

    if (DATE_RX.test(line)) {
      if (block.length > 0) {
        blocks.push([...block]);
      }
      block = [line];
    } else if (block.length > 0) {
      block.push(line);
    }
  }

  if (block.length > 0) {
    blocks.push(block);
  }

  if (currentBalance === null) {
    console.warn('[PostFinance] Solde initial non trouvé');
    return [];
  }

  const transactions: BankTransaction[] = [];

  for (const block of blocks) {
    if (block.length === 0) continue;

    const date = block[0].slice(0, 8);  // DD.MM.YY
    const fullDate = date.replace(/(\d{2}\.\d{2}\.)(\d{2})/, '$120');  // Assume 20YY for recent years

    let fullText = block.join('  ').replace(/\s{2,}/g, ' ').trim();

    const m = fullText.match(FIN_RX);
    if (!m) continue;

    const soldeStr = m[2];
    const valeur = m[3];

    const newSolde = toFloat(soldeStr);
    const delta = Math.round((newSolde - currentBalance) * 100) / 100;
    const montant = Math.abs(delta);
    const isDebit = delta < 0;

    let description = fullText
      .replace(date, '')
      .replace(soldeStr, '')
      .replace(valeur, '')
      .replace(/RÉFÉRENCE DE L'EXPEDITEUR:/gi, '')
      .replace(/COMMUNICATIONS:/gi, '')
      .replace(/REFERENCES:/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!description) description = '(transaction non décrite)';

    transactions.push({
      date: fullDate,
      description,
      debit: isDebit ? montant : null,
      credit: !isDebit ? montant : null,
      solde: newSolde
    });

    currentBalance = newSolde;
  }

  console.log('[PostFinance] Transactions extraites:', transactions.length);

  return transactions;
};

/**
 * Parse Credit Suisse PDF text content and extract bank transactions
 */
export const parseCreditSuisseTransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{2}/;
  const amountPattern = /-?[\d']+[.,]\d{2}(?!\d)/g;

  const lines = text.split('\n');
  const rows: string[][] = [];

  let transactionLines: string[] = [];

  console.log('[Credit Suisse] Nombre de lignes à analyser:', lines.length);

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

  console.log('[Credit Suisse] Blocs de transactions trouvés:', rows.length);

  const structuredData: { date: string; texte: string; soldeNum: number }[] = [];

  let initialBalance: number | null = null;

  // Find initial balance (Solde reporté)
  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    if (lowerLine.includes('solde reporté')) {
      const amounts = line.match(amountPattern) || [];
      if (amounts.length > 0) {
        initialBalance = toFloat(amounts[amounts.length - 1]);
        console.log('[Credit Suisse] Solde reporté trouvé:', initialBalance);
        break;
      }
    }
  }

  for (const block of rows) {
    const firstLine = block[0];
    const dateMatch = firstLine.match(datePattern);
    if (!dateMatch) continue;

    const date = dateMatch[0];
    const fullDate = date.replace(/(\d{2}\.\d{2}\.)(\d{2})/, '$120');  // Assume 20YY

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
    fullText = fullText.replace(/\d{2}\.\d{2}\.\d{2}/g, '');  // Remove valeur dates
    fullText = fullText.replace(/\s+/g, ' ').trim();

    if (fullText.toLowerCase().includes('solde') && (fullText.toLowerCase().includes('reporté') || fullText.toLowerCase().includes('final'))) continue;
    if (fullText.toLowerCase().includes('relevé') || fullText.toLowerCase().includes('total')) continue;
    if (!fullText || fullText.length < 3) continue;

    structuredData.push({ date: fullDate, texte: fullText, soldeNum: balanceVal });
  }

  console.log('[Credit Suisse] Transactions structurées:', structuredData.length);

  const transactions: BankTransaction[] = [];

  let prevSolde = initialBalance || 0;

  for (const row of structuredData) {
    const delta = Math.round((row.soldeNum - prevSolde) * 100) / 100;
    const montant = Math.abs(delta);
    const isDebit = delta < 0;

    transactions.push({
      date: row.date,
      description: row.texte,
      debit: isDebit ? montant : null,
      credit: !isDebit ? montant : null,
      solde: row.soldeNum
    });

    prevSolde = row.soldeNum;
  }

  return transactions;
};

/**
 * Parse Migros PDF text content and extract bank transactions
 * Similar to BCGE as per user note
 */
export const parseMigrosTransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const rows: string[][] = [];
  
  const lines = text.split('\n');
  let transactionLines: string[] = [];
  
  console.log('[Migros] Nombre de lignes à analyser:', lines.length);
  
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
  
  console.log('[Migros] Blocs de transactions trouvés:', rows.length);
  
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
    fullText = fullText.replace(/\/C\//gi, '');  // Clean IBAN prefixes
    fullText = fullText.replace(/Donneur d'ordre/gi, '');
    fullText = fullText.replace(/Communication\/Référence/gi, '');
    fullText = fullText.replace(/\s+/g, ' ').trim();
    
    if (fullText.toLowerCase().includes('solde') && fullText.toLowerCase().includes('initial')) continue;
    if (fullText.toLowerCase().includes('extrait de compte')) continue;
    if (!fullText || fullText.length < 3) continue;
    
    structuredData.push({ date, texte: fullText, soldeNum: balanceVal });
  }
  
  console.log('[Migros] Transactions structurées:', structuredData.length);
  
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
 * Parse PDF text based on bank type
 */
export const parseTransactionsFromText = (text: string, bankType: BankType = 'bcge'): BankTransaction[] => {
  console.log('Parsing transactions for bank type:', bankType);
  
  if (bankType === 'raiffeisen') {
    return parseRaiffeisenTransactions(text);
  } else if (bankType === 'ubs') {
    return parseUBSTransactions(text);
  } else if (bankType === 'postfinance') {
    return parsePostFinanceTransactions(text);
  } else if (bankType === 'creditsuisse') {
    return parseCreditSuisseTransactions(text);
  } else if (bankType === 'migros') {
    return parseMigrosTransactions(text);
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
