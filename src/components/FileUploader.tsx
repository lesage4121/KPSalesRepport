import React, { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelect, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string>('');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError('');

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      validateAndSelectFile(file);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      validateAndSelectFile(file);
    }
  }, []);

  const validateAndSelectFile = (file: File) => {
    if (file.type !== 'text/plain' && !file.name.endsWith('.txt')) {
      setError('Veuillez sélectionner un fichier texte (.txt)');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setError('Le fichier est trop volumineux (maximum 10MB)');
      return;
    }

    onFileSelect(file);
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-8 transition-all duration-300 cursor-pointer
          ${dragActive 
            ? 'border-blue-500 bg-blue-50 scale-105' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
          ${error ? 'border-red-400 bg-red-50' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".txt,text/plain"
          onChange={handleFileInput}
          disabled={isProcessing}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
        />
        
        <div className="flex flex-col items-center text-center">
          {error ? (
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          ) : (
            <div className={`transition-transform duration-300 ${dragActive ? 'scale-110' : ''}`}>
              {dragActive ? (
                <FileText className="w-12 h-12 text-blue-500 mb-4" />
              ) : (
                <Upload className="w-12 h-12 text-gray-400 mb-4" />
              )}
            </div>
          )}
          
          <h3 className={`text-lg font-semibold mb-2 ${error ? 'text-red-700' : 'text-gray-700'}`}>
            {error ? 'Erreur de fichier' : 'Déposez votre fichier de rapport ici'}
          </h3>
          
          <p className={`text-sm mb-4 ${error ? 'text-red-600' : 'text-gray-500'}`}>
            {error || 'ou cliquez pour sélectionner un fichier texte (.txt)'}
          </p>
          
          {!error && (
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>Format supporté: TXT</span>
              <span>•</span>
              <span>Taille max: 10MB</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};