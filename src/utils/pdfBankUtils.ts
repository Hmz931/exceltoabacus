import * as XLSX from 'xlsx';

export type BankType = 'bcge' | 'raiffeisen' | 'ubs' | 'postfinance' | 'creditsuisse' | 'migros';

export interface BankTransaction {
  date: string;
  description: string;
  debit: number | null;
  credit: number | null;
  solde: number;
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
 * Convert string to float (Swiss format: '1'234.56 → 1234.56)
 */
export const toFloat = (value: string | null | undefined): number => {
  if (!value) return 0.0;
  let cleaned = String(value).replace(/'/g, '').replace(',', '.').replace(/[^-0-9.]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0.0 : num;
};

/* ==================== BCGE (inchangé) ==================== */
export const parseBCGETransactions = (text: string): BankTransaction[] => {
  // ... (code identique à la version précédente, non modifié)
  // (Je garde le même code que tu as validé comme parfait)
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const rows: string[][] = [];
  const lines = text.split('\n');
  let transactionLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    if (datePattern.test(trimmedLine)) {
      if (transactionLines.length > 0) rows.push([...transactionLines]);
      transactionLines = [trimmedLine];
    } else if (transactionLines.length > 0) {
      transactionLines.push(trimmedLine);
    }
  }
  if (transactionLines.length > 0) rows.push(transactionLines);

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
    amounts.forEach(amt => firstLineClean = firstLineClean.replace(amt, ''));
    firstLineClean = firstLineClean.trim();

    let fullText = firstLineClean;
    if (block.length > 1) fullText += ' ' + block.slice(1).join(' ');
    fullText = fullText.replace(/CHF/gi, '').replace(/\s+/g, ' ').trim();

    if (fullText.toLowerCase().includes('solde') && fullText.toLowerCase().includes('date')) continue;
    if (fullText.toLowerCase().includes('relevé de compte')) continue;
    if (!fullText || fullText.length < 3) continue;

    structuredData.push({ date, texte: fullText, soldeNum: balanceVal });
  }

  const transactions: BankTransaction[] = [];
  for (let i = 0; i < structuredData.length; i++) {
    const row = structuredData[i];
    let debit: number | null = null;
    let credit: number | null = null;
    if (i > 0) {
      const delta = row.soldeNum - structuredData[i - 1].soldeNum;
      const roundedDelta = Math.round(delta * 100) / 100;
      if (roundedDelta < 0) debit = Math.abs(roundedDelta);
      else if (roundedDelta > 0) credit = roundedDelta;
    }
    transactions.push({ date: row.date, description: row.texte, debit, credit, solde: row.soldeNum });
  }
  return transactions;
};

