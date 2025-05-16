
import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { transformData, createExcelFile, downloadExcelFile, generateSummary, SummaryData } from "@/utils/excelUtils";
import FileUpload from "@/components/FileUpload";
import TransformationSummary from "@/components/TransformationSummary";
import { Separator } from '@/components/ui/separator';

const Index = () => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [jsonData, setJsonData] = useState<any[] | null>(null);
  const [transformedData, setTransformedData] = useState<any[] | null>(null);
  const [outputWorkbook, setOutputWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isTransforming, setIsTransforming] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("upload");

  const handleFileLoaded = (workbook: XLSX.WorkBook, data: any[]) => {
    setWorkbook(workbook);
    setJsonData(data);
    setTransformedData(null);
    setOutputWorkbook(null);
    setSummaryData(null);
    
    toast({
      title: "Fichier chargé avec succès",
      description: `${data.length} lignes trouvées dans le fichier.`,
    });

    // Move to transform tab
    setActiveTab("transform");
  };

  const handleTransform = () => {
    if (!jsonData) {
      toast({
        title: "Erreur",
        description: "Aucune donnée à transformer.",
        variant: "destructive",
      });
      return;
    }

    setIsTransforming(true);
    
    // Small delay to show loading state
    setTimeout(() => {
      try {
        const transformed = transformData(jsonData);
        setTransformedData(transformed);
        
        const newWorkbook = createExcelFile(transformed);
        setOutputWorkbook(newWorkbook);
        
        const summary = generateSummary(transformed);
        setSummaryData(summary);
        
        toast({
          title: "Transformation réussie",
          description: `${transformed.length} lignes transformées.`,
        });

        // Move to summary tab
        setActiveTab("summary");
        setIsTransforming(false);
      } catch (error) {
        console.error("Erreur lors de la transformation:", error);
        toast({
          title: "Erreur de transformation",
          description: "Une erreur est survenue lors de la transformation des données.",
          variant: "destructive",
        });
        setIsTransforming(false);
      }
    }, 500);
  };

  const handleDownload = () => {
    if (!outputWorkbook) {
      toast({
        title: "Erreur",
        description: "Aucun fichier généré à télécharger.",
        variant: "destructive",
      });
      return;
    }

    downloadExcelFile(outputWorkbook);
    
    toast({
      title: "Téléchargement lancé",
      description: "Le fichier F11_Ecritures.xlsx a été téléchargé.",
    });
  };

  const resetForm = () => {
    setWorkbook(null);
    setJsonData(null);
    setTransformedData(null);
    setOutputWorkbook(null);
    setSummaryData(null);
    setActiveTab("upload");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
              <svg 
                className="w-10 h-10 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">ExcelToAbacus</h1>
          <p className="mt-2 text-lg text-gray-600">
            Convertissez vos données Excel au format Abacus en quelques clics
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="upload" disabled={activeTab === "summary"}>
              <div className="flex items-center">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full inline-flex items-center justify-center mr-2 text-xs">1</span>
                <span>Import</span>
              </div>
            </TabsTrigger>
            
            <TabsTrigger value="transform" disabled={!jsonData || activeTab === "summary"}>
              <div className="flex items-center">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full inline-flex items-center justify-center mr-2 text-xs">2</span>
                <span>Transformation</span>
              </div>
            </TabsTrigger>
            
            <TabsTrigger value="summary" disabled={!transformedData}>
              <div className="flex items-center">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full inline-flex items-center justify-center mr-2 text-xs">3</span>
                <span>Résumé</span>
              </div>
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-4">
            <TabsContent value="upload">
              <Card>
                <CardHeader>
                  <CardTitle>Importez votre fichier Excel</CardTitle>
                  <CardDescription>
                    Sélectionnez un fichier Excel contenant vos données comptables
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload onFileLoaded={handleFileLoaded} />
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="transform">
              <Card>
                <CardHeader>
                  <CardTitle>Transformation des données</CardTitle>
                  <CardDescription>
                    Convertissez vos données au format Abacus
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-blue-50 border border-blue-100 rounded-md p-4 mb-6">
                    <div className="flex">
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-5 w-5 text-blue-500 mr-2" 
                        viewBox="0 0 20 20" 
                        fill="currentColor"
                      >
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-blue-800">Prêt à transformer</p>
                        <p className="text-xs text-blue-600 mt-1">
                          {jsonData ? `${jsonData.length} lignes seront transformées au format Abacus.` : 'Aucune donnée chargée.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 justify-between">
                    <Button 
                      onClick={() => setActiveTab("upload")}
                      variant="outline"
                    >
                      Retour
                    </Button>
                    <Button 
                      onClick={handleTransform}
                      disabled={isTransforming || !jsonData}
                    >
                      {isTransforming ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Transformation en cours...
                        </span>
                      ) : 'Transformer les données'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="summary">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Résultat de la transformation</CardTitle>
                    <CardDescription>
                      Voici le résumé des données transformées au format Abacus
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    {summaryData && <TransformationSummary summaryData={summaryData} />}
                  </CardContent>
                  
                  <CardFooter className="flex flex-col items-stretch space-y-4">
                    <Button 
                      onClick={handleDownload}
                      className="w-full"
                      disabled={!outputWorkbook}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 mr-2" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                        />
                      </svg>
                      Télécharger F11_Ecritures.xlsx
                    </Button>
                    
                    <Button 
                      onClick={resetForm}
                      variant="outline"
                      className="w-full"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4 mr-2" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                        />
                      </svg>
                      Commencer une nouvelle transformation
                    </Button>
                  </CardFooter>
                </Card>
                
                <div className="text-center text-xs text-gray-500">
                  <p>ExcelToAbacus - Convertissez vos données Excel au format Abacus</p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
