/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BarChart3,
  BatteryCharging,
  Bell,
  CheckCircle2,
  Download,
  Moon,
  Pause,
  Play,
  ShieldAlert,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { INITIAL_NETWORK_APPS } from './data/seedApps';
import {
  calculateBatteryOverhead,
  evaluateLimitStatus,
  formatBandwidthSpeed,
  formatDataSize,
  generateNetworkAlerts,
  type NetworkAppRecord,
} from './utils/networkEngine';
import { HomeWidgetPreview } from './components/HomeWidgetPreview';
import { AppLimitsView } from './components/AppLimitsView';
import { MonthlyReportsView } from './components/MonthlyReportsView';
import { ExportAndDiagnosticsView } from './components/ExportAndDiagnosticsView';

type ActiveTab = 'overview' | 'limits' | 'monthly' | 'export';

export default function App() {
  const [darkMode, setDarkMode] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [apps, setApps] = useState<NetworkAppRecord[]>(INITIAL_NETWORK_APPS);
  const [selectedAppId, setSelectedAppId] = useState<string>(INITIAL_NETWORK_APPS[0].id);
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-11');
  const [batteryEfficiencyMode, setBatteryEfficiencyMode] = useState<boolean>(true);
  const [livePollingPaused, setLivePollingPaused] = useState<boolean>(false);
  const [acknowledgedAlertIds, setAcknowledgedAlertIds] = useState<Set<string>>(new Set());

  const [throughputHistory, setThroughputHistory] = useState<{ down: number; up: number }[]>([
    { down: 8200, up: 4100 },
    { down: 9100, up: 4600 },
    { down: 7600, up: 3900 },
    { down: 10400, up: 5200 },
    { down: 9800, up: 6100 },
    { down: 11200, up: 5900 },
    { down: 8900, up: 4800 },
    { down: 9400, up: 5400 },
    { down: 10800, up: 6300 },
    { down: 9675, up: 6145 },
  ]);

  // Keep <html> .dark class synced with darkMode state
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [darkMode]);

  // Battery-efficient adaptive polling loop
  useEffect(() => {
    if (livePollingPaused) return;
    const intervalMs = batteryEfficiencyMode ? 3500 : 1500;

    const timer = window.setInterval(() => {
      setApps((prevApps) => {
        let nextTotalDown = 0;
        let nextTotalUp = 0;

        const updated = prevApps.map((app, idx) => {
          if (app.backgroundRestricted && idx !== 0) {
            return {
              ...app,
              currentDownKbps: Math.max(0, Math.round(app.currentDownKbps * 0.2)),
              currentUpKbps: Math.max(0, Math.round(app.currentUpKbps * 0.2)),
            };
          }
          // Deterministic gentle oscillation so speeds feel alive without chaotic jitter
          const deltaDown = ((idx % 2 === 0 ? 1 : -1) * ((Date.now() >> 10) % 140)) + 25;
          const deltaUp = ((idx % 2 === 1 ? 1 : -1) * ((Date.now() >> 10) % 90)) + 15;
          const nextDown = Math.max(45, app.currentDownKbps + deltaDown);
          const nextUp = Math.max(25, app.currentUpKbps + deltaUp);
          nextTotalDown += nextDown;
          nextTotalUp += nextUp;
          return {
            ...app,
            currentDownKbps: nextDown,
            currentUpKbps: nextUp,
          };
        });

        setThroughputHistory((prevHist) => [
          ...prevHist.slice(-23),
          { down: nextTotalDown, up: nextTotalUp },
        ]);

        return updated;
      });
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [batteryEfficiencyMode, livePollingPaused]);

  const totalDownKbps = useMemo(
    () => apps.reduce((sum, a) => sum + a.currentDownKbps, 0),
    [apps]
  );
  const totalUpKbps = useMemo(
    () => apps.reduce((sum, a) => sum + a.currentUpKbps, 0),
    [apps]
  );
  const totalTodayMB = useMemo(
    () => apps.reduce((sum, a) => sum + a.todayUsedMB, 0),
    [apps]
  );
  const totalDailyLimitMB = useMemo(
    () => apps.reduce((sum, a) => sum + a.dailyLimitMB, 0),
    [apps]
  );

  const alerts = useMemo(
    () => generateNetworkAlerts(apps, acknowledgedAlertIds),
    [apps, acknowledgedAlertIds]
  );
  const unacknowledgedAlerts = useMemo(
    () => alerts.filter((a) => !a.acknowledged),
    [alerts]
  );

  const batteryStats = useMemo(
    () => calculateBatteryOverhead(batteryEfficiencyMode ? 3500 : 1500, batteryEfficiencyMode),
    [batteryEfficiencyMode]
  );

  const handleUpdateAppLimit = (
    appId: string,
    dailyLimitMB: number,
    alertThresholdPct: number
  ) => {
    setApps((prev) =>
      prev.map((app) =>
        app.id === appId
          ? { ...app, dailyLimitMB, alertThresholdPct }
          : app
      )
    );
    // Clear prior acknowledgment for this app so updated threshold triggers fresh alert state
    setAcknowledgedAlertIds((prev) => {
      const next = new Set(prev);
      next.delete(`alert-limit-exceeded-${appId}`);
      next.delete(`alert-nearing-threshold-${appId}`);
      return next;
    });
  };

  const handleToggleBackgroundRestrict = (appId: string) => {
    setApps((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              backgroundRestricted: !app.backgroundRestricted,
              currentUpKbps: !app.backgroundRestricted ? 40 : app.currentUpKbps,
            }
          : app
      )
    );
  };

  const handleSimulateTrafficBurst = (appId: string, addMB: number) => {
    setApps((prev) =>
      prev.map((app) =>
        app.id === appId
          ? {
              ...app,
              todayUsedMB: app.todayUsedMB + addMB,
              todayBackgroundMB: app.todayBackgroundMB + Math.round(addMB * 0.75),
              todayMobileMB: app.todayMobileMB + Math.round(addMB * 0.6),
              todayWifiMB: app.todayWifiMB + Math.round(addMB * 0.4),
              currentDownKbps: app.currentDownKbps + 1250,
            }
          : app
      )
    );
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    setAcknowledgedAlertIds((prev) => {
      const next = new Set(prev);
      next.add(alertId);
      return next;
    });
  };

  const openAppLimitConfig = (appId: string) => {
    setSelectedAppId(appId);
    setActiveTab('limits');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-12 transition-colors">
      {/* Top Bar Contract: Zone 1 Brand Wordmark — Zone 2 4 Nav Links — Zone 3 Primary Action */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-4 sm:px-8 py-3.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('overview');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          NetPulse Android
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary Dashboard Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300"
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'overview'
                ? 'border-sky-500 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Live Monitor
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('limits')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'limits'
                ? 'border-sky-500 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            App Limits ({unacknowledgedAlerts.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monthly')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'monthly'
                ? 'border-sky-500 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Monthly Reports
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 ${
              activeTab === 'export'
                ? 'border-sky-500 text-slate-900 dark:text-white font-semibold'
                : 'border-transparent hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Export & Diagnostics
          </button>
        </nav>

        {/* Zone 3: 1 primary action (Theme toggle) */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            aria-label={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            {darkMode ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
                <span>Light Theme</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
                <span>Dark Theme</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6">
        {/* Workspace Toolbar & Telemetry KPI Strip */}
        <section
          aria-label="Real-Time Network Telemetry Summary"
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Android eBPF Socket Monitor · {batteryStats.modeLabel}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                Network Connections & Bandwidth Guard
              </h1>
            </div>

            {/* Secondary Workspace Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setBatteryEfficiencyMode((prev) => !prev)}
                aria-pressed={batteryEfficiencyMode}
                className={`min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-xl border transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  batteryEfficiencyMode
                    ? 'border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <BatteryCharging className="w-4 h-4" aria-hidden="true" />
                <span>
                  Battery Saver: {batteryStats.drainPctPerHour}%/hr ({batteryStats.cpuWakeupsPerMin} wakeups/m)
                </span>
              </button>

              <button
                type="button"
                onClick={() => setLivePollingPaused((prev) => !prev)}
                aria-pressed={livePollingPaused}
                className="min-h-[40px] px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                {livePollingPaused ? (
                  <>
                    <Play className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                    <span>Resume Stream</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
                    <span>Pause Stream</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 4-Column KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ArrowDown className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" />
                <span>Live Download Throughput</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {formatBandwidthSpeed(totalDownKbps)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {apps.reduce((sum, a) => sum + a.connections.length, 0)} established sockets
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ArrowUp className="w-3.5 h-3.5 text-sky-500" aria-hidden="true" />
                <span>Live Upload Throughput</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {formatBandwidthSpeed(totalUpKbps)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                QUIC / TCP / UDP active streams
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Activity className="w-3.5 h-3.5 text-indigo-500" aria-hidden="true" />
                <span>Today Data Consumed</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {formatDataSize(totalTodayMB)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                of {formatDataSize(totalDailyLimitMB)} combined daily limits
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Bell className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                <span>Threshold & Anomaly Alerts</span>
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
                {unacknowledgedAlerts.length} Active
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {alerts.filter((a) => a.severity === 'critical').length} critical ·{' '}
                {alerts.filter((a) => a.severity === 'warning').length} nearing limit
              </div>
            </div>
          </div>
        </section>

        {/* Active View Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Above-the-Fold Primary Grid: Real-Time Home Screen Traffic Widget + Live Per-App Connection Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6">
                <HomeWidgetPreview
                  apps={apps}
                  totalDownKbps={totalDownKbps}
                  totalUpKbps={totalUpKbps}
                  batteryEfficiencyMode={batteryEfficiencyMode}
                  onToggleBatteryMode={() => setBatteryEfficiencyMode((prev) => !prev)}
                  onSelectAppForLimit={openAppLimitConfig}
                  throughputHistory={throughputHistory}
                />
              </div>

              <section
                aria-label="Live Per-App Bandwidth and Socket Monitor"
                className="lg:col-span-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
              >
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      Live Application Bandwidth Monitor
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tap any application to adjust its daily data usage limit or restrict background sockets.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800 mt-2">
                  {apps.map((app) => {
                    const limitEval = evaluateLimitStatus(
                      app.todayUsedMB,
                      app.dailyLimitMB,
                      app.alertThresholdPct
                    );
                    const primaryConn = app.connections[0];
                    return (
                      <div
                        key={app.id}
                        className="py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {app.name}
                            </span>
                            <span className="text-xs text-slate-400">·</span>
                            <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap shrink-0">
                              {formatDataSize(app.todayUsedMB)} / {formatDataSize(app.dailyLimitMB)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 min-w-0">
                            <span className="font-mono truncate">
                              {primaryConn
                                ? `${primaryConn.protocol} → ${primaryConn.domain}:${primaryConn.port}`
                                : app.packageName}
                            </span>
                            <span aria-hidden="true" className="shrink-0">·</span>
                            <span className="whitespace-nowrap shrink-0">
                              {limitEval.status === 'exceeded' ? (
                                <span className="text-rose-600 dark:text-rose-400 font-medium">
                                  Over limit ({limitEval.usagePct}%)
                                </span>
                              ) : limitEval.status === 'approaching' ? (
                                <span className="text-amber-600 dark:text-amber-400 font-medium">
                                  Near limit ({limitEval.usagePct}%)
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {limitEval.usagePct}% of cap
                                </span>
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right font-mono tabular-nums">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                              {formatBandwidthSpeed(app.currentDownKbps)} ↓
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                              {formatBandwidthSpeed(app.currentUpKbps)} ↑
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => openAppLimitConfig(app.id)}
                            aria-label={`Set daily limit for ${app.name}`}
                            className="min-h-[40px] px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                          >
                            Set Limit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>

            {/* Abnormal Usage & Daily Limit Threshold Alerts Feed (Clean Hairline Divided List) */}
            <section
              aria-label="Abnormal Data Usage and Threshold Alerts"
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    Abnormal Data Usage & Daily Threshold Alerts ({unacknowledgedAlerts.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Real-time notifications when apps approach or exceed custom daily caps or exhibit abnormal background spikes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('limits')}
                  className="min-h-[38px] px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  Configure All Thresholds
                </button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-opacity ${
                      alert.acknowledged ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {alert.severity === 'critical' ? (
                        <ShieldAlert
                          className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      ) : (
                        <AlertTriangle
                          className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {alert.title}
                          </span>
                          <span aria-hidden="true" className="text-xs text-slate-400">·</span>
                          <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                            {alert.packageName}
                          </span>
                          <span aria-hidden="true" className="text-xs text-slate-400">·</span>
                          <span
                            className={`text-xs font-mono font-medium ${
                              alert.severity === 'critical'
                                ? 'text-rose-600 dark:text-rose-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {alert.metricLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                          {alert.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => openAppLimitConfig(alert.appId)}
                        aria-label={`Adjust limit for ${alert.title}`}
                        className="min-h-[36px] px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-200 hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors whitespace-nowrap"
                      >
                        Adjust Limit
                      </button>
                      {!alert.acknowledged && (
                        <button
                          type="button"
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          aria-label={`Dismiss alert: ${alert.title}`}
                          className="min-h-[36px] px-2.5 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
                        >
                          Dismiss
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === 'limits' && (
          <AppLimitsView
            apps={apps}
            selectedAppId={selectedAppId}
            onSelectApp={setSelectedAppId}
            onUpdateAppLimit={handleUpdateAppLimit}
            onToggleBackgroundRestrict={handleToggleBackgroundRestrict}
            onSimulateTrafficBurst={handleSimulateTrafficBurst}
          />
        )}

        {activeTab === 'monthly' && (
          <MonthlyReportsView
            apps={apps}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            onNavigateToExport={() => setActiveTab('export')}
          />
        )}

        {activeTab === 'export' && (
          <ExportAndDiagnosticsView
            apps={apps}
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar (Natural Thumb Zone, <= 15% viewport height) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 items-center h-14 px-2"
      >
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg ${
            activeTab === 'overview'
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Activity className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] mt-0.5">Monitor</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('limits')}
          className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg ${
            activeTab === 'limits'
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] mt-0.5">App Limits</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('monthly')}
          className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg ${
            activeTab === 'monthly'
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <BarChart3 className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] mt-0.5">Monthly</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className={`min-h-[44px] flex flex-col items-center justify-center rounded-lg ${
            activeTab === 'export'
              ? 'text-sky-600 dark:text-sky-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span className="text-[10px] mt-0.5">Export</span>
        </button>
      </nav>
    </div>
  );
}
