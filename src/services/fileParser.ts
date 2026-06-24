import { SalesData } from '../types';

export class SalesReportParser {
  private formatDate(dateStr: string): string {
    try {
      // Parse format ddMMMyy (e.g., 15JAN24)
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                         'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      
      const day = parseInt(dateStr.substring(0, 2));
      const monthStr = dateStr.substring(2, 5);
      const year = 2000 + parseInt(dateStr.substring(5, 7));
      
      const monthIndex = monthNames.indexOf(monthStr);
      if (monthIndex === -1) return dateStr;
      
      const date = new Date(year, monthIndex, day);
      return date.toLocaleDateString('fr-FR');
    } catch {
      return dateStr;
    }
  }

  private extractNumber(line: string, keyword: string): number {
    try {
      const index = line.lastIndexOf(keyword);
      if (index === -1) return 0;
      
      const numberStr = line.substring(index + keyword.length).trim();
      const tokens = numberStr.split(/\s+/);
      const lastToken = tokens[tokens.length - 1];
      
      return parseFloat(lastToken) || 0;
    } catch {
      return 0;
    }
  }

  private extractLastNumber(line: string): number {
    try {
      const tokens = line.split(/\s+/);
      const lastToken = tokens[tokens.length - 1].trim();
      return parseFloat(lastToken) || 0;
    } catch {
      return 0;
    }
  }

  public async parseFile(content: string, onProgress?: (progress: number, step: string) => void): Promise<SalesData[]> {
    const lines = content.split('\n');
    const results: SalesData[] = [];
    
    let currentDate = '';
    let currentStation = '';
    let currentStationNumber = 0;
    let currentStationCode = '';
    let currentData: Partial<SalesData> = {};
    
    onProgress?.(10, 'Initialisation du parsing...');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const progress = 10 + (i / lines.length) * 80;
      
      if (i % 100 === 0) {
        onProgress?.(progress, `Analyse ligne ${i + 1}/${lines.length}`);
        // Allow UI to update
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      // Extract date from report header
      if (line.includes('GRAND TOTAL STATION REPORT FOR')) {
        const dateStr = line.substring(line.indexOf('GRAND TOTAL STATION REPORT FOR') + 'GRAND TOTAL STATION REPORT FOR'.length).trim();
        currentDate = this.formatDate(dateStr);
      }
      
      // Extract station information
      else if (line.startsWith('STATION NAME:')) {
        if (currentData.station && Object.keys(currentData).length > 3) {
          results.push(currentData as SalesData);
        }
        
        const parts = line.split('STATION NUMBER:');
        if (parts.length === 2) {
          currentStationNumber = parseInt(parts[1].trim()) || 0;
          currentStation = line.substring(13, 16).trim();
          currentStationCode = line.substring(16, 18).trim();
          
          currentData = {
            date: currentDate,
            station: currentStation,
            officeId: currentStationNumber,
            stationCode: currentStationCode,
            currency: '',
            et: 0,
            visa: 0,
            amex: 0,
            mastercard: 0,
            otherFop: 0,
            refund: 0,
            netFare: 0,
            totalAmount: 0,
            totalTax: 0,
            totalHt: 0
          };
        }
      }
      
      // Extract payment method amounts
      else if (currentData.station && line.includes('ET') && line.indexOf('ET') > 3 && !line.includes('FARE')) {
        currentData.et = this.extractLastNumber(line);
      }
      else if (currentData.station && line.includes('CC-VI')) {
        currentData.visa = this.extractLastNumber(line);
      }
      else if (currentData.station && line.includes('CC-AX')) {
        currentData.amex = this.extractLastNumber(line);
      }
      else if (currentData.station && line.includes('CC-CA')) {
        currentData.mastercard = this.extractLastNumber(line);
      }
      else if (currentData.station && (line.includes('CC-OP') || line.includes('XX'))) {
        currentData.otherFop = (currentData.otherFop || 0) + this.extractLastNumber(line);
      }
      
      // Extract financial data
      else if (currentData.station && line.includes('REFUND')) {
        currentData.currency = line.substring(6, 9).trim();
        currentData.refund = this.extractNumber(line, 'REFUND');
      }
      else if (currentData.station && line.includes('NET FARE') && !line.includes('RFND')) {
        currentData.netFare = this.extractNumber(line, 'NET FARE');
      }
      else if (currentData.station && line.includes('TOTAL AMOUNT') && !line.includes('RFND')) {
        currentData.totalAmount = this.extractNumber(line, 'TOTAL AMOUNT');
      }
      else if (currentData.station && line.includes('TOTAL TAX')) {
        currentData.totalTax = this.extractLastNumber(line);
        currentData.totalHt = (currentData.totalAmount || 0) - (currentData.totalTax || 0);
      }
    }
    
    // Add the last station data
    if (currentData.station && Object.keys(currentData).length > 3) {
      results.push(currentData as SalesData);
    }
    
    onProgress?.(100, 'Parsing terminé!');
    return results;
  }
}