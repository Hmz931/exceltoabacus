import * as XLSX from 'xlsx';

export type BankType = 'bcge' | 'raiffeisen';

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
  { value: 'raiffeisen', label: 'Raiffeisen' }
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
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const amountPattern = /[\d']+[.,]\d{2}/g;
  
  const lines = text.split('\n');
  const transactions: BankTransaction[] = [];
  
  let currentTransaction: {
    date: string;
    descriptions: string[];
    debit: number | null;
    credit: number | null;
    solde: number;
  } | null = null;
  
  console.log('[Raiffeisen] Nombre de lignes à analyser:', lines.length);
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // Skip header lines
    if (trimmedLine.includes('Date') && trimmedLine.includes('Texte') && trimmedLine.includes('Solde')) continue;
    if (trimmedLine.includes('Relevé de compte')) continue;
    if (trimmedLine.includes('Page ') && trimmedLine.includes(' de ')) continue;
    if (trimmedLine.startsWith('RAIFFEISEN')) continue;
    if (trimmedLine.startsWith('Contrat:')) continue;
    if (trimmedLine.startsWith('Compte:')) continue;
    if (trimmedLine.startsWith('Banque Raiffeisen')) continue;
    if (trimmedLine.includes('CH') && trimmedLine.includes('8080')) continue;
    if (trimmedLine === 'Compte courant') continue;
    if (trimmedLine.startsWith('Titulaire:')) continue;
    
    // Check if line starts with a date (new transaction)
    if (datePattern.test(trimmedLine)) {
      // Save previous transaction
      if (currentTransaction) {
        transactions.push({
          date: currentTransaction.date,
          description: currentTransaction.descriptions.join(' ').trim(),
          debit: currentTransaction.debit,
          credit: currentTransaction.credit,
          solde: currentTransaction.solde
        });
      }
      
      // Parse new transaction line
      const date = trimmedLine.match(datePattern)![0];
      const amounts = trimmedLine.match(amountPattern) || [];
      
      // In Raiffeisen format, amounts appear in order: possibly debit, possibly credit, solde, valeur date
      // We need to extract based on position and context
      let debit: number | null = null;
      let credit: number | null = null;
      let solde: number = 0;
      
      // Remove date from line to get rest
      let restOfLine = trimmedLine.substring(10).trim();
      
      // Extract description (text before amounts)
      const firstAmountMatch = restOfLine.match(/[\d']+[.,]\d{2}/);
      let description = '';
      if (firstAmountMatch) {
        description = restOfLine.substring(0, firstAmountMatch.index).trim();
      } else {
        description = restOfLine;
      }
      
      // Analyze amounts - Raiffeisen shows amounts in the original columns
      // The solde is typically the largest value or specifically positioned
      if (amounts.length >= 2) {
        const numAmounts = amounts.map(a => toFloat(a));
        
        // Find the balance (solde) - usually the largest or second-to-last
        // In Raiffeisen, format is: Débit | Crédit | Solde | Valeur
        // Solde is typically 5-6 digit number with apostrophe separators
        
        // The last amount that looks like a date (same as first date) is the Valeur
        // The amount before that is usually the Solde
        
        // Simple heuristic: amounts > 10000 are likely solde values
        const potentialSolde = numAmounts.filter(a => a > 1000);
        if (potentialSolde.length > 0) {
          // Take the one that appears in the line (usually middle-right position)
          solde = potentialSolde[0];
        }
        
        // Remaining amounts are debit/credit
        const smallAmounts = numAmounts.filter(a => a <= 1000 || !potentialSolde.includes(a));
        if (smallAmounts.length > 0) {
          // Check if description contains "Crédit" or payment keywords
          const lowerDesc = description.toLowerCase();
          if (lowerDesc.includes('crédit') || lowerDesc.includes('versement') || lowerDesc.includes('virement entrant')) {
            credit = smallAmounts[0];
          } else {
            debit = smallAmounts[0];
          }
        }
      } else if (amounts.length === 1) {
        solde = toFloat(amounts[0]);
      }
      
      currentTransaction = {
        date,
        descriptions: [description],
        debit,
        credit,
        solde
      };
    } else if (currentTransaction) {
      // Continuation line - add to description
      // But skip lines that are just amounts
      const justAmounts = trimmedLine.match(/^[\d',.\s]+$/);
      if (!justAmounts) {
        currentTransaction.descriptions.push(trimmedLine);
      } else {
        // This might be additional amount info - parse it
        const amounts = trimmedLine.match(amountPattern) || [];
        if (amounts.length > 0) {
          const numAmounts = amounts.map(a => toFloat(a));
          // Update debit/credit if we find amounts
          for (const amt of numAmounts) {
            if (amt > 10000 && currentTransaction.solde === 0) {
              currentTransaction.solde = amt;
            } else if (amt < 10000) {
              if (currentTransaction.debit === null && currentTransaction.credit === null) {
                currentTransaction.debit = amt;
              }
            }
          }
        }
      }
    }
  }
  
  // Don't forget the last transaction
  if (currentTransaction) {
    transactions.push({
      date: currentTransaction.date,
      description: currentTransaction.descriptions.join(' ').trim(),
      debit: currentTransaction.debit,
      credit: currentTransaction.credit,
      solde: currentTransaction.solde
    });
  }
  
  console.log('[Raiffeisen] Transactions extraites:', transactions.length);
  
  // Filter out empty or header transactions
  return transactions.filter(t => 
    t.description && 
    t.description.length > 2 && 
    !t.description.toLowerCase().includes('solde reporté') &&
    t.solde > 0
  );
};

/**
 * Parse PDF text based on bank type
 */
export const parseTransactionsFromText = (text: string, bankType: BankType = 'bcge'): BankTransaction[] => {
  console.log('Parsing transactions for bank type:', bankType);
  
  if (bankType === 'raiffeisen') {
    return parseRaiffeisenTransactions(text);
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
