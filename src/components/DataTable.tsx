import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { SalesData } from '../types';
import { CurrencyService } from '../services/CurrencyService';

interface DataTableProps {
  data: SalesData[];
  onExport: () => void;
  displayCurrency: string;
}

type SortField = keyof SalesData;
type SortDirection = 'asc' | 'desc';

export const DataTable: React.FC<DataTableProps> = ({ data, onExport, displayCurrency }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    const aValue = a[sortField];
    const bValue = b[sortField];
    
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    }
    
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    return 0;
  });

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = sortedData.slice(startIndex, endIndex);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-white opacity-60" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-white" />
      : <ArrowDown className="w-4 h-4 text-white" />;
  };

  // Calculate totals in display currency
  const totalAmount = data.reduce((sum, item) => 
    sum + CurrencyService.convertAmount(item.totalAmount, item.currency, displayCurrency), 0);
  const totalTax = data.reduce((sum, item) => 
    sum + CurrencyService.convertAmount(item.totalTax, item.currency, displayCurrency), 0);
  const totalHT = data.reduce((sum, item) => 
    sum + CurrencyService.convertAmount(item.totalHt, item.currency, displayCurrency), 0);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune donnée à afficher</h3>
        <p className="text-gray-500">Importez un fichier de rapport pour voir les données ici.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header with stats and controls */}
      <div className="bg-gradient-to-r from-asky-blue to-blue-700 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Eye className="w-6 h-6" />
            <h2 className="text-xl font-semibold">
              Données complètes ({data.length} enregistrements)
            </h2>
          </div>
          <button
            onClick={onExport}
            className="bg-white text-asky-blue px-4 py-2 rounded-lg font-medium hover:bg-blue-50 transition-colors flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Exporter Excel
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-blue-100 text-sm">Total Enregistrements</p>
            <p className="text-2xl font-bold">{data.length}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-blue-100 text-sm">Montant Total</p>
            <p className="text-2xl font-bold">{CurrencyService.formatAmount(totalAmount, displayCurrency)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-blue-100 text-sm">Total Taxes</p>
            <p className="text-2xl font-bold">{CurrencyService.formatAmount(totalTax, displayCurrency)}</p>
          </div>
          <div className="bg-white/10 rounded-lg p-4">
            <p className="text-blue-100 text-sm">Total HT</p>
            <p className="text-2xl font-bold">{CurrencyService.formatAmount(totalHT, displayCurrency)}</p>
          </div>
        </div>
      </div>

      {/* Table controls */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Afficher:</label>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={data.length}>Tout</option>
            </select>
            <span className="text-sm text-gray-700">entrées</span>
          </div>
        </div>

        <div className="text-sm text-gray-700">
          Affichage de {startIndex + 1} à {Math.min(endIndex, data.length)} sur {data.length} entrées
        </div>
        
        <div className="text-sm text-gray-700">
          Montants affichés en: <span className="font-semibold">{displayCurrency}</span>
        </div>
      </div>

      {/* Data table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-red-600">
            <tr>
              {[
                { key: 'date', label: 'Date' },
                { key: 'station', label: 'Station' },
                { key: 'officeId', label: 'Office ID' },
                { key: 'stationCode', label: 'Code' },
                { key: 'currency', label: 'Devise' },
                { key: 'et', label: 'ET' },
                { key: 'visa', label: 'VISA' },
                { key: 'amex', label: 'AMEX' },
                { key: 'mastercard', label: 'MasterCard' },
                { key: 'otherFop', label: 'Other FOP' },
                { key: 'refund', label: 'Refund' },
                { key: 'netFare', label: 'Net Fare' },
                { key: 'totalAmount', label: 'Total' },
                { key: 'totalTax', label: 'Taxes' },
                { key: 'totalHt', label: 'HT' }
              ].map(({ key, label }) => (
                <th
                  key={key}
                  className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer hover:bg-red-700 transition-colors"
                  onClick={() => handleSort(key as SortField)}
                >
                  <div className="flex items-center gap-1">
                    {label}
                    {getSortIcon(key as SortField)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {currentData.map((item, index) => (
              <tr key={`${item.station}-${item.officeId}-${index}`} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.date}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{item.station}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.officeId}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.stationCode}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{item.currency}</td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.et, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.visa, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.amex, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.mastercard, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.otherFop, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.refund, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.netFare, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.totalAmount, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.totalTax, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                  {CurrencyService.formatAmount(
                    CurrencyService.convertAmount(item.totalHt, item.currency, displayCurrency), 
                    displayCurrency
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-1 rounded-md text-sm ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md border border-gray-300 bg-white text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          
          <div className="text-sm text-gray-700">
            Page {currentPage} sur {totalPages}
          </div>
        </div>
      )}
    </div>
  );
};