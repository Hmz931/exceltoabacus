import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, BarChart3, TrendingUp, Download, FileText, Info, BookOpen } from "lucide-react";
import abacusExportGuide from "@/assets/abacus-export-guide.png";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EntryData {
  date: Date;
  module: string;
  modificationUser?: string;
}

// User mapping for XML ModificationUser field
const USER_MAPPING: Record<string, string> = {
  "8": "David Gaudin",
  "9": "Kevin Nahmias",
  "11": "Eloïse Pitel",
  "17": "getyoozuneo_ws",
  "20": "Sameh Ben Amor",
  "23": "Hamza Bouguerra",
  "31": "Sylvain Köhli",
  "33": "Aida Jouini",
  "98": "Ancien collaborateur",
  "111": "Mike Cottier",
  "162": "Mahdi Cherif",
  "170": "Ancien collaborateur",
  "186": "Helmi Jouini",
  "190": "Yohanna Channel",
  "191": "Mariya Gesheva",
  "200": "Igor Maia",
  "247": "Christophe Guillaud",
  "315": "Lamber FALQUET",
  "318": "Julien Simmonet",
  "369": "Rodolphe Droin",
  "416": "Jolan Labhard",
  "417": "Imène Ben Rabeb",
  "487": "Salem Ben-farhat",
};

type PeriodType = "day" | "month" | "quarter" | "semester" | "year";

const MONTH_NAMES = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const QUARTER_NAMES = ["Q1", "Q2", "Q3", "Q4"];
const SEMESTER_NAMES = ["S1", "S2"];

// Module descriptions
const MODULE_DESCRIPTIONS: Record<string, string> = {
  "F": "Comptabilité financière",
  "CF": "Comptabilité financière écriture multiple",
  "SF": "Comptabilité financière écriture multiple",
  "K": "Facture d'achat: Saisie",
  "k": "Facture d'achat: Paiement",
  "D": "Facture de vente: Saisie",
  "d": "Facture de vente: Paiement",
  "Y": "EBICS (Electronic Banking)",
  "L": "Salaire (Lohn)",
  "\"": "Écriture inconnue",
  "!": "Écriture de bouclement d'exercice automatique",
};

// Module categories
const MODULE_CATEGORIES: Record<string, string[]> = {
  "Comptabilité financière": ["F", "CF", "SF"],
  "Comptabilité Créanciers": ["K", "k"],
  "Comptabilité Débiteurs": ["D", "d"],
  "EBICS": ["Y"],
  "Salaires": ["L"],
};

const getModuleLabel = (module: string): string => {
  return MODULE_DESCRIPTIONS[module] || module;
};

const getModuleCategory = (module: string): string => {
  for (const [category, codes] of Object.entries(MODULE_CATEGORIES)) {
    if (codes.includes(module)) return category;
  }
  return "Autre";
};

const MODULE_COLORS: Record<string, string> = {
  "K": "#3b82f6",
  "k": "#3b82f6",
  "L": "#10b981",
  "F": "#f59e0b",
  "CF": "#f59e0b",
  "SF": "#f59e0b",
  "Y": "#8b5cf6",
  "D": "#06b6d4",
  "d": "#06b6d4",
  "!": "#ef4444",
  "?": "#6b7280",
};

const getModuleColor = (module: string, index: number): string => {
  const defaultColors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];
  return MODULE_COLORS[module] || defaultColors[index % defaultColors.length];
};

