/**
 * Deep Diagnostic Telemetry Module
 * Captures empirical performance metrics:
 * - Event Loop Utilization (ELU) via perf_hooks
 * - Event Loop Delay (Lag) histogram via monitorEventLoopDelay
 * - MongoDB Connection Pool usage and checkout wait times
 * - HTTP request latency, status distributions, 429 counts, and bytes transferred
 * - Process CPU and memory metrics
 */

'use strict';

const { eventLoopUtilization, monitorEventLoopDelay } = require('perf_hooks');
const os = require('os');
const mongoose = require('mongoose');

// 1. Event Loop Monitoring
let lagMonitor = monitorEventLoopDelay({ resolution: 10 });
lagMonitor.enable();

let eluBaseline = eventLoopUtilization();

// 2. MongoDB Connection Pool Metrics
const poolStats = {
  checkOutStarted: 0,
  checkOutCompleted: 0,
  checkOutFailed: 0,
  activeConnections: 0,
  totalCheckoutTimeMs: 0,
  maxCheckoutTimeMs: 0,
  recentCheckoutLatencies: []
};

// 3. Database Query Latency Metrics
const dbQueryStats = {
  totalQueries: 0,
  totalDurationMs: 0,
  slowQueries: 0, // queries > 100ms
  latencies: []
};

// 4. HTTP Server Metrics
const httpStats = {
  totalRequests: 0,
  statusCodes: {},
  rateLimit429Count: 0,
  totalBytesSent: 0,
  staticAssetRequests: 0,
  staticAssetBytes: 0,
  endpointCounts: {},
  latencies: []
};

let poolListenersAttached = false;

function attachPoolMonitoring() {
  if (poolListenersAttached) return;
  try {
    const client = mongoose.connection?.getClient?.();
    if (!client) return;

    client.on('connectionCheckOutStarted', () => {
      poolStats.checkOutStarted++;
    });

    client.on('connectionCheckedOut', (event) => {
      poolStats.checkOutCompleted++;
      poolStats.activeConnections++;
      const dur = typeof event.durationMS === 'number' ? event.durationMS : 0;
      poolStats.totalCheckoutTimeMs += dur;
      if (dur > poolStats.maxCheckoutTimeMs) {
        poolStats.maxCheckoutTimeMs = dur;
      }
      if (poolStats.recentCheckoutLatencies.length < 5000) {
        poolStats.recentCheckoutLatencies.push(dur);
      }
    });

    client.on('connectionCheckedIn', () => {
      poolStats.activeConnections = Math.max(0, poolStats.activeConnections - 1);
    });

    client.on('connectionCheckOutFailed', () => {
      poolStats.checkOutFailed++;
    });

    poolListenersAttached = true;
  } catch (err) {
    console.error('Failed to attach MongoDB pool telemetry:', err.message);
  }
}

// Attach Mongoose query profiling plugin
mongoose.plugin((schema) => {
  schema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'aggregate'], function () {
    this._startTime = process.hrtime.bigint();
  });

  schema.post(['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'aggregate'], function () {
    if (this._startTime) {
      const durMs = Number(process.hrtime.bigint() - this._startTime) / 1e6;
      dbQueryStats.totalQueries++;
      dbQueryStats.totalDurationMs += durMs;
      if (durMs > 100) {
        dbQueryStats.slowQueries++;
      }
      if (dbQueryStats.latencies.length < 5000) {
        dbQueryStats.latencies.push(durMs);
      }
    }
  });
});

/**
 * Express middleware to capture HTTP metrics per request
 */
function telemetryMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  const path = req.path || '';

  // Classify static assets
  const isStatic = path.startsWith('/static') || path.startsWith('/favicon') || path.endsWith('.pdf') || path.endsWith('.png') || path.endsWith('.css') || path.endsWith('.js');
  if (isStatic) {
    httpStats.staticAssetRequests++;
  }

  // Intercept end to measure latency and bytes
  const originalEnd = res.end;
  res.end = function (...args) {
    const durMs = Number(process.hrtime.bigint() - start) / 1e6;
    httpStats.totalRequests++;

    const code = res.statusCode || 500;
    httpStats.statusCodes[code] = (httpStats.statusCodes[code] || 0) + 1;

    if (code === 429) {
      httpStats.rateLimit429Count++;
    }

    const contentLength = parseInt(res.getHeader('content-length'), 10) || 0;
    httpStats.totalBytesSent += contentLength;
    if (isStatic) {
      httpStats.staticAssetBytes += contentLength;
    }

    if (httpStats.latencies.length < 10000) {
      httpStats.latencies.push(durMs);
    }

    const routeKey = `${req.method} ${req.baseUrl || ''}${req.path || ''}`;
    httpStats.endpointCounts[routeKey] = (httpStats.endpointCounts[routeKey] || 0) + 1;

    return originalEnd.apply(this, args);
  };

  next();
}

