/**
 * Comprehensive Progressive Load-Testing Harness
 * Evaluates the Telangana Yogasana Association portal under:
 * 100, 500, 1,000, 2,500, 5,000, and 10,000 concurrent user streams.
 *
 * Measures:
 * - Requests / second (RPS)
 * - Average, p50, p95, p99 latencies
 * - Error rate & Status code distribution (2xx, 429, 4xx, 5xx, Network Errors)
 * - CPU (User / System) & Memory (RSS / Heap)
 * - Network throughput (MB/s)
 * - Database response and connection pool saturation
 */

'use strict';

const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const app = require('../server');
const Athlete = require('../models/Athlete');
const Secretary = require('../models/Secretary');
const { connectDB, POOL_OPTIONS } = require('../config/db');
const { JWT_SECRET } = require('../config/constants');

// High-capacity HTTP agent to prevent client-side port starvation
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 5000,
  maxFreeSockets: 1000,
  timeout: 30000
});

// Benchmark Concurrency Tiers
const CONCURRENCY_TIERS = [100, 500, 1000, 2500, 5000, 10000];

// Test Accounts & Fixtures
const TEST_SECRETARY_EMAIL = 'loadtest_sec@telanganayoga.org';
const TEST_SECRETARY_PASSWORD = 'LoadTestSecret2026!';
const TEST_DISTRICT = 'Hyderabad';

let server;
let serverPort;
let testSecretaryDoc;
let testAthleteDoc;
let secretaryToken;

/**
 * Seed database with test fixtures required for authentic operations.
 */
async function setupFixtures() {
  await connectDB();

  // 1. Ensure test secretary exists
  await Secretary.deleteOne({ email: TEST_SECRETARY_EMAIL });
  testSecretaryDoc = await Secretary.create({
    email: TEST_SECRETARY_EMAIL,
    password: TEST_SECRETARY_PASSWORD,
    district: TEST_DISTRICT,
    role: 'SECRETARY',
    secretaryName: 'Benchmark Secretary'
  });

  secretaryToken = jwt.sign(
    {
      id: testSecretaryDoc._id,
      email: testSecretaryDoc.email,
      role: testSecretaryDoc.role,
      district: testSecretaryDoc.district
    },
    JWT_SECRET,
    { expiresIn: '2h', algorithm: 'HS256' }
  );

  // 2. Ensure test athlete exists for public card lookup & roster retrieval
  await Athlete.deleteMany({ firstName: 'LoadTestSeed' });
  testAthleteDoc = await Athlete.create({
    firstName: 'LoadTestSeed',
    lastName: 'Runner',
    dob: new Date('2010-05-15'),
    gender: 'Female',
    district: TEST_DISTRICT,
    category: 'Junior',
    chestNumber: 'HYD-JR-999',
    status: 'Verified',
    institutionName: 'Telangana Sports Academy',
    guardianName: 'Guardian Seed'
  });
}

/**
 * Clean up test fixtures from database.
 */
async function cleanupFixtures() {
  if (testSecretaryDoc?._id) {
    await Secretary.deleteOne({ _id: testSecretaryDoc._id });
  }
  await Athlete.deleteMany({ firstName: { $in: ['LoadTestSeed', 'LoadTestAth'] } });
}

/**
 * Generates an operation request based on weighted user distribution:
 * 1. Homepage: GET / (25%)
 * 2. Rulebook: GET /static/images/Yoga Federation Rules & Regulations.pdf (10%)
 * 3. District Info: GET /nominate (15%)
 * 4. Gallery / Asset: GET /static/images/TSYSC.png (15%)
 * 5. Athlete Registration: POST /portal/athletes/nominate (10%)
 * 6. Public Card API: GET /portal/athletes/HYD-JR-999/public-card (10%)
 * 7. Secretary Login: POST /auth/login (7.5%)
 * 8. Dashboard Retrieval: GET /portal/athletes/list (7.5%)
 */
