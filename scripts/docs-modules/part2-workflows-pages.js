/**
 * Part 2: Sections 5 to 7
 * 5. User Workflows
 * 6. District Association Login & Authentication Workflow
 * 7. Page-by-Page Technical Breakdown
 */

module.exports = `
<!-- SECTION 5: USER WORKFLOWS -->
<section id="section-5" class="doc-section">
  <h2>
    <span>5. User Workflows</span>
    <span class="badge badge-implemented">END-TO-END SPECIFICATION</span>
  </h2>

  <p>
    The system orchestrates five distinct end-to-end workflows tailored to specific stakeholder responsibilities, security boundaries, and operational requirements.
  </p>

  <h3>Workflow 1: Individual Athlete Registration & Payment</h3>
  <ol>
    <li><strong>Portal Access</strong>: Athlete visits <code>/nominate.html</code> via browser or mobile device.</li>
    <li><strong>Form Population</strong>: Enters personal details (First Name, Last Name, Date of Birth, Gender, 4-digit Aadhaar, Mobile Number, Guardian Name, Residential Address, Institution).</li>
    <li><strong>Dynamic Client Categorization</strong>: As DOB is entered, client-side JS calculates age as of Dec 31 and updates the Category indicator (Sub-Junior, Junior, Senior) in real-time.</li>
    <li><strong>Event Selection & Fee Calculation</strong>: User checks one or more competition disciplines (e.g. Traditional Yogasana, Artistic Single, Artistic Pair, Rhythmic Pair, Free Flow Dance). Client computes fee: <code>events.length * ₹260</code>.</li>
    <li><strong>Proof Uploads</strong>: User attaches passport-size photo and DOB proof (Birth Certificate / Aadhaar / School Bonafide). Client performs pre-flight validation (MIME type and 5MB size limit).</li>
    <li><strong>Order Initialization</strong>: Client dispatches <code>POST /portal/athletes/create-order</code> with the selected events array. Backend validates events and returns an authentic Razorpay order object (<code>order_id</code>, <code>amount</code>).</li>
    <li><strong>Payment Checkout Modal</strong>: Client invokes Razorpay checkout modal. The athlete completes payment via UPI, Credit/Debit Card, or Net Banking.</li>
    <li><strong>Submission & Verification</strong>: Upon payment success, the client bundles form fields, uploaded files, and Razorpay payment parameters (<code>order_id</code>, <code>payment_id</code>, <code>signature</code>) into <code>multipart/form-data</code> and sends <code>POST /portal/athletes/nominate</code>.</li>
    <li><strong>Server Processing & Chest Number Generation</strong>:
      <ul>
        <li>Server verifies HMAC-SHA256 signature against <code>RAZORPAY_KEY_SECRET</code>.</li>
        <li>Sanitizes text and validates all fields against strict bounds.</li>
        <li>Invokes <code>getNextChestNumber(district, category)</code> to atomically increment the counter.</li>
        <li>Persists the new <code>Athlete</code> document with status <code>'Submitted'</code>.</li>
      </ul>
    </li>
    <li><strong>Confirmation & Admit Card Link</strong>: Server returns HTTP 201 with athlete record and assigned chest number. Client displays success banner with direct link to download the Admit Card.</li>
  </ol>

  <h3>Workflow 2: School / Institution Delegation Bulk Registration</h3>
  <ol>
    <li><strong>Access</strong>: Physical Education Director visits <code>/school-nominate.html</code>.</li>
    <li><strong>Institution Metadata</strong>: Enters School Name, Coach/Representative Name, Coach Contact Number, and District.</li>
    <li><strong>Delegation Builder</strong>: Dynamically adds up to 50 student athletes in a tabular interface. Each row captures Name, DOB, Gender, Aadhaar Last-4, Events, and file upload fields.</li>
    <li><strong>Submission</strong>: Client sends <code>POST /portal/athletes/bulk-nominate</code> with multipart payload containing the students array and indexed files.</li>
    <li><strong>Batch Atomic Numbering</strong>: Server executes <code>getNextChestNumbersBatch(district, category, count)</code> reserving sequential chest numbers in a single atomic database round-trip.</li>
    <li><strong>Mass Ingestion</strong>: Server bulk-inserts documents via <code>Athlete.insertMany()</code>, returning HTTP 201 with summary counts and athlete IDs.</li>
  </ol>

  <h3>Workflow 3: District Secretary Scrutiny & Verification</h3>
  <ol>
    <li><strong>Authentication</strong>: District Secretary logs in at <code>/login.html</code>.</li>
    <li><strong>Dashboard Loading</strong>: Browser transitions to <code>/dashboard.html</code>. Client requests <code>GET /portal/athletes/list</code>.</li>
    <li><strong>District Scoping</strong>: Server middleware extracts JWT, validates district (e.g. <code>'Warangal'</code>), and automatically appends <code>{ district: 'Warangal' }</code> to the MongoDB query filter.</li>
    <li><strong>Document Scrutiny</strong>: Secretary clicks an athlete to inspect uploaded birth certificates and photo documents served through <code>/uploads/:filename</code>.</li>
    <li><strong>Status Transition</strong>: Secretary changes status to <code>'Verified'</code> or <code>'Clarification'</code> with mandatory remarks. Dispatches <code>PATCH /portal/athletes/:id/status</code>.</li>
    <li><strong>Cache Invalidation</strong>: Backend mutates the document and immediately purges the corresponding cache keys from <code>admitCardCache</code>.</li>
  </ol>

  <h3>Workflow 4: Public Admit Card & Certificate Verification</h3>
  <ol>
    <li><strong>Public Query</strong>: Competitor or arena marshal navigates to <code>/admitcard.html?id=HYD-JR-01</code> or scans the QR code printed on the physical admit card.</li>
    <li><strong>Cache Interception</strong>: Server checks <code>admitCardCache.get(key)</code>. On cache hit, delivers cached JSON payload in &lt;5ms with <code>X-Cache: HIT</code> header.</li>
    <li><strong>Database Fallback</strong>: On cache miss, performs lean indexed query (<code>chestNumber</code> or <code>_id</code>), populates cache, and responds with <code>X-Cache: MISS</code>.</li>
    <li><strong>Client Rendering</strong>: Client displays official association badge, athlete photo, chest number, event schedule, rules, and printable barcode/QR matrix.</li>
  </ol>

  <h3>Workflow 5: Super Administrator Governance</h3>
  <ol>
    <li><strong>Statewide Roster Inspection</strong>: Super Admin token provides <code>role: 'SUPER_ADMIN'</code> and <code>district: 'ALL_DISTRICTS'</code>, bypassing district filters to aggregate statewide analytics across all 33 districts.</li>
    <li><strong>Security Audit Log Review</strong>: Admin accesses <code>GET /auth/logs</code> to audit failed and successful login attempts with client IP addresses and user agents.</li>
  </ol>
</section>

<!-- SECTION 6: DISTRICT ASSOCIATION LOGIN & AUTHENTICATION WORKFLOW -->
<section id="section-6" class="doc-section">
  <h2>
    <span>6. District Association Login & Authentication Workflow</span>
    <span class="badge badge-implemented">SECURITY ARCHITECTURE</span>
  </h2>

  <p>
    Authentication in the portal is hardened against credential stuffing, brute force attacks, timing attacks, prototype pollution, and password-based Denial of Service.
  </p>

  <div class="code-container">
    <div class="code-header">
      <span>Authentication Request Lifecycle (POST /auth/login)</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>Client Credentials (email, password)
   |
   v
[1. express-rate-limit: loginLimiter]
   --> Max 10 attempts per 15 minutes per IP. Exceeding triggers HTTP 429.
   |
   v
[2. Parameter Whitelist & Type Guard]
   --> Only 'email' and 'password' allowed. Rejects unexpected keys.
   --> Verifies typeof email === 'string' && typeof password === 'string'.
   |
   v
[3. Input Normalization & ReDoS Defense]
   --> Strips HTML tags, converts email to lowercase, trims whitespace.
   --> Strict regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/
   |
   v
[4. Bcrypt DoS Protection]
   --> Enforces password.length <= 128 characters (mitigating CPU exhaustion).
   |
   v
[5. Database Lookup & Password Comparison]
   --> Secretary.findOne({ email: cleanEmail })
   --> bcrypt.compare(password, user.password) using constant-time hashing.
   |
   v
[6. Security Audit Trail (LoginLog)]
   --> Logs email, district, role, clientIp (via x-forwarded-for), userAgent,
       and status ('SUCCESS' | 'FAILED') to MongoDB collection 'loginlogs'.
   |
   v
[7. JWT Token Generation (HS256)]
   --> Signs payload: { id, email, role, district } with JWT_SECRET.
   --> Algorithm pinned explicitly to 'HS256'; expiresIn: '1d'.
   |
   v
[8. Secure Cookie & Response Dispatch]
   --> Sets cookie 'token': HttpOnly=true, Secure=(NODE_ENV==='production'),
       SameSite='strict', path='/', maxAge=24h.
   --> Returns JSON { success: true, token, district, role, secretaryName }.</code></pre>
  </div>

  <div class="callout callout-warning">
    <div class="callout-title">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      Cryptographic Algorithm Pinning
    </div>
    <p>
      In <code>middleware/auth.js</code>, <code>jwt.verify()</code> explicitly pins the allowed algorithms to <code>['HS256']</code>:
      <code>jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] })</code>.
      This eliminates Algorithm Confusion Attacks (e.g. forging tokens using public keys with an <code>'none'</code> or <code>'RS256'</code> algorithm header).
    </p>
  </div>
</section>

<!-- SECTION 7: PAGE-BY-PAGE TECHNICAL BREAKDOWN -->
<section id="section-7" class="doc-section">
  <h2>
    <span>7. Page-by-Page Technical Breakdown</span>
    <span class="badge badge-implemented">FULL TEMPLATE AUDIT</span>
  </h2>

  <p>
    Below is the comprehensive technical breakdown of every template and web interface implemented in the portal, followed by proposed extensions for version 2.
  </p>

  <!-- Page 1: index.html -->
  <h3>7.1 Landing & Public Information Portal (<code>templates/index.html</code>)</h3>
  <div class="table-wrapper">
    <table>
      <tbody>
        <tr>
          <th style="width: 20%;">Route URLs</th>
          <td><code>/</code>, <code>/index</code>, <code>/index.html</code></td>
        </tr>
        <tr>
          <th>Access Level</th>
          <td>Public (Unrestricted)</td>
        </tr>
        <tr>
          <th>Core Purpose</th>
          <td>Championship announcement, competition regulations, age division guidelines, schedule milestones, district association directory, and primary navigation hub.</td>
        </tr>
        <tr>
          <th>DOM & Semantic Layout</th>
          <td>Header with accessible branding and mobile drawer; Hero section with CTA buttons; Regulatory age table; 33 District showcase grid; Rulebook download card; Accessible footer.</td>
        </tr>
        <tr>
          <th>Client JS & Interactivity</th>
          <td>Mobile navigation drawer toggling (with ARIA expanded states); Smooth scroll anchor navigation; Dynamic year injection; Rulebook PDF streaming link.</td>
        </tr>
        <tr>
          <th>Accessibility Highlights</th>
          <td>Skip navigation link (<code>#main-content</code>); Native landmark tags (<code>&lt;header&gt;</code>, <code>&lt;nav&gt;</code>, <code>&lt;main&gt;</code>, <code>&lt;footer&gt;</code>); Explicit touch targets (&gt;44px); Desktop navigation visible fix (<code>.site-nav-desktop</code>).</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Page 2: nominate.html -->
  <h3>7.2 Athlete Self-Nomination & Checkout (<code>templates/nominate.html</code>)</h3>
  <div class="table-wrapper">
    <table>
      <tbody>
        <tr>
          <th style="width: 20%;">Route URLs</th>
          <td><code>/nominate</code>, <code>/nominate.html</code></td>
        </tr>
        <tr>
          <th>Access Level</th>
          <td>Public (with optional secretary session inheritance)</td>
        </tr>
        <tr>
          <th>Core Purpose</th>
          <td>Single athlete registration portal with instant age validation, event multi-selection, file attachment, and Razorpay checkout modal execution.</td>
        </tr>
        <tr>
          <th>DOM & Semantic Layout</th>
          <td>Multi-section accessible form; Personal identification block; District dropdown (33 districts); Event checkboxes; File input drops; Dynamic fee calculator badge; Razorpay modal host.</td>
        </tr>
        <tr>
          <th>Client JS Logic</th>
          <td>
            <ul>
              <li><strong>DOB Listener</strong>: Calculates exact regulatory age category on date input change.</li>
              <li><strong>Event Listener</strong>: Computes fee (₹260 * event count) and updates live payment badge.</li>
              <li><strong>Order Dispatcher</strong>: Calls <code>POST /portal/athletes/create-order</code> to obtain authentic Razorpay order token.</li>
              <li><strong>Payment Modal Handler</strong>: Launches <code>new Razorpay(options).open()</code> with athlete contact prefill.</li>
              <li><strong>Form Submission</strong>: Dispatches complete multipart bundle to <code>POST /portal/athletes/nominate</code>.</li>
            </ul>
          </td>
        </tr>
        <tr>
          <th>Error & Feedback UI</th>
          <td>Inline accessible error banners (<code>aria-live="polite"</code>); Input border highlighting on validation failure; Disabled submit button during upload to prevent double-submits.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Page 3: school-nominate.html -->
  <h3>7.3 School & Academy Bulk Delegation Portal (<code>templates/school-nominate.html</code>)</h3>
  <div class="table-wrapper">
    <table>
      <tbody>
        <tr>
          <th style="width: 20%;">Route URLs</th>
          <td><code>/school-nominate</code>, <code>/school-nominate.html</code></td>
        </tr>
        <tr>
          <th>Access Level</th>
          <td>Public (Institutional Representatives)</td>
        </tr>
        <tr>
          <th>Core Purpose</th>
          <td>High-efficiency institutional roster management allowing school coaches to enter up to 50 athletes simultaneously.</td>
        </tr>
        <tr>
          <th>DOM & Semantic Layout</th>
          <td>Institution details card (School Name, Coach Name, Phone, District); Dynamic athlete roster table with responsive card fallback for mobile viewports; Add Row / Delete Row action bar; Master submission button.</td>
        </tr>
        <tr>
          <th>Client JS Logic</th>
          <td>
            Dynamic DOM row generator appending indexed form elements (<code>students[i][name]</code>, <code>students[i][dob]</code>, etc.); Pre-flight validation ensuring at least 1 athlete and at most 50 athletes; Serialization into JSON array with associated file mapping (<code>photo_0</code>, <code>dob_0</code>).
          </td>
        </tr>
        <tr>
          <th>Backend Endpoint</th>
          <td>Dispatches to <code>POST /portal/athletes/bulk-nominate</code>; handles batch counter allocation.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Page 4: admitcard.html -->
  <h3>7.4 Public Admit Card & Verification Portal (<code>templates/admitcard.html</code>)</h3>
  <div class="table-wrapper">
    <table>
      <tbody>
        <tr>
          <th style="width: 20%;">Route URLs</th>
          <td><code>/admitcard</code>, <code>/admitcard.html</code></td>
        </tr>
        <tr>
          <th>Access Level</th>
          <td>Public (Searchable by Chest Number or MongoDB ID)</td>
        </tr>
        <tr>
          <th>Core Purpose</th>
          <td>Digital credential and hall ticket issuance displaying athlete photo, chest number, event lineup, reporting time, venue details, and competition rules.</td>
        </tr>
        <tr>
          <th>DOM & Semantic Layout</th>
          <td>Search input card; Admit Card badge container (header, athlete portrait, metadata grid, scheduled events list, official seal, QR verification container); Action bar (Print Card, Download, Search Another).</td>
        </tr>
        <tr>
          <th>Performance & Caching</th>
          <td>Consumes <code>GET /portal/athletes/:id/public-card</code>. Backed by backend in-memory TTL/LRU cache with <code>X-Cache: HIT</code> responses under 5ms.</td>
        </tr>
        <tr>
          <th>Print Media CSS</th>
          <td>Dedicated <code>@media print</code> rules that strip headers, footers, search inputs, and page margins, generating an exact A4 hall ticket ready for arena entry.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Page 5: login.html -->
  <h3>7.5 District Secretary & Admin Login (<code>templates/login.html</code>)</h3>
  <div class="table-wrapper">
    <table>
      <tbody>
        <tr>
          <th style="width: 20%;">Route URLs</th>
          <td><code>/login</code>, <code>/login.html</code></td>
        </tr>
        <tr>
          <th>Access Level</th>
          <td>Public (Form for restricted credentials)</td>
        </tr>
        <tr>
          <th>Core Purpose</th>
          <td>Authentication gateway for 33 District Association Secretaries and Super Administrators.</td>
        </tr>
        <tr>
          <th>DOM & Semantic Layout</th>
          <td>Centered login card; Association crest; Email and password input fields; Show/Hide password toggle; Remember session notice; Accessible alert banner.</td>
        </tr>
        <tr>
          <th>Client JS Logic</th>
          <td>Asynchronous fetch submission to <code>POST /auth/login</code>; Automatic redirection to <code>/dashboard.html</code> upon HTTP 200 response; Local session storage backup.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Page 6: dashboard.html -->
  <h3>7.6 District Secretary Management Console (<code>templates/dashboard.html</code>)</h3>
  <div class="table-wrapper">
    <table>
      <tbody>
        <tr>
          <th style="width: 20%;">Route URLs</th>
          <td><code>/dashboard</code>, <code>/dashboard.html</code></td>
        </tr>
        <tr>
          <th>Access Level</th>
          <td>Protected (Requires valid JWT cookie or Bearer header via <code>requireAuth</code>)</td>
        </tr>
        <tr>
          <th>Core Purpose</th>
          <td>District-isolated athlete management console: roster review, document scrutiny, status updates (Verified/Clarification), export to CSV, and district summary telemetry.</td>
        </tr>
        <tr>
          <th>DOM & Semantic Layout</th>
          <td>Dashboard header with active district pill and logout trigger; Metric cards (Total Nominated, Verified, Pending, Clarification); Status filter tabs; Search and sort controls; Athlete roster table; Document scrutiny modal with zoomable proof viewer.</td>
        </tr>
        <tr>
          <th>Client JS Logic</th>
          <td>
            <ul>
              <li>Fetches athlete list via <code>GET /portal/athletes/list</code>.</li>
              <li>Renders roster with status pills and quick action triggers.</li>
              <li>Opens modal with direct document links (<code>/uploads/:filename</code>).</li>
              <li>Dispatches status mutations to <code>PATCH /portal/athletes/:id/status</code>.</li>
              <li>Exports active filtered roster to CSV format entirely on the client side.</li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Proposed Pages -->
  <h3>7.7 Proposed Future Interfaces (Version 2.0 Roadmap)</h3>
  <div class="cards-grid">
    <div class="card">
      <div class="card-title">
        <span>Court Mat Live Scoring Console</span>
        <span class="badge badge-proposed">PROPOSED V2</span>
      </div>
      <p><code>templates/scoring.html</code>: Tablet-optimized interface for 5 jury judges per mat, capturing difficulty, execution, and penalty marks in real-time with WebSocket synchronization.</p>
    </div>
    <div class="card">
      <div class="card-title">
        <span>Merit & Participation Certificate Generator</span>
        <span class="badge badge-proposed">PROPOSED V2</span>
      </div>
      <p><code>templates/certificates.html</code>: Automated SVG/PDF certificate rendering engine with cryptographic signature verification and verifiable public QR URLs.</p>
    </div>
  </div>
</section>
`;
