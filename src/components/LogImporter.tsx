
import React, { useState, useRef } from "react";
import { FileUp,  ScrollText, ShieldCheck, Fingerprint, FileWarning,Loader2,Zap,} from "lucide-react";
import { parseRawReports } from "../parser";
import { StationReport } from "../types";
import { ValidationSummary } from "./ValidationSummary";

interface LogImporterProps {
  onImport: (rawText: string) => void;
}

export const LogImporter: React.FC<LogImporterProps> = ({ onImport}) => {
  const [inputText, setInputText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isErrorState, setIsErrorState] = useState(false);
  
  // High fidelity file metadata/analysis states
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: string;
    lineCount: number;
    reportCount: number;
  } | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState("");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [pendingReports, setPendingReports] = useState<StationReport[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getReportCount = (text: string) => {
    const matches = text.match(/WY\*T#STA/g);
    return matches ? matches.length : 0;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const processFileContent = (text: string, fileName: string, fileSize: number) => {
    setInputText(text);
    const lines = text.split("\n").length;
    const reportsCount = getReportCount(text);
    
    setSelectedFile({
      name: fileName,
      size: formatSize(fileSize),
      lineCount: lines,
      reportCount: reportsCount
    });
    
    setIsErrorState(false);
    setStatusMessage(`Fichier "${fileName}" chargé avec succès (${formatSize(fileSize)}). Prêt pour l'audit.`);
  };

  const handleAudit = () => {
    if (!inputText.trim()) {
      setIsErrorState(true);
      setStatusMessage("Erreur: Veuillez copier des données ou glisser un fichier avant l'analyse.");
      return;
    }

    // Launch multi-step interactive analysis representation
    setIsAnalyzing(true);
    setCompletedSteps([]);
    setAnalysisStep("1. Reading file and loading buffer...");

    setTimeout(() => {
      setCompletedSteps(prev => [...prev, "1. Reading file and loading buffer..."]);
      setAnalysisStep("2. Algorithmic extraction of segments ('WY*T#STA')...");
      
      setTimeout(() => {
        setCompletedSteps(prev => [...prev, "2. Algorithmic extraction of segments ('WY*T#STA')..."]);
        setAnalysisStep("3. Total reconciliation and tax/commission calculation...");
        
        setTimeout(() => {
          const reports = parseRawReports(inputText);
          
          setCompletedSteps(prev => [...prev, "3. Total reconciliation and tax/commission calculation..."]);
          setAnalysisStep("4. Identification of missing closure info and anomalies...");
          
          setTimeout(() => {
            setCompletedSteps(prev => [...prev, "4. Identification of missing closure info and anomalies..."]);
            setAnalysisStep("5. Compiling validation summary...");
            
            setTimeout(() => {
              setIsAnalyzing(false);
              if (reports.length === 0) {
                setIsErrorState(true);
                setStatusMessage("Format non reconnu : Aucun rapport 'WY*T#STA' n'a pu être extrait.");
              } else {
                setPendingReports(reports);
              }
            }, 300);
          }, 450);
        }, 450);
      }, 450);
    }, 450);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processFileContent(text, file.name, file.size);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        processFileContent(text, file.name, file.size);
      };
      reader.readAsText(file);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputText(val);
    if (!val.trim()) {
      setSelectedFile(null);
    } else {
      // Virtual file metadata for manually pasted content
      const lines = val.split("\n").length;
      const reportsCount = getReportCount(val);
      setSelectedFile({
        name: "Données_Saisies.txt",
        size: `${formatSize(new Blob([val]).size)}`,
        lineCount: lines,
        reportCount: reportsCount
      });
    }
  };

  const handleClearText = () => {
    setInputText("");
    setSelectedFile(null);
    setStatusMessage(null);
    setIsErrorState(false);
    setPendingReports(null);
  };

  if (pendingReports) {
    return (
      <ValidationSummary 
        reports={pendingReports} 
        onConfirm={() => onImport(inputText)}
        onCancel={() => setPendingReports(null)}
      />
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm mb-6">
      <div id="importer-header" className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-indigo-600" />
            Reading, Extraction & Audit of Log File
          </h3>
          <p className="text-slate-550 text-xs mt-0.5">Drag a station log file (`.txt`, `.log`) or paste raw financial data.</p>
        </div>
      </div>

      {isAnalyzing ? (
        /* Immersive interactive extraction steps layout */
        <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 shadow-inner flex flex-col items-center justify-center min-h-[220px]">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
            <span className="font-bold text-sm tracking-wide uppercase text-indigo-300">Algorithmic Analysis in Progress...</span>
          </div>

          <div className="max-w-md w-full space-y-2 mt-2">
            {completedSteps.map((step, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-emerald-400 font-mono transition-opacity duration-300">
                <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{step}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs text-indigo-200 font-mono font-semibold animate-pulse">
              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping"></span>
              <span>{analysisStep}</span>
            </div>
          </div>
          
          <div className="w-full max-w-xs bg-slate-805 h-1.5 rounded-full mt-6 overflow-hidden">
            <div 
              className="bg-indigo-505 bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${(completedSteps.length + 1) * 20}%` }}
            ></div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Drag/Drop Zone */}
          <div className="lg:col-span-1">
            <div
              id="drag-drop-zone"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all h-full min-h-[180px] flex flex-col justify-center items-center ${
                dragOver
                  ? "border-indigo-500 bg-indigo-50/80 scale-[1.01]"
                  : "border-slate-200 hover:border-slate-350 hover:bg-slate-50/40"
              }`}
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".txt,.log"
                className="hidden"
              />
              <FileUp className="w-10 h-10 text-indigo-500 mb-3 animate-pulse" />
              <span className="text-xs font-bold text-slate-800 block mb-1">
                Select Raw File
              </span>
              <span className="text-[10px] text-slate-500 max-w-[150px]">
                Drag & drop a .txt or .log file here
              </span>
            </div>
          </div>

          {/* Paste Raw Text Box */}
          <div className="lg:col-span-2 flex flex-col justify-between">
            <div className="relative">
              <textarea
                id="raw-pasted-log-area"
                placeholder="Paste the raw text content of the reports here (e.g., starting with WY*T#STA and ending with END OF REPORT)..."
                value={inputText}
                onChange={handleTextChange}
                className="w-full bg-slate-55/40 hover:bg-slate-55/65 bg-slate-50/50 border border-slate-200 text-slate-700 text-xs rounded-xl p-3 h-32 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white resize-none font-mono placeholder:text-slate-400"
              ></textarea>
              {inputText && (
                <button
                  id="btn-clear-paste"
                  onClick={handleClearText}
                  className="absolute right-3.5 bottom-3 text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-xs cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-3">
              <div className="text-[10px] text-slate-400 max-w-sm">
                <span className="font-semibold block text-slate-600">Supported log structure:</span>
                Automatic search and extraction of segments starting with <code className="font-mono text-indigo-600">WY*T#STA</code>.
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  id="btn-launch-audit"
                  onClick={handleAudit}
                  disabled={!inputText.trim()}
                  className={`font-semibold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-sm transition pointer-events-auto cursor-pointer ${
                    inputText.trim() 
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                      : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Start File Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Selected file information block */}
      {selectedFile && !isAnalyzing && (
        <div className="mt-4 p-4 bg-slate-50/60 rounded-xl border border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 text-indigo-700 p-2.5 rounded-xl">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">Loaded File: {selectedFile.name}</p>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                <span>Size: {selectedFile.size}</span>
                <span>•</span>
                <span>Lines: {selectedFile.lineCount}</span>
                <span>•</span>
                <span className="font-semibold text-indigo-650">Identified Reports: {selectedFile.reportCount}</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleAudit}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto"
          >
            <Zap className="w-3 h-3" />
            Start Analysis
          </button>
        </div>
      )}

      {/* Status or error message alerts */}
      {statusMessage && !isAnalyzing && (
        <div
          id="import-status"
          className={`mt-4 p-3.5 rounded-xl border text-xs flex items-center gap-2 font-medium transition ${
            isErrorState
              ? "bg-rose-50 border-rose-150 text-rose-800"
              : "bg-indigo-50/50 border-indigo-100 text-indigo-800"
          }`}
        >
          {isErrorState ? (
            <FileWarning className="w-4 h-4 text-rose-600 flex-shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          )}
          <span>{statusMessage}</span>
        </div>
      )}
    </div>
  );
};
