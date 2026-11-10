import React, { useState } from 'react';
import { Calendar, Download, BarChart3, Wifi, Smartphone, Clock, AlertTriangle } from 'lucide-react';
import {
  aggregateMonthlySummary,
  formatDataSize,
  type NetworkAppRecord,
} from '../utils/networkEngine';
import { AVAILABLE_MONTHS } from '../data/seedApps';

interface MonthlyReportsViewProps {
  apps: NetworkAppRecord[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
  onNavigateToExport: () => void;
}

export const MonthlyReportsView: React.FC<MonthlyReportsViewProps> = ({
  apps,
  selectedMonth,
  onSelectMonth,
  onNavigateToExport,
}) => {
  const [selectedAppId, setSelectedAppId] = useState<string>(apps[0]?.id ?? '');
  const [sortBy, setSortBy] = useState<'total' | 'mobile' | 'background'>('total');

  const summary = aggregateMonthlySummary(apps, selectedMonth);
  const focusedApp = apps.find((a) => a.id === selectedAppId) ?? apps[0];
  const focusedMonthly = focusedApp?.monthlyReports[selectedMonth];

  const sortedApps = [...apps].sort((a, b) => {
    const recA = a.monthlyReports[selectedMonth];
    const recB = b.monthlyReports[selectedMonth];
    if (!recA || !recB) return 0;
    if (sortBy === 'mobile') return recB.mobileMB - recA.mobileMB;
    if (sortBy === 'background') return recB.backgroundMB - recA.backgroundMB;
    return recB.wifiMB + recB.mobileMB - (recA.wifiMB + recA.mobileMB);
  });

  const maxDailyValue = focusedMonthly
    ? Math.max(...focusedMonthly.dailySeriesMB, 100)
    : 100;

  return (
    <div className="space-y-6">
      {/* Header & Month Selector Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Historical Application Telemetry</span>
              <span aria-hidden="true">·</span>
              <span>NetworkStatsManager Billing Cycle</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              Detailed Monthly Application Reports
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div
              role="group"
              aria-label="Select billing month"
              className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800"
            >
              {AVAILABLE_MONTHS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => onSelectMonth(m.key)}
                  className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    selectedMonth === m.key
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onNavigateToExport}
              className="min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export Month CSV/JSON</span>
            </button>
          </div>
        </div>

        {/* 4-Column Monthly Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Total Monthly Traffic</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {formatDataSize(summary.totalMB)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Across {apps.length} monitored Android apps
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Wi-Fi vs Mobile Data</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {formatDataSize(summary.wifiMB)}{' '}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                / {formatDataSize(summary.mobileMB)}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {Math.round((summary.mobileMB / Math.max(1, summary.totalMB)) * 100)}% metered cellular share
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Foreground vs Background</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {formatDataSize(summary.foregroundMB)}{' '}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                / {formatDataSize(summary.backgroundMB)}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {Math.round((summary.backgroundMB / Math.max(1, summary.totalMB)) * 100)}% background transfers
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Logged Anomaly Events</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
              {summary.anomalyCount}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Background wake-lock & bandwidth bursts
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Per-App Monthly Breakdown Table + Selected App Daily Histogram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Application Monthly Breakdown ({AVAILABLE_MONTHS.find((m) => m.key === selectedMonth)?.label})
            </h3>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                onClick={() => setSortBy('total')}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  sortBy === 'total'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sort by Total
              </button>
              <button
                type="button"
                onClick={() => setSortBy('mobile')}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  sortBy === 'mobile'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sort by Cellular
              </button>
              <button
                type="button"
                onClick={() => setSortBy('background')}
                className={`min-h-[34px] px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  sortBy === 'background'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Sort by Background
              </button>
            </div>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  <th className="py-2.5 pr-3">Application</th>
                  <th className="py-2.5 px-2.5 text-right">Wi-Fi</th>
                  <th className="py-2.5 px-2.5 text-right">Mobile 5G</th>
                  <th className="py-2.5 px-2.5 text-right">Foreground</th>
                  <th className="py-2.5 px-2.5 text-right">Background</th>
                  <th className="py-2.5 px-2.5 text-right">Total</th>
                  <th className="py-2.5 pl-2.5 text-right">Peak Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {sortedApps.map((app) => {
                  const rec = app.monthlyReports[selectedMonth];
                  if (!rec) return null;
                  const appTotal = rec.wifiMB + rec.mobileMB;
                  const isFocused = focusedApp?.id === app.id;
                  return (
                    <tr
                      key={app.id}
                      onClick={() => setSelectedAppId(app.id)}
                      className={`cursor-pointer transition-colors ${
                        isFocused
                          ? 'bg-sky-50/70 dark:bg-sky-950/30'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                      }`}
                    >
                      <td className="py-3 pr-3 max-w-[210px]">
                        <button
                          type="button"
                          onClick={() => setSelectedAppId(app.id)}
                          className="text-left focus:outline-none w-full"
                        >
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {app.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                            {app.packageName} · {app.category}
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {formatDataSize(rec.wifiMB)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {formatDataSize(rec.mobileMB)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {formatDataSize(rec.foregroundMB)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {formatDataSize(rec.backgroundMB)}
                      </td>
                      <td className="py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100">
                        {formatDataSize(appTotal)}
                      </td>
                      <td className="py-3 pl-2.5 text-right font-mono tabular-nums whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
                        {rec.peakHour}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 4 Columns: Focused App Monthly Deep Dive & Daily Histogram */}
        {focusedApp && focusedMonthly && (
          <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {focusedMonthly.monthLabel} · App Drilldown
              </div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {focusedApp.name}
              </h3>
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {focusedApp.packageName}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
                  <span>Peak Window</span>
                </div>
                <div className="font-mono tabular-nums font-semibold text-sm text-slate-900 dark:text-slate-100 mt-1">
                  {focusedMonthly.peakHour}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                  <span>Anomalies</span>
                </div>
                <div className="font-mono tabular-nums font-semibold text-sm text-slate-900 dark:text-slate-100 mt-1">
                  {focusedMonthly.anomalyCount} events
                </div>
              </div>
            </div>

            {/* 14-Day Daily Usage Bar Chart */}
            <div className="pt-2">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                  <BarChart3 className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
                  Daily Transfer Trend (14-Day Window)
                </span>
                <span className="font-mono tabular-nums">Max {formatDataSize(maxDailyValue)}</span>
              </div>

              <div className="h-36 flex items-end gap-1.5 pt-4 pb-1 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                {focusedMonthly.dailySeriesMB.map((val, idx) => {
                  const pct = Math.max(10, Math.round((val / maxDailyValue) * 100));
                  const exceedsDailyCap = val > focusedApp.dailyLimitMB;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        title={`Day ${idx + 1}: ${val} MB`}
                        className={`w-full rounded-t transition-all ${
                          exceedsDailyCap
                            ? 'bg-rose-500 dark:bg-rose-400'
                            : 'bg-sky-600 dark:bg-sky-400'
                        }`}
                        style={{ height: `${pct}%` }}
                      />
                      <span className="text-[10px] font-mono tabular-nums text-slate-400">
                        {idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Bars in crimson indicate days where {focusedApp.name} exceeded its current{' '}
                {formatDataSize(focusedApp.dailyLimitMB)} daily threshold.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
