import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, BarChart3, TrendingUp, Download, FileText, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from "xlsx";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EntryData {
  date: Date;
  module: string;
}

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
  const [groupByCategory, setGroupByCategory] = useState(false);
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

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
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
      const parsedEntries: EntryData[] = [];
      const moduleSet = new Set<string>();

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const dateValue = row[dateColIndex];
        const moduleValue = row[moduleColIndex];

        const date = parseDate(dateValue);
        if (!date) continue;

        const module = moduleValue ? String(moduleValue).trim() : "?";
        parsedEntries.push({ date, module });
        moduleSet.add(module);
      }

      setEntries(parsedEntries);
      setSelectedModules(Array.from(moduleSet).sort());
      toast({
        title: "Analyse terminée",
        description: `${parsedEntries.length} écritures chargées`,
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
  }, [toast]);

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

  // Données pour le graphique et tableau comparatif
  const chartData = useMemo(() => {
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

    // Convertir en format pour Recharts
    const sortedPeriods = Object.keys(data).sort();
    return sortedPeriods.map((period) => ({
      period,
      ...data[period],
    }));
  }, [entries, periodFilter]);

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
    let htmlContent = `
      <html>
      <head>
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
        </style>
      </head>
      <body>
        <h1>Analyse des Écritures Comptables</h1>
        <p class="info"><strong>Source:</strong> Export Abacus F5534</p>
    `;

    const displayCols = groupByCategory ? categories : modules;

    years.forEach((year) => {
      htmlContent += `<h2>Année ${year}</h2><table><tr><th>Mois</th>`;
      displayCols.forEach((col) => {
        htmlContent += `<th>${groupByCategory ? col : `${col}`}</th>`;
      });
      htmlContent += `<th>Total</th></tr>`;
      
      MONTH_NAMES.forEach((month) => {
        const monthTotal = groupByCategory ? getCategoryMonthTotal(year, month) : getYearMonthTotal(year, month);
        if (monthTotal === 0) return;
        
        htmlContent += `<tr><td>${month}</td>`;
        displayCols.forEach((col) => {
          const val = groupByCategory 
            ? (categoryData[year]?.[month]?.[col] || "")
            : (mainAnalysisData[year]?.[month]?.[col] || "");
          htmlContent += `<td>${val}</td>`;
        });
        htmlContent += `<td><strong>${monthTotal}</strong></td></tr>`;
      });
      
      htmlContent += `<tr class="total-row"><td>Total ${year}</td>`;
      displayCols.forEach((col) => {
        const val = groupByCategory 
          ? getCategoryCategoryTotal(year, col)
          : getYearModuleTotal(year, col);
        htmlContent += `<td>${val}</td>`;
      });
      htmlContent += `<td>${getYearTotal(year)}</td></tr></table>`;
    });

    // Legend
    htmlContent += `<div class="legend"><h2>Légende des Modules</h2><table>
      <tr><th>Code</th><th>Description</th><th>Catégorie</th></tr>`;
    modules.forEach((module) => {
      htmlContent += `<tr><td>${module}</td><td>${getModuleLabel(module)}</td><td>${getModuleCategory(module)}</td></tr>`;
    });
    htmlContent += `</table></div></body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.print();
    }

    toast({
      title: "Export PDF",
      description: "La fenêtre d'impression s'est ouverte",
    });
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

        <Alert className="mb-6 bg-amber-50 border-amber-200">
          <Info className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>Format requis:</strong> Le fichier d'entrée doit être un export Excel extrait d'Abacus à partir du menu <strong>F5534</strong>.
          </AlertDescription>
        </Alert>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Charger un fichier Excel
            </CardTitle>
            <CardDescription>
              Importez un fichier Excel contenant les écritures comptables (export F5534)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <Input
                type="file"
                accept=".xlsx,.xls"
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
          <Tabs defaultValue="main" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="main" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Par Année
              </TabsTrigger>
              <TabsTrigger value="comparative" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Comparatif
              </TabsTrigger>
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
                        Écritures par Période et Module
                      </CardTitle>
                      <CardDescription>
                        Sélectionnez les modules à afficher pour une comparaison détaillée
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
                  {/* Sélection des modules */}
                  <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
                    {modules.map((module, index) => (
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
                    ))}
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
                        {selectedModules.map((module, index) => (
                          <Bar
                            key={module}
                            dataKey={module}
                            name={module}
                            fill={getModuleColor(module, modules.indexOf(module))}
                            radius={[4, 4, 0, 0]}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Tableau récapitulatif */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-purple-100">
                          <TableHead className="font-bold">Période</TableHead>
                          {selectedModules.map((module) => (
                            <TableHead key={module} className="text-center font-bold">
                              {module}
                            </TableHead>
                          ))}
                          <TableHead className="text-center font-bold">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {chartData.map((row, index) => {
                          const total = selectedModules.reduce((sum, m) => sum + ((row as any)[m] || 0), 0);
                          return (
                            <TableRow 
                              key={row.period}
                              className={index % 2 === 0 ? "bg-purple-50" : "bg-white"}
                            >
                              <TableCell className="font-medium">{row.period}</TableCell>
                              {selectedModules.map((module) => (
                                <TableCell key={module} className="text-center">
                                  {(row as any)[module] || ""}
                                </TableCell>
                              ))}
                              <TableCell className="text-center font-semibold">{total}</TableCell>
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-purple-200 font-bold">
                          <TableCell>Total</TableCell>
                          {selectedModules.map((module) => (
                            <TableCell key={module} className="text-center">
                              {chartData.reduce((sum, row) => sum + ((row as any)[module] || 0), 0)}
                            </TableCell>
                          ))}
                          <TableCell className="text-center">
                            {chartData.reduce((sum, row) => 
                              sum + selectedModules.reduce((s, m) => s + ((row as any)[m] || 0), 0), 0
                            )}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default EntryAnalysis;
