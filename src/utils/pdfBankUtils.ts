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
 * Parse BCGE PDF text content and extract bank transactions
 * ────────────────────────────────────────────────────────────────
 * → KEPT EXACTLY AS IN YOUR GITHUB VERSION
 */
/**
 * Parse BCGE PDF (format 2024+) – version corrigée pour multi-lignes + solde correct
 */
export const parseBCGETransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const amountPattern = /[\d']+\.\d{2}(?!\d)/g;   // meilleur regex pour montants suisses

  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  console.log('[BCGE] Lignes totales:', lines.length);

  for (const line of lines) {
    if (datePattern.test(line)) {
      if (currentBlock.length > 0) {
        blocks.push([...currentBlock]);
      }
      currentBlock = [line];
    } else if (currentBlock.length > 0) {
      currentBlock.push(line);
    }
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  console.log('[BCGE] Blocs détectés:', blocks.length);

  const transactions: BankTransaction[] = [];
  let previousSolde: number | null = null;

  for (const block of blocks) {
    if (block.length === 0) continue;

    const firstLine = block[0];
    const dateMatch = firstLine.match(datePattern);
    if (!dateMatch) continue;
    const date = dateMatch[0];

    // === Extraction du solde (dernier montant du bloc) ===
    let solde = 0;
    for (let i = block.length - 1; i >= 0; i--) {
      const matches = block[i].match(amountPattern);
      if (matches && matches.length > 0) {
        solde = toFloat(matches[matches.length - 1]);
        break;
      }
    }

    // === Construction description complète ===
    let description = block
      .slice(1)                                      // enlever la ligne de date
      .join(' ')
      .replace(/Donneur d'ordre\s*/gi, '')
      .replace(/Bénéficiaire\s*/gi, '')
      .replace(/Montant\s*CHF\s*/gi, '')
      .replace(/Communication\/Référence\s*/gi, '')
      .replace(/CHF\s*/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!description) description = '(transaction sans description)';

    // === Calcul débit / crédit via delta ===
    let debit: number | null = null;
    let credit: number | null = null;

    if (previousSolde !== null) {
      const delta = Math.round((solde - previousSolde) * 100) / 100;
      if (delta < 0) debit = Math.abs(delta);
      else if (delta > 0) credit = delta;
    }

    transactions.push({
      date,
      description,
      debit,
      credit,
      solde
    });

    previousSolde = solde;
  }

  console.log('[BCGE] Transactions extraites:', transactions.length);
  return transactions;
};
/**
 * Improved Raiffeisen parser – based on delta of solde + better line grouping
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
      .replace(/EUR\s*\d+[,.]\d{2}/gi, '')     // remove foreign currency lines noise
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
  
  worksheet['!cols'] = [
    { wch: 12 },   // Date
    { wch: 70 },   // Description – increased width
    { wch: 14 },   // Débit
    { wch: 14 },   // Crédit
    { wch: 14 }    // Solde
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
