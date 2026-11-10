import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BatteryCharging,
  ShieldAlert,
  Smartphone,
  Wifi,
  SlidersHorizontal,
} from 'lucide-react';
import {
  formatBandwidthSpeed,
  formatDataSize,
  evaluateLimitStatus,
  type NetworkAppRecord,
} from '../utils/networkEngine';

interface HomeWidgetPreviewProps {
  apps: NetworkAppRecord[];
  totalDownKbps: number;
  totalUpKbps: number;
  batteryEfficiencyMode: boolean;
  onToggleBatteryMode: () => void;
  onSelectAppForLimit: (appId: string) => void;
  throughputHistory: { down: number; up: number }[];
}

export const HomeWidgetPreview: React.FC<HomeWidgetPreviewProps> = ({
  apps,
  totalDownKbps,
  totalUpKbps,
  batteryEfficiencyMode,
  onToggleBatteryMode,
  onSelectAppForLimit,
  throughputHistory,
}) => {
  const [widgetSize, setWidgetSize] = useState<'4x2' | '4x1'>('4x2');
  const [networkInterface, setNetworkInterface] = useState<'Wi-Fi 6E' | '5G NR'>('Wi-Fi 6E');

  const topApps = [...apps]
    .sort((a, b) => b.currentDownKbps + b.currentUpKbps - (a.currentDownKbps + a.currentUpKbps))
    .slice(0, 3);

  const totalUsedTodayMB = apps.reduce((acc, a) => acc + a.todayUsedMB, 0);
  const totalLimitTodayMB = apps.reduce((acc, a) => acc + a.dailyLimitMB, 0);
  const overallPct = totalLimitTodayMB > 0 ? Math.min(100, Math.round((totalUsedTodayMB / totalLimitTodayMB) * 100)) : 0;

  return (
    <section
      aria-label="Android Home Screen Real-Time Traffic Widget"
      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Android Launcher Widget</span>
            <span aria-hidden="true">·</span>
            <span>AppWidgetProvider</span>
          </div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            Home Screen Real-Time Traffic Widget
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label="Widget Dimensions"
            className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            <button
              type="button"
              onClick={() => setWidgetSize('4x1')}
              className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                widgetSize === '4x1'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Compact 4×1
            </button>
            <button
              type="button"
              onClick={() => setWidgetSize('4x2')}
              className={`min-h-[36px] px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                widgetSize === '4x2'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              Expanded 4×2
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setNetworkInterface((prev) => (prev === 'Wi-Fi 6E' ? '5G NR' : 'Wi-Fi 6E'))
            }
            aria-label={`Switch simulated radio interface, currently ${networkInterface}`}
            className="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
          >
            <Wifi className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
            <span>{networkInterface}</span>
          </button>
        </div>
      </div>

      {/* Simulated Android Home Screen Canvas */}
      <div className="mt-4 rounded-xl bg-slate-950 text-slate-100 p-4 border border-slate-800">
        {/* Android Status Bar Strip */}
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pb-3 mb-3 border-b border-slate-800/80">
          <span>09:32 · Pixel Launcher</span>
          <div className="flex items-center gap-3">
            <span>{networkInterface}</span>
            <span>·</span>
            <span>{formatBandwidthSpeed(totalDownKbps + totalUpKbps)}</span>
            <span>·</span>
            <span>94%</span>
          </div>
        </div>

        {/* Pinned Android Widget Card */}
        <div
          data-testid="android-home-widget"
          className="rounded-2xl bg-slate-900/95 border border-slate-800 p-4 transition-all"
        >
          {/* Top Row: Live RX / TX + Daily Quota Ring */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5">
              <div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <ArrowDown className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  <span>Download</span>
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-white mt-0.5">
                  {formatBandwidthSpeed(totalDownKbps)}
                </div>
              </div>

              <div className="h-8 w-px bg-slate-800" aria-hidden="true" />

              <div>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <ArrowUp className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                  <span>Upload</span>
                </div>
                <div className="text-xl font-bold font-mono tabular-nums text-white mt-0.5">
                  {formatBandwidthSpeed(totalUpKbps)}
                </div>
              </div>
            </div>

            {/* Daily Total Cap Indicator & Battery Toggle */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs text-slate-400">Daily Budget</div>
                <div className="text-xs font-mono tabular-nums text-slate-200 font-medium">
                  {formatDataSize(totalUsedTodayMB)} / {formatDataSize(totalLimitTodayMB)} ({overallPct}%)
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleBatteryMode}
                aria-pressed={batteryEfficiencyMode}
                aria-label="Toggle Widget Adaptive Battery Saver"
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                  batteryEfficiencyMode
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                <BatteryCharging className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{batteryEfficiencyMode ? 'eBPF Eco On' : 'Standard Poll'}</span>
              </button>
            </div>
          </div>

          {/* Mini Sparkline Bar Row */}
          <div className="mt-3 pt-3 border-t border-slate-800/80">
            <div className="flex items-end gap-1 h-9" aria-label="Real-time bandwidth sparkline">
              {throughputHistory.slice(-24).map((pt, index) => {
                const combined = pt.down + pt.up;
                const heightPct = Math.max(12, Math.min(100, Math.round((combined / 18000) * 100)));
                const isHigh = combined > 13000;
                return (
                  <div
                    key={index}
                    className={`flex-1 rounded-t transition-opacity ${
                      isHigh ? 'bg-amber-400' : 'bg-sky-500/80'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  />
                );
              })}
            </div>
          </div>

          {/* Expanded 4x2 Section: Live Top Consuming Apps in Widget */}
          {widgetSize === '4x2' && (
            <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Top Active UIDs · Tap to configure daily limit</span>
                <span className="font-mono">Live Socket Rate</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {topApps.map((app) => {
                  const limitEval = evaluateLimitStatus(
                    app.todayUsedMB,
                    app.dailyLimitMB,
                    app.alertThresholdPct
                  );
                  return (
                    <button
                      key={app.id}
                      type="button"
                      onClick={() => onSelectAppForLimit(app.id)}
                      className="min-h-[44px] text-left rounded-xl bg-slate-800/70 hover:bg-slate-800 border border-slate-700/70 px-3 py-2 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-slate-100 truncate">
                          {app.name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono tabular-nums">
                          {formatDataSize(app.todayUsedMB)} · {limitEval.usagePct}% cap
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-mono tabular-nums font-semibold text-sky-400">
                          {formatBandwidthSpeed(app.currentDownKbps + app.currentUpKbps)}
                        </div>
                        {limitEval.status !== 'normal' && (
                          <div className="flex items-center justify-end gap-1 text-[10px] text-amber-400">
                            <ShieldAlert className="w-3 h-3" aria-hidden="true" />
                            <span>{limitEval.status === 'exceeded' ? 'Over cap' : 'Near cap'}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
