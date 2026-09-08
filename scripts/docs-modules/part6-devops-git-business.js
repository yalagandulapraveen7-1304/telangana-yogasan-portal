/**
 * Part 6: Sections 18 to 22
 * 18. SEO, Social Sharing & Public Discoverability
 * 19. DevOps, Infrastructure & Deployment Architecture
 * 20. Git & GitHub Workflow & Repository Hygiene
 * 21. Complete Folder Structure & Key Files
 * 22. Complete Business Logic Implementation
 */

module.exports = `
<!-- SECTION 18: SEO, SOCIAL SHARING & PUBLIC DISCOVERABILITY -->
<section id="section-18" class="doc-section">
  <h2>
    <span>18. SEO, Social Sharing & Public Discoverability</span>
    <span class="badge badge-implemented">OPENGRAPH & METADATA</span>
  </h2>

  <p>
    The public portal templates incorporate high-fidelity OpenGraph and Twitter Card metadata to ensure attractive link unfurling across WhatsApp, Telegram, Twitter, and Facebook when sports associations and schools share championship circulars.
  </p>

  <div class="code-container">
    <div class="code-header">
      <span>SEO & Social Sharing Tags (templates/index.html)</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>&lt;!-- Primary Meta Tags --&gt;
&lt;title&gt;Telangana State Inter-District Yogasana Sports Championship 2026&lt;/title&gt;
&lt;meta name="description" content="Official athlete nomination portal for the Telangana State Inter-District Yogasana Sports Championship. Register individual athletes and school delegations across 33 districts."&gt;
&lt;meta name="keywords" content="Telangana Yogasana, Yoga Championship, SATS, YFI, Athlete Registration, Admit Card"&gt;

&lt;!-- OpenGraph / Facebook / WhatsApp --&gt;
&lt;meta property="og:type" content="website"&gt;
&lt;meta property="og:url" content="https://telanganayogasana.org/"&gt;
&lt;meta property="og:title" content="Telangana State Inter-District Yogasana Championship 2026"&gt;
&lt;meta property="og:description" content="Enroll now for the official state yoga championship. 33 districts, official certificates, and national qualifiers."&gt;
&lt;meta property="og:image" content="https://telanganayogasana.org/static/images/hero-yoga.webp"&gt;

&lt;!-- Twitter Card --&gt;
&lt;meta name="twitter:card" content="summary_large_image"&gt;
&lt;meta name="twitter:title" content="Telangana Yogasana State Championship"&gt;
&lt;meta name="twitter:description" content="Official athlete nomination and admit card portal."&gt;
&lt;meta name="twitter:image" content="https://telanganayogasana.org/static/images/hero-yoga.webp"&gt;</code></pre>
  </div>
</section>

<!-- SECTION 19: DEVOPS, INFRASTRUCTURE & DEPLOYMENT ARCHITECTURE -->
<section id="section-19" class="doc-section">
  <h2>
    <span>19. DevOps, Infrastructure & Deployment Architecture</span>
    <span class="badge badge-implemented">VERCEL & DOCKER READY</span>
  </h2>

  <p>
    The codebase supports dual-runtime deployment: <strong>Serverless execution on Vercel</strong> for zero-maintenance auto-scaling, and <strong>Persistent Node.js containerization</strong> for high-volume dedicated on-premise deployments.
  </p>

  <h3>19.1 Vercel Serverless Architecture (<code>vercel.json</code>)</h3>
  <div class="code-container">
    <div class="code-header">
      <span>Vercel Configuration (vercel.json)</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>{
  "version": 2,
  "builds": [
    {
      "src": "server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server.js"
    }
  ]
}</code></pre>
  </div>
  <p>
    In serverless environments, <code>process.env.VERCEL</code> is automatically detected. The storage service (<code>services/storage.js</code>) dynamically pivots from local disk to <code>os.tmpdir()</code>, and <code>server.js</code> skips <code>app.listen()</code>, exporting the raw Express app instance to the Vercel AWS Lambda handler.
  </p>

  <h3>19.2 Recommended Dedicated Container Deployment (Docker & PM2)</h3>
  <div class="code-container">
    <div class="code-header">
      <span>Production Ecosystem Configuration (ecosystem.config.js)</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>module.exports = {
  apps: [{
    name: 'yogasana-portal',
    script: './server.js',
    instances: 'max',       // Cluster mode: spawns 1 worker per CPU core
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      DB_MAX_POOL_SIZE: 50
    },
    max_memory_restart: '1G'
  }]
};</code></pre>
  </div>

  <h3>19.3 Environment Variable Configuration Audit</h3>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Variable Name</th>
          <th>Required</th>
          <th>Sample Value</th>
          <th>Purpose & Security Impact</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>PORT</code></td>
          <td>Optional</td>
          <td><code>5000</code></td>
          <td>HTTP listening port for persistent server processes.</td>
        </tr>
        <tr>
          <td><code>NODE_ENV</code></td>
          <td>Recommended</td>
          <td><code>production</code></td>
          <td>Enables HSTS, secure cookies, and optimized Express view caches.</td>
        </tr>
        <tr>
          <td><code>MONGO_URI</code></td>
          <td><strong>Required</strong></td>
          <td><code>mongodb+srv://user:pass@cluster.mongodb.net/yoga</code></td>
          <td>MongoDB Atlas connection string with connection pool parameters.</td>
        </tr>
        <tr>
          <td><code>JWT_SECRET</code></td>
          <td><strong>Required</strong></td>
          <td><code>64-character-hex-string</code></td>
          <td>Cryptographic signing key for HS256 authentication tokens.</td>
        </tr>
        <tr>
          <td><code>RAZORPAY_KEY_ID</code></td>
          <td><strong>Required</strong></td>
          <td><code>rzp_live_XXXXXXXXXX</code></td>
          <td>Public client key for Razorpay checkout integration.</td>
        </tr>
        <tr>
          <td><code>RAZORPAY_KEY_SECRET</code></td>
          <td><strong>Required</strong></td>
          <td><code>YYYYYYYYYYYYYYYYYYYY</code></td>
          <td>Secret key for server HMAC-SHA256 signature verification.</td>
        </tr>
      </tbody>
    </table>
  </div>
</section>

<!-- SECTION 20: GIT & GITHUB WORKFLOW & REPOSITORY HYGIENE -->
<section id="section-20" class="doc-section">
  <h2>
    <span>20. Git & GitHub Workflow & Repository Hygiene</span>
    <span class="badge badge-implemented">GITHUB MASTERED</span>
  </h2>

  <p>
    The project is version-controlled on GitHub at:
    <br>
    <a href="https://github.com/yalagandulapraveen7-1304/telangana-yogasan-portal.git" target="_blank" style="color: var(--accent-cyan); font-family: var(--font-mono);">https://github.com/yalagandulapraveen7-1304/telangana-yogasan-portal.git</a>
  </p>

  <h3>Repository Hygiene & Security Protections</h3>
  <ul>
    <li><strong>Zero Secret Leaks</strong>: <code>.env</code> and <code>.env.local</code> are strictly excluded via <code>.gitignore</code>. A comprehensive template is maintained in <code>.env.example</code>.</li>
    <li><strong>Build Script Integration</strong>: <code>package.json</code> defines <code>"build": "node scripts/build.js"</code> and <code>"vercel-build": "node scripts/build.js"</code> ensuring CSS compilation runs automatically on every deployment.</li>
    <li><strong>Conventional Commit Discipline</strong>: Commits follow standard conventional prefixes (<code>feat:</code>, <code>fix:</code>, <code>perf:</code>, <code>test:</code>, <code>docs:</code>).</li>
    <li><strong>SSL Certificate Isolation</strong>: Local testing SSL keys (<code>localhost+2-key.pem</code>) are ignored from production bundles.</li>
  </ul>
</section>

<!-- SECTION 21: COMPLETE FOLDER STRUCTURE & KEY FILES -->
<section id="section-21" class="doc-section">
  <h2>
    <span>21. Complete Folder Structure & Key Files</span>
    <span class="badge badge-implemented">ANNOTATED TREE</span>
  </h2>

  <div class="code-container">
    <div class="code-header">
      <span>Project Directory Hierarchy</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>yogasana-portal/
├── .env.example                # Template for production environment variables
├── .gitignore                  # Git exclusions (node_modules, .env, uploads)
├── README.md                   # Project summary, setup instructions, scripts guide
├── package.json                # Project dependencies, scripts, engines definition
├── server.js                   # Main application entry point & Express pipeline
├── vercel.json                 # Vercel serverless deployment specification
│
├── config/                     # Configuration & Infrastructure Layer
│   ├── constants.js            # Business constants, districts, event fees
│   ├── db.js                   # Mongoose connection pooling & caching
│   └── env.js                  # Environment variable schema validation
│
├── middleware/                 # Interceptors & Security Pipeline
│   ├── auth.js                 # JWT verification (HS256) & sliding-window rate limiters
│   ├── sanitize.js             # Recursive NoSQL sanitizer & CSRF origin guard
│   └── upload.js               # Multer multipart file upload handler
│
├── models/                     # Data Domain Entities (Mongoose Schemas)
│   ├── Athlete.js              # Nominated athletes, categories, statuses, compound indexes
│   ├── Counter.js              # Atomic sequence generator for collision-free bibs
│   ├── LoginLog.js             # Security audit log capturing IP and user agent
│   └── Secretary.js            # District secretary credentials, roles, bcrypt hashing
│
├── routes/                     # API Controllers & Route Handlers
│   ├── auth.js                 # Login, logout, audit log endpoints
│   └── nominate.js             # Athlete nomination, bulk school submission, admit card cache
│
├── services/                   # Domain & Infrastructure Services
│   └── storage.js              # Path-traversal-safe file storage provider
│
├── utils/                      # Pure Business Functions & Utility Helpers
│   ├── category.js             # Regulatory age calculation & chest number formatting
│   ├── counter.js              # Concurrency-safe atomic increment engine
│   ├── payment.js              # Razorpay order generator & HMAC SHA-256 validator
│   ├── telemetry.js            # Active request and latency diagnostic tracker
│   └── validators.js           # Strict regex validators for phone, Aadhaar, dates
│
├── templates/                  # Server-Rendered Semantic HTML Templates
│   ├── index.html              # Championship public homepage & schedule
│   ├── nominate.html           # Individual athlete registration & payment
│   ├── school-nominate.html    # Bulk institutional school delegation portal
│   ├── admitcard.html          # Public admit card search & print hall ticket
│   ├── login.html              # District secretary & admin login
│   └── dashboard.html          # Protected district athlete management console
│
├── static/                     # Static Web Assets (Max-Age: 30d Caching)
│   ├── css/                    # Tailwind source (input.css) & compiled output (output.css)
│   ├── js/                     # Client scripts (main.dev.js, minified production JS)
│   ├── images/                 # Association logos, hero photography, favicon.ico
│   └── documents/              # Official 2026 Championship Rulebook PDF
│
├── scripts/                    # Automation & Benchmarking Tools
│   ├── benchmark-suite.js      # 100 to 10k concurrent user load-testing harness
│   └── build.js                # Tailwind CSS compilation & asset bundling
│
├── tests/                      # Comprehensive 214 Automated Tests Suite
│   ├── unit/                   # Algorithmic validators, category calculations
│   ├── integration/            # Multi-endpoint nomination & auth flows
│   ├── security/               # NoSQL injection, ReDoS, IDOR, brute-force defenses
│   └── e2e/                    # Full browser-equivalent workflow validations
│
└── docs/                       # Standalone System Architecture Documentation
    └── architecture-documentation.html # This interactive master documentation file</code></pre>
  </div>
</section>

<!-- SECTION 22: COMPLETE BUSINESS LOGIC IMPLEMENTATION -->
<section id="section-22" class="doc-section">
  <h2>
    <span>22. Complete Business Logic Implementation</span>
    <span class="badge badge-implemented">15+ REGULATORY RULES</span>
  </h2>

  <p>
    The championship rules are implemented in strict accordance with the Yoga Federation of India competition code:
  </p>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Rule ID</th>
          <th>Business Specification</th>
          <th>Implementation Code</th>
          <th>Enforcement Location</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>BR-01</strong></td>
          <td>Age calculation cutoff is strictly December 31 of current championship year.</td>
          <td><code>const refDate = new Date(today.getFullYear(), 11, 31); const age = (refDate - dob) / 365.25;</code></td>
          <td><code>utils/category.js:18</code></td>
        </tr>
        <tr>
          <td><strong>BR-02</strong></td>
          <td>Sub-Junior category: Age &ge; 8 and &lt; 14 years.</td>
          <td><code>if (age &gt;= 8 && age &lt; 14) return 'Sub-Junior';</code></td>
          <td><code>utils/category.js:21</code></td>
        </tr>
        <tr>
          <td><strong>BR-03</strong></td>
          <td>Junior category: Age &ge; 14 and &lt; 18 years.</td>
          <td><code>if (age &gt;= 14 && age &lt; 18) return 'Junior';</code></td>
          <td><code>utils/category.js:22</code></td>
        </tr>
        <tr>
          <td><strong>BR-04</strong></td>
          <td>Senior category: Age &ge; 18 years.</td>
          <td><code>if (age &gt;= 18) return 'Senior';</code></td>
          <td><code>utils/category.js:23</code></td>
        </tr>
        <tr>
          <td><strong>BR-05</strong></td>
          <td>Registration fee is strictly ₹260 per event.</td>
          <td><code>const FEE_PER_EVENT = 260; const total = count * FEE_PER_EVENT;</code></td>
          <td><code>config/constants.js:12</code></td>
        </tr>
        <tr>
          <td><strong>BR-06</strong></td>
          <td>Athlete can select at most 10 events.</td>
          <td><code>if (events.length &gt; 10) return false;</code></td>
          <td><code>utils/validators.js:108</code></td>
        </tr>
        <tr>
          <td><strong>BR-07</strong></td>
          <td>School delegation is capped at 50 students per submission.</td>
          <td><code>if (studentsData.length &gt; 50) return res.status(400)...</code></td>
          <td><code>routes/nominate.js:588</code></td>
        </tr>
        <tr>
          <td><strong>BR-08</strong></td>
          <td>Chest numbers follow strict convention: <code>[DIST]-[CAT]-[SERIAL]</code>.</td>
          <td><code>formatChestNumber(dist, cat, seq) =&gt; 'HYD-JR-01'</code></td>
          <td><code>utils/category.js:48</code></td>
        </tr>
        <tr>
          <td><strong>BR-09</strong></td>
          <td>Aadhaar numbers must be 4 digits numeric token (privacy protection).</td>
          <td><code>/^[0-9]{4}$/.test(aadhaar)</code></td>
          <td><code>utils/validators.js:42</code></td>
        </tr>
        <tr>
          <td><strong>BR-10</strong></td>
          <td>Mobile numbers must be valid 10-digit Indian numbers starting with 6, 7, 8, 9.</td>
          <td><code>/^[6-9]\\d{9}$/.test(phone)</code></td>
          <td><code>utils/validators.js:32</code></td>
        </tr>
        <tr>
          <td><strong>BR-11</strong></td>
          <td>Districts must match one of the 33 official administrative districts of Telangana.</td>
          <td><code>TELANGANA_DISTRICTS.includes(normalized)</code></td>
          <td><code>config/constants.js:19</code></td>
        </tr>
        <tr>
          <td><strong>BR-12</strong></td>
          <td>Nomination scrutiny statuses are strictly bounded to an enum.</td>
          <td><code>['Submitted', 'Verified', 'Clarification', 'Pending']</code></td>
          <td><code>models/Athlete.js:24</code></td>
        </tr>
      </tbody>
    </table>
  </div>
</section>
`;
