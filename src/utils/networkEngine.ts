export type AppCategory = 'Streaming' | 'Social' | 'Cloud & Sync' | 'Messaging' | 'System & OS' | 'Navigation';

export type LimitStatus = 'normal' | 'approaching' | 'exceeded';

export type AlertSeverity = 'warning' | 'critical';

export interface ActiveConnection {
  id: string;
  remoteIp: string;
  domain: string;
  port: number;
  protocol: 'TCP' | 'UDP' | 'QUIC';
  country: string;
  downKbps: number;
  upKbps: number;
  latencyMs: number;
  state: 'ESTABLISHED' | 'SYN_SENT' | 'TIME_WAIT';
}

export interface MonthlyRecord {
  monthKey: string; // e.g., '2026-11', '2026-10', '2026-09'
  monthLabel: string; // e.g., 'November 2026'
  wifiMB: number;
  mobileMB: number;
  foregroundMB: number;
  backgroundMB: number;
  peakHour: string;
  anomalyCount: number;
  dailySeriesMB: number[]; // 30 days
}

export interface NetworkAppRecord {
  id: string;
  name: string;
  packageName: string;
  uid: number;
  category: AppCategory;
  iconKey: string;
  currentDownKbps: number;
  currentUpKbps: number;
  todayUsedMB: number;
  todayForegroundMB: number;
  todayBackgroundMB: number;
  todayWifiMB: number;
  todayMobileMB: number;
  dailyLimitMB: number;
  alertThresholdPct: number; // e.g. 80 means alert when >= 80% of dailyLimitMB
  baselineBackgroundRatio: number; // typical background ratio (0..1)
  backgroundRestricted: boolean;
  connections: ActiveConnection[];
  monthlyReports: Record<string, MonthlyRecord>;
}