/**
 * Resets telemetry windows for discrete tier benchmarking
 */
function resetTelemetry() {
  lagMonitor.reset();
  eluBaseline = eventLoopUtilization();

  poolStats.checkOutStarted = 0;
  poolStats.checkOutCompleted = 0;
  poolStats.checkOutFailed = 0;
  poolStats.totalCheckoutTimeMs = 0;
  poolStats.maxCheckoutTimeMs = 0;
  poolStats.recentCheckoutLatencies = [];

  dbQueryStats.totalQueries = 0;
  dbQueryStats.totalDurationMs = 0;
  dbQueryStats.slowQueries = 0;
  dbQueryStats.latencies = [];

  httpStats.totalRequests = 0;
  httpStats.statusCodes = {};
  httpStats.rateLimit429Count = 0;
  httpStats.totalBytesSent = 0;
  httpStats.staticAssetRequests = 0;
  httpStats.staticAssetBytes = 0;
  httpStats.endpointCounts = {};
  httpStats.latencies = [];
}

/**
 * Computes snapshot of current metrics
 */
function getTelemetrySnapshot() {
  attachPoolMonitoring();

  const elu = eventLoopUtilization(eluBaseline);
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();

  // Lag stats in milliseconds
  const lagMeanMs = (lagMonitor.mean / 1e6) || 0;
  const lagP50Ms = (lagMonitor.percentile(50) / 1e6) || 0;
  const lagP95Ms = (lagMonitor.percentile(95) / 1e6) || 0;
  const lagP99Ms = (lagMonitor.percentile(99) / 1e6) || 0;
  const lagMaxMs = (lagMonitor.max / 1e6) || 0;

  // DB Checkout wait time
  const avgCheckoutMs = poolStats.checkOutCompleted > 0
    ? (poolStats.totalCheckoutTimeMs / poolStats.checkOutCompleted).toFixed(2)
    : '0.00';

  // DB Query latency
  const avgQueryMs = dbQueryStats.totalQueries > 0
    ? (dbQueryStats.totalDurationMs / dbQueryStats.totalQueries).toFixed(2)
    : '0.00';

  return {
    eventLoop: {
      utilization: (elu.utilization * 100).toFixed(2) + '%',
      utilizationRaw: elu.utilization,
      activeMs: (elu.active).toFixed(1),
      idleMs: (elu.idle).toFixed(1),
      lagMeanMs: lagMeanMs.toFixed(2),
      lagP50Ms: lagP50Ms.toFixed(2),
      lagP95Ms: lagP95Ms.toFixed(2),
      lagP99Ms: lagP99Ms.toFixed(2),
      lagMaxMs: lagMaxMs.toFixed(2)
    },
    database: {
      activeConnections: poolStats.activeConnections,
      checkOutStarted: poolStats.checkOutStarted,
      checkOutCompleted: poolStats.checkOutCompleted,
      checkOutFailed: poolStats.checkOutFailed,
      avgCheckoutWaitMs: avgCheckoutMs,
      maxCheckoutWaitMs: poolStats.maxCheckoutTimeMs.toFixed(2),
      totalQueries: dbQueryStats.totalQueries,
      avgQueryDurationMs: avgQueryMs,
      slowQueriesCount: dbQueryStats.slowQueries
    },
    http: {
      totalRequests: httpStats.totalRequests,
      statusCodes: { ...httpStats.statusCodes },
      rateLimit429Count: httpStats.rateLimit429Count,
      totalBytesSentMB: (httpStats.totalBytesSent / (1024 * 1024)).toFixed(2),
      staticAssetRequests: httpStats.staticAssetRequests,
      staticAssetBytesMB: (httpStats.staticAssetBytes / (1024 * 1024)).toFixed(2),
      topEndpoints: { ...httpStats.endpointCounts }
    },
    system: {
      cpuUserMs: (cpu.user / 1000).toFixed(1),
      cpuSystemMs: (cpu.system / 1000).toFixed(1),
      rssMB: (mem.rss / (1024 * 1024)).toFixed(1),
      heapUsedMB: (mem.heapUsed / (1024 * 1024)).toFixed(1),
      heapTotalMB: (mem.heapTotal / (1024 * 1024)).toFixed(1)
    }
  };
}

module.exports = {
  telemetryMiddleware,
  attachPoolMonitoring,
  resetTelemetry,
  getTelemetrySnapshot
};
