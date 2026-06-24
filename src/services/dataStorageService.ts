import { SalesData, SavedData } from '../types';

export class DataStorageService {
  private static readonly STORAGE_KEY = 'asky_sales_data';

  public static async saveData(filename: string, data: SalesData[]): Promise<string> {
    // Sauvegarde locale
    const savedData: SavedData = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      filename,
      data
    };

    const existingData = await this.getAllSavedData();
    existingData.push(savedData);
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(existingData));
    return savedData.id;
  }

  public static async getAllSavedData(): Promise<SavedData[]> {
    // Récupération locale
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  public static async getSavedData(id: string): Promise<SavedData | null> {
    const allData = await this.getAllSavedData();
    return allData.find(d => d.id === id) || null;
  }

  public static async deleteSavedData(id: string): Promise<void> {
    // Suppression locale
    const allData = await this.getAllSavedData();
    const filteredData = allData.filter(d => d.id !== id);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredData));
  }

  public static async getAllHistoricalData(): Promise<SalesData[]> {
    const allSaved = await this.getAllSavedData();
    return allSaved.flatMap(saved => saved.data);
  }
}