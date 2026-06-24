import React, { useState, useEffect } from 'react';
import { History, Download, Trash2, Calendar, FileText, Database } from 'lucide-react';
import { SavedData } from '../types';
import { DataStorageService } from '../services/dataStorageService';

interface DataHistoryProps {
  onLoadHistoricalData: (data: SavedData[]) => void;
}

export const DataHistory: React.FC<DataHistoryProps> = ({ onLoadHistoricalData }) => {
  const [savedData, setSavedData] = useState<SavedData[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSavedData();
  }, []);

  const loadSavedData = async () => {
    setLoading(true);
    try {
      const data = await DataStorageService.getAllSavedData();
      setSavedData(data);
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ces données ?')) {
      await DataStorageService.deleteSavedData(id);
      await loadSavedData();
    }
  };

  const handleLoadSelected = () => {
    const selected = savedData.filter(item => selectedItems.includes(item.id));
    onLoadHistoricalData(selected);
  };

  const handleSelectAll = () => {
    if (selectedItems.length === savedData.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(savedData.map(item => item.id));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <Database className="w-12 h-12 text-gray-400 mx-auto mb-4 animate-spin" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Chargement...</h3>
        <p className="text-gray-500">Récupération de vos données sauvegardées.</p>
      </div>
    );
  }

  if (savedData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun historique</h3>
        <p className="text-gray-500">
          Les données importées sont automatiquement sauvegardées localement.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-asky-blue to-blue-700 text-white p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Historique des Données</h2>
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              Local
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 bg-white/20 rounded-lg text-sm hover:bg-white/30 transition-colors"
            >
              {selectedItems.length === savedData.length ? 'Désélectionner tout' : 'Sélectionner tout'}
            </button>
            {selectedItems.length > 0 && (
              <button
                onClick={handleLoadSelected}
                className="px-4 py-2 bg-asky-orange rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Charger ({selectedItems.length})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Data list */}
      <div className="divide-y divide-gray-200">
        {savedData.map((item) => (
          <div key={item.id} className="p-4 hover:bg-gray-50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={selectedItems.includes(item.id)}
                  onChange={() => toggleSelection(item.id)}
                  className="w-4 h-4 text-asky-blue border-gray-300 rounded focus:ring-asky-blue"
                />
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-asky-orange" />
                  <div>
                    <h4 className="font-medium text-gray-900">{item.filename}</h4>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(item.date).toLocaleDateString('fr-FR', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      <span>{item.data.length} enregistrements</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onLoadHistoricalData([item])}
                  className="p-2 text-asky-blue hover:bg-blue-50 rounded-lg transition-colors"
                  title="Charger ces données"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};