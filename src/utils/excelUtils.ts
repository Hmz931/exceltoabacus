
import * as XLSX from 'xlsx';

export interface ExcelRow {
  [key: string]: any;
}

export const requiredHeaders = ["Date", "Compte", "Contrepartie", "Texte1", "Montant", "Code TVA"];

// TVA rates mapping based on the code
export const tauxTVAMapping: { [key: number]: number } = {
  111: 7.7, 121: 7.7, 131: 8.1, 132: 2.6,
  141: 8.1, 142: 2.6, 144: 3.8, 311: 7.7,
  312: 2.5, 511: 8.1, 512: 2.6, 516: 100,
  112: 2.5, 122: 2.5, 126: 0, 136: 0,
  116: 0, 200: 0, 400: 0, 401: 0,
  115: 100, 125: 100
};

// Define the columns for the output Excel file
export const outputColumns = [
  "N° enregistrement", "Version", "Date", "Compte", "Contrepartie", "Texte1", "Montant", "Texte2", "DC",
  "Niveau d'imputation 1", "Contrepartie niveau d'imputation 1", "Numéro du document", "Cours", "Gre cours",
  "Montant ME", "Identificateur écriture collective", "Spec1", "Applicationidentification", "Réserve", "Date de valeur",
  "Position coll.", "Réserve", "N° mandant", "ISO", "ISO2", "Quantité", "Taux", "Niveau d'imputation 2",
  "Contrepartie niveau d'imputation 2", "Fond1", "Fond2", "Réserve", "Réserve", "Réserve", "Champ de code", "Code TVA",
  "Taux TVA", "TVA incl.", "Méthode TVA", "Pays de TVA", "Coeff. TVA", "Compte TVA", "Contrepartie TVA", "DC TVA",
  "Montant TVA", "TVA montant ME", "Reste montant TVA", "Reste TVA montant ME", "Réserve", "Type TVA", "Réserve",
  "Réserve", "Réserve", "Division", "Budgétisés / Réel", "MontantCollCondCrédit", "MEMontantCollCondCrédit", "Coeff1 Euro",
  "Coeff2 Euro", "Intercompany", "Cours2", "Code de consolidation", "Niveau d'imputation 3", "Contrepartie niveau d'imputation 3"
];

// Check if the Excel file has all required headers
export const validateHeaders = (headers: string[]): string[] => {
  return requiredHeaders.filter(header => !headers.includes(header));
};

// Transform data according to the specified rules
export const transformData = (jsonData: ExcelRow[]): ExcelRow[] => {
  return jsonData.map((row, index) => {
    const codeTVA = row["Code TVA"];
    const montant = row["Montant"] || 0;
    const texte1 = row["Texte1"] ? String(row["Texte1"]).substring(0, 80) : "";

    const tauxTVA = codeTVA ? (tauxTVAMapping[codeTVA] || 0) : 0;
    const tvaIncl = codeTVA ? "I" : "";
    const coeffTVA = 100;
    const compteTVA = codeTVA ? row["Compte"] || 0 : 0;
    const contrepartieTVA = codeTVA ? 1172 : 0;
    const dcTVA = codeTVA ? 2 : 0;
    const montantTVA = tauxTVA > 0 ? -(Math.round((montant - (montant / (1 + tauxTVA / 100))) * 100) / 100) : 0;
    const typeTVA = codeTVA ? 2 : 0;

    return {
      "N° enregistrement": index + 1, 
      "Version": "J", 
      "Date": row["Date"], 
      "Compte": row["Compte"],
      "Contrepartie": row["Contrepartie"] || "", 
      "Texte1": texte1, 
      "Montant": montant, 
      "Texte2": "",
      "DC": "D", 
      "Niveau d'imputation 1": 0, 
      "Contrepartie niveau d'imputation 1": 0, 
      "Numéro du document": "",
      "Cours": 0, 
      "Gre cours": "", 
      "Montant ME": 0, 
      "Identificateur écriture collective": "",
      "Spec1": "", 
      "Applicationidentification": "F", 
      "Réserve": "", 
      "Date de valeur": "", 
      "Position coll.": 0,
      "ISO": "CHF", 
      "ISO2": "CHF", 
      "Quantité": 0, 
      "Taux": 0, 
      "Niveau d'imputation 2": 0,
      "Contrepartie niveau d'imputation 2": 0, 
      "Fond1": 0, 
      "Fond2": 0, 
      "Champ de code": "", 
      "Code TVA": codeTVA,
      "Taux TVA": tauxTVA, 
      "TVA incl.": tvaIncl, 
      "Méthode TVA": 2, 
      "Pays de TVA": "CH", 
      "Coeff. TVA": coeffTVA,
      "Compte TVA": compteTVA, 
      "Contrepartie TVA": contrepartieTVA, 
      "DC TVA": dcTVA, 
      "Montant TVA": montantTVA,
      "TVA montant ME": 0, 
      "Reste montant TVA": 0, 
      "Reste TVA montant ME": 0, 
      "Type TVA": typeTVA, 
      "Division": 0,
      "Budgétisés / Réel": 0, 
      "MontantCollCondCrédit": 0, 
      "MEMontantCollCondCrédit": 0, 
      "Coeff1 Euro": 1,
      "Coeff2 Euro": 1, 
      "Intercompany": 0, 
      "Cours2": 0, 
      "Code de consolidation": "", 
      "Niveau d'imputation 3": 0,
      "Contrepartie niveau d'imputation 3": 0
    };
  });
};

