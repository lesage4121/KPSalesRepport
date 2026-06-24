import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Zap, Save, TrendingUp, ChevronLeft } from 'lucide-react';
import { FileUploader } from '../components/FileUploader';
import { ProcessingStatusComponent } from '../components/ProcessingStatus';
import { SearchFilters } from '../components/SearchFilters';
import { DataTable } from '../components/DataTable';
import { SalesChart } from '../components/SalesChart';
import { DataHistory } from '../components/DataHistory';
import { CurrencySelector } from '../components/CurrencySelector';
import { SalesReportParser } from '../services/fileParser';
import { ExcelGenerator } from '../services/excelGeneratorService';
import { DataStorageService } from '../services/dataStorageService';
import { CurrencyService } from '../services/CurrencyService';
import { SalesData,ProcessingStatus, SavedData } from '../types';
import { useNavigate } from "react-router-dom";

 export const OnlineApp: React.FC = ()=> {
  const navigate = useNavigate();
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [filteredData, setFilteredData] = useState<SalesData[]>([]);
  const [displayCurrency, setDisplayCurrency] = useState('USD');
  const [activeTab, setActiveTab] = useState<'data' | 'chart' | 'history'>('data');
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    isProcessing: false,
    progress: 0,
    currentStep: ''
  });

  const parser = new SalesReportParser();
  const excelGenerator = new ExcelGenerator();

  // Charger les données historiques au démarrage
  useEffect(() => {loadHistoricalData();}, []);

  const loadHistoricalData = async () => {
    try {
      const historicalData = await DataStorageService.getAllHistoricalData();
      if (historicalData.length > 0) {
        setSalesData(historicalData);
        setFilteredData(historicalData);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des données historiques:', error);
    }
  };

  const handleFileSelect = async (file: File) => {
    setProcessingStatus({
      isProcessing: true,
      progress: 0,
      currentStep: 'Lecture du fichier...'
    });
    
    try {
      const content = await file.text();
      
      const data = await parser.parseFile( content,
      (progress, step) => {setProcessingStatus({ isProcessing: true, progress, currentStep: step });}   );

      setSalesData(data);
      setFilteredData(data);
      
      // Save data automatically
      await DataStorageService.saveData(file.name, data);
      
      setProcessingStatus({
        isProcessing: false,
        progress: 100,
        currentStep: `${data.length} stations extraites avec succès!`
      });

      // Clear success message after 3 seconds
      setTimeout(() => {
        setProcessingStatus({
          isProcessing: false,
          progress: 0,
          currentStep: ''
        });
      }, 3000);

    } catch (error) {
      setProcessingStatus({
        isProcessing: false,
        progress: 0,
        currentStep: '',
        error: error instanceof Error ? error.message : 'Erreur lors du traitement du fichier'
      });
    }
  };

  const handleExport = async () => {
    try {
      await excelGenerator.generateExcel(filteredData.length > 0 ? filteredData : salesData);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
    }
  };

  const handleLoadHistoricalData = (historicalData: SavedData[]) => {
    const allData = historicalData.flatMap(item => item.data);
    setSalesData(allData);
    setFilteredData(allData);
    setActiveTab('data');
  };

  // Calculate totals in display currency
  const calculateTotals = (data: SalesData[]) => {
    let totalAmount = 0;
    let totalHT = 0;
    
    data.forEach(item => {
      totalAmount += CurrencyService.convertAmount(item.totalAmount, item.currency, displayCurrency);
      totalHT += CurrencyService.convertAmount(item.totalHt, item.currency, displayCurrency);
    });
    
    return { totalAmount, totalHT };
  };

  const { totalAmount, totalHT } = calculateTotals(filteredData.length > 0 ? filteredData : salesData);


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50">
            <div className="flex items-center justify-between pt-5">
              <button 
                onClick={() => navigate("/")}
                className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                Return to menu
              </button>
            </div>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="bg-asky-blue p-3 rounded-xl">
                <FileSpreadsheet className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-asky-blue to-blue-800 bg-clip-text text-transparent">
                ASKY Airlines - Extracteur de Rapports
              </h1>
              <div className="bg-asky-orange p-3 rounded-xl">
                <Zap className="w-8 h-8 text-white" />
              </div>
            </div>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Transformez vos rapports de ventes hebdomadaires en fichiers Excel structurés 
              avec analyse automatique et mise en forme professionnelle.
            </p>
            
            {/* Currency selector and totals */}
            {salesData.length > 0 && (
              <div className="flex items-center justify-center gap-6 mt-6">
                <CurrencySelector 
                  selectedCurrency={displayCurrency}
                  onCurrencyChange={setDisplayCurrency}
                />
                <div className="flex items-center gap-4 text-sm">
                  <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                    <span className="text-gray-600">Total TTC: </span>
                    <span className="font-bold text-asky-blue">
                      {CurrencyService.formatAmount(totalAmount, displayCurrency)}
                    </span>
                  </div>
                  <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                    <span className="text-gray-600">Total HT: </span>
                    <span className="font-bold text-asky-orange">
                      {CurrencyService.formatAmount(totalHT, displayCurrency)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="space-y-8">
          {/* File upload section */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Étape 1: Sélectionnez votre fichier
              </h2>
              <p className="text-gray-600">
                Importez votre rapport de ventes au format texte (.txt) pour commencer l'extraction.
              </p>
            </div>
            
            <FileUploader 
              onFileSelect={handleFileSelect}
              isProcessing={processingStatus.isProcessing}
            />
          </div>

          {/* Processing status */}
          <ProcessingStatusComponent status={processingStatus} />

          {/* Navigation tabs */}
          {salesData.length > 0 && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="border-b border-gray-200">
                <nav className="flex">
                  {[
                    { key: 'data', label: 'Données', icon: FileSpreadsheet },
                    { key: 'chart', label: 'Graphiques', icon: TrendingUp },
                    { key: 'history', label: 'Historique', icon: Save }
                  ].map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key as any)}
                      className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                        activeTab === key
                          ? 'border-asky-blue text-asky-blue bg-blue-50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {label}
                    </button>
                  ))}
                </nav>
              </div>
              
              <div className="p-6">
                {activeTab === 'data' && (
                  <div className="space-y-6">
                    <SearchFilters 
                      data={salesData}
                      onFilteredDataChange={setFilteredData}
                    />
                    
                    <DataTable 
                      data={filteredData}
                      onExport={handleExport}
                      displayCurrency={displayCurrency}
                    />
                  </div>
                )}
                
                {activeTab === 'chart' && (
                  <SalesChart 
                    data={salesData}
                    displayCurrency={displayCurrency}
                  />
                )}
                
                {activeTab === 'history' && (
                  <DataHistory 
                    onLoadHistoricalData={handleLoadHistoricalData}
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Features */}
        {salesData.length === 0 && !processingStatus.isProcessing && (
          <div className="mt-16 bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
              Fonctionnalités principales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-6 border border-gray-200 rounded-xl hover:shadow-lg transition-shadow">
                <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet className="w-8 h-8 text-asky-blue" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Parsing Intelligent</h4>
                <p className="text-gray-600">
                  Extraction automatique des données de stations, montants, taxes et moyens de paiement.
                </p>
              </div>
              
              <div className="text-center p-6 border border-gray-200 rounded-xl hover:shadow-lg transition-shadow">
                <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Zap className="w-8 h-8 text-green-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Traitement Rapide</h4>
                <p className="text-gray-600">
                  Traitement en temps réel avec indicateur de progression et validation des données.
                </p>
              </div>
              
              <div className="text-center p-6 border border-gray-200 rounded-xl hover:shadow-lg transition-shadow">
                <div className="bg-orange-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileSpreadsheet className="w-8 h-8 text-asky-orange" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Export Excel</h4>
                <p className="text-gray-600">
                  Génération automatique de fichiers Excel formatés avec en-têtes et styles professionnels.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
