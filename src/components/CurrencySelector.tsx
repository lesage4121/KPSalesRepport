import React from 'react';
import { DollarSign } from 'lucide-react';
import { CurrencyService } from '../services/CurrencyService';

interface CurrencySelectorProps {
  selectedCurrency: string;
  onCurrencyChange: (currency: string) => void;
}

export const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  selectedCurrency,
  onCurrencyChange
}) => {
  const currencies = CurrencyService.getCurrencies();

  return (
    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
      <DollarSign className="w-4 h-4 text-asky-orange" />
      <select
        value={selectedCurrency}
        onChange={(e) => onCurrencyChange(e.target.value)}
        className="bg-transparent border-none outline-none text-sm font-medium text-gray-700 cursor-pointer"
      >
        {currencies.map(currency => (
          <option key={currency.code} value={currency.code}>
            {currency.code} - {currency.name}
          </option>
        ))}
      </select>
    </div>
  );
};