import * as XLSX from 'xlsx';

export interface CamtData {
  montant: string;
  devise: string;
  creditDebit: string;
  dateComptabilisation: string;
  dateValeur: string;
  nomDebiteur: string;
  ibanDebiteur: string;
  ibanCreancier: string;
  referenceProprietaire: string;
  endToEndId: string;
  instructionId: string;
  banqueDebiteur: string;
  informationsSupplementaires: string;
}

export const camtHeaders = [
  "Montant", "Devise", "Crédit/Débit", "Date de comptabilisation", "Date de valeur",
  "Nom du débiteur", "IBAN du débiteur", "IBAN du créancier",
  "Référence propriétaire", "EndToEndId", "InstructionId",
  "Banque du débiteur", "Informations supplémentaires"
];

const ns = "urn:iso:std:iso:20022:tech:xsd:camt.054.001.04";

function getElementText(element: Element | null): string {
  return element?.textContent?.trim() || "";
}

function findElementNS(parent: Element, selector: string): Element | null {
  const parts = selector.split('/');
  let current = parent;
  
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') {
      current = current.parentElement as Element;
      continue;
    }
    
    const tagName = part.startsWith('ns:') ? part.substring(3) : part;
    const found = Array.from(current.children).find(child => 
      child.localName === tagName || child.tagName.endsWith(':' + tagName)
    );
    
    if (!found) return null;
    current = found;
  }
  
  return current;
}

function findAllElementsNS(parent: Element, selector: string): Element[] {
  const parts = selector.split('//');
  if (parts.length !== 2) return [];
  
  const tagName = parts[1].startsWith('ns:') ? parts[1].substring(3) : parts[1];
  const elements: Element[] = [];
  
  function traverse(element: Element) {
    if (element.localName === tagName || element.tagName.endsWith(':' + tagName)) {
      elements.push(element);
    }
    
    Array.from(element.children).forEach(child => traverse(child));
  }
  
  traverse(parent);
  return elements;
}

export function parseCamtXml(xmlString: string): CamtData[] {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Erreur de parsing XML: ' + parserError.textContent);
  }
  
  const root = xmlDoc.documentElement;
  const entries = findAllElementsNS(root, '//Ntry');
  
  const results: CamtData[] = [];
  
  entries.forEach(entry => {
    const amtElement = findElementNS(entry, 'Amt');
    const montant = getElementText(amtElement);
    const devise = amtElement?.getAttribute('Ccy') || '';
    const sens = getElementText(findElementNS(entry, 'CdtDbtInd'));
    
    const dateComptaElement = findElementNS(entry, 'BookgDt/Dt');
    const dateCompta = getElementText(dateComptaElement);
    
    const dateValeurElement = findElementNS(entry, 'ValDt/Dt');
    const dateValeur = getElementText(dateValeurElement);
    
    const infoSupElement = findElementNS(entry, 'AddtlNtryInf');
    const infoSup = getElementText(infoSupElement);
    
    // Find all transaction details within this entry
    const txDetails = findAllElementsNS(entry, '//TxDtls');
    
    if (txDetails.length === 0) {
      // No transaction details, create a single row with entry data
      results.push({
        montant,
        devise,
        creditDebit: sens,
        dateComptabilisation: dateCompta,
        dateValeur,
        nomDebiteur: '',
        ibanDebiteur: '',
        ibanCreancier: '',
        referenceProprietaire: '',
        endToEndId: '',
        instructionId: '',
        banqueDebiteur: '',
        informationsSupplementaires: infoSup
      });
    } else {
      // Process each transaction detail
      txDetails.forEach(tx => {
        const instrId = getElementText(findElementNS(tx, 'Refs/InstrId'));
        const endToEnd = getElementText(findElementNS(tx, 'Refs/EndToEndId'));
        const ref = getElementText(findElementNS(tx, 'Refs/Prtry/Ref'));
        
        const debiteurNom = getElementText(findElementNS(tx, 'RltdPties/Dbtr/Nm'));
        const debiteurIban = getElementText(findElementNS(tx, 'RltdPties/DbtrAcct/Id/IBAN'));
        const crediteurIban = getElementText(findElementNS(tx, 'RltdPties/CdtrAcct/Id/IBAN'));
        
        const banqueDebiteur = getElementText(findElementNS(tx, 'RltdAgts/DbtrAgt/FinInstnId/Nm'));
        
        results.push({
          montant,
          devise,
          creditDebit: sens,
          dateComptabilisation: dateCompta,
          dateValeur,
          nomDebiteur: debiteurNom,
          ibanDebiteur: debiteurIban,
          ibanCreancier: crediteurIban,
          referenceProprietaire: ref,
          endToEndId: endToEnd,
          instructionId: instrId,
          banqueDebiteur,
          informationsSupplementaires: infoSup
        });
      });
    }
  });
  
  return results;
}

export function createCamtExcelFile(data: CamtData[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  
  // Create worksheet data
  const wsData = [
    camtHeaders,
    ...data.map(row => [
      row.montant,
      row.devise,
      row.creditDebit,
      row.dateComptabilisation,
      row.dateValeur,
      row.nomDebiteur,
      row.ibanDebiteur,
      row.ibanCreancier,
      row.referenceProprietaire,
      row.endToEndId,
      row.instructionId,
      row.banqueDebiteur,
      row.informationsSupplementaires
    ])
  ];
  
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  
  // Auto-size columns
  const maxWidths = camtHeaders.map((_, colIndex) => {
    return Math.max(
      camtHeaders[colIndex].length,
      ...wsData.slice(1).map(row => String(row[colIndex] || '').length)
    );
  });
  
  ws['!cols'] = maxWidths.map(width => ({ width: Math.min(width + 2, 50) }));
  
  XLSX.utils.book_append_sheet(wb, ws, "Paiements");
  
  return wb;
}

export function downloadCamtExcelFile(workbook: XLSX.WorkBook, filename: string = 'Paiements.xlsx'): void {
  XLSX.writeFile(workbook, filename);
}

export function processCamtFiles(files: File[]): Promise<{ allData: CamtData[], totalFiles: number, totalRows: number }> {
  return new Promise((resolve, reject) => {
    let completedFiles = 0;
    const allData: CamtData[] = [];
    let hasError = false;
    
    if (files.length === 0) {
      reject(new Error('Aucun fichier à traiter'));
      return;
    }
    
    files.forEach((file, index) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          if (hasError) return;
          
          const xmlString = e.target?.result as string;
          const data = parseCamtXml(xmlString);
          allData.push(...data);
          
          completedFiles++;
          
          if (completedFiles === files.length) {
            resolve({
              allData,
              totalFiles: files.length,
              totalRows: allData.length
            });
          }
        } catch (error) {
          if (!hasError) {
            hasError = true;
            reject(new Error(`Erreur dans le fichier ${file.name}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`));
          }
        }
      };
      
      reader.onerror = () => {
        if (!hasError) {
          hasError = true;
          reject(new Error(`Impossible de lire le fichier ${file.name}`));
        }
      };
      
      reader.readAsText(file, 'utf-8');
    });
  });
}