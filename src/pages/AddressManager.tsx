
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
import { Download, File } from 'lucide-react';
import * as XLSX from 'xlsx';

const AddressManager = () => {
  const [supplierMode, setSupplierMode] = useState('INSERT');
  const [supplierNumber, setSupplierNumber] = useState(450);
  const [customerMode, setCustomerMode] = useState('INSERT');
  const [customerNumber, setCustomerNumber] = useState(86);

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
    const data = [{
      Nom: '',
      'Ligne supplémentaire': '',
      Adresse: '',
      Numero: '',
      'Code postal': '',
      Ville: '',
      Pays: '',
      'Téléphone 1': '',
      WWW: '',
      'E-mail': '',
      'N° TVA': '',
      IBAN: ''
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fournisseurs');
    XLSX.writeFile(wb, 'Adresses_Fournisseurs.xlsx');
    
    toast({
      title: "Modèle téléchargé",
      description: "Le modèle fournisseurs a été téléchargé avec succès.",
    });
  };

  const downloadCustomerTemplate = () => {
    const data = [{
      CodeName: '',
      Nom: '',
      'Ligne supplémentaire': '',
      Adresse: '',
      Numero: '',
      'Code postal': '',
      Ville: ''
    }];
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clients');
    XLSX.writeFile(wb, 'Adresses_Clients.xlsx');
    
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
          <BeneficiaryAddressNumber>${supplierNum}</BeneficiaryAddressNumber>
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
              <Number>{SupplierNumber}</Number>
              <AddressData mode="SAVE">
                <CodeName>{CodeName}</CodeName>
                <Number>{SupplierNumber}</Number>
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
                <Number>{SupplierNumber}</Number>
                <AddressNumber>{SupplierNumber}</AddressNumber>
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
                <AdviceAddressNumber>{SupplierNumber}</AdviceAddressNumber>
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

        const blob = new Blob([xmlOutput], { type: 'text/xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Adresses.xml';
        link.click();

        toast({
          title: "XML généré",
          description: "Le fichier XML des fournisseurs a été généré avec succès.",
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
              <CustomerNumber>{CustomerNumber}</CustomerNumber>
              <CustomerID/>
              <PaymentTermNumber>1</PaymentTermNumber>
              <TurnoverCustomer>0</TurnoverCustomer>
              <PersonInCharge>0</PersonInCharge>
              <NoTurnoverActive>false</NoTurnoverActive>
              <CreditLimitType>0</CreditLimitType>
              <CreditLimitAmount>0</CreditLimitAmount>
              <CreditLimitFromTurnoverCustomer>false</CreditLimitFromTurnoverCustomer>
              <MultipleCurrenciesActive>false</MultipleCurrenciesActive>
              <DefaultCurrency>CHF</DefaultCurrency>
              <AccountProposalType>0</AccountProposalType>
              <AccountProposalNumber>0</AccountProposalNumber>
              <ReminderAddress>0</ReminderAddress>
              <ReminderContact>0</ReminderContact>
              <ReminderProcedure>NORM</ReminderProcedure>
              <ReminderArea>0</ReminderArea>
              <ReminderType>0</ReminderType>
              <ReminderDeliveryFlag>false</ReminderDeliveryFlag>
              <ReminderNoReminder>false</ReminderNoReminder>
              <ReminderBlocked>false</ReminderBlocked>
              <ReminderIntervalMinimised>false</ReminderIntervalMinimised>
              <ReminderBlockedUntil/>
              <ReminderBlockedDeliveryFlag>false</ReminderBlockedDeliveryFlag>
              <CollectiveDebtor>false</CollectiveDebtor>
              <InactiveFrom/>
              <Division>0</Division>
              <Intercompany>0</Intercompany>
              <CostGroup>0</CostGroup>
              <CustomerCommissionGroup>0</CustomerCommissionGroup>
              <CommissionPayer1>0</CommissionPayer1>
              <CommissionPayer2>0</CommissionPayer2>
              <AbcCode/>
              <CashManagementGroup>0</CashManagementGroup>
              <GroupNumber1>0</GroupNumber1>
              <GroupNumber2>0</GroupNumber2>
              <GroupNumber3>0</GroupNumber3>
              <GroupCode1/>
              <GroupCode2/>
              <GroupCode3/>
              <Tenant>false</Tenant>
              <DispositionDateFlag>0</DispositionDateFlag>
              <DispositionDateDays>0</DispositionDateDays>
              <OutpaymentMethod>0</OutpaymentMethod>
              <DebitMethod>0</DebitMethod>
              <SubLedgerAccountNumber>0</SubLedgerAccountNumber>
              <DispatchType>0</DispatchType>
              <RemindWaitPeriodDays>0</RemindWaitPeriodDays>
              <OverrideWaitPerDays>false</OverrideWaitPerDays>
              <AddressData mode="{Mode}">
                <AddressNumber></AddressNumber>
                <CodeName>{CodeName}</CodeName>
                <Name>{Name}</Name>
                <FirstName/>
                <AdditionalLine>{AdditionalLine}</AdditionalLine>
                <Line1>{Line1}</Line1>
                <Line2/>
                <Line3/>
                <Line4/>
                <Country>CH</Country>
                <ZIP>{ZIP}</ZIP>
                <City>{City}</City>
                <Phone1/>
                <Phone2/>
                <Fax/>
                <Mobile/>
                <SalutationNumber>0</SalutationNumber>
                <SalutationName/>
                <Title/>
                <IndustryCode>0</IndustryCode>
                <Text/>
                <Website/>
                <Email/>
                <Language>fr</Language>
                <FreeDate/>
                <FreeField1/>
                <FreeField2/>
                <SubjectType>2</SubjectType>
                <AANMainSubject>0</AANMainSubject>
                <AddressValidAsOf>2021-01-01</AddressValidAsOf>
                <TaxIDSwitzerland/>
                <TaxIDEuropeanUnion/>
                <PostRoute>0</PostRoute>
                <HouseNumber>{HouseNumber}</HouseNumber>
                <Street>{Street}</Street>
                <PostOfficeBoxText/>
                <PostOfficeBoxNumber/>
                <StreetAddition/>
                <AddressAddition/>
                <DwellingNumber/>
                <MunicipalityCode>6621</MunicipalityCode>
                <BuildingNumber>0</BuildingNumber>
                <OpenLocationCode/>
                <StreetHouseNumber>{Street} {HouseNumber}</StreetHouseNumber>
                <PostOfficeBoxTextNumber/>
              </AddressData>
              <CurrencyData mode="{Mode}">
                <Currency>CHF</Currency>
                <TaxCode/>
                <CurrencyRisk>0</CurrencyRisk>
                <CurrencyLimitAmount>0</CurrencyLimitAmount>
                <PaymentOrderESRProcedure>0</PaymentOrderESRProcedure>
                <PaymentOrderIPIProcedure>0</PaymentOrderIPIProcedure>
                <StandardProcedure>3</StandardProcedure>
                <PaymentOrderEZProcedure>1</PaymentOrderEZProcedure>
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

        const blob = new Blob([xmlOutput], { type: 'text/xml' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Adresses.xml';
        link.click();

        toast({
          title: "XML généré",
          description: "Le fichier XML des clients a été généré avec succès.",
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
            Générez des fichiers XML pour fournisseurs et clients, convertissez vos données
          </p>
        </div>

        <div className="space-y-6">
          {/* Générer XML Fournisseurs */}
          <Card>
            <CardHeader>
              <CardTitle>Générer XML Fournisseurs</CardTitle>
              <CardDescription>
                Créez un fichier XML pour importer des fournisseurs dans Abacus
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="supplier-mode">Mode :</Label>
                  <Select value={supplierMode} onValueChange={setSupplierMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSERT">INSERT</SelectItem>
                      <SelectItem value="SAVE">SAVE</SelectItem>
                      <SelectItem value="UPDATE">UPDATE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="supplier-number">Numéro de fournisseur initial :</Label>
                  <Input
                    type="number"
                    value={supplierNumber}
                    onChange={(e) => setSupplierNumber(parseInt(e.target.value) || 450)}
                    min="1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="supplier-file">Télécharger fichier Excel (Adresses Fournisseurs.xlsx) :</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={generateSupplierXML}
                />
              </div>
              
              <Button 
                onClick={downloadSupplierTemplate}
                variant="outline"
                className="flex items-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Télécharger modèle Fournisseurs
              </Button>
            </CardContent>
          </Card>

          {/* Générer XML Clients */}
          <Card>
            <CardHeader>
              <CardTitle>Générer XML Clients</CardTitle>
              <CardDescription>
                Créez un fichier XML pour importer des clients dans Abacus
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer-mode">Mode :</Label>
                  <Select value={customerMode} onValueChange={setCustomerMode}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSERT">INSERT</SelectItem>
                      <SelectItem value="SAVE">SAVE</SelectItem>
                      <SelectItem value="UPDATE">UPDATE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="customer-number">Numéro de client initial :</Label>
                  <Input
                    type="number"
                    value={customerNumber}
                    onChange={(e) => setCustomerNumber(parseInt(e.target.value) || 86)}
                    min="1"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="customer-file">Télécharger fichier Excel (Adresses Clients.xlsx) :</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={generateCustomerXML}
                />
              </div>
              
              <Button 
                onClick={downloadCustomerTemplate}
                variant="outline"
                className="flex items-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Télécharger modèle Clients
              </Button>
            </CardContent>
          </Card>

          {/* Convertir XML en Excel */}
          <Card>
            <CardHeader>
              <CardTitle>Convertir XML en Excel</CardTitle>
              <CardDescription>
                Convertissez un fichier XML d'adresses en format Excel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="xml-file">Télécharger fichier XML (Adresses.xml) :</Label>
                <Input
                  type="file"
                  accept=".xml"
                  onChange={convertXMLtoExcel}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AddressManager;
