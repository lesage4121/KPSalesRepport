import React from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { ProcessingStatus } from '../types';

interface ProcessingStatusProps {
  status: ProcessingStatus;
}

export const ProcessingStatusComponent: React.FC<ProcessingStatusProps> = ({ status }) => {
  if (!status.isProcessing && !status.error) return null;

  return (
    <div className="w-full max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center gap-4">
        {status.error ? (
          <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
        ) : status.progress === 100 ? (
          <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
        ) : (
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin flex-shrink-0" />
        )}
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className={`font-medium ${status.error ? 'text-red-700' : 'text-gray-900'}`}>
              {status.error ? 'Erreur de traitement' : status.currentStep}
            </h3>
            {!status.error && (
              <span className="text-sm text-gray-500">{Math.round(status.progress)}%</span>
            )}
          </div>
          
          {status.error ? (
            <p className="text-sm text-red-600">{status.error}</p>
          ) : (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};