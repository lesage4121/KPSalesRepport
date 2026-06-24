import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { SalesData } from '../types';

export class ExcelGenerator {
  private createHeaderStyle() {
    return {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "DC2626" } },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }

  private createDataStyle() {
    return {
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      },
      alignment: { horizontal: "center", vertical: "center" }
    };
  }

  public async generateExcel(data: SalesData[], filename: string = 'rapport_ventes'): Promise<void> {
    const headers = [
      'Date', 'Station', 'Office ID', 'Station Code', 'Currency',
      'ET', 'VISA', 'AMEX', 'MasterCard', 'OTHER FOP', 'Refund',
      'Net Fare', 'Total Amount', 'Total Tax', 'Total-HT'
    ];

    // Create workbook and worksheet
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([]);

    // Add headers
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });

    // Add data
    const dataRows = data.map(item => [
      item.date,
      item.station,
      item.officeId,
      item.stationCode,
      item.currency,
      item.et,
      item.visa,
      item.amex,
      item.mastercard,
      item.otherFop,
      item.refund,
      item.netFare,
      item.totalAmount,
      item.totalTax,
      item.totalHt
    ]);

    if (dataRows.length > 0) {
      XLSX.utils.sheet_add_aoa(ws, dataRows, { origin: 'A2' });
    }

    // Set column widths
    const columnWidths = headers.map(() => ({ wch: 12 }));
    ws['!cols'] = columnWidths;

    // Freeze first row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Données');

    // Generate buffer and save
    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const timestamp = new Date().toISOString().split('T')[0];
    saveAs(blob, `${filename}_${timestamp}.xlsx`);
  }
}