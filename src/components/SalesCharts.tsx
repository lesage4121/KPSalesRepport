
import React, { useMemo, useState } from "react";
import { StationReport } from "../types";
import { SingleTaxExplanationModal } from "./SingleTaxExplanationModal";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Legend, 
  LineChart, 
  Line, 
  CartesianGrid 
} from "recharts";
import { 
  BarChart3, 
  TrendingUp, 
  PieChart as PieIcon, 
  Landmark,
  LayoutGrid,
  Activity,
  ArrowUpRight,
  MonitorCheck
} from "lucide-react";
import { Skeleton } from "./ui/Skeleton";

interface SalesChartsProps {
  reports: StationReport[];
  selectedCurrency: string; // The filtered currency or first available
  loading?: boolean;
}

const COLORS = ["#4F46E5", "#06B6D4", "#F59E0B", "#10B981", "#EC4899", "#8B5CF6", "#EF4444"];

export const SalesCharts: React.FC<SalesChartsProps> = ({ reports, selectedCurrency, loading = false }) => {
  const activeReports = useMemo(() => reports.filter(r => !r.isEmpty), [reports]);
  const [selectedTaxItem, setSelectedTaxItem] = useState<{ code: string; amount: number; currency: string } | null>(null);

  // Determine standard currency for chart
  const currencyToAnalyze = useMemo(() => {
    if (selectedCurrency && selectedCurrency !== "ALL") return selectedCurrency;
    
    // Fallback to currency with highest volume
    const counts: Record<string, number> = {};
    activeReports.forEach(r => {
      r.currencyBlocks.forEach(b => {
        counts[b.currency] = (counts[b.currency] || 0) + b.amountTotal;
      });
    });
    let maxCur = "XOF";
    let maxVal = 0;
    Object.entries(counts).forEach(([cur, val]) => {
      if (val > maxVal) {
        maxVal = val;
        maxCur = cur;
      }
    });
    return maxCur;
  }, [activeReports, selectedCurrency]);

  // 1. DATA FOR STATION BAR-CHART
  // Sum sales in selected currency by station
  const stationChartData = useMemo(() => {
    const stationMap: Record<string, number> = {};
    activeReports.forEach(rep => {
      rep.currencyBlocks.forEach(block => {
        if (block.currency === currencyToAnalyze) {
          stationMap[rep.stationName] = (stationMap[rep.stationName] || 0) + block.amountTotal;
        }
      });
    });

    return Object.entries(stationMap)
      .map(([name, total]) => ({ name, Ventes: parseFloat(total.toFixed(2)) }))
      .sort((a, b) => b.Ventes - a.Ventes)
      .slice(0, 8); // Top 8
  }, [activeReports, currencyToAnalyze]);

  // 2. DATA FOR PERIOD TREND LINE-CHART
  // Sum sales in selected currency by date code
  const trendChartData = useMemo(() => {
    const trendMap: Record<string, number> = {};
    activeReports.forEach(rep => {
      rep.currencyBlocks.forEach(block => {
        if (block.currency === currencyToAnalyze) {
          trendMap[rep.dateStr] = (trendMap[rep.dateStr] || 0) + block.amountTotal;
        }
      });
    });

    const datesOrdered = ["01JUN", "02JUN", "03JUN", "04JUN", "05JUN", "06JUN", "07JUN", "08JUN"];
    return datesOrdered
      .map(date => ({
        name: date,
        Ventes: parseFloat((trendMap[date] || 0).toFixed(2))
      }))
      .filter(d => d.Ventes > 0);
  }, [activeReports, currencyToAnalyze]);

  const EXCHANGE_RATES_TO_XOF: Record<string, number> = {
    XOF: 1,
    XAF: 1,
    USD: 600,
    EUR: 655.957,
    NGN: 0.4,
    GHS: 40,
    KES: 4.5,
    CVE: 5.95,
  };

  // 3. DATA FOR PAYMENT METHODS PIE-CHART
  const paymentChartData = useMemo(() => {
    const methodMap: Record<string, number> = {};
    const FRIENDLY_METHODS: Record<string, string> = {
      CA: "Cash",
      ET: "E-Ticket / CC",
      CK: "Cheque",
      IN: "Invoicing",
      MO: "Mobile Money",
      MM: "Mobile Money",
      OM: "Mobile Money",
      XX: "Other / Rectif"
    };

    activeReports.forEach(rep => {
      rep.currencyBlocks.forEach(block => {
        const rate = EXCHANGE_RATES_TO_XOF[block.currency] || 1;
        block.sales.forEach(row => {
          const key = FRIENDLY_METHODS[row.method] || `Other (${row.method})`;
          methodMap[key] = (methodMap[key] || 0) + (row.totalAmount * rate);
        });
      });
    });

    return Object.entries(methodMap)
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)
      .filter(d => d.value > 0);
  }, [activeReports]);

  // 4. DATA FOR TAX BREAKDOWN
  const taxBreakdownData = useMemo(() => {
    const taxMap: Record<string, number> = {};
    activeReports.forEach(rep => {
      rep.currencyBlocks.forEach(block => {
        if (block.currency === currencyToAnalyze) {
          block.taxes.forEach(t => {
            taxMap[t.code] = (taxMap[t.code] || 0) + t.amount;
          });
        }
      });
    });

    return Object.entries(taxMap)
      .map(([tax, total]) => ({ tax, total: parseFloat(total.toFixed(2)) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [activeReports, currencyToAnalyze]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-[320px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5 rounded-md" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex-1 w-full bg-slate-50/50 rounded-xl relative overflow-hidden">
               <Skeleton className="absolute inset-x-4 bottom-4 top-12 rounded-lg" variant="shimmer" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const totalValue = paymentChartData.reduce((sum, item) => sum + item.value, 0);
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs">
          <p className="font-bold mb-1 text-indigo-400">{payload[0].name}</p>
          <p className="flex justify-between gap-4 font-mono">
            <span>Volume:</span>
            <span>{payload[0].value.toLocaleString()} FCFA</span>
          </p>
          <p className="flex justify-between gap-4 font-mono text-slate-400 border-t border-slate-800 mt-1 pt-1">
            <span>Share:</span>
            <span>{((payload[0].value / totalValue) * 100).toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const totalSales = stationChartData.reduce((sum, item) => sum + item.Ventes, 0);
      return (
        <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl border border-slate-800 text-xs">
          <p className="font-bold mb-1 text-indigo-400">{label}</p>
          <p className="flex justify-between gap-4 font-mono">
            <span>Sales:</span>
            <span>{payload[0].value.toLocaleString()} {currencyToAnalyze}</span>
          </p>
          <p className="flex justify-between gap-4 font-mono text-slate-400 border-t border-slate-800 mt-1 pt-1">
            <span>Contribution:</span>
            <span>{((payload[0].value / totalSales) * 100).toFixed(1)}%</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return value.toString();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-indigo-600" />
            <h4 className="font-semibold text-slate-800 text-sm">Top Stations ({currencyToAnalyze})</h4>
          </div>
          <p className="text-slate-400 text-xs font-mono">Sales Volume</p>
        </div>
        <div className="h-64">
          {stationChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stationChartData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="Ventes" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={45}>
                  {stationChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No data to display for this currency.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-600" />
            <h4 className="font-semibold text-slate-800 text-sm">Sales Evolution ({currencyToAnalyze})</h4>
          </div>
          <p className="text-slate-400 text-xs font-mono">June 2026 Time Audit</p>
        </div>
        <div className="h-64">
          {trendChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendChartData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fill: "#64748B" }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(val: any) => [`${val.toLocaleString()} ${currencyToAnalyze}`, "Sales"]}
                  contentStyle={{ backgroundColor: "#1E293B", borderRadius: "12px", border: "none", color: "#FFF" }}
                />
                <Line type="monotone" dataKey="Ventes" stroke="#06B6D4" strokeWidth={3} dot={{ r: 4, stroke: "#FFF", strokeWidth: 2, fill: "#06B6D4" }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No history for this currency.
            </div>
          )}
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <MonitorCheck className="w-5 h-5 text-amber-600" />
            <h4 className="font-semibold text-slate-800 text-sm">Payment Modes (Consolidated XOF)</h4>
          </div>
          <p className="text-slate-400 text-xs font-mono">Global Revenue Distribution</p>
        </div>
        <div className="h-64 grid grid-cols-1 md:grid-cols-5 items-center gap-4">
          <div className="col-span-3 h-full">
            {paymentChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {paymentChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                No recorded sales.
              </div>
            )}
          </div>
          <div className="col-span-2 space-y-2 overflow-y-auto max-h-full pr-1">
            {paymentChartData.map((item, index) => (
              <div key={item.name} className="flex flex-col">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
                  <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                  <span className="truncate font-bold">{item.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono ml-4">
                  {item.value.toLocaleString()} FCFA
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Landmark className="w-5 h-5 text-emerald-600" />
            <h4 className="font-semibold text-slate-800 text-sm">Top Tax Breakdown ({currencyToAnalyze})</h4>
          </div>
          <p className="text-slate-400 text-xs font-mono">Air Travel Fiscal Declaration</p>
        </div>
        <div className="h-64 flex flex-col justify-between">
          {taxBreakdownData.length > 0 ? (
            <div className="space-y-2.5 overflow-y-auto max-h-full pr-1.5">
              {taxBreakdownData.map((item, index) => {
                const maxVal = taxBreakdownData[0]?.total || 1;
                const percent = Math.max(2, (item.total / maxVal) * 100);
                return (
                  <div 
                    key={item.tax} 
                    onClick={() => setSelectedTaxItem({ code: item.tax, amount: item.total, currency: currencyToAnalyze })}
                    className="group cursor-pointer hover:bg-indigo-50/40 p-2.5 rounded-xl border border-transparent hover:border-indigo-150 transition-all duration-150 select-none active:scale-97"
                  >
                    <div className="flex justify-between items-center mb-1.5 text-slate-700">
                      <span className="font-bold bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-750 text-[10px] px-1.5 py-0.5 rounded-md font-mono transition-colors">
                        Tax {item.tax}
                      </span>
                      <span className="font-mono text-slate-600 font-bold group-hover:text-indigo-950 transition-colors">
                        {item.total.toLocaleString("en-US")} {currencyToAnalyze}
                      </span>
                    </div>
                    <div className="w-full bg-slate-50 group-hover:bg-indigo-50/50 h-2 rounded-full overflow-hidden transition-colors">
                      <div
                        className="bg-emerald-500 group-hover:bg-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs">
              No tax components for this currency.
            </div>
          )}
        </div>
      </div>

      {selectedTaxItem && (
        <SingleTaxExplanationModal
          isOpen={true}
          onClose={() => setSelectedTaxItem(null)}
          taxCode={selectedTaxItem.code}
          amount={selectedTaxItem.amount}
          currency={selectedTaxItem.currency}
        />
      )}
    </div>
  );
};
