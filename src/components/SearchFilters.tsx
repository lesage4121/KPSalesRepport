import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Calendar, Building, CreditCard, DollarSign } from 'lucide-react';
import { SalesData } from '../types';

interface SearchFiltersProps {
  data: SalesData[];
  onFilteredDataChange: (filteredData: SalesData[]) => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({ data, onFilteredDataChange }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    station: '',
    currency: '',
    officeId: '',
    paymentType: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Get unique values for filter dropdowns
  const uniqueStations = [...new Set(data.map(item => item.station))].sort();
  const uniqueCurrencies = [...new Set(data.map(item => item.currency))].sort();
  const uniqueOfficeIds = [...new Set(data.map(item => item.officeId.toString()))].sort();

  const paymentTypes = [
    { value: 'et', label: 'ET' },
    { value: 'visa', label: 'VISA' },
    { value: 'amex', label: 'AMEX' },
    { value: 'mastercard', label: 'MasterCard' },
    { value: 'otherFop', label: 'Other FOP' }
  ];

  useEffect(() => {
    let filteredData = data;

    // Text search across multiple fields
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredData = filteredData.filter(item =>
        item.station.toLowerCase().includes(term) ||
        item.currency.toLowerCase().includes(term) ||
        item.officeId.toString().includes(term) ||
        item.stationCode.toLowerCase().includes(term) ||
        item.date.includes(term)
      );
    }

    // Apply filters
    if (filters.station) {
      filteredData = filteredData.filter(item => item.station === filters.station);
    }
    if (filters.currency) {
      filteredData = filteredData.filter(item => item.currency === filters.currency);
    }
    if (filters.officeId) {
      filteredData = filteredData.filter(item => item.officeId.toString() === filters.officeId);
    }
    if (filters.paymentType) {
      filteredData = filteredData.filter(item => {
        const paymentValue = item[filters.paymentType as keyof SalesData] as number;
        return paymentValue > 0;
      });
    }
    if (filters.dateFrom) {
      filteredData = filteredData.filter(item => {
        const itemDate = new Date(item.date.split('/').reverse().join('-'));
        const fromDate = new Date(filters.dateFrom);
        return itemDate >= fromDate;
      });
    }
    if (filters.dateTo) {
      filteredData = filteredData.filter(item => {
        const itemDate = new Date(item.date.split('/').reverse().join('-'));
        const toDate = new Date(filters.dateTo);
        return itemDate <= toDate;
      });
    }
    if (filters.minAmount) {
      filteredData = filteredData.filter(item => item.totalAmount >= parseFloat(filters.minAmount));
    }
    if (filters.maxAmount) {
      filteredData = filteredData.filter(item => item.totalAmount <= parseFloat(filters.maxAmount));
    }

    onFilteredDataChange(filteredData);
  }, [searchTerm, filters, data, onFilteredDataChange]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilters({
      station: '',
      currency: '',
      officeId: '',
      paymentType: '',
      dateFrom: '',
      dateTo: '',
      minAmount: '',
      maxAmount: ''
    });
  };

  const hasActiveFilters = searchTerm || Object.values(filters).some(value => value !== '');

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-800">Recherche et Filtres</h3>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Effacer tout
            </button>
          )}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filtres avancés
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par station, devise, office ID, code station..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Quick filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <select
          value={filters.station}
          onChange={(e) => handleFilterChange('station', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Toutes les stations</option>
          {uniqueStations.map(station => (
            <option key={station} value={station}>{station}</option>
          ))}
        </select>

        <select
          value={filters.currency}
          onChange={(e) => handleFilterChange('currency', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Toutes les devises</option>
          {uniqueCurrencies.map(currency => (
            <option key={currency} value={currency}>{currency}</option>
          ))}
        </select>

        <select
          value={filters.officeId}
          onChange={(e) => handleFilterChange('officeId', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Tous les Office ID</option>
          {uniqueOfficeIds.map(id => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>

        <select
          value={filters.paymentType}
          onChange={(e) => handleFilterChange('paymentType', e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Tous les moyens de paiement</option>
          {paymentTypes.map(type => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Advanced filters */}
      {showAdvancedFilters && (
        <div className="border-t pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date de début
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date de fin
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Montant minimum
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={filters.minAmount}
                onChange={(e) => handleFilterChange('minAmount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Montant maximum
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={filters.maxAmount}
                onChange={(e) => handleFilterChange('maxAmount', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};