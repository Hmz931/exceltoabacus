import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { XmlFileUpload } from "@/components/XmlFileUpload";
import { convertExcelToXML, downloadXMLFile } from "@/utils/xmlUtils";
import { FileText, Download, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import * as XLSX from 'xlsx';

export default function XmlConverter() {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [jsonData, setJsonData] = useState<any[]>([]);
  const [xmlContent, setXmlContent] = useState<string>('');
  const [summary, setSummary] = useState<{ totalInvoices: number; totalAmount: number } | null>(null);
  const [activeTab, setActiveTab] = useState('upload');
  const [isConverting, setIsConverting] = useState(false);
  const { toast } = useToast();

  const handleFileLoaded = (wb: XLSX.WorkBook, data: any[]) => {
    setWorkbook(wb);
    setJsonData(data);
    setActiveTab('convert');
    toast({
      title: "Fichier chargé avec succès",
      description: `${data.length} lignes détectées`,
    });
  };

  const handleConvert = async () => {
    if (!workbook) return;

    setIsConverting(true);
    try {
      const result = convertExcelToXML(workbook);
      setXmlContent(result.xml);
      setSummary(result.summary);
      setActiveTab('download');
      toast({
        title: "Conversion réussie",
        description: `${result.summary.totalInvoices} factures converties`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur de conversion",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleDownload = () => {
    if (xmlContent) {
      downloadXMLFile(xmlContent, 'AbaConnect_Export.xml');
      toast({
        title: "Téléchargement lancé",
        description: "Le fichier XML a été téléchargé",
      });
    }
  };

  const resetForm = () => {
    setWorkbook(null);
    setJsonData([]);
    setXmlContent('');
    setSummary(null);
    setActiveTab('upload');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-4">
            Convertisseur Excel vers XML AbaConnect
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Convertissez vos données de facturation Excel au format XML AbaConnect 
            avec calcul automatique de la TVA et validation des données
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="max-w-4xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">1. Import</TabsTrigger>
            <TabsTrigger value="convert" disabled={!workbook}>2. Conversion</TabsTrigger>
            <TabsTrigger value="download" disabled={!xmlContent}>3. Téléchargement</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <XmlFileUpload onFileLoaded={handleFileLoaded} />
          </TabsContent>

          <TabsContent value="convert" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Données détectées
                </CardTitle>
                <CardDescription>
                  Vérifiez les données avant de lancer la conversion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Nombre total de lignes :</span>
                    <Badge variant="secondary">{jsonData.length}</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Nombre de factures :</span>
                    <Badge variant="secondary">
                      {new Set(jsonData.map(row => row['N° Facture'])).size}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="flex justify-center">
                    <Button 
                      onClick={handleConvert} 
                      disabled={isConverting}
                      className="w-full max-w-sm"
                    >
                      {isConverting ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Conversion en cours...
                        </>
                      ) : (
                        'Convertir en XML AbaConnect'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="download" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Conversion terminée
                </CardTitle>
                <CardDescription>
                  Votre fichier XML AbaConnect est prêt à être téléchargé
                </CardDescription>
              </CardHeader>
              <CardContent>
                {summary && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">{summary.totalInvoices}</div>
                        <div className="text-sm text-muted-foreground">Factures converties</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <div className="text-2xl font-bold text-primary">
                          {summary.totalAmount.toFixed(2)} CHF
                        </div>
                        <div className="text-sm text-muted-foreground">Montant total</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <Button onClick={handleDownload} className="flex-1 max-w-sm">
                        <Download className="mr-2 h-4 w-4" />
                        Télécharger le XML
                      </Button>
                      <Button onClick={resetForm} variant="outline" className="flex-1 max-w-sm">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Nouvelle conversion
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}