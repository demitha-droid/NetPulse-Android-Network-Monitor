import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateLimitStatus,
  detectAbnormalUsage,
  generateNetworkAlerts,
  aggregateMonthlySummary,
  exportDataHistory,
  calculateBatteryOverhead,
  type NetworkAppRecord,
} from './networkEngine';

const sampleApp: NetworkAppRecord = {
  id: 'app-1',
  name: 'CloudVault Backup',
  packageName: 'com.cloudvault.android.sync',
  uid: 10142,
  category: 'Social',
  iconKey: 'cloud',
  currentDownKbps: 640,
  currentUpKbps: 2400,
  todayUsedMB: 425,
  todayForegroundMB: 105,
  todayBackgroundMB: 320,
  todayWifiMB: 280,
  todayMobileMB: 145,
  dailyLimitMB: 500,
  alertThresholdPct: 80,
  baselineBackgroundRatio: 0.25,
  backgroundRestricted: false,
  connections: [
    {
      id: 'conn-1',
      remoteIp: '198.51.100.42',
      domain: 'ingest-us-west.telemetry-edge.net',
      port: 443,
      protocol: 'QUIC',
      country: 'US',
      downKbps: 640,
      upKbps: 2400,
      latencyMs: 28,
      state: 'ESTABLISHED',
    },
  ],
  monthlyReports: {
    '2026-11': {
      monthKey: '2026-11',
      monthLabel: 'November 2026',
      wifiMB: 4120,
      mobileMB: 1380,
      foregroundMB: 2100,
      backgroundMB: 3400,
      peakHour: '02:00 - 03:00',
      anomalyCount: 3,
      dailySeriesMB: [180, 210, 190, 240, 310, 290, 425, 195, 205, 425],
    },
  },
};

test('evaluateLimitStatus identifies normal, approaching, and exceeded thresholds accurately', () => {
  const normal = evaluateLimitStatus(200, 500, 80);
  assert.equal(normal.status, 'normal');
  assert.equal(normal.usagePct, 40);
  assert.equal(normal.remainingMB, 300);

  const approaching = evaluateLimitStatus(425, 500, 80);
  assert.equal(approaching.status, 'approaching');
  assert.equal(approaching.usagePct, 85);
  assert.equal(approaching.remainingMB, 75);

  const exceeded = evaluateLimitStatus(540, 500, 80);
  assert.equal(exceeded.status, 'exceeded');
  assert.equal(exceeded.usagePct, 108);
  assert.equal(exceeded.remainingMB, 0);
});

test('detectAbnormalUsage flags uncharacteristic background spikes and clears restricted apps', () => {
  const result = detectAbnormalUsage(sampleApp);
  assert.equal(result.isAbnormal, true);
  assert.ok(result.reason?.includes('Background transfer'));
  assert.ok(result.spikeScore >= 80);

  const restrictedApp: NetworkAppRecord = {
    ...sampleApp,
    backgroundRestricted: true,
  };
  const restrictedResult = detectAbnormalUsage(restrictedApp);
  assert.equal(restrictedResult.isAbnormal, false);
});

test('generateNetworkAlerts emits both threshold and anomaly alerts and respects acknowledgment', () => {
  const alerts = generateNetworkAlerts([sampleApp]);
  assert.equal(alerts.length, 2);
  // Critical abnormal spike should sort ahead of warning nearing_threshold
  assert.equal(alerts[0].type, 'abnormal_spike');
  assert.equal(alerts[1].type, 'nearing_threshold');

  const acked = generateNetworkAlerts([sampleApp], new Set([alerts[0].id]));
  assert.equal(acked[0].type, 'nearing_threshold');
  assert.equal(acked[1].acknowledged, true);
});

test('aggregateMonthlySummary sums Wi-Fi, mobile, foreground, and background usage cleanly', () => {
  const summary = aggregateMonthlySummary([sampleApp], '2026-11');
  assert.equal(summary.wifiMB, 4120);
  assert.equal(summary.mobileMB, 1380);
  assert.equal(summary.totalMB, 5500);
  assert.equal(summary.foregroundMB, 2100);
  assert.equal(summary.backgroundMB, 3400);
  assert.equal(summary.anomalyCount, 3);
});

test('exportDataHistory formats valid CSV and JSON payloads with connection details', () => {
  const csv = exportDataHistory([sampleApp], '2026-11', 'csv', true);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('Primary Remote Endpoint'));
  assert.ok(lines[1].includes('com.cloudvault.android.sync'));
  assert.ok(lines[1].includes('ingest-us-west.telemetry-edge.net:443'));

  const jsonStr = exportDataHistory([sampleApp], '2026-11', 'json', false);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed.monthKey, '2026-11');
  assert.equal(parsed.applications.length, 1);
  assert.equal(parsed.applications[0].limitStatus, 'approaching');
});

test('calculateBatteryOverhead lowers drain in adaptive eBPF battery efficiency mode', () => {
  const eco = calculateBatteryOverhead(2000, true);
  const fast = calculateBatteryOverhead(1000, false);
  assert.ok(eco.drainPctPerHour < fast.drainPctPerHour);
  assert.ok(eco.cpuWakeupsPerMin < fast.cpuWakeupsPerMin);
});
