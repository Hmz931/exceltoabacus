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

/* ==================== UBS (amélioré) ==================== */
export const parseUBSTransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const amountPattern = /-?[\d']+[.,]\d{2}(?!\d)/g;
  const lines = text.split('\n');
  const rows: string[][] = [];
  let transactionLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (datePattern.test(trimmed)) {
      if (transactionLines.length > 0) rows.push([...transactionLines]);
      transactionLines = [trimmed];
    } else if (transactionLines.length > 0) {
      transactionLines.push(trimmed);
    }
  }
  if (transactionLines.length > 0) rows.push(transactionLines);

  let initialBalance: number | null = null;
  for (const line of lines) {
    if (line.toLowerCase().includes('solde initial')) {
      const amounts = line.match(amountPattern) || [];
      if (amounts.length > 0) initialBalance = toFloat(amounts[amounts.length - 1]);
      break;
    }
  }

  const structuredData: { date: string; texte: string; soldeNum: number }[] = [];

  for (const block of rows) {
    const firstLine = block[0];
    const dateMatch = firstLine.match(datePattern);
    if (!dateMatch) continue;

    const date = dateMatch[0];
    const amounts = firstLine.match(amountPattern) || [];
    const balanceVal = amounts.length > 0 ? toFloat(amounts[amounts.length - 1]) : 0.0;

    let clean = firstLine.replace(datePattern, '');
    amounts.forEach(a => clean = clean.replace(a, ''));
    clean = clean.trim();

    let fullText = clean + ' ' + block.slice(1).join(' ');
    fullText = fullText.replace(/CHF/gi, '').replace(/\d{2}\.\d{2}\.\d{4}/g, '').replace(/\s+/g, ' ').trim();

    if (fullText.toLowerCase().includes('solde') && (fullText.toLowerCase().includes('final') || fullText.toLowerCase().includes('initial'))) continue;
    if (!fullText || fullText.length < 3) continue;

    structuredData.push({ date, texte: fullText, soldeNum: balanceVal });
  }

  const transactions: BankTransaction[] = [];
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
      const rounded = Math.round(delta * 100) / 100;
      if (rounded < 0) debit = Math.abs(rounded);
      else if (rounded > 0) credit = rounded;
    }
    transactions.push({ date: row.date, description: row.texte, debit, credit, solde: row.soldeNum });
  }

  transactions.reverse(); // oldest first
  return transactions;
};

