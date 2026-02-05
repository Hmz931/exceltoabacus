import * as XLSX from 'xlsx';

export type BankType = 'bcge' | 'raiffeisen' | 'creditsuisse';

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
  { value: 'creditsuisse', label: 'Credit Suisse' }
];

/**
 * Convert string value to float, handling Swiss number format (apostrophe as thousand separator)
 */
export const toFloat = (value: string | null | undefined): number => {
  if (!value) return 0.0;
 
  let cleaned = String(value).replace(/'/g, '').replace(',', '.');
  cleaned = cleaned.replace(/[^-0-9.]/g, '');
 
  try {
    const result = parseFloat(cleaned);
    return isNaN(result) ? 0.0 : result;
  } catch {
    return 0.0;
  }
};

/**
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  PARSER BCGE CORRIGÉ - VERSION FINALE                                      ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 * 
 * PROBLÈME IDENTIFIÉ:
 * Le regex /\d{1,3}(?:'?\d{3})*[.,]\d{2}/g capturait aussi les dates (ex: "03.02")
 * 
 * SOLUTION:
 * 1. Améliorer le regex pour exclure les dates
 * 2. Utiliser le delta entre soldes consécutifs pour déterminer Débit/Crédit
 * 3. Fallback sur l'analyse de texte (/C/, Originator = crédit; Beneficiary, Achat = débit)
 * 
 * STRUCTURE BCGE:
 * - Chaque ligne: DATE Description MONTANT_TRANSACTION SOLDE
 * - Le DERNIER montant = SOLDE après transaction
 * - L'AVANT-DERNIER montant = MONTANT de la transaction
 */
export const parseBCGETransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  
  // ✨ REGEX AMÉLIORÉ: Exclut les dates en exigeant soit 3+ chiffres OU un séparateur d'apostrophe
  // Cela empêche la capture de "03.02" mais capture "128.64", "1'533.33", etc.
  const AMOUNT_RX = /(?<!\d)\d{1,3}(?:'?\d{3})+[.,]\d{2}|(?<!\d)\d{4,}[.,]\d{2}|(?<!\d)\d{3}[.,]\d{2}(?!\d)/g;
  
  const rows: string[][] = [];
  const lines = text.split('\n');
  let transactionLines: string[] = [];
 
  console.log('[BCGE] Nombre de lignes à analyser:', lines.length);
 
  // Grouper les lignes par bloc de transaction
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
 
  const structuredData: { 
    date: string; 
    texte: string; 
    montantTransaction: number;
    soldeNum: number;
  }[] = [];
 
  // Parser chaque bloc de transaction
  for (const block of rows) {
    const firstLine = block[0];
    const dateMatch = firstLine.match(datePattern);
    if (!dateMatch) continue;
   
    const date = dateMatch[0];
    
    // Extraire tous les montants (en excluant les dates grâce au nouveau regex)
    const amounts = firstLine.match(AMOUNT_RX) || [];
    
    console.log(`[BCGE] Date: ${date}, Montants trouvés:`, amounts);
    
    // Dans le format BCGE: dernier montant = SOLDE, avant-dernier = TRANSACTION
    if (amounts.length < 2) {
      console.warn(`[BCGE] Ligne ignorée (moins de 2 montants): ${firstLine}`);
      continue;
    }
    
    const montantTransaction = toFloat(amounts[amounts.length - 2]);
    const balanceVal = toFloat(amounts[amounts.length - 1]);
   
    // Nettoyer le texte de description
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
   
    // Filtrer les lignes de header et lignes vides
    if (fullText.toLowerCase().includes('solde') && fullText.toLowerCase().includes('date')) continue;
    if (fullText.toLowerCase().includes('relevé de compte')) continue;
    if (!fullText || fullText.length < 3) continue;
   
    structuredData.push({ 
      date, 
      texte: fullText, 
      montantTransaction,
      soldeNum: balanceVal 
    });
  }
 
  console.log('[BCGE] Transactions structurées:', structuredData.length);
 
  const transactions: BankTransaction[] = [];
 
  // Déterminer Débit/Crédit pour chaque transaction
  for (let i = 0; i < structuredData.length; i++) {
    const row = structuredData[i];
    let debit: number | null = null;
    let credit: number | null = null;
   
    // MÉTHODE 1: Calcul du delta avec le solde précédent (le plus fiable)
    if (i > 0) {
      const delta = row.soldeNum - structuredData[i - 1].soldeNum;
      const roundedDelta = Math.round(delta * 100) / 100;
      const montantAttendu = Math.round(row.montantTransaction * 100) / 100;
      
      console.log(`[BCGE] Transaction ${i}: delta=${roundedDelta}, montant=${montantAttendu}`);
      
      // Vérifier si le delta correspond au montant de la transaction
      if (Math.abs(Math.abs(roundedDelta) - montantAttendu) < 0.02) {
        // Delta correspond au montant
        if (roundedDelta < 0) {
          debit = montantAttendu;
        } else {
          credit = montantAttendu;
        }
      } else {
        // Delta ne correspond pas: utiliser l'analyse de texte (MÉTHODE 2)
        const textLower = row.texte.toLowerCase();
        
        if (textLower.includes('/c/') || textLower.includes('originator')) {
          credit = row.montantTransaction;
        } else if (textLower.includes('beneficiary') || textLower.includes('achat')) {
          debit = row.montantTransaction;
        } else {
          // Fallback: si delta négatif = débit, sinon crédit
          if (roundedDelta < 0) {
            debit = montantAttendu;
          } else {
            credit = montantAttendu;
          }
        }
      }
    } else {
      // Première transaction: utiliser l'analyse de texte
      const textLower = row.texte.toLowerCase();
      
      if (textLower.includes('/c/') || textLower.includes('originator')) {
        credit = row.montantTransaction;
      } else if (textLower.includes('beneficiary') || textLower.includes('achat')) {
        debit = row.montantTransaction;
      } else {
        // Heuristique: montant élevé = probablement un crédit, faible = débit
        if (row.montantTransaction < 50000) {
          debit = row.montantTransaction;
        } else {
          credit = row.montantTransaction;
        }
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
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  PARSER RAIFFEISEN - INCHANGÉ (FONCTIONNE CORRECTEMENT)                    ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 */
export const parseRaiffeisenTransactions = (text: string): BankTransaction[] => {
  const DATE_RX = /^\d{2}\.\d{2}\.\d{4}/;
  const SOLDE_RX = /[\d' ]+\.\d{2}/g;
  const FIN_RX = /([\d' ]+\.\d{2})\s+([\d' ]+\.\d{2})\s+(\d{2}\.\d{2}\.\d{4})/;
  
  console.log('[Raiffeisen] Nombre de lignes à analyser:', text.split('\n').length);
  
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
    
    let fullText = block.join(' ').replace(/\s{2,}/g, ' ').trim();
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
      .replace(/EUR\s*\d+[,.]\d{2}/gi, '')
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
 * ╔════════════════════════════════════════════════════════════════════════════╗
 * ║  PARSER CREDIT SUISSE - Version 3.0 (ported from Python)                   ║
 * ╚════════════════════════════════════════════════════════════════════════════╝
 * 
 * PORTED FROM PYTHON VERSION (CreditSuisseStatementParser)
 * 
 * KEY PATTERNS:
 * - CREDIT: "- [amount]" (dash followed by amount)
 * - DEBIT: "[amount] -" (amount followed by dash)
 * - Balance: last number at the end of the text
 * - Multi-line transactions: lines without date are continuation of previous
 */
export const parseCreditSuisseTransactions = (text: string): BankTransaction[] => {
  console.log('[CreditSuisse] Démarrage de l\'analyse...');
  
  const lines = text.split('\n');
  const transactions: BankTransaction[] = [];
  
  // Skip patterns (headers, footers, etc.)
  const shouldSkipLine = (line: string): boolean => {
    if (!line || !line.trim()) return true;
    
    const skipPatterns = [
      'Crée le',
      'Assistance clientèle',
      'CREDIT SUISSE',
      'Fait partie du',
      'Date comptable',
      'Texte',
      'Débit',
      'Crédit',
      'Date de valeur',
      'Solde',
      '===== Page',
      'Chercher écritures',
      'Compte Compte entreprise',
      'Écritures',
      'parsed-documents://',
      'parsed-image',
      'Images from page',
      '# ',
      '---',
      '| ---'
    ];
    
    for (const pattern of skipPatterns) {
      if (line.includes(pattern)) return true;
    }
    
    // Page numbers like "1 / 165"
    if (/^\d+\s*\/\s*\d+$/.test(line.trim())) return true;
    
    return false;
  };
  
  // Clean amount string to float
  const cleanAmount = (amountStr: string | null | undefined): number | null => {
    if (!amountStr || amountStr === '-' || amountStr.trim() === '') return null;
    
    let cleaned = String(amountStr).trim().replace(/'/g, '').replace(/ /g, '');
    cleaned = cleaned.replace(',', '.');
    cleaned = cleaned.replace(/[^\d.\-]/g, '');
    
    // Handle multiple decimal points
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
    
    try {
      const value = parseFloat(cleaned);
      return isNaN(value) ? null : Math.round(value * 100) / 100;
    } catch {
      return null;
    }
  };
  
  // Extract transaction from combined text
  const extractFromCombinedText = (text: string): {
    texte: string;
    debit: number | null;
    credit: number | null;
    solde: number | null;
    dateValeur: string | null;
  } => {
    let result = {
      texte: '',
      debit: null as number | null,
      credit: null as number | null,
      solde: null as number | null,
      dateValeur: null as string | null
    };
    
    let workingText = text;
    
    // Find all dates in text
    const dates = workingText.match(/\d{2}\.\d{2}\.\d{4}/g) || [];
    if (dates.length >= 2) {
      result.dateValeur = dates[dates.length - 1];
    }
    
    // Find balance (last number in text)
    const balanceMatch = workingText.match(/(-?[\d']+[\d',\.]*\d)\s*$/);
    if (balanceMatch) {
      result.solde = cleanAmount(balanceMatch[1]);
      workingText = workingText.slice(0, balanceMatch.index).trim();
    }
    
    // CREDIT pattern: dash followed by amount "- 1'234.56"
    const creditMatch = workingText.match(/-\s+([\d']+[\d',\.]*\d)/);
    if (creditMatch) {
      result.credit = cleanAmount(creditMatch[1]);
      workingText = workingText.replace(creditMatch[0], ' ');
    }
    
    // DEBIT pattern: amount followed by dash "1'234.56 -"
    const debitMatch = workingText.match(/([\d']+[\d',\.]*\d)\s+-/);
    if (debitMatch) {
      result.debit = cleanAmount(debitMatch[1]);
      workingText = workingText.replace(debitMatch[0], ' ');
    }
    
    // If no pattern matched, look for standalone numbers
    if (result.debit === null && result.credit === null) {
      const allNumbers = workingText.match(/([\d']+[\d',\.]*\d)/g);
      if (allNumbers && allNumbers.length > 0) {
        // Usually the first larger number is the transaction amount
        for (const numStr of allNumbers) {
          const amount = cleanAmount(numStr);
          if (amount !== null && amount > 10) {
            // Heuristic: treat as debit by default
            result.debit = amount;
            workingText = workingText.replace(numStr, ' ');
            break;
          }
        }
      }
    }
    
    // Clean up description
    let description = workingText;
    
    // Remove extra dashes
    description = description.replace(/\s*-\s*/g, ' ');
    
    // Remove date valeur if present
    if (result.dateValeur) {
      description = description.replace(result.dateValeur, '');
    }
    
    // Clean up multiple spaces and trim
    description = description.replace(/\s+/g, ' ').trim();
    
    // Remove leading/trailing punctuation
    description = description.replace(/^[^a-zA-Z0-9À-ÿ]+|[^a-zA-Z0-9À-ÿ]+$/g, '');
    
    result.texte = description;
    
    return result;
  };
  
  // Parse transactions from text lines
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip header/footer lines
    if (shouldSkipLine(line)) {
      i++;
      continue;
    }
    
    // Look for date at beginning (DD.MM.YYYY)
    const dateMatch = line.match(/^(\d{2}\.\d{2}\.\d{4})\s+(.+)$/);
    
    if (dateMatch) {
      const dateComptable = dateMatch[1];
      const restOfLine = dateMatch[2];
      
      // Look ahead for continuation lines (up to 10 lines max)
      const fullTextParts: string[] = [restOfLine];
      let nextIdx = i + 1;
      let linesConsumed = 1;
      
      while (nextIdx < lines.length && linesConsumed < 10) {
        const nextLine = lines[nextIdx].trim();
        
        // Stop if we hit another date or skip pattern
        if (/^\d{2}\.\d{2}\.\d{4}/.test(nextLine) || shouldSkipLine(nextLine)) {
          break;
        }
        
        // Stop if line looks like an amount + date pattern (end of transaction)
        if (/[\d',\.]+\s+\d{2}\.\d{2}\.\d{4}/.test(nextLine) ||
            /\d{2}\.\d{2}\.\d{4}\s+[\d',\.]+/.test(nextLine)) {
          // Include this line but stop after
          fullTextParts.push(nextLine);
          linesConsumed++;
          nextIdx++;
          break;
        }
        
        fullTextParts.push(nextLine);
        linesConsumed++;
        nextIdx++;
      }
      
      // Combine all parts
      const fullText = fullTextParts.join(' ');
      
      // Extract transaction details
      const extracted = extractFromCombinedText(fullText);
      
      // Only add if we have at least one amount
      if (extracted.debit !== null || extracted.credit !== null) {
        transactions.push({
          date: dateComptable,
          description: extracted.texte || '(Transaction)',
          debit: extracted.debit,
          credit: extracted.credit,
          solde: extracted.solde ?? 0
        });
      }
      
      // Skip ahead
      i = nextIdx;
    } else {
      i++;
    }
  }
  
  console.log('[CreditSuisse] Transactions extraites:', transactions.length);
  
  return transactions;
};

/**
 * Parse PDF text based on bank type
 */
export const parseTransactionsFromText = (text: string, bankType: BankType = 'bcge'): BankTransaction[] => {
  console.log('Parsing transactions for bank type:', bankType);
 
  if (bankType === 'raiffeisen') {
    return parseRaiffeisenTransactions(text);
  }
  
  if (bankType === 'creditsuisse') {
    return parseCreditSuisseTransactions(text);
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
 
  worksheet['!cols'] = [
    { wch: 12 }, // Date
    { wch: 70 }, // Description – increased width
    { wch: 14 }, // Débit
    { wch: 14 }, // Crédit
    { wch: 14 } // Solde
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
