import React, { useState } from 'react';
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
import { Download, FileText, ArrowLeft, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import CamtFileUpload from "@/components/CamtFileUpload";
import { processCamtFiles, createCamtExcelFile, downloadCamtExcelFile, CamtData, camtHeaders } from "@/utils/camtUtils";
import * as XLSX from 'xlsx';

const CamtConverter = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<CamtData[] | null>(null);
  const [outputWorkbook, setOutputWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [processingStats, setProcessingStats] = useState<{ totalFiles: number; totalRows: number } | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  const handleFilesLoaded = async (files: File[]) => {
    setIsProcessing(true);
    
    try {
      const result = await processCamtFiles(files);
      
      setProcessedData(result.allData);
      setProcessingStats({
        totalFiles: result.totalFiles,
        totalRows: result.totalRows
      });
      
      const workbook = createCamtExcelFile(result.allData);
      setOutputWorkbook(workbook);
      
      toast({
        title: "Conversion réussie",
        description: `${result.totalFiles} fichier(s) traité(s), ${result.totalRows} ligne(s) extraite(s).`,
      });
      
      setActiveTab("results");
    } catch (error) {
      console.error("Erreur lors du traitement:", error);
      toast({
        title: "Erreur de conversion",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la conversion.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
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

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '.');
    const filename = `Paiements_CAMT_${dateStr}.xlsx`;

    downloadCamtExcelFile(outputWorkbook, filename);
    
    toast({
      title: "Téléchargement lancé",
      description: `Le fichier ${filename} a été téléchargé.`,
    });
  };

  const resetConverter = () => {
    setProcessedData(null);
    setOutputWorkbook(null);
    setProcessingStats(null);
    setActiveTab("upload");
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-600 rounded-lg flex items-center justify-center">
              <FileText className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Convertisseur CAMT vers Excel</h1>
          <p className="mt-2 text-lg text-gray-600">
            Convertissez vos fichiers CAMT XML en Excel avec toutes les données de paiement
          </p>
          <div className="mt-4">
            <Link to="/">
              <Button variant="outline" className="flex items-center">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour à l'accueil
              </Button>
            </Link>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="upload">
              <div className="flex items-center">
                <span className="bg-green-100 text-green-700 w-5 h-5 rounded-full inline-flex items-center justify-center mr-2 text-xs">1</span>
                <span>Import CAMT</span>
              </div>
            </TabsTrigger>
            
            <TabsTrigger value="results" disabled={!processedData}>
              <div className="flex items-center">
                <span className="bg-green-100 text-green-700 w-5 h-5 rounded-full inline-flex items-center justify-center mr-2 text-xs">2</span>
                <span>Résultats</span>
              </div>
            </TabsTrigger>
          </TabsList>
          
          <div className="mt-4">
            <TabsContent value="upload">
              <Card>
                <CardHeader>
                  <CardTitle>Importez vos fichiers CAMT XML</CardTitle>
                  <CardDescription>
                    Sélectionnez un ou plusieurs fichiers CAMT XML (format ISO 20022 CAMT.054) pour les convertir en Excel
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="bg-green-50 border border-green-100 p-4 rounded-lg">
                      <h3 className="text-lg font-medium text-green-800 mb-2 flex items-center">
                        <FileText className="mr-2 h-5 w-5" />
                        Format CAMT supporté
                      </h3>
                      <p className="text-sm text-green-700 mb-4">
                        Cette conversion supporte les fichiers <strong>CAMT.054</strong> (ISO 20022) contenant les notifications de débit/crédit.
                      </p>
                      
                      <div className="bg-white border border-green-200 rounded-md p-3">
                        <h4 className="font-medium text-green-800 mb-2">Données extraites :</h4>
                        <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                          {camtHeaders.map((header, index) => (
                            <div key={index} className="flex items-center">
                              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                              {header}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <CamtFileUpload 
                      onFilesLoaded={handleFilesLoaded}
                      isProcessing={isProcessing}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="results">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Résultat de la conversion</CardTitle>
                    <CardDescription>
                      Vos fichiers CAMT ont été convertis avec succès
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    {processingStats && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-green-700">
                            {processingStats.totalFiles}
                          </div>
                          <div className="text-sm text-green-600">
                            Fichier{processingStats.totalFiles > 1 ? 's' : ''} traité{processingStats.totalFiles > 1 ? 's' : ''}
                          </div>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-blue-700">
                            {processingStats.totalRows}
                          </div>
                          <div className="text-sm text-blue-600">
                            Transaction{processingStats.totalRows > 1 ? 's' : ''} extraite{processingStats.totalRows > 1 ? 's' : ''}
                          </div>
                        </div>
                        
                        <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 text-center">
                          <div className="text-2xl font-bold text-orange-700">
                            {camtHeaders.length}
                          </div>
                          <div className="text-sm text-orange-600">
                            Colonnes de données
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {processedData && processedData.length > 0 && (
                      <div className="bg-gray-50 border rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">Aperçu des données (5 premières lignes) :</h4>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead>
                              <tr className="bg-gray-100">
                                {camtHeaders.slice(0, 6).map((header, index) => (
                                  <th key={index} className="px-2 py-1 text-left font-medium text-gray-700 border-b">
                                    {header}
                                  </th>
                                ))}
                                <th className="px-2 py-1 text-left font-medium text-gray-700 border-b">...</th>
                              </tr>
                            </thead>
                            <tbody>
                              {processedData.slice(0, 5).map((row, index) => (
                                <tr key={index} className="border-b border-gray-200">
                                  <td className="px-2 py-1">{row.montant}</td>
                                  <td className="px-2 py-1">{row.devise}</td>
                                  <td className="px-2 py-1">{row.creditDebit}</td>
                                  <td className="px-2 py-1">{row.dateComptabilisation}</td>
                                  <td className="px-2 py-1">{row.dateValeur}</td>
                                  <td className="px-2 py-1 max-w-32 truncate">{row.nomDebiteur}</td>
                                  <td className="px-2 py-1">...</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {processedData.length > 5 && (
                          <p className="text-xs text-gray-500 mt-2">
                            ... et {processedData.length - 5} autres ligne{processedData.length - 5 > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                  
                  <CardFooter className="flex flex-col items-stretch space-y-4">
                    <Button 
                      onClick={handleDownload}
                      className="w-full"
                      disabled={!outputWorkbook}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Télécharger le fichier Excel
                    </Button>
                    
                    <Button 
                      onClick={resetConverter}
                      variant="outline"
                      className="w-full"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Convertir d'autres fichiers
                    </Button>
                  </CardFooter>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default CamtConverter;