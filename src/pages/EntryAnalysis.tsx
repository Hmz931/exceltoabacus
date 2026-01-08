import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface AnalysisData {
  [month: string]: {
    [module: string]: number;
  };
}

const MONTH_NAMES = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];

const EntryAnalysis = () => {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const parseDate = (dateValue: any): Date | null => {
    if (!dateValue) return null;
    
    // Si c'est un nombre (date Excel)
    if (typeof dateValue === "number") {
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + dateValue * 86400000);
    }
    
    // Si c'est une chaîne
    if (typeof dateValue === "string") {
      // Format DD.MM.YYYY
      const dotMatch = dateValue.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
      if (dotMatch) {
        return new Date(parseInt(dotMatch[3]), parseInt(dotMatch[2]) - 1, parseInt(dotMatch[1]));
      }
      // Format YYYY-MM-DD
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

      // Trouver les colonnes Date (C=2) et Applicationidentification (R=17)
      const headers = jsonData[0] as string[];
      const dateColIndex = 2; // Colonne C
      const moduleColIndex = 17; // Colonne R (Applicationidentification)

      const analysis: AnalysisData = {};
      const moduleSet = new Set<string>();

      // Parcourir les données (en sautant l'en-tête)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const dateValue = row[dateColIndex];
        const moduleValue = row[moduleColIndex];

        const date = parseDate(dateValue);
        if (!date) continue;

        const month = date.getMonth(); // 0-11
        const monthName = MONTH_NAMES[month];
        const module = moduleValue ? String(moduleValue).trim() : "?";

        if (!analysis[monthName]) {
          analysis[monthName] = {};
        }
        if (!analysis[monthName][module]) {
          analysis[monthName][module] = 0;
        }
        analysis[monthName][module]++;
        moduleSet.add(module);
      }

      // Trier les modules alphabétiquement
      const sortedModules = Array.from(moduleSet).sort();
      
      setModules(sortedModules);
      setAnalysisData(analysis);

      toast({
        title: "Analyse terminée",
        description: `${jsonData.length - 1} écritures analysées`,
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

  const getMonthTotal = (monthName: string): number => {
    if (!analysisData || !analysisData[monthName]) return 0;
    return Object.values(analysisData[monthName]).reduce((sum, count) => sum + count, 0);
  };

  const getModuleTotal = (module: string): number => {
    if (!analysisData) return 0;
    return MONTH_NAMES.reduce((sum, month) => {
      return sum + (analysisData[month]?.[module] || 0);
    }, 0);
  };

  const getGrandTotal = (): number => {
    if (!analysisData) return 0;
    return MONTH_NAMES.reduce((sum, month) => sum + getMonthTotal(month), 0);
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
            Analysez le nombre d'écritures par mois et par module (Applicationidentification)
          </p>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Charger un fichier Excel
            </CardTitle>
            <CardDescription>
              Importez un fichier Excel contenant les écritures comptables (colonnes Date et Applicationidentification)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
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
            </div>
          </CardContent>
        </Card>

        {analysisData && modules.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Nombre d'écritures par Mois et Module
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-100">
                      <TableHead className="font-bold">Mois</TableHead>
                      {modules.map((module) => (
                        <TableHead key={module} className="text-center font-bold">
                          {module}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold">Total général</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MONTH_NAMES.map((month, index) => {
                      const monthTotal = getMonthTotal(month);
                      if (monthTotal === 0) return null;
                      
                      return (
                        <TableRow 
                          key={month}
                          className={index % 2 === 0 ? "bg-blue-50" : "bg-white"}
                        >
                          <TableCell className="font-medium">{month}</TableCell>
                          {modules.map((module) => (
                            <TableCell key={module} className="text-center">
                              {analysisData[month]?.[module] || ""}
                            </TableCell>
                          ))}
                          <TableCell className="text-center font-semibold">
                            {monthTotal}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-blue-200 font-bold">
                      <TableCell>Total général</TableCell>
                      {modules.map((module) => (
                        <TableCell key={module} className="text-center">
                          {getModuleTotal(module)}
                        </TableCell>
                      ))}
                      <TableCell className="text-center">{getGrandTotal()}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EntryAnalysis;