// Generate summary statistics from transformed data
export interface SummaryData {
  totalTransactions: number;
  encaissements: {
    count: number;
    total: number;
    details: { 
      [key: string]: {
        count: number;
        total: number;
      }
    };
  };
  decaissements: {
    count: number;
    total: number;
    salaires: {
      count: number;
      amount: number;
    };
    achatsDirects: {
      count: number;
      amount: number;
    };
    achatsIndirects: {
      count: number;
      amount: number;
    };
  };
}

export const generateSummary = (outputData: ExcelRow[]): SummaryData => {
  let encaissements = { 
    count: 0, 
    total: 0, 
    details: {} as { [key: string]: { count: number; total: number } }
  };
  
  let decaissements = { 
    count: 0, 
    total: 0,
    salaires: { count: 0, amount: 0 },
    achatsDirects: { count: 0, amount: 0 },
    achatsIndirects: { count: 0, amount: 0 }
  };

  outputData.forEach((row) => {
    const compte = row["Compte"];
    const montant = parseFloat(row["Montant"]) || 0;

    if (compte >= 1000 && compte <= 1999) {
      encaissements.count++;
      encaissements.total += montant;
      
      if (!encaissements.details[compte]) {
        encaissements.details[compte] = { count: 0, total: 0 };
      }
      
      encaissements.details[compte].count++;
      encaissements.details[compte].total += montant;
    } else {
      decaissements.count++;
      decaissements.total += montant;
      
      if (compte == 2299) {
        decaissements.salaires.count++;
        decaissements.salaires.amount += montant;
      }
      
      if (compte >= 4000 && compte <= 4999) {
        decaissements.achatsDirects.count++;
        decaissements.achatsDirects.amount += montant;
      }
      
      if (compte >= 6000 && compte <= 8999) {
        decaissements.achatsIndirects.count++;
        decaissements.achatsIndirects.amount += montant;
      }
    }
  });

  return {
    totalTransactions: outputData.length,
    encaissements,
    decaissements
  };
};

// Create Excel file from transformed data
export const createExcelFile = (data: ExcelRow[]): XLSX.WorkBook => {
  const outputSheet = XLSX.utils.json_to_sheet(data, { header: outputColumns });
  const outputWorkbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, 'Ecritures');
  return outputWorkbook;
};

// Download Excel file
export const downloadExcelFile = (workbook: XLSX.WorkBook, filename: string = 'F11_Ecritures.xlsx'): void => {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