/* ==================== PostFinance (amélioré) ==================== */
export const parsePostFinanceTransactions = (text: string): BankTransaction[] => {
  const DATE_RX = /^\d{2}\.\d{2}\.\d{2}/;
  const SOLDE_RX = /[\d' ]+\.\d{2}/g;
  const FIN_RX = /([\d' ]+\.\d{2})\s+([\d' ]+\.\d{2})\s+(\d{2}\.\d{2}\.\d{2})/;

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
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

    if (norm.includes('etatdecompte') || norm.includes('soldereporté')) {
      const matches = line.match(SOLDE_RX);
      if (matches) currentBalance = toFloat(matches[matches.length - 1]);
      continue;
    }

    if (DATE_RX.test(line)) {
      if (block.length > 0) blocks.push([...block]);
      block = [line];
    } else if (block.length > 0) {
      block.push(line);
    }
  }
  if (block.length > 0) blocks.push(block);

  if (currentBalance === null) return [];

  const transactions: BankTransaction[] = [];
  for (const b of blocks) {
    if (b.length === 0) continue;
    const rawDate = b[0].slice(0, 8); // DD.MM.YY
    const fullDate = rawDate.replace(/(\d{2}\.\d{2}\.)(\d{2})/, '$120'); // 20YY

    let fullText = b.join(' ').replace(/\s+/g, ' ').trim();
    const m = fullText.match(FIN_RX);
    if (!m) continue;

    const soldeStr = m[2];
    const valeur = m[3];
    const newSolde = toFloat(soldeStr);
    const delta = Math.round((newSolde - currentBalance) * 100) / 100;
    const montant = Math.abs(delta);
    const isDebit = delta < 0;

    let desc = fullText
      .replace(rawDate, '')
      .replace(soldeStr, '')
      .replace(valeur, '')
      .replace(/RÉFÉRENCE DE L'EXPEDITEUR:/gi, '')
      .replace(/COMMUNICATIONS:/gi, '')
      .replace(/REFERENCES:/gi, '')
      .replace(/\s+/g, ' ').trim();

    if (!desc) desc = '(transaction non décrite)';

    transactions.push({
      date: fullDate,
      description: desc,
      debit: isDebit ? montant : null,
      credit: !isDebit ? montant : null,
      solde: newSolde
    });
    currentBalance = newSolde;
  }
  return transactions;
};

/* ==================== Credit Suisse (amélioré) ==================== */
export const parseCreditSuisseTransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{2}/;
  const amountPattern = /-?[\d']+[.,]\d{2}(?!\d)/g;
  const lines = text.split('\n');
  const rows: string[][] = [];
  let transactionLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (datePattern.test(trimmed)) {
      if (transactionLines.length > 0) rows.push([...transactionLines]);
      transactionLines = [trimmed];
    } else if (transactionLines.length > 0) {
      transactionLines.push(trimmed);
    }
  }
  if (transactionLines.length > 0) rows.push(transactionLines);

  let initialBalance: number | null = null;
  for (const line of lines) {
    if (line.toLowerCase().includes('solde reporté')) {
      const amounts = line.match(amountPattern) || [];
      if (amounts.length > 0) initialBalance = toFloat(amounts[amounts.length - 1]);
      break;
    }
  }

  const structuredData: { date: string; texte: string; soldeNum: number }[] = [];
  for (const block of rows) {
    const firstLine = block[0];
    const dateMatch = firstLine.match(datePattern);
    if (!dateMatch) continue;

    const rawDate = dateMatch[0];
    const fullDate = rawDate.replace(/(\d{2}\.\d{2}\.)(\d{2})/, '$120');

    const amounts = firstLine.match(amountPattern) || [];
    const balanceVal = amounts.length > 0 ? toFloat(amounts[amounts.length - 1]) : 0.0;

    let clean = firstLine.replace(datePattern, '');
    amounts.forEach(a => clean = clean.replace(a, ''));
    clean = clean.trim();

    let fullText = clean + ' ' + block.slice(1).join(' ');
    fullText = fullText.replace(/CHF/gi, '').replace(/\d{2}\.\d{2}\.\d{2}/g, '').replace(/\s+/g, ' ').trim();

    if (fullText.toLowerCase().includes('solde') && fullText.toLowerCase().includes('reporté')) continue;
    if (!fullText || fullText.length < 3) continue;

    structuredData.push({ date: fullDate, texte: fullText, soldeNum: balanceVal });
  }

  const transactions: BankTransaction[] = [];
  let prevSolde = initialBalance ?? 0;
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

/* ==================== Migros (amélioré pour soldes retardés) ==================== */
export const parseMigrosTransactions = (text: string): BankTransaction[] => {
  const datePattern = /^\d{2}\.\d{2}\.\d{4}/;
  const rows: string[][] = [];
  const lines = text.split('\n');
  let transactionLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (datePattern.test(trimmed)) {
      if (transactionLines.length > 0) rows.push([...transactionLines]);
      transactionLines = [trimmed];
    } else if (transactionLines.length > 0) {
      transactionLines.push(trimmed);
    }
  }
  if (transactionLines.length > 0) rows.push(transactionLines);

  const structuredData: { date: string; texte: string; soldeNum: number }[] = [];
  let lastSolde = 0;

  for (const block of rows) {
    const firstLine = block[0];
    const dateMatch = firstLine.match(datePattern);
    if (!dateMatch) continue;

    const date = dateMatch[0];
    const amountPattern = /[\d']+[.,]\d{2}(?!\d)/g;
    const amounts = firstLine.match(amountPattern) || [];
    let balanceVal = amounts.length > 0 ? toFloat(amounts[amounts.length - 1]) : lastSolde;

    let firstLineClean = firstLine.replace(datePattern, '');
    amounts.forEach(amt => firstLineClean = firstLineClean.replace(amt, ''));
    firstLineClean = firstLineClean.trim();

    let fullText = firstLineClean + ' ' + block.slice(1).join(' ');
    fullText = fullText.replace(/CHF/gi, '').replace(/\/C\//gi, '').replace(/Donneur d'ordre/gi, '').replace(/Communication\/Référence/gi, '').replace(/\s+/g, ' ').trim();

    if (fullText.toLowerCase().includes('solde initial')) continue;
    if (!fullText || fullText.length < 3) continue;

    // If the solde is not on this line, keep previous
    if (balanceVal === lastSolde && amounts.length === 0) {
      // Look for "Solde CHF" in block
      const soldeMatch = fullText.match(/Solde CHF\s*([\d']+[.,]\d{2})/i);
      if (soldeMatch) balanceVal = toFloat(soldeMatch[1]);
    }

    structuredData.push({ date, texte: fullText, soldeNum: balanceVal });
    lastSolde = balanceVal;
  }

  const transactions: BankTransaction[] = [];
  for (let i = 0; i < structuredData.length; i++) {
    const row = structuredData[i];
    let debit: number | null = null;
    let credit: number | null = null;
    if (i > 0) {
      const delta = row.soldeNum - structuredData[i - 1].soldeNum;
      const rounded = Math.round(delta * 100) / 100;
      if (rounded < 0) debit = Math.abs(rounded);
      else if (rounded > 0) credit = rounded;
    }
    transactions.push({ date: row.date, description: row.texte, debit, credit, solde: row.soldeNum });
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
