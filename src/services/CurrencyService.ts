import { CurrencyRate } from '../types';

export class CurrencyService {
  private static rates: CurrencyRate[] = [
    { code: 'USD', name: 'Dollar US', rate: 1.0 },
    { code: 'EUR', name: 'Euro', rate: 0.85 },
    { code: 'XOF', name: 'Franc CFA', rate: 600.0 },
    { code: 'GBP', name: 'Livre Sterling', rate: 0.75 },
    { code: 'CAD', name: 'Dollar Canadien', rate: 1.35 },
    { code: 'CHF', name: 'Franc Suisse', rate: 0.92 },
    { code: 'JPY', name: 'Yen Japonais', rate: 110.0 },
    { code: 'NGN', name: 'Naira Nigérian', rate: 460.0 },
    { code: 'GHS', name: 'Cedi Ghanéen', rate: 6.0 },
    { code: 'MAD', name: 'Dirham Marocain', rate: 10.0 }
  ];

  public static getCurrencies(): CurrencyRate[] {
    return this.rates;
  }

  public static convertAmount(amount: number, fromCurrency: string, toCurrency: string): number {
    if (fromCurrency === toCurrency) return amount;
    
    const fromRate = this.rates.find(r => r.code === fromCurrency)?.rate || 1;
    const toRate = this.rates.find(r => r.code === toCurrency)?.rate || 1;
    
    // Convert to USD first, then to target currency
    const usdAmount = amount / fromRate;
    return usdAmount * toRate;
  }

  public static formatAmount(amount: number, currency: string): string {
    const formatter = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currency === 'XOF' ? 'XOF' : currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    
    try {
      return formatter.format(amount);
    } catch {
      return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currency}`;
    }
  }
}