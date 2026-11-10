import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  Search,
  SlidersHorizontal,
  Unlock,
  Wifi,
  Smartphone,
  Activity,
} from 'lucide-react';
import {
  evaluateLimitStatus,
  detectAbnormalUsage,
  formatBandwidthSpeed,
  formatDataSize,
  type AppCategory,
  type NetworkAppRecord,
} from '../utils/networkEngine';

interface AppLimitsViewProps {
  apps: NetworkAppRecord[];
  selectedAppId: string | null;
  onSelectApp: (appId: string) => void;
  onUpdateAppLimit: (appId: string, dailyLimitMB: number, alertThresholdPct: number) => void;
  onToggleBackgroundRestrict: (appId: string) => void;
  onSimulateTrafficBurst: (appId: string, addMB: number) => void;
}

const CATEGORIES: ('All' | AppCategory)[] = [
  'All',
  'Streaming',
  'Cloud & Sync',
  'Social',
  'Navigation',
  'Messaging',
  'System & OS',
];

export const AppLimitsView: React.FC<AppLimitsViewProps> = ({
  apps,
  selectedAppId,
  onSelectApp,
  onUpdateAppLimit,
  onToggleBackgroundRestrict,
  onSimulateTrafficBurst,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | AppCategory>('All');
  const [statusFilter, setStatusFilter] = useState<'all' | 'alerts_only'>('all');

  const activeApp = apps.find((a) => a.id === selectedAppId) ?? apps[0];

  const [draftLimitMB, setDraftLimitMB] = useState<string>(
    activeApp ? String(activeApp.dailyLimitMB) : '500'
  );
  const [draftThresholdPct, setDraftThresholdPct] = useState<string>(
    activeApp ? String(activeApp.alertThresholdPct) : '80'
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  // Sync local form inputs when selected app changes
  React.useEffect(() => {
    if (activeApp) {
      setDraftLimitMB(String(activeApp.dailyLimitMB));
      setDraftThresholdPct(String(activeApp.alertThresholdPct));
      setValidationError(null);
    }
  }, [activeApp?.id, activeApp?.dailyLimitMB, activeApp?.alertThresholdPct]);

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.packageName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'All' || app.category === categoryFilter;
    if (!matchesSearch || !matchesCat) return false;

    if (statusFilter === 'alerts_only') {
      const limitEval = evaluateLimitStatus(app.todayUsedMB, app.dailyLimitMB, app.alertThresholdPct);
      const anomaly = detectAbnormalUsage(app);
      return limitEval.status !== 'normal' || anomaly.isAbnormal;
    }
    return true;
  });

  const handleSaveLimit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeApp) return;

    const parsedLimit = Number(draftLimitMB);
    const parsedThreshold = Number(draftThresholdPct);

    if (!draftLimitMB.trim() || Number.isNaN(parsedLimit) || parsedLimit < 10 || parsedLimit > 50000) {
      setValidationError('Enter a valid daily data limit between 10 MB and 50,000 MB.');
      setSaveFeedback(null);
      return;
    }
    if (
      !draftThresholdPct.trim() ||
      Number.isNaN(parsedThreshold) ||
      parsedThreshold < 50 ||
      parsedThreshold > 99
    ) {
      setValidationError('Enter a warning threshold between 50% and 99%.');
      setSaveFeedback(null);
      return;
    }

    setValidationError(null);
    onUpdateAppLimit(activeApp.id, Math.round(parsedLimit), Math.round(parsedThreshold));
    setSaveFeedback(
      `Saved ${Math.round(parsedLimit)} MB daily limit (${Math.round(parsedThreshold)}% alert threshold) for ${activeApp.name}.`
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 Columns: Per-App Bandwidth & Daily Limit Table */}
      <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Application Bandwidth & Daily Limits
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Select any Android UID to configure custom daily data caps, warning thresholds, or background firewall rules.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All Apps ({apps.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('alerts_only')}
              className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                statusFilter === 'alerts_only'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Nearing / Over Limit
            </button>
          </div>
        </div>

        {/* Search & Category Filter Stack */}
        <div className="mt-4 flex flex-col gap-3">
          <div className="relative w-full">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <label htmlFor="app-limit-search" className="sr-only">
              Search applications by name or package
            </label>
            <input
              id="app-limit-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search app name or package (e.g. com.cloudsync)..."
              className="w-full min-h-[42px] pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Application Rows */}
        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {filteredApps.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No Android applications match the active filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('All');
                  setStatusFilter('all');
                }}
                className="mt-3 min-h-[40px] px-4 py-2 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            filteredApps.map((app) => {
              const limitEval = evaluateLimitStatus(
                app.todayUsedMB,
                app.dailyLimitMB,
                app.alertThresholdPct
              );
              const anomaly = detectAbnormalUsage(app);
              const isSelected = activeApp?.id === app.id;
              const barWidth = Math.min(100, Math.round(limitEval.usagePct));

              return (
                <div
                  key={app.id}
                  className={`py-3.5 px-3 -mx-3 rounded-xl transition-colors ${
                    isSelected
                      ? 'bg-sky-50/70 dark:bg-sky-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelectApp(app.id)}
                      className="flex-1 text-left min-w-0 focus:outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {app.name}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">·</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          UID {app.uid}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-mono truncate">{app.packageName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{app.category}</span>
                        {anomaly.isAbnormal && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                              Abnormal background spike
                            </span>
                          </>
                        )}
                      </div>
                    </button>

                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                        {formatDataSize(app.todayUsedMB)}{' '}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                          / {formatDataSize(app.dailyLimitMB)}
                        </span>
                      </div>
                      <div className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatBandwidthSpeed(app.currentDownKbps)} ↓ · {formatBandwidthSpeed(app.currentUpKbps)} ↑
                      </div>
                    </div>
                  </div>

                  {/* Daily Limit Progress Bar */}
                  <div className="mt-2.5">
                    <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          limitEval.status === 'exceeded'
                            ? 'bg-rose-600 dark:bg-rose-500'
                            : limitEval.status === 'approaching'
                            ? 'bg-amber-500'
                            : 'bg-emerald-600 dark:bg-emerald-500'
                        }`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                      <div className="flex items-center gap-1.5">
                        {limitEval.status === 'exceeded' ? (
                          <span className="text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                            Limit Exceeded ({limitEval.usagePct}% of daily cap)
                          </span>
                        ) : limitEval.status === 'approaching' ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                            Nearing Threshold ({limitEval.usagePct}% ≥ {app.alertThresholdPct}% alert)
                          </span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                            Within Daily Cap ({limitEval.usagePct}% used)
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSelectApp(app.id)}
                        className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
                      >
                        Configure Limit ({app.name})
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right 5 Columns: Custom Daily Limit & Threshold Inspector for Selected App */}
      {activeApp && (
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                {activeApp.packageName} · UID {activeApp.uid}
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {activeApp.category}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
              {activeApp.name}
            </h3>
          </div>

          {/* Foreground vs Background & Wi-Fi vs Mobile Breakdown */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Activity className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
                <span>Foreground vs Background</span>
              </div>
              <div className="mt-1.5 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {formatDataSize(activeApp.todayForegroundMB)} FG ·{' '}
                {formatDataSize(activeApp.todayBackgroundMB)} BG
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {Math.round((activeApp.todayBackgroundMB / Math.max(1, activeApp.todayUsedMB)) * 100)}%
                background ratio today
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Wifi className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                <span>Wi-Fi vs Cellular</span>
              </div>
              <div className="mt-1.5 text-sm font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                {formatDataSize(activeApp.todayWifiMB)} Wi-Fi ·{' '}
                {formatDataSize(activeApp.todayMobileMB)} 5G
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeApp.connections.length} active socket(s)
              </div>
            </div>
          </div>

          {/* Custom Daily Limit & Threshold Form */}
          <form onSubmit={handleSaveLimit} className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <SlidersHorizontal className="w-4 h-4 text-sky-500" aria-hidden="true" />
              <span>Custom Daily Data Usage Limit & Alert Threshold</span>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="daily-limit-mb-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Daily Data Limit (MB)
                </label>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Today used: {formatDataSize(activeApp.todayUsedMB)}
                </span>
              </div>
              <input
                id="daily-limit-mb-input"
                type="number"
                min={10}
                max={50000}
                step={10}
                value={draftLimitMB}
                onChange={(e) => {
                  setDraftLimitMB(e.target.value);
                  setSaveFeedback(null);
                }}
                className="mt-1.5 w-full min-h-[42px] px-3 py-2 text-sm font-mono tabular-nums rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
              {/* Quick Presets */}
              <div className="flex items-center gap-1.5 mt-2">
                {[250, 500, 800, 1000, 2000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setDraftLimitMB(String(preset));
                      setSaveFeedback(null);
                    }}
                    className="min-h-[32px] px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    {preset} MB
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="alert-threshold-pct-input"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                >
                  Near-Threshold Alert Trigger (%)
                </label>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  Alert at{' '}
                  {formatDataSize(
                    Math.round(((Number(draftLimitMB) || 0) * (Number(draftThresholdPct) || 80)) / 100)
                  )}
                </span>
              </div>
              <input
                id="alert-threshold-pct-input"
                type="number"
                min={50}
                max={99}
                value={draftThresholdPct}
                onChange={(e) => {
                  setDraftThresholdPct(e.target.value);
                  setSaveFeedback(null);
                }}
                className="mt-1.5 w-full min-h-[42px] px-3 py-2 text-sm font-mono tabular-nums rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>

            {validationError && (
              <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                {validationError}
              </p>
            )}

            {saveFeedback && (
              <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {saveFeedback}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 text-xs font-semibold rounded-xl bg-slate-900 dark:bg-sky-500 text-white dark:text-slate-950 hover:bg-slate-800 dark:hover:bg-sky-400 transition-colors whitespace-nowrap shrink-0"
              >
                Save Daily Limit
              </button>

              <button
                type="button"
                onClick={() => onSimulateTrafficBurst(activeApp.id, 120)}
                className="min-h-[44px] px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                Simulate +120 MB Spike
              </button>
            </div>
          </form>

          {/* Background Data Restriction Firewall Rule */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Restrict Background Cellular Socket
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Blocks background data when app is not in foreground (`netd` UID rule).
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggleBackgroundRestrict(activeApp.id)}
              aria-pressed={activeApp.backgroundRestricted}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                activeApp.backgroundRestricted
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {activeApp.backgroundRestricted ? (
                <>
                  <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Restricted</span>
                </>
              ) : (
                <>
                  <Unlock className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Allowed</span>
                </>
              )}
            </button>
          </div>

          {/* Active Sockets for this App */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Active Network Connections ({activeApp.connections.length})
            </h4>
            <div className="space-y-2">
              {activeApp.connections.map((conn) => (
                <div
                  key={conn.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-medium text-slate-900 dark:text-slate-100 truncate">
                      {conn.domain}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 shrink-0">
                      {conn.protocol} · :{conn.port}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-1">
                    <span>
                      {conn.remoteIp} ({conn.country}) · {conn.latencyMs}ms
                    </span>
                    <span>
                      {formatBandwidthSpeed(conn.downKbps)} ↓ / {formatBandwidthSpeed(conn.upKbps)} ↑
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