export interface NetworkAlert {
  id: string;
  appId: string;
  appName: string;
  packageName: string;
  type: 'limit_exceeded' | 'nearing_threshold' | 'abnormal_spike';
  severity: AlertSeverity;
  title: string;
  description: string;
  metricLabel: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface MonthlySummaryTotals {
  totalMB: number;
  wifiMB: number;
  mobileMB: number;
  foregroundMB: number;
  backgroundMB: number;
  anomalyCount: number;
}

/**
 * Evaluates whether an application's daily usage is within normal limits,
 * approaching its configured alert threshold, or exceeding the daily limit.
 */
export function evaluateLimitStatus(
  todayUsedMB: number,
  dailyLimitMB: number,
  alertThresholdPct: number
): { status: LimitStatus; usagePct: number; remainingMB: number } {
  if (dailyLimitMB <= 0) {
    return { status: 'normal', usagePct: 0, remainingMB: 0 };
  }
  const rawPct = (todayUsedMB / dailyLimitMB) * 100;
  const usagePct = Math.round(rawPct * 10) / 10;
  const remainingMB = Math.max(0, Math.round((dailyLimitMB - todayUsedMB) * 10) / 10);

  if (todayUsedMB >= dailyLimitMB) {
    return { status: 'exceeded', usagePct, remainingMB: 0 };
  }
  if (usagePct >= alertThresholdPct) {
    return { status: 'approaching', usagePct, remainingMB };
  }
  return { status: 'normal', usagePct, remainingMB };
}

/**
 * Detects abnormal data usage patterns such as uncharacteristic background
 * data spikes or unusually high simultaneous upload streams.
 */
export function detectAbnormalUsage(app: NetworkAppRecord): {
  isAbnormal: boolean;
  reason: string | null;
  spikeScore: number;
} {
  if (app.todayUsedMB <= 0) {
    return { isAbnormal: false, reason: null, spikeScore: 0 };
  }

  const bgRatio = app.todayBackgroundMB / app.todayUsedMB;
  const bgDelta = bgRatio - app.baselineBackgroundRatio;

  // Abnormal condition 1: Background ratio exceeds baseline by >= 30% and background usage > 80 MB
  if (bgDelta >= 0.3 && app.todayBackgroundMB >= 80 && !app.backgroundRestricted) {
    const score = Math.min(99, Math.round(55 + bgDelta * 100));
    return {
      isAbnormal: true,
      reason: `Background transfer accounts for ${Math.round(bgRatio * 100)}% of daily traffic (${app.todayBackgroundMB.toFixed(0)} MB vs ${Math.round(app.baselineBackgroundRatio * 100)}% baseline).`,
      spikeScore: score,
    };
  }

  // Abnormal condition 2: Live upload bandwidth > 1800 kbps on non-cloud app
  if (app.currentUpKbps > 1800 && app.category !== 'Cloud & Sync' && !app.backgroundRestricted) {
    return {
      isAbnormal: true,
      reason: `Sustained outbound throughput spike (${(app.currentUpKbps / 1000).toFixed(2)} Mbps up) to ${app.connections[0]?.domain ?? 'remote host'}.`,
      spikeScore: 84,
    };
  }

  return { isAbnormal: false, reason: null, spikeScore: 12 };
}

/**
 * Builds the active list of alerts (threshold warnings, exceeded daily limits,
 * and abnormal traffic anomalies) across all monitored Android applications.
 */
export function generateNetworkAlerts(
  apps: NetworkAppRecord[],
  acknowledgedIds: Set<string> = new Set()
): NetworkAlert[] {
  const alerts: NetworkAlert[] = [];

  for (const app of apps) {
    const limitEval = evaluateLimitStatus(app.todayUsedMB, app.dailyLimitMB, app.alertThresholdPct);

    if (limitEval.status === 'exceeded') {
      const id = `alert-limit-exceeded-${app.id}`;
      alerts.push({
        id,
        appId: app.id,
        appName: app.name,
        packageName: app.packageName,
        type: 'limit_exceeded',
        severity: 'critical',
        title: `${app.name} exceeded daily limit`,
        description: `Used ${formatDataSize(app.todayUsedMB)} of ${formatDataSize(app.dailyLimitMB)} daily cap (${limitEval.usagePct}%).`,
        metricLabel: `${limitEval.usagePct}% of cap`,
        timestamp: 'Just now',
        acknowledged: acknowledgedIds.has(id),
      });
    } else if (limitEval.status === 'approaching') {
      const id = `alert-nearing-threshold-${app.id}`;
      alerts.push({
        id,
        appId: app.id,
        appName: app.name,
        packageName: app.packageName,
        type: 'nearing_threshold',
        severity: 'warning',
        title: `${app.name} nearing daily threshold`,
        description: `Reached ${limitEval.usagePct}% of ${formatDataSize(app.dailyLimitMB)} daily limit (alert set at ${app.alertThresholdPct}%).`,
        metricLabel: `${formatDataSize(limitEval.remainingMB)} left`,
        timestamp: '2m ago',
        acknowledged: acknowledgedIds.has(id),
      });
    }

    const anomaly = detectAbnormalUsage(app);
    if (anomaly.isAbnormal && anomaly.reason) {
      const id = `alert-anomaly-${app.id}`;
      alerts.push({
        id,
        appId: app.id,
        appName: app.name,
        packageName: app.packageName,
        type: 'abnormal_spike',
        severity: 'critical',
        title: `Abnormal data usage in ${app.name}`,
        description: anomaly.reason,
        metricLabel: `Spike index ${anomaly.spikeScore}`,
        timestamp: 'Active telemetry',
        acknowledged: acknowledgedIds.has(id),
      });
    }
  }

  // Sort critical first, unacknowledged first
  return alerts.sort((a, b) => {
    if (a.acknowledged !== b.acknowledged) return a.acknowledged ? 1 : -1;
    if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
    return 0;
  });
}

/**
 * Aggregates monthly metrics across all apps for a given month key (e.g. '2026-11').
 */
export function aggregateMonthlySummary(
  apps: NetworkAppRecord[],
  monthKey: string
): MonthlySummaryTotals {
  let totalMB = 0;
  let wifiMB = 0;
  let mobileMB = 0;
  let foregroundMB = 0;
  let backgroundMB = 0;
  let anomalyCount = 0;

  for (const app of apps) {
    const rec = app.monthlyReports[monthKey];
    if (!rec) continue;
    const appTotal = rec.wifiMB + rec.mobileMB;
    totalMB += appTotal;
    wifiMB += rec.wifiMB;
    mobileMB += rec.mobileMB;
    foregroundMB += rec.foregroundMB;
    backgroundMB += rec.backgroundMB;
    anomalyCount += rec.anomalyCount;
  }

  return {
    totalMB: Math.round(totalMB * 10) / 10,
    wifiMB: Math.round(wifiMB * 10) / 10,
    mobileMB: Math.round(mobileMB * 10) / 10,
    foregroundMB: Math.round(foregroundMB * 10) / 10,
    backgroundMB: Math.round(backgroundMB * 10) / 10,
    anomalyCount,
  };
}

/**
 * Formats megabytes into human-readable MB or GB with tabular precision.
 */
export function formatDataSize(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  if (mb >= 100) {
    return `${Math.round(mb)} MB`;
  }
  return `${mb.toFixed(1)} MB`;
}

/**
 * Formats speed in kbps into Kbps or Mbps.
 */
export function formatBandwidthSpeed(kbps: number): string {
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(2)} Mbps`;
  }
  return `${Math.round(kbps)} Kbps`;
}

/**
 * Estimates battery overhead of the network monitor based on polling interval and battery saver state.
 */
export function calculateBatteryOverhead(
  pollingIntervalMs: number,
  batteryEfficiencyMode: boolean
): { drainPctPerHour: number; cpuWakeupsPerMin: number; modeLabel: string } {
  if (batteryEfficiencyMode) {
    return {
      drainPctPerHour: 0.18,
      cpuWakeupsPerMin: 12,
      modeLabel: 'Adaptive eBPF Coalesced (Low Drain)',
    };
  }
  const factor = Math.max(0.5, 2000 / Math.max(500, pollingIntervalMs));
  return {
    drainPctPerHour: Math.round(0.45 * factor * 100) / 100,
    cpuWakeupsPerMin: Math.round(30 * factor),
    modeLabel: 'High-Frequency Socket Polling',
  };
}

/**
 * Exports network usage history in CSV or JSON format for external analytics.
 */
export function exportDataHistory(
  apps: NetworkAppRecord[],
  monthKey: string,
  format: 'csv' | 'json',
  includeConnections: boolean
): string {
  if (format === 'json') {
    const payload = {
      exportedAt: '2026-11-10T09:30:00-08:00',
      monthKey,
      summary: aggregateMonthlySummary(apps, monthKey),
      applications: apps.map((app) => {
        const monthly = app.monthlyReports[monthKey];
        const limitStatus = evaluateLimitStatus(app.todayUsedMB, app.dailyLimitMB, app.alertThresholdPct);
        return {
          name: app.name,
          packageName: app.packageName,
          uid: app.uid,
          category: app.category,
          todayUsedMB: app.todayUsedMB,
          dailyLimitMB: app.dailyLimitMB,
          alertThresholdPct: app.alertThresholdPct,
          limitStatus: limitStatus.status,
          backgroundRestricted: app.backgroundRestricted,
          monthlyReport: monthly
            ? {
                wifiMB: monthly.wifiMB,
                mobileMB: monthly.mobileMB,
                foregroundMB: monthly.foregroundMB,
                backgroundMB: monthly.backgroundMB,
                totalMB: monthly.wifiMB + monthly.mobileMB,
                peakHour: monthly.peakHour,
                anomalyCount: monthly.anomalyCount,
              }
            : null,
          ...(includeConnections ? { activeConnections: app.connections } : {}),
        };
      }),
    };
    return JSON.stringify(payload, null, 2);
  }

  // CSV format
  const headers = [
    'App Name',
    'Package Name',
    'UID',
    'Category',
    'Today Used (MB)',
    'Daily Limit (MB)',
    'Threshold (%)',
    'Limit Status',
    'Month',
    'Monthly Wi-Fi (MB)',
    'Monthly Mobile (MB)',
    'Monthly Foreground (MB)',
    'Monthly Background (MB)',
    'Monthly Total (MB)',
    'Peak Hour',
    'Anomalies',
    ...(includeConnections ? ['Active Connections', 'Primary Remote Endpoint'] : []),
  ];

  const escapeCsv = (val: string | number | boolean) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = apps.map((app) => {
    const monthly = app.monthlyReports[monthKey];
    const limitStatus = evaluateLimitStatus(app.todayUsedMB, app.dailyLimitMB, app.alertThresholdPct);
    const wifiMB = monthly ? monthly.wifiMB : 0;
    const mobileMB = monthly ? monthly.mobileMB : 0;
    const fgMB = monthly ? monthly.foregroundMB : 0;
    const bgMB = monthly ? monthly.backgroundMB : 0;
    const baseCols: (string | number | boolean)[] = [
      app.name,
      app.packageName,
      app.uid,
      app.category,
      app.todayUsedMB,
      app.dailyLimitMB,
      app.alertThresholdPct,
      limitStatus.status,
      monthKey,
      wifiMB,
      mobileMB,
      fgMB,
      bgMB,
      wifiMB + mobileMB,
      monthly ? monthly.peakHour : 'N/A',
      monthly ? monthly.anomalyCount : 0,
    ];
    if (includeConnections) {
      baseCols.push(
        app.connections.length,
        app.connections[0] ? `${app.connections[0].domain}:${app.connections[0].port}` : 'None'
      );
    }
    return baseCols.map(escapeCsv).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
