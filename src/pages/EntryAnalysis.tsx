import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, BarChart3, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

interface EntryData {
  date: Date;
  module: string;
}

type PeriodType = "day" | "month" | "quarter" | "semester" | "year";

const MONTH_NAMES = ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
const QUARTER_NAMES = ["T1", "T2", "T3", "T4"];
const SEMESTER_NAMES = ["S1", "S2"];

const EntryAnalysis = () => {
  const [entries, setEntries] = useState<EntryData[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodType>("month");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
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

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        const dateValue = row[dateColIndex];
        const moduleValue = row[moduleColIndex];

        const date = parseDate(dateValue);
        if (!date) continue;

        parsedEntries.push({
          date,
          module: moduleValue ? String(moduleValue).trim() : "?",
        });
      }

      setEntries(parsedEntries);
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

  // Extraire les années et modules uniques
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

  // Données pour l'onglet principal (par année)
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

  // Données pour l'onglet comparatif
  const comparativeData = useMemo(() => {
    const filteredEntries = moduleFilter === "all" 
      ? entries 
      : entries.filter((e) => e.module === moduleFilter);

    const getPeriodKey = (date: Date): string => {
      const day = date.getDate().toString().padStart(2, "0");
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      
      switch (periodFilter) {
        case "day":
          return `${day}/${month}`;
        case "month":
          return MONTH_NAMES[date.getMonth()];
        case "quarter":
          return QUARTER_NAMES[Math.floor(date.getMonth() / 3)];
        case "semester":
          return SEMESTER_NAMES[Math.floor(date.getMonth() / 6)];
        case "year":
          return "Année";
        default:
          return MONTH_NAMES[date.getMonth()];
      }
    };

    const data: { [period: string]: { [year: number]: number } } = {};
    
    filteredEntries.forEach((entry) => {
      const year = entry.date.getFullYear();
      const period = getPeriodKey(entry.date);
      
      if (!data[period]) data[period] = {};
      if (!data[period][year]) data[period][year] = 0;
      data[period][year]++;
    });

    // Trier les périodes
    const sortedPeriods = Object.keys(data).sort((a, b) => {
      if (periodFilter === "month") {
        return MONTH_NAMES.indexOf(a) - MONTH_NAMES.indexOf(b);
      }
      if (periodFilter === "quarter") {
        return QUARTER_NAMES.indexOf(a) - QUARTER_NAMES.indexOf(b);
      }
      if (periodFilter === "semester") {
        return SEMESTER_NAMES.indexOf(a) - SEMESTER_NAMES.indexOf(b);
      }
      return a.localeCompare(b);
    });

    return { data, periods: sortedPeriods };
  }, [entries, periodFilter, moduleFilter]);

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

  const getComparativeYearTotal = (year: number): number => {
    return comparativeData.periods.reduce((sum, period) => {
      return sum + (comparativeData.data[period]?.[year] || 0);
    }, 0);
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

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Charger un fichier Excel
            </CardTitle>
            <CardDescription>
              Importez un fichier Excel contenant les écritures comptables
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
                            {modules.map((module) => (
                              <TableHead key={module} className="text-center font-bold">
                                {module}
                              </TableHead>
                            ))}
                            <TableHead className="text-center font-bold">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {MONTH_NAMES.map((month, index) => {
                            const monthTotal = getYearMonthTotal(year, month);
                            if (monthTotal === 0) return null;
                            
                            return (
                              <TableRow 
                                key={month}
                                className={index % 2 === 0 ? "bg-blue-50" : "bg-white"}
                              >
                                <TableCell className="font-medium">{month}</TableCell>
                                {modules.map((module) => (
                                  <TableCell key={module} className="text-center">
                                    {mainAnalysisData[year]?.[month]?.[module] || ""}
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
                            {modules.map((module) => (
                              <TableCell key={module} className="text-center">
                                {getYearModuleTotal(year, module)}
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

            {/* Onglet Comparatif */}
            <TabsContent value="comparative">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Évolution Comparative
                  </CardTitle>
                  <CardDescription>
                    Comparez l'évolution du nombre d'écritures sur différentes années
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Filtres */}
                  <div className="flex flex-wrap gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Période</label>
                      <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodType)}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="day">Par Jour</SelectItem>
                          <SelectItem value="month">Par Mois</SelectItem>
                          <SelectItem value="quarter">Par Trimestre</SelectItem>
                          <SelectItem value="semester">Par Semestre</SelectItem>
                          <SelectItem value="year">Par Année</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Module</label>
                      <Select value={moduleFilter} onValueChange={setModuleFilter}>
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tous les modules</SelectItem>
                          {modules.map((module) => (
                            <SelectItem key={module} value={module}>
                              {module}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tableau comparatif */}
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-purple-100">
                          <TableHead className="font-bold">Période</TableHead>
                          {years.map((year) => (
                            <TableHead key={year} className="text-center font-bold">
                              {year}
                            </TableHead>
                          ))}
                          {years.length > 1 && (
                            <TableHead className="text-center font-bold">Évolution</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comparativeData.periods.map((period, index) => {
                          const values = years.map((year) => comparativeData.data[period]?.[year] || 0);
                          const evolution = years.length > 1 && values[0] > 0
                            ? (((values[values.length - 1] - values[0]) / values[0]) * 100).toFixed(1)
                            : null;
                          
                          return (
                            <TableRow 
                              key={period}
                              className={index % 2 === 0 ? "bg-purple-50" : "bg-white"}
                            >
                              <TableCell className="font-medium">{period}</TableCell>
                              {years.map((year) => (
                                <TableCell key={year} className="text-center">
                                  {comparativeData.data[period]?.[year] || ""}
                                </TableCell>
                              ))}
                              {years.length > 1 && (
                                <TableCell className="text-center">
                                  {evolution !== null && (
                                    <span className={Number(evolution) >= 0 ? "text-green-600" : "text-red-600"}>
                                      {Number(evolution) >= 0 ? "+" : ""}{evolution}%
                                    </span>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })}
                        <TableRow className="bg-purple-200 font-bold">
                          <TableCell>Total</TableCell>
                          {years.map((year) => (
                            <TableCell key={year} className="text-center">
                              {getComparativeYearTotal(year)}
                            </TableCell>
                          ))}
                          {years.length > 1 && (
                            <TableCell className="text-center">
                              {(() => {
                                const first = getComparativeYearTotal(years[0]);
                                const last = getComparativeYearTotal(years[years.length - 1]);
                                if (first === 0) return "";
                                const evo = (((last - first) / first) * 100).toFixed(1);
                                return (
                                  <span className={Number(evo) >= 0 ? "text-green-700" : "text-red-700"}>
                                    {Number(evo) >= 0 ? "+" : ""}{evo}%
                                  </span>
                                );
                              })()}
                            </TableCell>
                          )}
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