/* ==================== Raiffeisen (inchangé) ==================== */
export const parseRaiffeisenTransactions = (text: string): BankTransaction[] => {
  // ... (code identique à la version précédente, non modifié)
  // (le parser Raiffeisen que tu as validé)
  const DATE_RX = /^\d{2}\.\d{2}\.\d{4}/;
  const FIN_RX = /([\d' ]+\.\d{2})\s+([\d' ]+\.\d{2})\s+(\d{2}\.\d{2}\.\d{4})/;
  let currentBalance = 0.0;
  let startParsing = false;
  const lines = text.split('\n');
  const transactionBlocks: string[][] = [];
  let currentBlock: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (line.includes("Date Texte Débit Crédit Solde Valeur")) {
      startParsing = true;
      continue;
    }
    if (!startParsing) continue;
    if (line.includes("Solde reporté")) {
      const matches = line.match(/[\d' ]+\.\d{2}/g);
      if (matches) currentBalance = toFloat(matches[matches.length - 1]);
      continue;
    }
    if (DATE_RX.test(line)) {
      if (currentBlock.length > 0) transactionBlocks.push(currentBlock);
      currentBlock = [line];
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) transactionBlocks.push(currentBlock);

  const transactions: BankTransaction[] = [];
  for (const block of transactionBlocks) {
    const firstLine = block[0];
    const dateA = firstLine.substring(0, 10);
    const contentFull = block.join(" ");
    const finMatch = contentFull.match(FIN_RX);
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
      textB = textB.replace(/Détails supprimés/gi, '').replace(/\s+/g, " ").trim();
      if (!textB) textB = "(transaction non décrite)";

      transactions.push({
        date: dateA,
        description: textB,
        debit: isDebit ? mouvement : null,
        credit: !isDebit ? mouvement : null,
        solde: nouveauSolde,
      });
      currentBalance = nouveauSolde;
    }
  }
  return transactions;
};

/* ==================== UBS ==================== */
export const parseUBSTransactions = (text: string): BankTransaction[] => {
  // UBS format: Date de trans. | Date de compt. | Description | Débit | Crédit | Date de valeur | Solde
  // Débits sont négatifs (ex: -1'707.60), Crédits positifs
  const DATE_RX = /^\d{2}\.\d{2}\.\d{4}/;
  const AMOUNT_RX = /-?[\d']+[.,]\d{2}/g;
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Find initial balance
  let initialBalance = 0;
  for (const line of lines) {
    if (line.toLowerCase().includes('solde initial')) {
      const amounts = line.match(AMOUNT_RX);
      if (amounts) initialBalance = toFloat(amounts[amounts.length - 1]);
      break;
    }
  }
  
  // Group lines into transaction blocks
  const blocks: string[][] = [];
  let block: string[] = [];
  
  for (const line of lines) {
    // Skip header/footer lines
    if (line.includes('UBS Switzerland') || line.includes('Page ') || 
        line.includes('ubs.com') || line.includes('Affiché dans') ||
        line.includes('Critères de filtrage') || line.includes('Montant comptable') ||
        line.includes('Période:') || line.toLowerCase().includes('solde final') ||
        line.toLowerCase().includes('solde initial')) continue;
    
    if (DATE_RX.test(line)) {
      if (block.length > 0) blocks.push([...block]);
      block = [line];
    } else if (block.length > 0) {
      block.push(line);
    }
  }
  if (block.length > 0) blocks.push(block);
  
  const transactions: BankTransaction[] = [];
  let prevBalance = initialBalance;
  
  for (const b of blocks) {
    const fullText = b.join(' ');
    const dateMatch = b[0].match(DATE_RX);
    if (!dateMatch) continue;
    
    const date = dateMatch[0];
    const amounts = fullText.match(AMOUNT_RX) || [];
    if (amounts.length === 0) continue;
    
    // Last amount is typically the balance
    const solde = toFloat(amounts[amounts.length - 1]);
    
    // Find debit (negative) or credit (positive) amount
    let debit: number | null = null;
    let credit: number | null = null;
    
    for (const amt of amounts) {
      if (amt.startsWith('-')) {
        debit = Math.abs(toFloat(amt));
        break;
      }
    }
    
    // If no explicit debit, check if there's a credit
    if (!debit && amounts.length >= 2) {
      // Check delta from previous balance
      const delta = Math.round((solde - prevBalance) * 100) / 100;
      if (delta > 0) {
        credit = delta;
      } else if (delta < 0) {
        debit = Math.abs(delta);
      }
    }
    
    // Build description
    let desc = fullText
      .replace(DATE_RX, '')
      .replace(/\d{2}\.\d{2}\.\d{4}/g, '');
    amounts.forEach(a => desc = desc.replace(a, ''));
    desc = desc.replace(/CHF/gi, '').replace(/EUR/gi, '').replace(/Ordre e-banking/gi, '')
      .replace(/Credit/gi, '').replace(/\s+/g, ' ').trim();
    
    if (!desc) desc = '(transaction)';
    if (desc.toLowerCase().includes('solde décompte')) {
      // This is a fee line
      desc = 'Frais de service';
    }
    
    transactions.push({ date, description: desc, debit, credit, solde });
    prevBalance = solde;
  }
  
  return transactions;
};

/* ==================== PostFinance ==================== */
export const parsePostFinanceTransactions = (text: string): BankTransaction[] => {
  // PostFinance format: Date (DD.MM.YY) | Texte | Crédit | Débit | Valeur | Solde
  // Note: Le format a Crédit AVANT Débit, et les montants peuvent être sur plusieurs lignes
  const DATE_RX = /^\d{2}\.\d{2}\.\d{2}(?!\d)/;
  const AMOUNT_RX = /[\d' ]+\.\d{2}/g;
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Trouver le solde initial ("Etat de compte")
  let initialBalance: number | null = null;
  for (const line of lines) {
    if (line.toLowerCase().includes('etat de compte') || line.toLowerCase().includes('état de compte')) {
      const amounts = line.match(AMOUNT_RX);
      if (amounts) initialBalance = toFloat(amounts[amounts.length - 1]);
      break;
    }
  }
  
  // Fallback: chercher "Solde reporté"
  if (initialBalance === null) {
    for (const line of lines) {
      if (line.toLowerCase().includes('solde reporté')) {
        const amounts = line.match(AMOUNT_RX);
        if (amounts) initialBalance = toFloat(amounts[amounts.length - 1]);
        break;
      }
    }
  }
  
  console.log('PostFinance - Solde initial trouvé:', initialBalance);
  
  // Grouper les lignes en blocs de transaction
  const blocks: string[][] = [];
  let block: string[] = [];
  let startParsing = false;
  
  for (const line of lines) {
    // Détecter le début du tableau
    const normLine = line.toLowerCase().replace(/\s+/g, '');
    if (normLine.includes('date') && normLine.includes('texte') && normLine.includes('solde')) {
      startParsing = true;
      continue;
    }
    if (!startParsing) continue;
    
    // Ignorer les headers et footers
    if (line.includes('PostFinance') || line.includes('Page') || 
        line.includes('IBAN') || line.includes('Numéro de compte') ||
        line.includes('Extrait de compte') || line.toLowerCase().includes('etat de compte') ||
        line.toLowerCase().includes('état de compte')) continue;
    
    if (DATE_RX.test(line)) {
      if (block.length > 0) blocks.push([...block]);
      block = [line];
    } else if (block.length > 0) {
      block.push(line);
    }
  }
  if (block.length > 0) blocks.push(block);
  
  console.log('PostFinance - Nombre de blocs trouvés:', blocks.length);
  
  if (initialBalance === null) {
    console.log('PostFinance - Pas de solde initial trouvé');
    return [];
  }
  
  const transactions: BankTransaction[] = [];
  let prevBalance = initialBalance;
  
  for (const b of blocks) {
    const fullText = b.join(' ');
    const dateMatch = b[0].match(DATE_RX);
    if (!dateMatch) continue;
    
    const rawDate = dateMatch[0];
    // Convertir DD.MM.YY en DD.MM.20YY
    const fullDate = rawDate.replace(/(\d{2}\.\d{2}\.)(\d{2})$/, '$120$2');
    
    // Extraire tous les montants
    const amounts = fullText.match(AMOUNT_RX) || [];
    if (amounts.length === 0) continue;
    
    // Le dernier montant non-date est généralement le solde
    // Format: montant crédit/débit | date valeur | solde
    // Chercher le solde (dernier grand nombre)
    let solde = toFloat(amounts[amounts.length - 1]);
    
    // Calculer débit/crédit à partir du delta
    const delta = Math.round((solde - prevBalance) * 100) / 100;
    const montant = Math.abs(delta);
    
    let debit: number | null = null;
    let credit: number | null = null;
    
    if (delta < 0) {
      debit = montant;
    } else if (delta > 0) {
      credit = montant;
    }
    
    // Construire la description
    let desc = fullText
      .replace(DATE_RX, '')
      .replace(/\d{2}\.\d{2}\.\d{2}/g, '');
    amounts.forEach(a => desc = desc.replace(a, ''));
    desc = desc
      .replace(/CHF/gi, '')
      .replace(/DONNEUR D'ORDRE:/gi, '')
      .replace(/EXPÉDITEUR:/gi, '')
      .replace(/COMMUNICATIONS:/gi, '')
      .replace(/RÉFÉRENCES:/gi, '')
      .replace(/REFERENCES:/gi, '')
      .replace(/MONTANT DE FRAIS.*?SHA/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!desc || desc.length < 2) desc = '(transaction)';
    
    transactions.push({ date: fullDate, description: desc, debit, credit, solde });
    prevBalance = solde;
  }
  
  return transactions;
};

/* ==================== Credit Suisse ==================== */
export const parseCreditSuisseTransactions = (text: string): BankTransaction[] => {
  // Credit Suisse format: Date comptable | Texte | Débit | Crédit | Date de valeur | Solde
  // Les débits sont marqués avec un montant, les crédits aussi, le "-" indique pas de valeur
  const DATE_RX = /^\d{2}\.\d{2}\.\d{4}/;
  const AMOUNT_RX = /[\d']+[.,]\d{2}/g;
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Grouper les lignes en blocs de transaction
  const blocks: string[][] = [];
  let block: string[] = [];
  let startParsing = false;
  
  for (const line of lines) {
    // Détecter le début du tableau
    if (line.includes('Date comptable') && line.includes('Texte')) {
      startParsing = true;
      continue;
    }
    if (!startParsing) continue;
    
    // Ignorer les headers/footers
    if (line.includes('CREDIT SUISSE') || line.includes('Crée le') ||
        line.includes('Assistance clientèle') || line.includes('Suisse:') ||
        line.match(/^\d+\s*\/\s*\d+$/)) continue;
    
    if (DATE_RX.test(line)) {
      if (block.length > 0) blocks.push([...block]);
      block = [line];
    } else if (block.length > 0) {
      block.push(line);
    }
  }
  if (block.length > 0) blocks.push(block);
  
  console.log('Credit Suisse - Blocs trouvés:', blocks.length);
  
  const transactions: BankTransaction[] = [];
  
  for (const b of blocks) {
    const firstLine = b[0];
    const dateMatch = firstLine.match(DATE_RX);
    if (!dateMatch) continue;
    
    const date = dateMatch[0];
    const fullText = b.join(' ');
    const amounts = fullText.match(AMOUNT_RX) || [];
    
    if (amounts.length === 0) continue;
    
    // Le dernier montant est le solde
    const solde = toFloat(amounts[amounts.length - 1]);
    
    // Analyser la structure: Débit | Crédit | Date valeur | Solde
    // Si le débit est "-", c'est un crédit et vice versa
    let debit: number | null = null;
    let credit: number | null = null;
    
    // Chercher dans la première ligne les indicateurs
    if (firstLine.includes(' - ')) {
      // Il y a un "-" qui indique absence de valeur
      // Format typique: "29.12.2025 Frais du paquet Business Easy 33.00 - 31.12.2025 48'793.32"
      const parts = firstLine.split(/\s+/);
      for (let i = 0; i < parts.length; i++) {
        if (parts[i] === '-' && i > 0) {
          // Le montant avant le "-" est soit débit soit crédit
          // Si le "-" est après un montant, c'est un débit (pas de crédit)
          const prevPart = parts[i - 1];
          if (prevPart.match(AMOUNT_RX)) {
            debit = toFloat(prevPart);
          } else if (i + 1 < parts.length && parts[i + 1].match(AMOUNT_RX)) {
            // Le montant après le "-" est un crédit
            credit = toFloat(parts[i + 1]);
          }
          break;
        }
      }
    }
    
    // Si pas trouvé avec "-", utiliser le premier montant comme mouvement
    if (debit === null && credit === null && amounts.length >= 2) {
      const firstAmount = toFloat(amounts[0]);
      // Heuristique: si c'est le même que le solde, ignorer
      if (firstAmount !== solde) {
        // Déterminer si c'est un débit ou crédit en regardant le contexte
        if (firstLine.toLowerCase().includes('frais') || firstLine.toLowerCase().includes('paiement')) {
          debit = firstAmount;
        } else {
          credit = firstAmount;
        }
      }
    }
    
    // Construire la description
    let desc = fullText
      .replace(DATE_RX, '')
      .replace(/\d{2}\.\d{2}\.\d{4}/g, '');
    amounts.forEach(a => desc = desc.replace(a, ''));
    desc = desc.replace(/\s*-\s*/g, ' ').replace(/CHF/gi, '').replace(/\s+/g, ' ').trim();
    
    if (!desc || desc.length < 2) desc = '(transaction)';
    
    transactions.push({ date, description: desc, debit, credit, solde });
  }
  
  return transactions;
};

/* ==================== Migros ==================== */
export const parseMigrosTransactions = (text: string): BankTransaction[] => {
  // Migros format similaire à BCGE: Date | Texte écriture | Valeur | Débit | Écriture de crédit | Solde CHF
  // Les montants utilisent l'apostrophe comme séparateur de milliers
  const DATE_RX = /^\d{2}\.\d{2}\.\d{4}/;
  const AMOUNT_RX = /[\d']+[.,]\d{2}/g;
  
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  
  // Chercher le solde initial
  let initialBalance: number | null = null;
  for (const line of lines) {
    if (line.toLowerCase().includes('solde initial') || line.toLowerCase().includes('solde au')) {
      const amounts = line.match(AMOUNT_RX);
      if (amounts) initialBalance = toFloat(amounts[amounts.length - 1]);
      break;
    }
  }
  
  console.log('Migros - Solde initial:', initialBalance);
  
  // Grouper les lignes en blocs de transaction
  const blocks: string[][] = [];
  let block: string[] = [];
  let startParsing = false;
  
  for (const line of lines) {
    // Détecter le début du tableau
    if (line.includes('Date') && line.includes('Texte') && line.includes('Solde')) {
      startParsing = true;
      continue;
    }
    if (!startParsing) continue;
    
    // Ignorer les headers/footers
    if (line.includes('BANQUE MIGROS') || line.includes('Extrait de compte') ||
        line.includes('Page ') || line.includes('Indications sans engagement') ||
        line.toLowerCase().includes('solde initial') || line.toLowerCase().includes('solde final') ||
        line.toLowerCase().includes('débits') || line.toLowerCase().includes('écritures de crédit')) continue;
    
    if (DATE_RX.test(line)) {
      if (block.length > 0) blocks.push([...block]);
      block = [line];
    } else if (block.length > 0) {
      block.push(line);
    }
  }
  if (block.length > 0) blocks.push(block);
  
  console.log('Migros - Blocs trouvés:', blocks.length);
  
  const transactions: BankTransaction[] = [];
  let prevBalance = initialBalance ?? 0;
  
  for (const b of blocks) {
    const firstLine = b[0];
    const dateMatch = firstLine.match(DATE_RX);
    if (!dateMatch) continue;
    
    const date = dateMatch[0];
    const fullText = b.join(' ');
    const amounts = fullText.match(AMOUNT_RX) || [];
    
    if (amounts.length === 0) continue;
    
    // Le dernier montant de la première ligne est souvent le solde
    // Ou chercher dans les lignes suivantes "Solde CHF"
    let solde = 0;
    const firstLineAmounts = firstLine.match(AMOUNT_RX) || [];
    if (firstLineAmounts.length > 0) {
      solde = toFloat(firstLineAmounts[firstLineAmounts.length - 1]);
    } else {
      // Chercher le solde dans le texte complet
      solde = toFloat(amounts[amounts.length - 1]);
    }
    
    // Calculer débit/crédit à partir du delta
    const delta = Math.round((solde - prevBalance) * 100) / 100;
    const montant = Math.abs(delta);
    
    let debit: number | null = null;
    let credit: number | null = null;
    
    if (delta < 0) {
      debit = montant;
    } else if (delta > 0) {
      credit = montant;
    }
    
    // Construire la description
    let desc = fullText
      .replace(DATE_RX, '')
      .replace(/\d{2}\.\d{2}\.\d{4}/g, '');
    amounts.forEach(a => desc = desc.replace(a, ''));
    desc = desc
      .replace(/CHF/gi, '')
      .replace(/Bénéficiaire/gi, '')
      .replace(/Compte du bénéficiaire.*$/gi, '')
      .replace(/Montant/gi, '')
      .replace(/Communication\/Référence/gi, '')
      .replace(/\(No\. BC\)/gi, '')
      .replace(/CH\d{2,}/g, '')  // Remove IBAN-like
      .replace(/\(\d+\)/g, '')   // Remove bank codes
      .replace(/\d{2}\s+\d{5}\s+\d{5}/g, '')  // Remove reference numbers
      .replace(/\s+/g, ' ')
      .trim();
    
    if (!desc || desc.length < 2) desc = '(transaction)';
    
    transactions.push({ date, description: desc, debit, credit, solde });
    prevBalance = solde;
  }
  
  return transactions;
};

/**
 * Parser principal
 */
export const parseTransactionsFromText = (text: string, bankType: BankType = 'bcge'): BankTransaction[] => {
  console.log('Parsing for bank:', bankType);

  if (bankType === 'raiffeisen') return parseRaiffeisenTransactions(text);
  if (bankType === 'ubs') return parseUBSTransactions(text);
  if (bankType === 'postfinance') return parsePostFinanceTransactions(text);
  if (bankType === 'creditsuisse') return parseCreditSuisseTransactions(text);
  if (bankType === 'migros') return parseMigrosTransactions(text);

  return parseBCGETransactions(text);
};

/* Fonctions Excel (inchangées) */
export const createBankExcelFile = (data: BankTransaction[]): XLSX.WorkBook => {
  const exportData = data.map(row => ({
    'Date': row.date,
    'Description / Texte': row.description,
    'Débit (-)': row.debit,
    'Crédit (+)': row.credit,
    'Solde (CHF)': row.solde
  }));
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet['!cols'] = [{ wch: 12 }, { wch: 60 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Relevé');
  return workbook;
};

export const downloadBankExcelFile = (workbook: XLSX.WorkBook, filename = 'Releve_Bancaire.xlsx'): void => {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
