import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  Sparkles,
  FileSpreadsheet,
  FileJson,
  ShieldAlert,
  Cpu,
} from 'lucide-react';
import {
  exportDataHistory,
  formatDataSize,
  type NetworkAppRecord,
} from '../utils/networkEngine';
import { AVAILABLE_MONTHS } from '../data/seedApps';

interface ExportAndDiagnosticsViewProps {
  apps: NetworkAppRecord[];
  selectedMonth: string;
  onSelectMonth: (monthKey: string) => void;
}

interface DiagnosticAnalysisResult {
  rootCauseSummary: string;
  securityAndAnomalyFindings: string[];
  recommendedActions: string[];
  estimatedDailySavingsMB: number;
  estimatedBatterySavingsPct: number;
  modelUsed?: string;
  notice?: string;
}

export const ExportAndDiagnosticsView: React.FC<ExportAndDiagnosticsViewProps> = ({
  apps,
  selectedMonth,
  onSelectMonth,
}) => {
  const [exportFormat, setExportFormat] = useState<'csv' | 'json'>('csv');
  const [includeConnections, setIncludeConnections] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  const [diagnosticQuery, setDiagnosticQuery] = useState<string>(
    'Audit abnormal background socket activity, identify apps risking daily cap overruns, and recommend battery-saving firewall rules.'
  );
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<DiagnosticAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const exportedPayload = exportDataHistory(apps, selectedMonth, exportFormat, includeConnections);

  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(exportedPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadFile = () => {
    const mimeType = exportFormat === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;';
    const blob = new Blob([exportedPayload], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const filename = `netpulse-android-telemetry-${selectedMonth}.${exportFormat}`;
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setDownloadStatus(`Exported ${filename} (${exportedPayload.length.toLocaleString()} bytes)`);
  };

  const handleRunDeepDiagnostics = async (e: React.FormEvent) => {
    e.preventDefault();
    setAnalyzing(true);
    setAnalysisError(null);

    try {
      const response = await fetch('/api/network/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: diagnosticQuery,
          apps: apps.map((a) => ({
            name: a.name,
            packageName: a.packageName,
            uid: a.uid,
            todayUsedMB: a.todayUsedMB,
            todayBackgroundMB: a.todayBackgroundMB,
            dailyLimitMB: a.dailyLimitMB,
            alertThresholdPct: a.alertThresholdPct,
            currentDownKbps: a.currentDownKbps,
            currentUpKbps: a.currentUpKbps,
            backgroundRestricted: a.backgroundRestricted,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with HTTP ${response.status}`);
      }
      const data = (await response.json()) as DiagnosticAnalysisResult;
      setAnalysisResult(data);
    } catch (err: unknown) {
      setAnalysisError(
        err instanceof Error ? err.message : 'Unable to complete deep network diagnostics.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 6 Columns: Data History Export for Analytics */}
      <section
        aria-label="Data History Export for Analytics"
        className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
      >
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Analytics & External SIEM / Spreadsheet Integration
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            Data Usage History Export
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Export per-app daily usage, custom thresholds, monthly Wi-Fi/Cellular totals, and active socket endpoints.
          </p>
        </div>

        {/* Export Configuration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="export-month-select"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Billing Month
            </label>
            <select
              id="export-month-select"
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="w-full min-h-[42px] px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              {AVAILABLE_MONTHS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label} ({m.key})
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Export Format
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={`min-h-[42px] px-3 py-2 text-xs font-medium rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                  exportFormat === 'csv'
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
                <span>CSV Table</span>
              </button>

              <button
                type="button"
                onClick={() => setExportFormat('json')}
                className={`min-h-[42px] px-3 py-2 text-xs font-medium rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                  exportFormat === 'json'
                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <FileJson className="w-4 h-4" aria-hidden="true" />
                <span>JSON Schema</span>
              </button>
            </div>
          </div>
        </div>

        <label className="flex items-center gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={includeConnections}
            onChange={(e) => setIncludeConnections(e.target.checked)}
            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Include active remote IP/domain socket endpoints in export</span>
        </label>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleDownloadFile}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-sky-400 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            <span>Download {exportFormat.toUpperCase()} File</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPayload}
            className="min-h-[44px] px-4 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                <span>Copied to Clipboard</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>Copy Raw Data</span>
              </>
            )}
          </button>
        </div>

        {downloadStatus && (
          <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {downloadStatus}
          </p>
        )}

        {/* Live Export Preview Box */}
        <div>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Live Export Payload Preview</span>
            <span className="font-mono tabular-nums">{exportedPayload.split('\n').length} lines</span>
          </div>
          <pre
            data-testid="export-payload-preview"
            className="max-h-72 overflow-auto rounded-xl bg-slate-950 text-slate-200 p-3.5 text-xs font-mono leading-relaxed border border-slate-800"
          >
            {exportedPayload}
          </pre>
        </div>
      </section>

      {/* Right 6 Columns: Deep Network Intelligence (Gemini 4 Argon High Thinking) */}
      <section
        aria-label="Deep Network Anomaly Diagnostics"
        className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
      >
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
            <span>Deep Packet & Wake-Lock Intelligence</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">gemini-4-argon (HIGH thinking)</span>
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            Deep Network Anomaly Diagnostics
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Run high-reasoning forensic analysis on current UID bandwidth spikes, background transfers, and battery radio impact.
          </p>
        </div>

        <form onSubmit={handleRunDeepDiagnostics} className="space-y-3">
          <div>
            <label
              htmlFor="diagnostic-query-input"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Diagnostic Investigation Prompt
            </label>
            <textarea
              id="diagnostic-query-input"
              rows={3}
              value={diagnosticQuery}
              onChange={(e) => setDiagnosticQuery(e.target.value)}
              className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <button
            type="submit"
            disabled={analyzing}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-sky-400 disabled:opacity-60 transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>{analyzing ? 'Running High-Thinking Diagnostics...' : 'Run Deep Network Audit'}</span>
          </button>
        </form>

        {analysisError && (
          <div role="alert" className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-xs text-rose-700 dark:text-rose-300">
            {analysisError}
          </div>
        )}

        {analysisResult && (
          <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3.5 border border-slate-200/70 dark:border-slate-800">
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Root Cause Summary
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {analysisResult.rootCauseSummary}
              </p>
              <div className="flex flex-wrap items-center gap-4 mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-700/70 text-xs font-mono tabular-nums">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Est. Data Savings: {formatDataSize(analysisResult.estimatedDailySavingsMB)}/day
                </span>
                <span className="text-sky-600 dark:text-sky-400 font-medium">
                  Est. Battery Gain: +{analysisResult.estimatedBatterySavingsPct}%/day
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                <span>Telemetry & Socket Findings</span>
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
                {analysisResult.securityAndAnomalyFindings.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Recommended Actions
              </h3>
              <ul className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-decimal pl-4">
                {analysisResult.recommendedActions.map((act, idx) => (
                  <li key={idx}>{act}</li>
                ))}
              </ul>
            </div>

            {analysisResult.notice && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {analysisResult.notice}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
};
