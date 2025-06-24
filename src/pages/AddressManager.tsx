import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { Download, File, Github, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

const AddressManager = () => {
  const [supplierMode, setSupplierMode] = useState('INSERT');
  const [supplierNumber, setSupplierNumber] = useState(450);
  const [customerMode, setCustomerMode] = useState('INSERT');
  const [customerNumber, setCustomerNumber] = useState(86);
  const [generatedXML, setGeneratedXML] = useState<string | null>(null);
  const [xmlType, setXmlType] = useState<'supplier' | 'customer' | null>(null);

  // Utility functions
  const escapeXML = (value: any): string => {
    if (value === null || value === undefined || value === '') return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const xmlField = (tag: string, value: any): string => {
    const escapedValue = escapeXML(value);
    return escapedValue ? `<${tag}>${escapedValue}</${tag}>` : `<${tag}/>`;
  };

  const downloadSupplierTemplate = () => {
    // Create a link to download the existing template
    const link = document.createElement('a');
    link.href = '/Adresses_Fournisseurs_Template.xlsx';
    link.download = 'Adresses_Fournisseurs_Template.xlsx';
    link.click();
    
    toast({
      title: "Modèle téléchargé",
      description: "Le modèle fournisseurs a été téléchargé avec succès.",
    });
  };

  const downloadCustomerTemplate = () => {
    // Create a link to download the existing template
    const link = document.createElement('a');
    link.href = '/Adresses_Clients_Template.xlsx';
    link.download = 'Adresses_Clients_Template.xlsx';
    link.click();
    
    toast({
      title: "Modèle téléchargé",
      description: "Le modèle clients a été téléchargé avec succès.",
    });
  };

  const generateIbanData = (ibans: any, supplierNum: number, country: string): string => {
    if (!ibans) return '';
    const ibansList = String(ibans).split('\n').map(iban => iban.trim().replace(/\s|-/g, ''));
    let ibanDataXML = '';
    
    ibansList.forEach((iban, idx) => {
      if (!iban || iban.length !== 21) return;
      const beneficiaryType = iban[4] === '3' ? '80' : '23';
      ibanDataXML += `
        <BeneficiaryAccount mode="SAVE">
          <BeneficiaryType>${beneficiaryType}</BeneficiaryType>
          <BeneficiaryCountry>${escapeXML(country)}</BeneficiaryCountry>
          <InternalBeneficiaryAccountNumber>${idx + 1}</InternalBeneficiaryAccountNumber>
          <BeneficiaryAccountNumber>${escapeXML(iban)}</BeneficiaryAccountNumber>
          <BankNumber>0</BankNumber>
          <TaxType>0</TaxType>
          <PostfinanceExpressDelivery>0</PostfinanceExpressDelivery>
          <PostfinancePersonal>0</PostfinancePersonal>
          <Swift/>
          <ClearingNumber/>
          <Inactive>false</Inactive>
          <ProcessingOrder>0</ProcessingOrder>
          <ProcessingType>0</ProcessingType>
        </BeneficiaryAccount>
        <PaymentMethod mode="SAVE">
          <BeneficiaryAddressNumber/>
          <BeneficiaryNumber>${idx + 1}</BeneficiaryNumber>
          <PaymentMethodNumber>${idx + 1}</PaymentMethodNumber>
          <BeneficiaryCountry>${escapeXML(country)}</BeneficiaryCountry>
          <BeneficiaryType>${beneficiaryType}</BeneficiaryType>
          <CompanyPaymentCentreNumber>1</CompanyPaymentCentreNumber>
          <CompanyPaymentCentreDataFormat>1</CompanyPaymentCentreDataFormat>
          <CompanyPaymentCentreDebitType>1</CompanyPaymentCentreDebitType>
          <CompanyPaymentCentreTransferType>1</CompanyPaymentCentreTransferType>
          <RunNumber>0</RunNumber>
          <Comment/>
          <ProcessingOrder>0</ProcessingOrder>
          <ProcessingType>0</ProcessingType>
        </PaymentMethod>
      `;
    });
    
    if (ibansList.some(iban => iban.trim())) {
      ibanDataXML += `
        <OrderProcessingData mode="SAVE">
          <Currency>CHF</Currency>
          <PriceCode>0</PriceCode>
          <DiscountCode>0</DiscountCode>
          <FlowNumber>0</FlowNumber>
          <OrderProcessingDeliveryTypeNumber>0</OrderProcessingDeliveryTypeNumber>
          <ConditionGroupNumber>0</ConditionGroupNumber>
          <MinimumAmount>0</MinimumAmount>
          <DiscountCondition>0</DiscountCondition>
          <StandardCondition>0</StandardCondition>
          <PromotionPriceOrPromotionDiscount>0</PromotionPriceOrPromotionDiscount>
          <SpecialPriceOrSpecialDiscount>0</SpecialPriceOrSpecialDiscount>
          <ReminderBlocked>0</ReminderBlocked>
          <TakeOverTaxFromProductData>0</TakeOverTaxFromProductData>
          <Table1>0</Table1>
          <Table2>0</Table2>
          <Table3>0</Table3>
          <Table4>0</Table4>
          <Table5>0</Table5>
          <Table6>0</Table6>
          <SeqCollectivePurchaseOrder>0</SeqCollectivePurchaseOrder>
          <SeqProjectPurchaseOrder>0</SeqProjectPurchaseOrder>
          <SeqSupplierCreditNote>0</SeqSupplierCreditNote>
          <SeqProjectSupplierCreditNote>0</SeqProjectSupplierCreditNote>
          <SeqProcurementCosts>0</SeqProcurementCosts>
          <SeqPurchaseOrderPPSMaterial>0</SeqPurchaseOrderPPSMaterial>
          <SeqPurchaseOrderPPSExternalWork>0</SeqPurchaseOrderPPSExternalWork>
          <SeqPurchaseOrderRequests>0</SeqPurchaseOrderRequests>
          <SeqFramePurchaseOrder>0</SeqFramePurchaseOrder>
          <ProductAccountSetExpense>0</ProductAccountSetExpense>
          <ProcessingOrder>0</ProcessingOrder>
          <ProcessingType>0</ProcessingType>
        </OrderProcessingData>
      `;
    }
    return ibanDataXML;
  };

  const downloadGeneratedXML = () => {
    if (!generatedXML) return;
    
    const blob = new Blob([generatedXML], { type: 'text/xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Adresses.xml';
    link.click();
    
    // Clear the generated XML after download
    setGeneratedXML(null);
    setXmlType(null);
    
    toast({
      title: "XML téléchargé",
      description: "Le fichier XML a été téléchargé avec succès.",
    });
  };

  const generateSupplierXML = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier Excel.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        const transactionTemplate = `
          <Transaction id="{TransactionID}">
            <Supplier mode="{Mode}">
              <Number/>
              <AddressData mode="SAVE">
                <CodeName>{CodeName}</CodeName>
                <Number/>
                <Name>{Name}</Name>
                <FirstName/>
                {AdditionalLineField}
                <Line1>{Line1}</Line1>
                <Line2/>
                <Line3/>
                <Line4/>
                <Country>{Country}</Country>
                <ZIP>{ZIP}</ZIP>
                <City>{City}</City>
                <State/>
                <SalutationNumber>0</SalutationNumber>
                <SalutationName/>
                <Title/>
                <IndustryCode>0</IndustryCode>
                <Text/>
                {WebsiteField}
                {EmailField}
                {Phone1Field}
                <Phone2/>
                <Fax/>
                <Mobile/>
                <FreeField1/>
                <FreeField2/>
                <Language>fr</Language>
                <PostRoute>0</PostRoute>
                <FreeDate/>
                <CodeNameFixed>false</CodeNameFixed>
                <AANMainSubject>0</AANMainSubject>
                <SubjectType>2</SubjectType>
                <AddressValidAsOf>2021-01-01</AddressValidAsOf>
                <TaxIDEuropeanUnion/>
                {TaxIDSwitzerlandField}
                <HouseNumber>{HouseNumber}</HouseNumber>
                <Street>{Street}</Street>
                <PostOfficeBoxText/>
                <PostOfficeBoxNumber/>
                <AddressAddition/>
                <StreetAddition/>
                <DwellingNumber/>
                <MunicipalityCode>6643</MunicipalityCode>
                <BuildingNumber>0</BuildingNumber>
                <OpenLocationCode/>
                <StreetHouseNumber>{Street} {HouseNumber}</StreetHouseNumber>
                <PostOfficeBoxTextNumber/>
                <ProcessingOrder>0</ProcessingOrder>
                <ProcessingType>0</ProcessingType>
              </AddressData>
              <CurrencyData mode="SAVE">
                <Currency>CHF</Currency>
                <TaxCode/>
                <CurrencyRisk>0</CurrencyRisk>
                <CurrencyLimit>0</CurrencyLimit>
                <ProcessingOrder>0</ProcessingOrder>
                <ProcessingType>0</ProcessingType>
              </CurrencyData>
              <DetailData mode="SAVE">
                <Number/>
                <AddressNumber/>
                <Condition>1</Condition>
                <PersonInCharge>0</PersonInCharge>
                <Division>0</Division>
                <Intercompany>0</Intercompany>
                <CostCentreGroup>0</CostCentreGroup>
                <ABCCode/>
                <GroupNumber1>0</GroupNumber1>
                <GroupNumber2>0</GroupNumber2>
                <GroupNumber3>0</GroupNumber3>
                <GroupCode1/>
                <GroupCode2/>
                <GroupCode3/>
                <CurrencyCode>CHF</CurrencyCode>
                <InactiveFromDate/>
                <TurnoverSupplierNumber>0</TurnoverSupplierNumber>
                <DeleteAfter>2</DeleteAfter>
                <CreditLimitType>0</CreditLimitType>
                <CreditLimitAmount>0</CreditLimitAmount>
                <TurnoverSupplierCreditLimitType>0</TurnoverSupplierCreditLimitType>
                <TurnoverActive>0</TurnoverActive>
                <DispositionBlocked>0</DispositionBlocked>
                <AdviceBlocked>0</AdviceBlocked>
                <AdviceType>0</AdviceType>
                <AdviceAddressNumber/>
                <AdviceContactNumber>0</AdviceContactNumber>
                <PaymentMethod>1</PaymentMethod>
                <AccountProposalType>2</AccountProposalType>
                <AccountProposalNumber>0</AccountProposalNumber>
                <EBussinessOptions>0</EBussinessOptions>
                <AddressNumberFixedFlag>0</AddressNumberFixedFlag>
                <SupplierDispoDateProposal>0</SupplierDispoDateProposal>
                <NumberOfDaysForDispoDateProposal>0</NumberOfDaysForDispoDateProposal>
                <ExpenseType>0</ExpenseType>
                <CustomerAccountNumber>0</CustomerAccountNumber>
                <VisaStructureProposalType>0</VisaStructureProposalType>
                <ProposalVisaStructure>0</ProposalVisaStructure>
                <ExemptionCertificateRequired>false</ExemptionCertificateRequired>
                <ExemptionCertificateRequestedOn/>
                <ExemptionCertificateValidFrom/>
                <ExemptionCertificateValidTo/>
                <ExemptionCertificateVerificationDate/>
                <ExemptionCertificateVerificationStatus>0</ExemptionCertificateVerificationStatus>
                <ExemptionCertificateToleranceDays>0</ExemptionCertificateToleranceDays>
                <ExemptionCertificateTaxNumber/>
                <ExemptionCertificateSecurityNumber/>
                <DiscountToleranceProposalType>0</DiscountToleranceProposalType>
                <NumberOfDiscountToleranceDays>0</NumberOfDiscountToleranceDays>
                <DiscountToleranceDaysInPercent>0</DiscountToleranceDaysInPercent>
                <DeactivateQueryForAddressUpdate>false</DeactivateQueryForAddressUpdate>
                <ForPayoutOnly>false</ForPayoutOnly>
                <NotAutoProcessDocumentsDeepBox>false</NotAutoProcessDocumentsDeepBox>
                <SourcePaymentConditions>0</SourcePaymentConditions>
                <DisableWarningPaymentConditionsDiff>false</DisableWarningPaymentConditionsDiff>
                <AutomaticSavingAccountOroposalIsInactive>false</AutomaticSavingAccountOroposalIsInactive>
                <ProcessingOrder>0</ProcessingOrder>
                <ProcessingType>0</ProcessingType>
              </DetailData>
              {IbanData}
            </Supplier>
          </Transaction>
        `;

        let transactions = '';
        (json as any[]).forEach((row: any, index) => {
          const nameValue = escapeXML(row['Nom'] || '');
          const codeName = nameValue.toUpperCase().slice(0, 16);
          const ibanData = generateIbanData(row['IBAN'], supplierNumber + index, row['Pays']);

          const transactionXML = transactionTemplate
            .replace(/{TransactionID}/g, (index + 1).toString())
            .replace(/{Mode}/g, supplierMode)
            .replace(/{SupplierNumber}/g, (supplierNumber + index).toString())
            .replace(/{Name}/g, nameValue)
            .replace(/{CodeName}/g, codeName)
            .replace(/{Line1}/g, escapeXML(row['Adresse'] || ''))
            .replace(/{HouseNumber}/g, escapeXML(row['Numero'] || ''))
            .replace(/{ZIP}/g, escapeXML(row['Code postal'] || ''))
            .replace(/{City}/g, escapeXML(row['Ville'] || ''))
            .replace(/{Country}/g, escapeXML(row['Pays'] || ''))
            .replace(/{Street}/g, escapeXML(row['Adresse'] || ''))
            .replace(/{AdditionalLineField}/g, xmlField('AdditionalLine', row['Ligne supplémentaire']))
            .replace(/{Phone1Field}/g, xmlField('Phone1', row['Téléphone 1']))
            .replace(/{WebsiteField}/g, xmlField('Website', row['WWW']))
            .replace(/{EmailField}/g, xmlField('Email', row['E-mail']))
            .replace(/{TaxIDSwitzerlandField}/g, xmlField('TaxIDSwitzerland', row['N° TVA']))
            .replace(/{IbanData}/g, ibanData);

          transactions += transactionXML;
        });

        const xmlOutput = `<?xml version="1.0" encoding="utf-8"?>
<AbaConnectContainer>
  <TaskCount>1</TaskCount>
  <Task>
    <Parameter>
      <Application>KRED</Application>
      <Id>Supplier</Id>
      <MapId>AbaDefault</MapId>
      <Version>2024.00</Version>
    </Parameter>
    ${transactions}
  </Task>
</AbaConnectContainer>`;

        setGeneratedXML(xmlOutput);
        setXmlType('supplier');

        toast({
          title: "XML généré",
          description: "Le fichier XML des fournisseurs a été généré avec succès. Cliquez sur le bouton de téléchargement pour l'obtenir.",
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Erreur lors de la génération du XML : " + (error as Error).message,
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const generateCustomerXML = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier Excel.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);

        const transactionTemplate = `
            <Transaction id="{TransactionID}">
            <Customer mode="{Mode}">
              <CodeName>{CodeName}</CodeName>
              <UniqueReference>SomeReference1234</UniqueReference>
              <CustomerNumber/>
              <MultipleCurrenciesActive>false</MultipleCurrenciesActive>
              <DefaultCurrency>CHF</DefaultCurrency>
              <AddressData mode="{Mode}">
                <AddressNumber/>
                <Name>{Name}</Name>
                <Line1>{Line1}</Line1>
                <Country>CH</Country>
                <ZIP>{ZIP}</ZIP>
                <City>{City}</City>
                <Language>fr</Language>
                <AdditionalLine>{AdditionalLine}</AdditionalLine>
                <AddressValidAsOf>2021-01-01</AddressValidAsOf>
              </AddressData>
              <CurrencyData mode="{Mode}">
                <Currency>CHF</Currency>
              </CurrencyData>
            </Customer>
          </Transaction>
        `;

        let transactions = '';
        (json as any[]).forEach((row: any, index) => {
          const nameValue = escapeXML(row['Nom'] || '');
          const codeName = nameValue.toUpperCase().slice(0, 16);

          const transactionXML = transactionTemplate
            .replace(/{TransactionID}/g, (index + 1).toString())
            .replace(/{Mode}/g, customerMode)
            .replace(/{CustomerNumber}/g, (customerNumber + index).toString())
            .replace(/{Name}/g, nameValue)
            .replace(/{CodeName}/g, codeName)
            .replace(/{AdditionalLine}/g, escapeXML(row['Ligne supplémentaire'] || ''))
            .replace(/{Line1}/g, escapeXML(row['Adresse'] || ''))
            .replace(/{ZIP}/g, escapeXML(row['Code postal'] || ''))
            .replace(/{City}/g, escapeXML(row['Ville'] || ''))
            .replace(/{HouseNumber}/g, escapeXML(row['Numero'] || ''))
            .replace(/{Street}/g, escapeXML(row['Adresse'] || ''));

          transactions += transactionXML;
        });

        const xmlOutput = `<?xml version="1.0" encoding="utf-8"?>
<AbaConnectContainer>
  <TaskCount>1</TaskCount>
  <Task>
    <Parameter>
      <Application>DEBI</Application>
      <Id>Kunden</Id>
      <MapId>AbaDefault</MapId>
      <Version>2022.00</Version>
    </Parameter>
    ${transactions}
  </Task>
</AbaConnectContainer>`;

        setGeneratedXML(xmlOutput);
        setXmlType('customer');

        toast({
          title: "XML généré",
          description: "Le fichier XML des clients a été généré avec succès. Cliquez sur le bouton de téléchargement pour l'obtenir.",
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Erreur lors de la génération du XML : " + (error as Error).message,
          variant: "destructive",
        });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const convertXMLtoExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier XML.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const xmlStr = e.target!.result as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');

        const data: any[] = [];
        const transactions = xmlDoc.getElementsByTagName('Transaction');
        
        for (let i = 0; i < transactions.length; i++) {
          const supplier = transactions[i].getElementsByTagName('Supplier')[0];
          if (!supplier) continue;

          const addressData = supplier.getElementsByTagName('AddressData')[0];
          let name = '', codeName = '', line1 = '', houseNumber = '', zipCode = '', city = '',
              country = '', phone1 = '', website = '', email = '', taxIdSwitzerland = '';
          
          if (addressData) {
            name = addressData.getElementsByTagName('Name')[0]?.textContent || '';
            codeName = addressData.getElementsByTagName('CodeName')[0]?.textContent || '';
            line1 = addressData.getElementsByTagName('Line1')[0]?.textContent || '';
            houseNumber = addressData.getElementsByTagName('HouseNumber')[0]?.textContent || '';
            zipCode = addressData.getElementsByTagName('ZIP')[0]?.textContent || '';
            city = addressData.getElementsByTagName('City')[0]?.textContent || '';
            country = addressData.getElementsByTagName('Country')[0]?.textContent || '';
            phone1 = addressData.getElementsByTagName('Phone1')[0]?.textContent || '';
            website = addressData.getElementsByTagName('Website')[0]?.textContent || '';
            email = addressData.getElementsByTagName('Email')[0]?.textContent || '';
            taxIdSwitzerland = addressData.getElementsByTagName('TaxIDSwitzerland')[0]?.textContent || '';
          }

          const ibans: string[] = [];
          const beneficiaryAccounts = supplier.getElementsByTagName('BeneficiaryAccount');
          for (let j = 0; j < beneficiaryAccounts.length; j++) {
            const iban = beneficiaryAccounts[j].getElementsByTagName('BeneficiaryAccountNumber')[0]?.textContent || '';
            if (iban && iban.length === 21) ibans.push(iban);
          }
          const ibansText = ibans.join('\n');

          data.push({
            Nom: name,
            'Ligne supplémentaire': '',
            Adresse: line1,
            Numero: houseNumber,
            'Code postal': zipCode,
            Ville: city,
            Pays: country,
            'Téléphone 1': phone1,
            WWW: website,
            'E-mail': email,
            'N° TVA': taxIdSwitzerland,
            IBAN: ibansText
          });
        }

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Fournisseurs');
        XLSX.writeFile(wb, 'Adresses_Fournisseurs_output.xlsx');

        toast({
          title: "Excel généré",
          description: "Le fichier Excel a été généré avec succès.",
        });
      } catch (error) {
        toast({
          title: "Erreur",
          description: "Erreur lors de la conversion : " + (error as Error).message,
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Adresses</h1>
          <p className="mt-2 text-lg text-gray-600">
            Convertissez vos fichiers Excel en XML pour Abacus et vice versa
          </p>
          <div className="mt-4 flex justify-center">
            <a 
              href="https://github.com/Hmz931/exceltoabacus" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center text-blue-600 hover:text-blue-800"
            >
              <Github className="mr-2 h-4 w-4" />
              Voir le code source sur GitHub
            </a>
          </div>
        </div>

        {/* Download button for generated XML */}
        {generatedXML && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-green-800">
                    XML {xmlType === 'supplier' ? 'Fournisseurs' : 'Clients'} généré avec succès
                  </h3>
                  <p className="text-green-600">
                    Votre fichier XML est prêt à être téléchargé
                  </p>
                </div>
                <Button onClick={downloadGeneratedXML} className="bg-green-600 hover:bg-green-700">
                  <Download className="mr-2 h-4 w-4" />
                  Télécharger XML
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions générales */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Info className="mr-2 h-5 w-5" />
              Instructions d'utilisation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-green-700">Pour créer des fichiers XML :</h4>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  <li>Téléchargez le modèle Excel approprié</li>
                  <li>Remplissez le fichier avec vos données</li>
                  <li>Configurez le mode et numéro initial</li>
                  <li>Téléchargez votre fichier rempli pour générer le XML</li>
                </ol>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-blue-700">Pour importer dans Abacus :</h4>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  <li>Ouvrez l'application F625 dans Abacus</li>
                  <li>Sélectionnez "Fichier" → "Importer"</li>
                  <li>Choisissez votre fichier XML généré</li>
                  <li>Suivez les instructions d'importation d'Abacus</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Générer XML Fournisseurs */}
          <Card>
            <CardHeader>
              <CardTitle>1. Générer XML Fournisseurs</CardTitle>
              <CardDescription>
                Convertissez vos données fournisseurs Excel au format XML Abacus
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier-mode">Mode d'importation :</Label>
                  <Select value={supplierMode} onValueChange={setSupplierMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSERT">INSERT (Nouveau)</SelectItem>
                      <SelectItem value="SAVE" disabled="true">SAVE (Créer/Modifier)</SelectItem>
                      <SelectItem value="UPDATE" disabled="true">UPDATE (Modifier uniquement)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="supplier-file">Fichier Excel rempli :</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={generateSupplierXML}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                   Sélectionnez votre fichier Excel rempli pour générer le XML. Les colonnes obligatoires suivantes doivent être renseignées : <b>"Nom", "Code postal", "Ville" et "Pays"</b>. Ces champs ne doivent pas être vides.                  
                </p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex items-center">
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger modèle Fournisseurs
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Télécharger le modèle Fournisseurs</AlertDialogTitle>
                    <AlertDialogDescription>
                      Vous allez télécharger le modèle Excel pour les fournisseurs. 
                      Ce fichier contient toutes les colonnes nécessaires que vous devrez remplir 
                      avec vos données avant de générer le XML.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={downloadSupplierTemplate}>
                      Télécharger
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Générer XML Clients */}
          <Card>
            <CardHeader>
              <CardTitle>2. Générer XML Clients</CardTitle>
              <CardDescription>
                Convertissez vos données clients Excel au format XML Abacus
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer-mode">Mode d'importation :</Label>
                  <Select value={customerMode} onValueChange={setCustomerMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSERT">INSERT (Nouveau)</SelectItem>
                      <SelectItem value="SAVE" disabled="true">SAVE (Créer/Modifier)</SelectItem>
                      <SelectItem value="UPDATE" disabled="true">UPDATE (Modifier uniquement)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label htmlFor="customer-file">Fichier Excel rempli :</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={generateCustomerXML}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Sélectionnez votre fichier Excel rempli pour générer le XML
                </p>
              </div>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="flex items-center">
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger modèle Clients
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Télécharger le modèle Clients</AlertDialogTitle>
                    <AlertDialogDescription>
                      Vous allez télécharger le modèle Excel pour les clients. 
                      Ce fichier contient toutes les colonnes nécessaires que vous devrez remplir 
                      avec vos données avant de générer le XML.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={downloadCustomerTemplate}>
                      Télécharger
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>

          {/* Convertir XML en Excel */}
          <Card>
            <CardHeader>
              <CardTitle>3. Convertir XML en Excel</CardTitle>
              <CardDescription>
                Convertissez un fichier XML Abacus vers le format Excel pour modification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="xml-file">Fichier XML à convertir :</Label>
                <Input
                  type="file"
                  accept=".xml"
                  onChange={convertXMLtoExcel}
                  className="mt-1"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Sélectionnez un fichier XML d'adresses pour le convertir en Excel
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Information sur F625 */}
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800">💡 Import dans Abacus via F625</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-blue-700 mb-3">
                Pour importer vos fichiers XML dans Abacus :
              </p>
              <ol className="list-decimal list-inside text-blue-700 space-y-2">
                <li>Ouvrez Abacus et naviguez vers l'application <strong>F625</strong></li>
                <li>Dans le menu, sélectionnez <strong>Fichier</strong> → <strong>Importer</strong></li>
                <li>Choisissez votre fichier XML généré par cet outil</li>
                <li>Configurez les paramètres d'import selon vos besoins</li>
                <li>Lancez l'importation et vérifiez les résultats</li>
              </ol>
              <p className="text-blue-600 text-sm mt-3">
                <strong>Note :</strong> Assurez-vous d'avoir les droits nécessaires dans Abacus pour importer des données.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AddressManager;