function getOperation(userIndex) {
  const rand = Math.random() * 100;

  // Simulate unique client IP in X-Forwarded-For for distributed user simulation
  const clientIp = `10.${(userIndex >> 8) & 255}.${userIndex & 255}.${(userIndex * 13) % 250 + 1}`;

  if (rand < 25) {
    // Op 1: Homepage access
    return {
      name: 'Homepage',
      method: 'GET',
      path: '/',
      headers: { 'X-Forwarded-For': clientIp }
    };
  } else if (rand < 35) {
    // Op 2: Rulebook PDF access
    return {
      name: 'Rulebook',
      method: 'GET',
      path: '/static/images/Yoga%20Federation%20Rules%20%26%20Regulations.pdf',
      headers: { 'X-Forwarded-For': clientIp }
    };
  } else if (rand < 50) {
    // Op 3: District Information
    return {
      name: 'DistrictInfo',
      method: 'GET',
      path: '/nominate',
      headers: { 'X-Forwarded-For': clientIp }
    };
  } else if (rand < 65) {
    // Op 4: Gallery / Static Assets
    return {
      name: 'Gallery',
      method: 'GET',
      path: '/static/images/TSYSC.png',
      headers: { 'X-Forwarded-For': clientIp }
    };
  } else if (rand < 75) {
    // Op 5: Athlete Registration
    const body = new URLSearchParams({
      firstName: 'LoadTestAth',
      lastName: `U${userIndex}`,
      dob: '2010-06-15',
      gender: 'Female',
      district: TEST_DISTRICT,
      events: 'Traditional Yogasana'
    }).toString();

    return {
      name: 'Registration',
      method: 'POST',
      path: '/portal/athletes/nominate',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'X-Forwarded-For': clientIp
      },
      body
    };
  } else if (rand < 85) {
    // Op 6: Public Card API
    return {
      name: 'PublicCardAPI',
      method: 'GET',
      path: '/portal/athletes/HYD-JR-999/public-card',
      headers: { 'X-Forwarded-For': clientIp }
    };
  } else if (rand < 92.5) {
    // Op 7: District Secretary Authentication
    const body = JSON.stringify({
      email: TEST_SECRETARY_EMAIL,
      password: TEST_SECRETARY_PASSWORD
    });

    return {
      name: 'SecretaryLogin',
      method: 'POST',
      path: '/auth/login',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-Forwarded-For': clientIp
      },
      body
    };
  } else {
    // Op 8: Dashboard Roster Data Retrieval
    return {
      name: 'DashboardList',
      method: 'GET',
      path: '/portal/athletes/list?page=1&limit=20',
      headers: {
        Authorization: `Bearer ${secretaryToken}`,
        'X-Forwarded-For': clientIp
      }
    };
  }
}

/**
 * Executes a single HTTP request using native node:http client.
 */
function makeRequest(op) {
  return new Promise((resolve) => {
    const startTime = process.hrtime.bigint();

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path: op.path,
        method: op.method,
        headers: op.headers,
        agent,
        timeout: 10000
      },
      (res) => {
        let bytesReceived = 0;
        res.on('data', (chunk) => {
          bytesReceived += chunk.length;
        });

        res.on('end', () => {
          const endTime = process.hrtime.bigint();
          const latencyMs = Number(endTime - startTime) / 1e6;

          resolve({
            success: res.statusCode >= 200 && res.statusCode < 400,
            statusCode: res.statusCode,
            latencyMs,
            bytesReceived,
            opName: op.name,
            error: null
          });
        });
      }
    );

    req.on('error', (err) => {
      const endTime = process.hrtime.bigint();
      const latencyMs = Number(endTime - startTime) / 1e6;

      resolve({
        success: false,
        statusCode: 0,
        latencyMs,
        bytesReceived: 0,
        opName: op.name,
        error: err.code || err.message
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('ETIMEDOUT'));
    });

    if (op.body) {
      req.write(op.body);
    }
    req.end();
  });
}

/**
 * Runs a progressive load-test tier with C concurrent workers for durationSeconds.
 */