const EntryAnalysis = () => {
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodType>("quarter");
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [comparativeGroupByCategory, setComparativeGroupByCategory] = useState(false);
  const [reversedEntriesCount, setReversedEntriesCount] = useState(0);
  const [userStats, setUserStats] = useState<Record<string, Record<string, number>>>({});
  const [fileType, setFileType] = useState<"excel" | "xml" | null>(null);
  const { toast } = useToast();

  const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
    if (typeof dateValue === "number") {
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + dateValue * 86400000);
    }
    
    if (typeof dateValue === "string") {
      const dotMatch = dateValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dotMatch) {
        return new Date(parseInt(dotMatch[3]), parseInt(dotMatch[2]) - 1, parseInt(dotMatch[1]));
      }
      const dashMatch = dateValue.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (dashMatch) {
        return new Date(parseInt(dashMatch[1]), parseInt(dashMatch[2]) - 1, parseInt(dashMatch[3]));
      }
    }
    
    return null;
  };

  // Parse XML file
  const parseXmlFile = useCallback(async (file: File): Promise<{ entries: EntryData[], reversedCount: number, userCounts: Record<string, Record<string, number>> }> => {
    const text = await file.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");
    
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      throw new Error("Erreur de parsing XML: Le fichier n'est pas un XML valide");
    }

    const transactions = xmlDoc.querySelectorAll("Transaction");
    const parsedEntries: EntryData[] = [];
    let reversedCount = 0;
    // userCounts structure: { userName: { module: count } }
    const userCounts: Record<string, Record<string, number>> = {};

    transactions.forEach((transaction) => {
      const collectiveInfo = transaction.querySelector("CollectiveInformation");
      if (!collectiveInfo) return;

      const typeElement = collectiveInfo.querySelector("Type");
      const type = typeElement?.textContent?.trim() || "";

      // Skip reversed entries (Type = "Reversal")
      if (type === "Reversal") {
        reversedCount++;
        return;
      }

      const entryDateElement = collectiveInfo.querySelector("EntryDate");
      const bookingSourceElement = collectiveInfo.querySelector("BookingSource");
      const modificationUserElement = collectiveInfo.querySelector("ModificationUser");

      const entryDateStr = entryDateElement?.textContent?.trim() || "";
      const bookingSource = bookingSourceElement?.textContent?.trim() || "?";
      const modificationUserId = modificationUserElement?.textContent?.trim() || "";

      // Parse date (format: YYYY-MM-DD)
      const date = parseDate(entryDateStr);
      if (!date) return;

      // Track user stats by module
      if (modificationUserId) {
        const userName = USER_MAPPING[modificationUserId] || `Utilisateur #${modificationUserId}`;
        if (!userCounts[userName]) {
          userCounts[userName] = {};
        }
        userCounts[userName][bookingSource] = (userCounts[userName][bookingSource] || 0) + 1;
      }

      parsedEntries.push({
        date,
        module: bookingSource,
        modificationUser: modificationUserId,
      });
    });

    return { entries: parsedEntries, reversedCount, userCounts };
  }, []);

  // Parse Excel file
  const parseExcelFile = useCallback(async (file: File): Promise<{ entries: EntryData[], reversedCount: number }> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    if (jsonData.length < 2) {
      throw new Error("Le fichier est vide ou ne contient pas de données");
    }

    const dateColIndex = 2;
    const moduleColIndex = 17;
    const collectiveIdentifierColIndex = 15; // Column P - Identificateur écriture collective
    const parsedEntries: EntryData[] = [];
    let reversedCount = 0;

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const dateValue = row[dateColIndex];
      const moduleValue = row[moduleColIndex];
      const collectiveIdentifier = row[collectiveIdentifierColIndex];

      // Skip reversed entries (extournées) marked with "#"
      if (collectiveIdentifier && String(collectiveIdentifier).trim() === "#") {
        reversedCount++;
        continue;
      }

      const date = parseDate(dateValue);
      if (!date) continue;

      const module = moduleValue ? String(moduleValue).trim() : "?";
      parsedEntries.push({ date, module });
    }

    return { entries: parsedEntries, reversedCount };
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const fileName = file.name.toLowerCase();
      const isXml = fileName.endsWith(".xml");
      const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

      if (!isXml && !isExcel) {
        throw new Error("Format de fichier non supporté. Utilisez un fichier Excel (.xlsx, .xls) ou XML (.xml)");
      }

      let parsedEntries: EntryData[] = [];
      let reversedCount = 0;
      let userCounts: Record<string, Record<string, number>> = {};
      const moduleSet = new Set<string>();

      if (isXml) {
        const result = await parseXmlFile(file);
        parsedEntries = result.entries;
        reversedCount = result.reversedCount;
        userCounts = result.userCounts;
        setFileType("xml");
      } else {
        const result = await parseExcelFile(file);
        parsedEntries = result.entries;
        reversedCount = result.reversedCount;
        setFileType("excel");
        userCounts = {};
      }

      parsedEntries.forEach(entry => moduleSet.add(entry.module));

      setEntries(parsedEntries);
      setSelectedModules(Array.from(moduleSet).sort());
      setReversedEntriesCount(reversedCount);
      setUserStats(userCounts);
      
      toast({
        title: "Analyse terminée",
        description: `${parsedEntries.length} écritures chargées${reversedCount > 0 ? ` (${reversedCount} extournées exclues)` : ""}`,
      });
    } catch (error) {
      console.error("Erreur lors de l'analyse:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de l'analyse du fichier",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
      event.target.value = "";
    }
  }, [toast, parseXmlFile, parseExcelFile]);

  const { years, modules } = useMemo(() => {
    const yearSet = new Set<number>();
    const moduleSet = new Set<string>();
    entries.forEach((entry) => {
      yearSet.add(entry.date.getFullYear());
      moduleSet.add(entry.module);
    });
    return {
      years: Array.from(yearSet).sort(),
      modules: Array.from(moduleSet).sort(),
    };
  }, [entries]);

  const mainAnalysisData = useMemo(() => {
    const data: { [year: number]: { [month: string]: { [module: string]: number } } } = {};
    
    entries.forEach((entry) => {
      const year = entry.date.getFullYear();
      const month = MONTH_NAMES[entry.date.getMonth()];
      
      if (!data[year]) data[year] = {};
      if (!data[year][month]) data[year][month] = {};
      if (!data[year][month][entry.module]) data[year][month][entry.module] = 0;
      data[year][month][entry.module]++;
    });
    
    return data;
  }, [entries]);

  // Données pour le graphique et tableau comparatif (par module)
  const chartDataByModule = useMemo(() => {
    const getPeriodKey = (date: Date): string => {
      const year = date.getFullYear();
      const month = date.getMonth();
      
      switch (periodFilter) {
        case "day":
          return `${year} - ${(month + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
        case "month":
          return `${year} - ${MONTH_NAMES[month]}`;
        case "quarter":
          return `${year} - ${QUARTER_NAMES[Math.floor(month / 3)]}`;
        case "semester":
          return `${year} - ${SEMESTER_NAMES[Math.floor(month / 6)]}`;
        case "year":
          return `${year}`;
        default:
          return `${year} - ${QUARTER_NAMES[Math.floor(month / 3)]}`;
      }
    };

    const data: { [period: string]: { [module: string]: number } } = {};
    
    entries.forEach((entry) => {
      const period = getPeriodKey(entry.date);
      
      if (!data[period]) data[period] = {};
      if (!data[period][entry.module]) data[period][entry.module] = 0;
      data[period][entry.module]++;
    });

    const sortedPeriods = Object.keys(data).sort();
    return sortedPeriods.map((period) => ({
      period,
      ...data[period],
    }));
  }, [entries, periodFilter]);

  // Données pour le graphique et tableau comparatif (par catégorie)
  const chartDataByCategory = useMemo(() => {
    const getPeriodKey = (date: Date): string => {
      const year = date.getFullYear();
      const month = date.getMonth();
      
      switch (periodFilter) {
        case "day":
          return `${year} - ${(month + 1).toString().padStart(2, "0")}/${date.getDate().toString().padStart(2, "0")}`;
        case "month":
          return `${year} - ${MONTH_NAMES[month]}`;
        case "quarter":
          return `${year} - ${QUARTER_NAMES[Math.floor(month / 3)]}`;
        case "semester":
          return `${year} - ${SEMESTER_NAMES[Math.floor(month / 6)]}`;
        case "year":
          return `${year}`;
        default:
          return `${year} - ${QUARTER_NAMES[Math.floor(month / 3)]}`;
      }
    };

    const data: { [period: string]: { [category: string]: number } } = {};
    
    entries.forEach((entry) => {
      const period = getPeriodKey(entry.date);
      const category = getModuleCategory(entry.module);
      
      if (!data[period]) data[period] = {};
      if (!data[period][category]) data[period][category] = 0;
      data[period][category]++;
    });

    const sortedPeriods = Object.keys(data).sort();
    return sortedPeriods.map((period) => ({
      period,
      ...data[period],
    }));
  }, [entries, periodFilter]);

  const chartData = comparativeGroupByCategory ? chartDataByCategory : chartDataByModule;

  const toggleModule = (module: string) => {
    setSelectedModules((prev) =>
      prev.includes(module)
        ? prev.filter((m) => m !== module)
        : [...prev, module]
    );
  };

  const getYearMonthTotal = (year: number, month: string): number => {
    if (!mainAnalysisData[year]?.[month]) return 0;
    return Object.values(mainAnalysisData[year][month]).reduce((sum, count) => sum + count, 0);
  };

  const getYearModuleTotal = (year: number, module: string): number => {
    return MONTH_NAMES.reduce((sum, month) => {
      return sum + (mainAnalysisData[year]?.[month]?.[module] || 0);
    }, 0);
  };

  const getYearTotal = (year: number): number => {
    return MONTH_NAMES.reduce((sum, month) => sum + getYearMonthTotal(year, month), 0);
  };

  // Category analysis data
  const categoryData = useMemo(() => {
    const data: { [year: number]: { [month: string]: { [category: string]: number } } } = {};
    
    entries.forEach((entry) => {
      const year = entry.date.getFullYear();
      const month = MONTH_NAMES[entry.date.getMonth()];
      const category = getModuleCategory(entry.module);
      
      if (!data[year]) data[year] = {};
      if (!data[year][month]) data[year][month] = {};
      if (!data[year][month][category]) data[year][month][category] = 0;
      data[year][month][category]++;
    });
    
    return data;
  }, [entries]);

  const categories = useMemo(() => {
    const catSet = new Set<string>();
    entries.forEach((entry) => catSet.add(getModuleCategory(entry.module)));
    return Array.from(catSet).sort();
  }, [entries]);

  const getCategoryMonthTotal = (year: number, month: string): number => {
    if (!categoryData[year]?.[month]) return 0;
    return Object.values(categoryData[year][month]).reduce((sum, count) => sum + count, 0);
  };

  const getCategoryCategoryTotal = (year: number, category: string): number => {
    return MONTH_NAMES.reduce((sum, month) => {
      return sum + (categoryData[year]?.[month]?.[category] || 0);
    }, 0);
  };

  // Export functions
  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // Main analysis sheets - by year
    years.forEach((year) => {
      const sheetData: any[][] = [];
      const displayCols = groupByCategory ? categories : modules;
      
      // Header
      sheetData.push(["Mois", ...displayCols.map(c => groupByCategory ? c : `${c} - ${getModuleLabel(c)}`), "Total"]);
      
      // Data rows
      MONTH_NAMES.forEach((month) => {
        const monthTotal = groupByCategory ? getCategoryMonthTotal(year, month) : getYearMonthTotal(year, month);
        if (monthTotal === 0) return;
        
        const row: (string | number)[] = [month];
        displayCols.forEach((col) => {
          if (groupByCategory) {
            row.push(categoryData[year]?.[month]?.[col] || 0);
          } else {
            row.push(mainAnalysisData[year]?.[month]?.[col] || 0);
          }
        });
        row.push(monthTotal);
        sheetData.push(row);
      });
      
      // Total row
      const totalRow: (string | number)[] = [`Total ${year}`];
      displayCols.forEach((col) => {
        if (groupByCategory) {
          totalRow.push(getCategoryCategoryTotal(year, col));
        } else {
          totalRow.push(getYearModuleTotal(year, col));
        }
      });
      totalRow.push(getYearTotal(year));
      sheetData.push(totalRow);
      
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, `Année ${year}`);
    });

    // Summary sheet
    const summaryData: any[][] = [
      ["Résumé de l'analyse"],
      [""],
      ["Écritures analysées", entries.length],
      ["Écritures extournées (exclues)", reversedEntriesCount],
      ["Total écritures dans le fichier", entries.length + reversedEntriesCount],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, "Résumé");

    // Module legend sheet
    const legendData: any[][] = [["Code", "Description", "Catégorie"]];
    modules.forEach((module) => {
      legendData.push([module, getModuleLabel(module), getModuleCategory(module)]);
    });
    const legendWs = XLSX.utils.aoa_to_sheet(legendData);
    XLSX.utils.book_append_sheet(wb, legendWs, "Légende Modules");
    
    XLSX.writeFile(wb, `Analyse_Ecritures_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Export réussi",
      description: "Le fichier Excel a été téléchargé",
    });
  };

  const exportToPDF = () => {
    // Create printable HTML content
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Analyse des Écritures</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #7c3aed; text-align: center; }
          h2 { color: #374151; margin-top: 30px; }
          table { width: 100%; border-collapse: collapse; margin: 15px 0; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: center; }
          th { background-color: #ede9fe; font-weight: bold; }
          tr:nth-child(even) { background-color: #f3f4f6; }
          .total-row { background-color: #c4b5fd !important; font-weight: bold; }
          .legend { margin-top: 40px; }
          .legend td { text-align: left; }
          .info { background-color: #fef3c7; padding: 10px; border-radius: 5px; margin-bottom: 20px; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h1>Analyse des Écritures Comptables</h1>
        <div class="info">
          <p><strong>Source:</strong> Export Abacus F5534</p>
          <p><strong>Écritures analysées:</strong> ${entries.length.toLocaleString()}${reversedEntriesCount > 0 ? ` | <strong>Écritures extournées (exclues):</strong> ${reversedEntriesCount.toLocaleString()}` : ''}</p>
        </div>
        ${years.map((year) => {
          const displayCols = groupByCategory ? categories : modules;
          let tableContent = `<h2>Année ${year}</h2><table><tr><th>Mois</th>`;
          displayCols.forEach((col) => {
            tableContent += `<th>${groupByCategory ? col : col}</th>`;
          });
          tableContent += `<th>Total</th></tr>`;
          
          MONTH_NAMES.forEach((month) => {
            const monthTotal = groupByCategory ? getCategoryMonthTotal(year, month) : getYearMonthTotal(year, month);
            if (monthTotal === 0) return;
            
            tableContent += `<tr><td>${month}</td>`;
            displayCols.forEach((col) => {
              const val = groupByCategory 
                ? (categoryData[year]?.[month]?.[col] || "")
                : (mainAnalysisData[year]?.[month]?.[col] || "");
              tableContent += `<td>${val}</td>`;
            });
            tableContent += `<td><strong>${monthTotal}</strong></td></tr>`;
          });
          
          tableContent += `<tr class="total-row"><td>Total ${year}</td>`;
          displayCols.forEach((col) => {
            const val = groupByCategory 
              ? getCategoryCategoryTotal(year, col)
              : getYearModuleTotal(year, col);
            tableContent += `<td>${val}</td>`;
          });
          tableContent += `<td>${getYearTotal(year)}</td></tr></table>`;
          return tableContent;
        }).join('')}
        <div class="legend"><h2>Légende des Modules</h2><table>
          <tr><th>Code</th><th>Description</th><th>Catégorie</th></tr>
          ${modules.map((module) => `<tr><td>${module}</td><td>${getModuleLabel(module)}</td><td>${getModuleCategory(module)}</td></tr>`).join('')}
        </table></div>
      </body>
      </html>
    `;

    // Create blob and open in new window
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank');
    
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        URL.revokeObjectURL(url);
      };
    }

    toast({
      title: "Export PDF",
      description: "La fenêtre d'impression s'est ouverte",
    });
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BarChart3 className="h-10 w-10 text-purple-600" />
            <h1 className="text-3xl font-bold text-gray-900">Analyse des Écritures</h1>
          </div>
          <p className="text-gray-600">
            Analysez le nombre d'écritures par période et par module
          </p>
        </div>

        {/* Guide Section - Always visible before file upload */}
        {entries.length === 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600" />
                Guide d'importation des écritures
              </CardTitle>
            <CardDescription>
                Importez vos écritures au format Excel (F5534)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Format guide */}
              <Tabs defaultValue="excel" className="w-full">
                <TabsList className="grid w-full grid-cols-1 max-w-xs">
                  <TabsTrigger value="excel">Format Excel</TabsTrigger>
                </TabsList>
                
                <TabsContent value="excel" className="space-y-4 mt-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h3 className="font-semibold text-amber-800 mb-2">Étapes d'exportation Excel (F5534)</h3>
                    <ol className="list-decimal list-inside space-y-2 text-sm text-amber-900">
                      <li><strong>Ouvrir F5534</strong> - Accéder au menu Import/Export des écritures dans Abacus</li>
                      <li><strong>Choisir le format Excel</strong> - Sélectionner "Excel" comme type d'exportation</li>
                      <li><strong>Définir l'emplacement</strong> - Choisir où enregistrer le fichier d'exportation</li>
                      <li><strong>Sélectionner l'exercice</strong> - Choisir l'exercice comptable à analyser</li>
                      <li><strong>Décocher "Numéro ÉCR."</strong> - Décocher cette option pour exporter toutes les écritures</li>
                      <li><strong>Exporter</strong> - Lancer l'exportation</li>
                    </ol>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <img 
                      src={abacusExportGuide} 
                      alt="Guide d'exportation Abacus F5534" 
                      className="w-full h-auto"
                    />
                  </div>
                </TabsContent>

                {/* XML tab hidden but functionality preserved */}
              </Tabs>

              <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-purple-50 border-purple-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-purple-800">Légende des Modules</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    {Object.entries(MODULE_DESCRIPTIONS).map(([code, desc]) => (
                      <div key={code} className="flex gap-2">
                        <span className="font-mono font-bold w-6">{code || '""'}</span>
                        <span className="text-gray-700">{desc}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-800">Catégories</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-1">
                    {Object.entries(MODULE_CATEGORIES).map(([category, codes]) => (
                      <div key={category} className="flex gap-2">
                        <span className="font-semibold">{category}:</span>
                        <span className="text-gray-700 font-mono">{codes.join(", ")}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Charger un fichier
            </CardTitle>
            <CardDescription>
              Importez un fichier Excel (.xlsx, .xls) contenant les écritures comptables
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Input
                type="file"
                accept=".xlsx,.xls,.xml"
                onChange={handleFileUpload}
                disabled={isProcessing}
                className="max-w-md"
              />
              {isProcessing && (
                <span className="text-sm text-gray-500">Analyse en cours...</span>
              )}
              {entries.length > 0 && (
                <div className="flex gap-2 ml-auto">
                  <Button onClick={exportToExcel} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    Excel
                  </Button>
                  <Button onClick={exportToPDF} variant="outline" className="gap-2">
                    <FileText className="h-4 w-4" />
                    PDF
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {entries.length > 0 && (
          <>
            {/* Summary with reversed entries info */}
            <Alert className="bg-blue-50 border-blue-200 mb-4">
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{entries.length.toLocaleString()}</span> écritures analysées
                  {reversedEntriesCount > 0 && (
                    <span className="text-amber-700">
                      ({reversedEntriesCount.toLocaleString()} extournées exclues)
                    </span>
                  )}
                  {fileType && (
                    <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-mono">
                      {fileType.toUpperCase()}
                    </span>
                  )}
                </div>
              </AlertDescription>
            </Alert>

            <Tabs defaultValue="main" className="space-y-4">
              <TabsList className={`grid w-full ${fileType === "xml" ? "grid-cols-3" : "grid-cols-2"} max-w-md`}>
              <TabsTrigger value="main" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Par Année
              </TabsTrigger>
              <TabsTrigger value="comparative" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Comparatif
              </TabsTrigger>
              {fileType === "xml" && (
                <TabsTrigger value="users" className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Par Utilisateur
                </TabsTrigger>
              )}
            </TabsList>

            {/* Onglet Principal - Par Année */}
            <TabsContent value="main" className="space-y-6">
              {/* Toggle for category grouping */}
              <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
                <span className="text-sm font-medium">Affichage:</span>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="groupByCategory"
                    checked={groupByCategory}
                    onCheckedChange={(checked) => setGroupByCategory(checked === true)}
                  />
                  <label htmlFor="groupByCategory" className="text-sm cursor-pointer">
                    Regrouper par catégorie
                  </label>
                </div>
              </div>

              {/* Module legend */}
              <Card className="bg-gray-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Légende des Modules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                    {modules.map((module) => (
                      <div key={module} className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded flex-shrink-0" 
                          style={{ backgroundColor: getModuleColor(module, modules.indexOf(module)) }}
                        />
                        <span className="font-mono font-bold">{module}</span>
                        <span className="text-gray-600 truncate">{getModuleLabel(module)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {years.map((year) => (
                <Card key={year}>
                  <CardHeader>
                    <CardTitle>Année {year}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-blue-100">
                            <TableHead className="font-bold">Mois</TableHead>
                            {(groupByCategory ? categories : modules).map((col) => (
                              <TableHead key={col} className="text-center font-bold" title={groupByCategory ? col : getModuleLabel(col)}>
                                {col}
                              </TableHead>
                            ))}
                            <TableHead className="text-center font-bold">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {MONTH_NAMES.map((month, index) => {
                            const monthTotal = groupByCategory ? getCategoryMonthTotal(year, month) : getYearMonthTotal(year, month);
                            if (monthTotal === 0) return null;
                            
                            return (
                              <TableRow 
                                key={month}
                                className={index % 2 === 0 ? "bg-blue-50" : "bg-white"}
                              >
                                <TableCell className="font-medium">{month}</TableCell>
                                {(groupByCategory ? categories : modules).map((col) => (
                                  <TableCell key={col} className="text-center">
                                    {groupByCategory 
                                      ? (categoryData[year]?.[month]?.[col] || "")
                                      : (mainAnalysisData[year]?.[month]?.[col] || "")}
                                  </TableCell>
                                ))}
                                <TableCell className="text-center font-semibold">
                                  {monthTotal}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-blue-200 font-bold">
                            <TableCell>Total {year}</TableCell>
                            {(groupByCategory ? categories : modules).map((col) => (
                              <TableCell key={col} className="text-center">
                                {groupByCategory 
                                  ? getCategoryCategoryTotal(year, col)
                                  : getYearModuleTotal(year, col)}
                              </TableCell>
                            ))}
                            <TableCell className="text-center">{getYearTotal(year)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Onglet Comparatif avec Graphique */}
            <TabsContent value="comparative">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        Écritures par Période et {comparativeGroupByCategory ? "Catégorie" : "Module"}
                      </CardTitle>
                      <CardDescription>
                        Sélectionnez les {comparativeGroupByCategory ? "catégories" : "modules"} à afficher pour une comparaison détaillée
                      </CardDescription>
                    </div>
                    <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodType)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="day">Journalier</SelectItem>
                        <SelectItem value="month">Mensuel</SelectItem>
                        <SelectItem value="quarter">Trimestriel</SelectItem>
                        <SelectItem value="semester">Semestriel</SelectItem>
                        <SelectItem value="year">Annuel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Toggle for category grouping in comparative tab */}
                  <div className="flex items-center gap-4 p-4 bg-white rounded-lg border">
                    <span className="text-sm font-medium">Affichage:</span>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="comparativeGroupByCategory"
                        checked={comparativeGroupByCategory}
                        onCheckedChange={(checked) => {
                          setComparativeGroupByCategory(checked === true);
                          if (checked) {
                            setSelectedCategories(categories);
                          } else {
                            setSelectedModules(modules);
                          }
                        }}
                      />
                      <label htmlFor="comparativeGroupByCategory" className="text-sm cursor-pointer">
                        Regrouper par catégorie
                      </label>
                    </div>
                  </div>

                  {/* Sélection des modules ou catégories */}
                  <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
                    {comparativeGroupByCategory ? (
                      categories.map((category, index) => (
                        <div key={category} className="flex items-center gap-2">
                          <Checkbox
                            id={`category-${category}`}
                            checked={selectedCategories.includes(category)}
                            onCheckedChange={() => toggleCategory(category)}
                          />
                          <label
                            htmlFor={`category-${category}`}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                          >
                            <span
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: getModuleColor(category, index) }}
                            />
                            <span>{category}</span>
                          </label>
                        </div>
                      ))
                    ) : (
                      modules.map((module, index) => (
                        <div key={module} className="flex items-center gap-2">
                          <Checkbox
                            id={`module-${module}`}
                            checked={selectedModules.includes(module)}
                            onCheckedChange={() => toggleModule(module)}
                          />
                          <label
                            htmlFor={`module-${module}`}
                            className="flex items-center gap-2 text-sm cursor-pointer"
                            title={getModuleLabel(module)}
                          >
                            <span
                              className="w-3 h-3 rounded"
                              style={{ backgroundColor: getModuleColor(module, index) }}
                            />
                            <span className="font-mono">{module}</span>
                            <span className="text-gray-500 text-xs hidden sm:inline">({getModuleLabel(module)})</span>
                          </label>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Graphique */}
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis 
                          dataKey="period" 
                          angle={-45} 
                          textAnchor="end" 
                          height={80}
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: "white", 
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: "20px" }} />
                        {comparativeGroupByCategory ? (
                          selectedCategories.map((category, index) => (
                            <Bar
                              key={category}
                              dataKey={category}
                              name={category}
                              fill={getModuleColor(category, index)}
                              radius={[4, 4, 0, 0]}
                            />
                          ))
                        ) : (
                          selectedModules.map((module) => (
                            <Bar
                              key={module}
                              dataKey={module}
                              name={module}
                              fill={getModuleColor(module, modules.indexOf(module))}
                              radius={[4, 4, 0, 0]}
                            />
                          ))
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Tableau récapitulatif */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-purple-100">
                          <TableHead className="font-bold">Période</TableHead>
                          {(comparativeGroupByCategory ? selectedCategories : selectedModules).map((col) => (
                            <TableHead key={col} className="text-center font-bold">
                              {col}
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chartData.map((row, index) => {
                          const displayCols = comparativeGroupByCategory ? selectedCategories : selectedModules;
                          const total = displayCols.reduce((sum, col) => sum + ((row as any)[col] || 0), 0);
                          return (
                            <TableRow 
                              key={row.period}
                              className={index % 2 === 0 ? "bg-purple-50" : "bg-white"}
                            >
                              <TableCell className="font-medium">{row.period}</TableCell>
                              {displayCols.map((col) => (
                                <TableCell key={col} className="text-center">
                                  {(row as any)[col] || ""}
                                </TableCell>
                              ))}
                              <TableCell className="text-center font-semibold">{total}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-purple-200 font-bold">
                          <TableCell>Total</TableCell>
                          {(comparativeGroupByCategory ? selectedCategories : selectedModules).map((col) => (
                            <TableCell key={col} className="text-center">
                              {chartData.reduce((sum, row) => sum + ((row as any)[col] || 0), 0)}
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            {chartData.reduce((sum, row) => {
                              const displayCols = comparativeGroupByCategory ? selectedCategories : selectedModules;
                              return sum + displayCols.reduce((s, col) => s + ((row as any)[col] || 0), 0);
                            }, 0)}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Onglet Par Utilisateur - XML only */}
            {fileType === "xml" && (
              <TabsContent value="users" className="space-y-6">
                {/* Contributions Graph */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Graphique des Contributions
                    </CardTitle>
                    <CardDescription>
                      Activité des utilisateurs par date (style GitHub)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      // Build contributions data: { date: { user: count } }
                      const contributionsData: Record<string, Record<string, number>> = {};
                      
                      entries.forEach(entry => {
                        if (!entry.modificationUser) return;
                        const dateKey = entry.date.toISOString().split('T')[0];
                        const userName = USER_MAPPING[entry.modificationUser] || `Utilisateur #${entry.modificationUser}`;
                        
                        if (!contributionsData[dateKey]) contributionsData[dateKey] = {};
                        contributionsData[dateKey][userName] = (contributionsData[dateKey][userName] || 0) + 1;
                      });

                      // Get date range
                      const sortedDates = Object.keys(contributionsData).sort();
                      if (sortedDates.length === 0) return <p className="text-gray-500">Aucune donnée disponible</p>;
                      
                      const startDate = new Date(sortedDates[0]);
                      const endDate = new Date(sortedDates[sortedDates.length - 1]);
                      
                      // Generate all weeks between start and end
                      const weeks: { weekStart: Date; days: Date[] }[] = [];
                      const current = new Date(startDate);
                      current.setDate(current.getDate() - current.getDay()); // Start from Sunday
                      
                      while (current <= endDate) {
                        const weekDays: Date[] = [];
                        for (let i = 0; i < 7; i++) {
                          weekDays.push(new Date(current));
                          current.setDate(current.getDate() + 1);
                        }
                        weeks.push({ weekStart: weekDays[0], days: weekDays });
                      }

                      // Get all users
                      const allUsers = Array.from(new Set(
                        Object.values(contributionsData).flatMap(d => Object.keys(d))
                      )).sort();

                      // Color scale
                      const getColor = (count: number, maxCount: number) => {
                        if (count === 0) return "bg-gray-100";
                        const intensity = Math.min(count / Math.max(maxCount * 0.3, 1), 1);
                        if (intensity < 0.25) return "bg-green-200";
                        if (intensity < 0.5) return "bg-green-400";
                        if (intensity < 0.75) return "bg-green-500";
                        return "bg-green-700";
                      };

                      const maxCounts: Record<string, number> = {};
                      allUsers.forEach(user => {
                        maxCounts[user] = Math.max(
                          ...Object.values(contributionsData).map(d => d[user] || 0)
                        );
                      });

                      return (
                        <div className="space-y-6 overflow-x-auto">
                          {allUsers.map(user => {
                            const userTotal = Object.values(contributionsData).reduce(
                              (sum, d) => sum + (d[user] || 0), 0
                            );
                            
                            return (
                              <div key={user} className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">{user}</span>
                                  <span className="text-xs text-gray-500">({userTotal} écritures)</span>
                                </div>
                                <div className="flex gap-0.5">
                                  {weeks.map((week, weekIndex) => (
                                    <div key={weekIndex} className="flex flex-col gap-0.5">
                                      {week.days.map((day, dayIndex) => {
                                        const dateKey = day.toISOString().split('T')[0];
                                        const count = contributionsData[dateKey]?.[user] || 0;
                                        const isInRange = day >= startDate && day <= endDate;
                                        
                                        return (
                                          <div
                                            key={dayIndex}
                                            className={`w-3 h-3 rounded-sm ${
                                              isInRange 
                                                ? getColor(count, maxCounts[user]) 
                                                : "bg-transparent"
                                            }`}
                                            title={isInRange ? `${dateKey}: ${count} écritures` : ""}
                                          />
                                        );
                                      })}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Legend */}
                          <div className="flex items-center gap-2 pt-4 text-xs text-gray-600">
                            <span>Moins</span>
                            <div className="w-3 h-3 rounded-sm bg-gray-100" />
                            <div className="w-3 h-3 rounded-sm bg-green-200" />
                            <div className="w-3 h-3 rounded-sm bg-green-400" />
                            <div className="w-3 h-3 rounded-sm bg-green-500" />
                            <div className="w-3 h-3 rounded-sm bg-green-700" />
                            <span>Plus</span>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>

                {/* User Stats Table */}
                {Object.keys(userStats).length > 0 && (() => {
                  const allUsers = Object.keys(userStats).sort((a, b) => {
                    const totalA = Object.values(userStats[a]).reduce((sum, c) => sum + c, 0);
                    const totalB = Object.values(userStats[b]).reduce((sum, c) => sum + c, 0);
                    return totalB - totalA;
                  });
                  const allModulesInStats = new Set<string>();
                  Object.values(userStats).forEach(moduleCounts => {
                    Object.keys(moduleCounts).forEach(m => allModulesInStats.add(m));
                  });
                  const sortedModules = Array.from(allModulesInStats).sort();

                  const userTotals: Record<string, number> = {};
                  const moduleTotals: Record<string, number> = {};
                  let grandTotal = 0;

                  allUsers.forEach(user => {
                    userTotals[user] = Object.values(userStats[user]).reduce((sum, c) => sum + c, 0);
                    grandTotal += userTotals[user];
                  });

                  sortedModules.forEach(mod => {
                    moduleTotals[mod] = allUsers.reduce((sum, user) => sum + (userStats[user][mod] || 0), 0);
                  });

                  return (
                    <Card className="bg-green-50 border-green-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-green-800 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Statistiques par Utilisateur et Module
                          <span className="ml-auto text-xs font-normal bg-green-200 px-2 py-0.5 rounded">
                            Total: {grandTotal.toLocaleString()} écritures
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-green-100">
                                <TableHead className="font-bold text-green-800">Utilisateur</TableHead>
                                {sortedModules.map(mod => (
                                  <TableHead key={mod} className="text-center font-bold text-green-800" title={getModuleLabel(mod)}>
                                    {mod}
                                  </TableHead>
                                ))}
                                <TableHead className="text-center font-bold text-green-800 bg-green-200">Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {allUsers.map(user => (
                                <TableRow key={user} className="hover:bg-green-50">
                                  <TableCell className="font-medium text-gray-700">{user}</TableCell>
                                  {sortedModules.map(mod => {
                                    const count = userStats[user][mod] || 0;
                                    return (
                                      <TableCell key={mod} className="text-center">
                                        {count > 0 ? (
                                          <span className="text-gray-700">{count.toLocaleString()}</span>
                                        ) : (
                                          <span className="text-gray-300">-</span>
                                        )}
                                      </TableCell>
                                    );
                                  })}
                                  <TableCell className="text-center font-semibold text-green-700 bg-green-100">
                                    {userTotals[user].toLocaleString()}
                                  </TableCell>
                                </TableRow>
                              ))}
                              <TableRow className="bg-green-200 font-bold">
                                <TableCell className="text-green-800">Total</TableCell>
                                {sortedModules.map(mod => (
                                  <TableCell key={mod} className="text-center text-green-800">
                                    {moduleTotals[mod].toLocaleString()}
                                  </TableCell>
                                ))}
                                <TableCell className="text-center text-green-900 bg-green-300">
                                  {grandTotal.toLocaleString()}
                                </TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </TabsContent>
            )}
          </Tabs>
          </>
        )}
      </div>
    </div>
  );
};

export default EntryAnalysis;
