import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, TrendingUp, BarChart3, Activity } from 'lucide-react';
import { SalesData, ChartData } from '../types';
import { CurrencyService } from '../services/CurrencyService';

interface SalesChartProps {
  data: SalesData[];
  displayCurrency: string;
}

type ChartPeriod = 'day' | 'week' | 'month';
type ChartType = 'bar' | 'line';

export const SalesChart: React.FC<SalesChartProps> = ({ data, displayCurrency }) => {
  const [period, setPeriod] = useState<ChartPeriod>('day');
  const [chartType, setChartType] = useState<ChartType>('bar');

  const chartData = useMemo(() => {
    const groupedData = new Map<string, { total: number; totalHT: number; count: number }>();

    data.forEach(item => {
      let key: string;
      const date = new Date(item.date.split('/').reverse().join('-'));
      
      switch (period) {
        case 'day':
          key = item.date;
          break;
        case 'week':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = `Semaine du ${weekStart.toLocaleDateString('fr-FR')}`;
          break;
        case 'month':
          key = `${date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`;
          break;
        default:
          key = item.date;
      }

      const convertedTotal = CurrencyService.convertAmount(item.totalAmount, item.currency, displayCurrency);
      const convertedHT = CurrencyService.convertAmount(item.totalHt, item.currency, displayCurrency);

      if (groupedData.has(key)) {
        const existing = groupedData.get(key)!;
        existing.total += convertedTotal;
        existing.totalHT += convertedHT;
        existing.count += 1;
      } else {
        groupedData.set(key, {
          total: convertedTotal,
          totalHT: convertedHT,
          count: 1
        });
      }
    });

    return Array.from(groupedData.entries())
      .map(([date, values]) => ({
        date,
        total: Math.round(values.total * 100) / 100,
        totalHT: Math.round(values.totalHT * 100) / 100,
        count: values.count
      }))
      .sort((a, b) => {
        if (period === 'day') {
          const dateA = new Date(a.date.split('/').reverse().join('-'));
          const dateB = new Date(b.date.split('/').reverse().join('-'));
          return dateA.getTime() - dateB.getTime();
        }
        return a.date.localeCompare(b.date);
      });
  }, [data, period, displayCurrency]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-800 mb-2">{label}</p>
          <div className="space-y-1">
            <p className="text-asky-blue">
              <span className="font-medium">Total TTC:</span> {CurrencyService.formatAmount(payload[0].value, displayCurrency)}
            </p>
            <p className="text-asky-orange">
              <span className="font-medium">Total HT:</span> {CurrencyService.formatAmount(payload[1]?.value || 0, displayCurrency)}
            </p>
            <p className="text-gray-600">
              <span className="font-medium">Transactions:</span> {payload[0].payload.count}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune donnée pour le graphique</h3>
        <p className="text-gray-500">Importez des données pour voir l'évolution des ventes.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-asky-blue to-blue-700 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-6 h-6" />
            <h2 className="text-xl font-semibold">Évolution des Ventes</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-100">Devise d'affichage: {displayCurrency}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="text-sm">Période:</span>
            <div className="flex bg-white/10 rounded-lg p-1">
              {[
                { key: 'day', label: 'Jour', icon: Calendar },
                { key: 'week', label: 'Semaine', icon: Calendar },
                { key: 'month', label: 'Mois', icon: Calendar }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPeriod(key as ChartPeriod)}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    period === key
                      ? 'bg-white text-asky-blue font-medium'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            <span className="text-sm">Type:</span>
            <div className="flex bg-white/10 rounded-lg p-1">
              {[
                { key: 'bar', label: 'Barres', icon: BarChart3 },
                { key: 'line', label: 'Courbe', icon: TrendingUp }
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setChartType(key as ChartType)}
                  className={`px-3 py-1 rounded text-sm transition-colors flex items-center gap-1 ${
                    chartType === key
                      ? 'bg-white text-asky-blue font-medium'
                      : 'text-white hover:bg-white/20'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#666"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" fill="#1e40af" name="Total TTC" radius={[4, 4, 0, 0]} />
                <Bar dataKey="totalHT" fill="#ea580c" name="Total HT" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="date" 
                  stroke="#666"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis stroke="#666" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#1e40af" 
                  strokeWidth={3}
                  dot={{ fill: '#1e40af', strokeWidth: 2, r: 4 }}
                  name="Total TTC"
                />
                <Line 
                  type="monotone" 
                  dataKey="totalHT" 
                  stroke="#ea580c" 
                  strokeWidth={3}
                  dot={{ fill: '#ea580c', strokeWidth: 2, r: 4 }}
                  name="Total HT"
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};