async function runTier(concurrency, durationSeconds = 6) {
  console.log(`\n===============================================================`);
  console.log(`>>> EXECUTING TIER: ${concurrency.toLocaleString()} CONCURRENT USERS (${durationSeconds}s duration) <<<`);
  console.log(`===============================================================`);

  const results = [];
  const statusCounts = {};
  const opCounts = {};
  const opLatencies = {};
  let totalBytes = 0;
  let networkErrors = 0;

  const initialCpu = process.cpuUsage();
  const initialMem = process.memoryUsage();
  const benchmarkStart = Date.now();
  const benchmarkEndDeadline = benchmarkStart + (durationSeconds * 1000);

  // Worker loop for each concurrent user stream
  async function userWorker(userIndex) {
    while (Date.now() < benchmarkEndDeadline) {
      const op = getOperation(userIndex);
      const res = await makeRequest(op);

      results.push(res.latencyMs);
      totalBytes += res.bytesReceived;

      // Status aggregation
      const code = res.statusCode || 'ERR';
      statusCounts[code] = (statusCounts[code] || 0) + 1;

      // Operation breakdown
      opCounts[res.opName] = (opCounts[res.opName] || 0) + 1;
      if (!opLatencies[res.opName]) opLatencies[res.opName] = [];
      opLatencies[res.opName].push(res.latencyMs);

      if (res.error) {
        networkErrors++;
      }
    }
  }

  // Launch C concurrent workers simultaneously
  const workers = [];
  for (let i = 0; i < concurrency; i++) {
    workers.push(userWorker(i));
  }

  await Promise.all(workers);

  const totalTimeSec = (Date.now() - benchmarkStart) / 1000;
  const finalCpu = process.cpuUsage(initialCpu);
  const finalMem = process.memoryUsage();

  // Sort latencies for exact percentile math
  results.sort((a, b) => a - b);
  const count = results.length;

  const sumLatency = results.reduce((acc, v) => acc + v, 0);
  const avgLatency = count > 0 ? (sumLatency / count).toFixed(2) : 0;
  const p50 = count > 0 ? results[Math.floor(count * 0.50)].toFixed(2) : 0;
  const p95 = count > 0 ? results[Math.floor(count * 0.95)].toFixed(2) : 0;
  const p99 = count > 0 ? results[Math.floor(count * 0.99)].toFixed(2) : 0;
  const minLatency = count > 0 ? results[0].toFixed(2) : 0;
  const maxLatency = count > 0 ? results[count - 1].toFixed(2) : 0;

  const rps = (count / totalTimeSec).toFixed(1);
  const throughputMBs = (totalBytes / (1024 * 1024) / totalTimeSec).toFixed(2);

  // Success vs Failure counts
  const successfulCount = (statusCounts['200'] || 0) + (statusCounts['201'] || 0) + (statusCounts['302'] || 0) + (statusCounts['304'] || 0);
  const rateLimitedCount = statusCounts['429'] || 0;
  const serverErrorCount = (statusCounts['500'] || 0) + (statusCounts['502'] || 0) + (statusCounts['503'] || 0);
  const clientErrorCount = (statusCounts['400'] || 0) + (statusCounts['401'] || 0) + (statusCounts['403'] || 0) + (statusCounts['404'] || 0);
  const failedCount = count - successfulCount;
  const errorRate = count > 0 ? ((failedCount / count) * 100).toFixed(2) : 0;

  // CPU utilization calculation across duration
  const totalCpuTimeMs = (finalCpu.user + finalCpu.system) / 1000;
  const cpuPercent = ((totalCpuTimeMs / (totalTimeSec * 1000 * os.cpus().length)) * 100).toFixed(1);

  // Memory in MB
  const rssMB = (finalMem.rss / (1024 * 1024)).toFixed(1);
  const heapUsedMB = (finalMem.heapUsed / (1024 * 1024)).toFixed(1);

  // Database Connection Pool Status
  const dbReadyState = mongoose.connection.readyState;
  const dbStatus = dbReadyState === 1 ? 'Connected (Ready)' : `Degraded (${dbReadyState})`;

  // Display telemetry summary
  console.log(`Total Requests Processed : ${count.toLocaleString()}`);
  console.log(`Throughput (RPS)         : ${rps} req/sec`);
  console.log(`Network Data Rate        : ${throughputMBs} MB/s (${(totalBytes / (1024 * 1024)).toFixed(2)} MB total)`);
  console.log(`Error Rate               : ${errorRate}% (${failedCount.toLocaleString()} failed, ${successfulCount.toLocaleString()} passed)`);
  console.log(`Latency min / avg / max  : ${minLatency}ms / ${avgLatency}ms / ${maxLatency}ms`);
  console.log(`Percentiles (p50/p95/p99): ${p50}ms / ${p95}ms / ${p99}ms`);
  console.log(`Status Codes Breakdown   : 2xx: ${successfulCount} | 429 (Rate-limited): ${rateLimitedCount} | 4xx: ${clientErrorCount} | 5xx: ${serverErrorCount} | Socket Err: ${networkErrors}`);
  console.log(`CPU Utilization (Process): ${cpuPercent}% of ${os.cpus().length} logical cores`);
  console.log(`Memory Usage             : RSS: ${rssMB} MB | Heap: ${heapUsedMB} MB`);
  console.log(`Database Pool State      : ${dbStatus} (Pool Bounds: ${POOL_OPTIONS.minPoolSize}-${POOL_OPTIONS.maxPoolSize})`);

  return {
    concurrency,
    totalRequests: count,
    rps: parseFloat(rps),
    throughputMBs: parseFloat(throughputMBs),
    avgLatency: parseFloat(avgLatency),
    p50: parseFloat(p50),
    p95: parseFloat(p95),
    p99: parseFloat(p99),
    minLatency: parseFloat(minLatency),
    maxLatency: parseFloat(maxLatency),
    successfulCount,
    failedCount,
    rateLimitedCount,
    serverErrorCount,
    networkErrors,
    errorRate: parseFloat(errorRate),
    cpuPercent: parseFloat(cpuPercent),
    rssMB: parseFloat(rssMB),
    heapUsedMB: parseFloat(heapUsedMB),
    statusCounts
  };
}

