/**
 * Part 3: Sections 8 to 10
 * 8. Frontend Architecture & Concepts
 * 9. Backend Architecture & Concepts
 * 10. Database Architecture & Concepts
 */

module.exports = `
<!-- SECTION 8: FRONTEND ARCHITECTURE & CONCEPTS -->
<section id="section-8" class="doc-section">
  <h2>
    <span>8. Frontend Architecture & Concepts</span>
    <span class="badge badge-implemented">CLIENT ENGINE</span>
  </h2>

  <p>
    The portal adopts a lightweight, ultra-performant <strong>Vanilla JavaScript + Modern Semantic HTML5 + Tailwind CSS v4</strong> architecture. By intentionally eschewing heavyweight client frameworks (such as React, Angular, or Vue), the portal achieves sub-second First Contentful Paint (&lt;0.8s) even on low-bandwidth rural mobile networks across Telangana.
  </p>

  <h3>Key Frontend Architectural Decisions</h3>
  <div class="cards-grid">
    <div class="card">
      <div class="card-title">Zero Framework Hydration Overhead</div>
      <p>HTML is served directly from the server. The DOM is fully interactive immediately upon rendering without downloading multi-megabyte JavaScript virtual DOM runtimes.</p>
    </div>
    <div class="card">
      <div class="card-title">Tailwind CSS v4 Standalone Engine</div>
      <p>Compiled via <code>@tailwindcss/cli</code> from <code>static/css/input.css</code> into a production-minified <code>static/css/output.css</code>, eliminating unused styles.</p>
    </div>
    <div class="card">
      <div class="card-title">Event Delegation & Memory Hygiene</div>
      <p>Dynamic lists (athlete tables, school rosters) attach single listeners to parent containers rather than attaching hundreds of individual DOM listeners.</p>
    </div>
    <div class="card">
      <div class="card-title">Print-Media Vector Layouts</div>
      <p>Admit card styles use dedicated CSS <code>@media print</code> rules ensuring pixel-perfect A4 printing with crisp vector barcodes and QR markers.</p>
    </div>
  </div>

  <h3>Resolution of Desktop Navigation Display Bug</h3>
  <div class="callout callout-success">
    <div class="callout-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
      Root Cause & Engineering Rectification
    </div>
    <p>
      An earlier defect caused the mobile hamburger menu icon to remain visible on desktop viewports (&ge;1024px) while hiding the horizontal navigation links.
      This occurred due to Tailwind v4 specificity precedence conflicts when utility classes collided with inline resets.
      The issue was permanently resolved in <code>static/css/custom.css</code>:
    </p>
    <div class="code-container">
      <div class="code-header">
        <span>Desktop Breakpoint Navigation Overrides (static/css/custom.css)</span>
        <button class="btn-copy-code">Copy</button>
      </div>
      <pre><code>@media (min-width: 1024px) {
  /* Enforce horizontal flex layout on desktop viewports */
  .site-nav-desktop {
    display: flex !important;
    visibility: visible !important;
    opacity: 1 !important;
    position: static !important;
  }
  /* Permanently suppress mobile drawer trigger button on desktop */
  #mobileMenuBtn,
  .mobile-menu-trigger {
    display: none !important;
  }
}</code></pre>
    </div>
  </div>
</section>

<!-- SECTION 9: BACKEND ARCHITECTURE & CONCEPTS -->
<section id="section-9" class="doc-section">
  <h2>
    <span>9. Backend Architecture & Concepts</span>
    <span class="badge badge-implemented">EXPRESS 5 CORE</span>
  </h2>

  <p>
    The backend is built upon <strong>Express.js v5.2.1</strong> running on <strong>Node.js v24 LTS</strong>. Express 5 introduces native promise rejection interception, ensuring that unhandled asynchronous rejections automatically propagate to global error middleware without requiring manual <code>try/catch</code> boilerplate on every route.
  </p>

  <h3>HTTP Request Lifecycle & Middleware Pipeline</h3>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Order</th>
          <th>Middleware Component</th>
          <th>File Location</th>
          <th>Security / Architectural Purpose</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>1</td>
          <td><code>app.set('trust proxy', 1)</code></td>
          <td><code>server.js:26</code></td>
          <td>Allows Express to accurately resolve client IP from <code>X-Forwarded-For</code> header behind Nginx/Vercel/Cloudflare proxies.</td>
        </tr>
        <tr>
          <td>2</td>
          <td><code>telemetryMiddleware</code></td>
          <td><code>utils/telemetry.js</code></td>
          <td>Intercepts request timestamps, status codes, and active connection counts to serve live metrics at <code>/_telemetry</code>.</td>
        </tr>
        <tr>
          <td>3</td>
          <td><code>helmet()</code></td>
          <td><code>server.js:45</code></td>
          <td>Injects Content Security Policy (CSP), HSTS (31536000s), Referrer-Policy, and X-Frame-Options to eliminate XSS/Clickjacking.</td>
        </tr>
        <tr>
          <td>4</td>
          <td><code>compression()</code></td>
          <td><code>server.js:79</code></td>
          <td>Applies Gzip/Deflate compression above 1KB threshold. Includes custom filter bypassing pre-compressed <code>.pdf</code> and <code>.webp</code> binaries.</td>
        </tr>
        <tr>
          <td>5</td>
          <td><code>express.json({ limit: '2mb' })</code></td>
          <td><code>server.js:95</code></td>
          <td>Parses JSON payloads while enforcing a strict 2MB ceiling to protect memory from payload-based Denial of Service.</td>
        </tr>
        <tr>
          <td>6</td>
          <td><code>noSqlSanitizer</code></td>
          <td><code>middleware/sanitize.js:36</code></td>
          <td>Recursively strips keys containing <code>$</code> or <code>.</code> from <code>req.body</code>, <code>req.query</code>, and <code>req.params</code>.</td>
        </tr>
        <tr>
          <td>7</td>
          <td><code>originGuard</code></td>
          <td><code>middleware/sanitize.js:64</code></td>
          <td>Verifies host matching on state-changing methods (POST, PATCH, PUT, DELETE) to protect against Cross-Site Request Forgery.</td>
        </tr>
        <tr>
          <td>8</td>
          <td><code>connectDB</code> Connection Guard</td>
          <td><code>server.js:117</code></td>
          <td>Verifies active MongoDB connection state before passing execution to dynamic route handlers.</td>
        </tr>
        <tr>
          <td>9</td>
          <td><code>apiLimiter</code> / <code>publicReadLimiter</code></td>
          <td><code>middleware/auth.js</code></td>
          <td>Applies per-IP sliding window rate limiting. Public read routes receive a higher quota (2,000/15m) than mutations (60/15m).</td>
        </tr>
        <tr>
          <td>10</td>
          <td>Route Handlers</td>
          <td><code>routes/</code></td>
          <td>Executes domain logic, Mongoose queries, file streaming, or payment signature verification.</td>
        </tr>
        <tr>
          <td>11</td>
          <td>Global Error Handler</td>
          <td><code>server.js:219</code></td>
          <td>Catches Multer size limit errors, JSON syntax errors, and unexpected exceptions, returning safe client errors without stack trace leakage.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <h3>Resilient Connection Management for Serverless & Long-Running Hosts</h3>
  <p>
    In <code>config/db.js</code>, the database manager provides promise-cached connection pooling. Under serverless cold starts (Vercel), subsequent function invocations reuse the established <code>cachedPromise</code>, avoiding the fatal <em>Thundering Herd</em> problem where hundreds of concurrent lambdas overwhelm the MongoDB connection limit:
  </p>

  <div class="code-container">
    <div class="code-header">
      <span>Database Connection Manager (config/db.js)</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>const POOL_OPTIONS = {
  maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE, 10) || 50,
  minPoolSize: parseInt(process.env.DB_MIN_POOL_SIZE, 10) || 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  waitQueueTimeoutMS: 10000,
  family: 4 // Force IPv4 for fast DNS resolution
};

let isConnected = false;
let cachedPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }
  if (cachedPromise) return cachedPromise;

  cachedPromise = mongoose.connect(MONGO_URI, POOL_OPTIONS)
    .then((conn) => {
      isConnected = true;
      return conn;
    })
    .catch((err) => {
      cachedPromise = null;
      isConnected = false;
      throw err;
    });

  return cachedPromise;
}</code></pre>
  </div>
</section>

<!-- SECTION 10: DATABASE ARCHITECTURE & CONCEPTS -->
<section id="section-10" class="doc-section">
  <h2>
    <span>10. Database Architecture & Concepts</span>
    <span class="badge badge-implemented">MONGODB SCHEMAS & INDEXES</span>
  </h2>

  <p>
    The persistence layer utilizes <strong>MongoDB Atlas</strong> with <strong>Mongoose v9.9.3</strong>. The schema architecture is designed for high read concurrency, strict validation, zero bib collision, and high-speed district-scoped filtering.
  </p>

  <h3>10.1 Athlete Model (<code>models/Athlete.js</code>)</h3>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Field Name</th>
          <th>BSON Type</th>
          <th>Validation / Constraints</th>
          <th>Default</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>firstName</code></td>
          <td>String</td>
          <td>Required, Trim, Max 80 chars</td>
          <td>-</td>
          <td>Athlete given name</td>
        </tr>
        <tr>
          <td><code>lastName</code></td>
          <td>String</td>
          <td>Trim, Max 80 chars</td>
          <td><code>''</code></td>
          <td>Athlete family / surname</td>
        </tr>
        <tr>
          <td><code>dob</code></td>
          <td>Date</td>
          <td>Required, Age 5 to 100</td>
          <td>-</td>
          <td>Date of birth used for category calculation</td>
        </tr>
        <tr>
          <td><code>gender</code></td>
          <td>String</td>
          <td>Enum: <code>['Male', 'Female', 'Other']</code></td>
          <td>-</td>
          <td>Competition gender classification</td>
        </tr>
        <tr>
          <td><code>aadhaarLast4</code></td>
          <td>String</td>
          <td>Exactly 4 numeric digits</td>
          <td><code>'0000'</code></td>
          <td>Privacy-preserving partial national identity token</td>
        </tr>
        <tr>
          <td><code>district</code></td>
          <td>String</td>
          <td>Validated against 33 official districts</td>
          <td><code>'Hyderabad'</code></td>
          <td>Administrative district residency</td>
        </tr>
        <tr>
          <td><code>events</code></td>
          <td>Array of Strings</td>
          <td>Array length 1 to 10</td>
          <td><code>['Traditional Yogasana']</code></td>
          <td>Nominated competition disciplines</td>
        </tr>
        <tr>
          <td><code>category</code></td>
          <td>String</td>
          <td>Enum: <code>Sub-Junior</code>, <code>Junior</code>, <code>Senior</code></td>
          <td><code>'Junior'</code></td>
          <td>Computed regulatory age category</td>
        </tr>
        <tr>
          <td><code>status</code></td>
          <td>String</td>
          <td>Enum: <code>Submitted</code>, <code>Verified</code>, <code>Clarification</code>, <code>Pending</code></td>
          <td><code>'Submitted'</code></td>
          <td>Scrutiny and verification lifecycle state</td>
        </tr>
        <tr>
          <td><code>chestNumber</code></td>
          <td>String</td>
          <td>Format: <code>[DIST]-[CAT]-[SEQ]</code></td>
          <td>-</td>
          <td>Collision-free competition bib identifier</td>
        </tr>
        <tr>
          <td><code>photoPath</code></td>
          <td>String</td>
          <td>Safe sanitized upload path</td>
          <td><code>''</code></td>
          <td>Passport photo URI (<code>/uploads/uuid.webp</code>)</td>
        </tr>
        <tr>
          <td><code>dobProofPath</code></td>
          <td>String</td>
          <td>Safe sanitized upload path</td>
          <td><code>''</code></td>
          <td>Birth certificate / bonafide document URI</td>
        </tr>
        <tr>
          <td><code>paymentDetails</code></td>
          <td>Object</td>
          <td>Embedded subdocument</td>
          <td>-</td>
          <td>Contains <code>orderId</code>, <code>paymentId</code>, <code>amount</code>, <code>status</code>, <code>paidAt</code></td>
        </tr>
      </tbody>
    </table>
  </div>

  <h3>10.2 Index Strategy & Query Performance</h3>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Index Specification</th>
          <th>Target Query Pattern</th>
          <th>Performance Impact</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>{ chestNumber: 1 }</code></td>
          <td>Public admit card lookups and on-field QR scanning</td>
          <td>Transforms $O(N)$ full collection scan into $O(\log N)$ B-tree point lookup (&lt;1ms execution).</td>
        </tr>
        <tr>
          <td><code>{ district: 1, createdAt: -1 }</code></td>
          <td>District Secretary dashboard athlete roster listing</td>
          <td>Enables compound index scan covering both district partition and reverse chronological sorting.</td>
        </tr>
        <tr>
          <td><code>{ district: 1, status: 1, createdAt: -1 }</code></td>
          <td>Status-filtered scrutiny queries (e.g. all 'Pending' athletes in Khammam)</td>
          <td>Completely covers index-only filter execution, eliminating memory sort operations.</td>
        </tr>
        <tr>
          <td><code>{ district: 1, category: 1 }</code></td>
          <td>Category aggregate counts and counter baseline initialization</td>
          <td>Accelerates baseline count synchronization during server startup.</td>
        </tr>
        <tr>
          <td><code>{ createdAt: -1 }</code></td>
          <td>Super Admin statewide chronological listing</td>
          <td>Supports statewide paginated oversight without sorting in RAM.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <h3>10.3 Secretary Model (<code>models/Secretary.js</code>)</h3>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>Type</th>
          <th>Attributes</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>email</code></td>
          <td>String</td>
          <td>Unique, Lowercase, Trim, Required</td>
          <td>Official administrative login identifier</td>
        </tr>
        <tr>
          <td><code>password</code></td>
          <td>String</td>
          <td>Bcrypt hash (Salt factor 10)</td>
          <td>Hashed credential via pre-save hook</td>
        </tr>
        <tr>
          <td><code>district</code></td>
          <td>String</td>
          <td>One of 33 districts or 'ALL_DISTRICTS'</td>
          <td>Authorized district administrative scope</td>
        </tr>
        <tr>
          <td><code>role</code></td>
          <td>String</td>
          <td>Enum: <code>['SECRETARY', 'SUPER_ADMIN']</code></td>
          <td>Access control role designation</td>
        </tr>
      </tbody>
    </table>
  </div>

  <h3>10.4 Counter Model & Atomic Concurrency Engine (<code>models/Counter.js</code>)</h3>
  <p>
    To eliminate race conditions when dozens of athletes register simultaneously, the portal uses a dedicated <strong>Atomic Sequence Counter</strong> pattern:
  </p>
  <div class="code-container">
    <div class="code-header">
      <span>Atomic Sequence Counter Implementation (utils/counter.js)</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>// Atomic single-record increment
async function getNextChestNumber(district, category) {
  const counterId = getCounterId(district, category); // e.g. "chest_hyderabad_junior"
  await syncCounterBaseline(counterId, district, category);

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );

  return formatChestNumber(district, category, counter.seq); // e.g. "HYD-JR-01"
}

// Atomic batch allocation for bulk school registrations
async function getNextChestNumbersBatch(district, category, count) {
  const counterId = getCounterId(district, category);
  await syncCounterBaseline(counterId, district, category);

  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: count } },
    { returnDocument: 'after', upsert: true }
  );

  const startSeq = counter.seq - count + 1;
  const chestNumbers = [];
  for (let i = 0; i < count; i++) {
    chestNumbers.push(formatChestNumber(district, category, startSeq + i));
  }
  return chestNumbers;
}</code></pre>
  </div>
</section>
`;