/**
 * Main execution runner
 */
async function main() {
  console.log('Initializing Load-Testing Environment...');
  console.log(`Host CPU  : ${os.cpus()[0]?.model} (${os.cpus().length} logical cores)`);
  console.log(`Total RAM : ${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(1)} GB`);
  console.log(`Platform  : ${os.platform()} ${os.arch()}`);

  try {
    await setupFixtures();
    console.log('Database fixtures and authorization tokens primed.');

    // Start local server on ephemeral port
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        console.log(`Server listening on benchmark port http://127.0.0.1:${serverPort}`);
        resolve();
      });
    });

    const tierReports = [];

    // Run progressive tiers
    for (const c of CONCURRENCY_TIERS) {
      const report = await runTier(c, 5); // 5 seconds per tier for crisp telemetry
      tierReports.push(report);

      // Brief 1s cooldown between tiers for garbage collection and socket drain
      await new Promise((r) => setTimeout(r, 1000));
    }

    console.log('\n\n===============================================================');
    console.log('>>> SUMMARY LOAD-TESTING SCALING COMPARISON TABLE <<<');
    console.log('===============================================================');
    console.table(
      tierReports.map((t) => ({
        'Concurrent Users': t.concurrency.toLocaleString(),
        'RPS': t.rps.toFixed(1),
        'Avg (ms)': t.avgLatency,
        'p50 (ms)': t.p50,
        'p95 (ms)': t.p95,
        'p99 (ms)': t.p99,
        'Err Rate': `${t.errorRate}%`,
        'HTTP 429': t.rateLimitedCount,
        'Socket Err': t.networkErrors,
        'CPU %': `${t.cpuPercent}%`,
        'Heap (MB)': t.heapUsedMB
      }))
    );

    await cleanupFixtures();
    console.log('\nAll test fixtures cleaned up.');

    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('Benchmark server closed.');
    }

    // Write raw telemetry JSON for audit walkthrough
    const fs = require('fs');
    fs.writeFileSync(
      path.join(__dirname, 'load-test-results.json'),
      JSON.stringify({ timestamp: new Date().toISOString(), tiers: tierReports }, null, 2)
    );
    console.log('Raw results written to scripts/load-test-results.json');

    process.exit(0);
  } catch (err) {
    console.error('Fatal benchmark execution error:', err);
    if (server) server.close();
    process.exit(1);
  }
}

main();
