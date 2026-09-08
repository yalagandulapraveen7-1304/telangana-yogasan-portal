/**
 * Part 4: Sections 11 to 13
 * 11. Complete API Architecture
 * 12. Security Architecture & Concepts
 * 13. Payment Architecture & Concepts
 */

module.exports = `
<!-- SECTION 11: COMPLETE API ARCHITECTURE -->
<section id="section-11" class="doc-section">
  <h2>
    <span>11. Complete API Architecture</span>
    <span class="badge badge-implemented">FULL REST ENDPOINT CATALOG</span>
  </h2>

  <p>
    The portal exposes 13 RESTful API endpoints adhering to standard HTTP status codes, structured JSON payloads, and strict rate limits.
  </p>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th>Endpoint Path</th>
          <th>Auth Scope</th>
          <th>Rate Limit</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><span class="badge badge-http-post">POST</span></td>
          <td><code>/auth/login</code></td>
          <td>Public</td>
          <td>10 req / 15m</td>
          <td>Authenticates secretary/admin, generates HS256 JWT, sets HttpOnly cookie.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-get">GET</span></td>
          <td><code>/auth/logout</code></td>
          <td>Public</td>
          <td>None</td>
          <td>Clears <code>token</code> cookie and redirects to <code>/login.html</code>.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-get">GET</span></td>
          <td><code>/auth/logs</code></td>
          <td>Super Admin</td>
          <td>500 req / 15m</td>
          <td>Retrieves chronological authentication audit logs with IP and User Agent.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-get">GET</span></td>
          <td><code>/portal/athletes/list</code></td>
          <td>Secretary / Admin</td>
          <td>500 req / 15m</td>
          <td>Returns paginated athlete roster scoped strictly to the secretary's district.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-get">GET</span></td>
          <td><code>/portal/athletes/:id</code></td>
          <td>Secretary / Admin</td>
          <td>500 req / 15m</td>
          <td>Fetches complete athlete profile including birth certificates and guardian info.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-get">GET</span></td>
          <td><code>/portal/athletes/:id/public-card</code></td>
          <td>Public</td>
          <td>2000 req / 15m</td>
          <td>High-speed public admit card lookup backed by in-memory LRU/TTL cache.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-post">POST</span></td>
          <td><code>/portal/athletes/create-order</code></td>
          <td>Public</td>
          <td>60 req / 15m</td>
          <td>Generates authenticated Razorpay order ID based on server-calculated event fee.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-post">POST</span></td>
          <td><code>/portal/athletes/nominate</code></td>
          <td>Public / Secretary</td>
          <td>60 req / 15m</td>
          <td>Registers single athlete with file uploads and verified payment signature.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-post">POST</span></td>
          <td><code>/portal/athletes/bulk-nominate</code></td>
          <td>Public / Secretary</td>
          <td>60 req / 15m</td>
          <td>Registers school delegation (up to 50 athletes) with batch atomic bib numbers.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-patch">PATCH</span></td>
          <td><code>/portal/athletes/:id/status</code></td>
          <td>Secretary / Admin</td>
          <td>500 req / 15m</td>
          <td>Updates scrutiny status (Verified/Clarification), purges cached admit card.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-get">GET</span></td>
          <td><code>/uploads/:filename</code></td>
          <td>Public (Sanitized)</td>
          <td>Static Cache (24h)</td>
          <td>Streams uploaded document images/PDFs with path traversal defense.</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-get">GET</span></td>
          <td><code>/_telemetry</code></td>
          <td>Internal / Admin</td>
          <td>Unrestricted</td>
          <td>Diagnostic performance metrics (active sockets, p95 latencies, error counts).</td>
        </tr>
        <tr>
          <td><span class="badge badge-http-post">POST</span></td>
          <td><code>/_telemetry/reset</code></td>
          <td>Internal / Admin</td>
          <td>Unrestricted</td>
          <td>Resets accumulated telemetry counters for benchmarking iterations.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <h3>Detailed Endpoint Specifications</h3>

  <!-- 1. POST /auth/login -->
  <h4><code>POST /auth/login</code></h4>
  <p>Authenticates district secretaries and state administrators.</p>
  <div class="code-container">
    <div class="code-header">
      <span>Request Payload & Responses</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>// Request Headers: Content-Type: application/json
{
  "email": "warangal_sec@telanganayoga.org",
  "password": "SecurePassword2026!"
}

// HTTP 200 OK Response
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "district": "Warangal",
  "role": "SECRETARY",
  "secretaryName": "Warangal District Secretary"
}

// HTTP 401 Unauthorized Response
{
  "success": false,
  "error": "Invalid email or password"
}

// HTTP 429 Too Many Requests
{
  "success": false,
  "error": "Too many login attempts from this IP. Please try again after 15 minutes."
}</code></pre>
  </div>

  <!-- 2. GET /portal/athletes/list -->
  <h4><code>GET /portal/athletes/list</code></h4>
  <p>Retrieves paginated, district-scoped athlete records. Supports <code>page</code>, <code>limit</code>, and <code>status</code> query parameters.</p>
  <div class="code-container">
    <div class="code-header">
      <span>Response Headers & Data Payload</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>// Request: GET /portal/athletes/list?page=1&limit=25&status=Verified
// Response Headers:
// X-Total-Count: 142
// X-Page: 1
// X-Per-Page: 25
// X-Total-Pages: 6
// Cache-Control: no-store, no-cache, must-revalidate, private

[
  {
    "_id": "65e8a71b2f91a82d4c000101",
    "firstName": "Ananya",
    "lastName": "Reddy",
    "dob": "2010-04-12T00:00:00.000Z",
    "gender": "Female",
    "category": "Junior",
    "district": "Warangal",
    "chestNumber": "WAR-JR-01",
    "events": ["Traditional Yogasana", "Artistic Single"],
    "status": "Verified",
    "institutionName": "Kakatiya High School",
    "guardianName": "K. Reddy",
    "aadhaarLast4": "4821",
    "photoPath": "/uploads/photo-1709721600000.webp",
    "createdAt": "2026-03-05T09:12:00.000Z"
  }
]</code></pre>
  </div>

  <!-- 3. POST /portal/athletes/nominate -->
  <h4><code>POST /portal/athletes/nominate</code></h4>
  <p>Enrolls an individual athlete. Accepts <code>multipart/form-data</code> containing textual attributes, proof files, and payment signature.</p>
  <div class="code-container">
    <div class="code-header">
      <span>Multipart Form Fields & HTTP 201 Response</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>// Form Fields:
firstName: "Rajesh"
lastName: "Kumar"
dob: "2012-08-20"
gender: "Male"
aadhaarLast4: "9102"
district: "Nizamabad"
events: ["Traditional Yogasana"]
guardianName: "M. Kumar"
mobileNumber: "9876543210"
residentialAddress: "H.No 4-12, Subhash Nagar, Nizamabad"
passport_photo: [Binary File: image/jpeg, max 5MB]
dob_certificate: [Binary File: application/pdf, max 5MB]
razorpay_order_id: "order_NEy4T7b8p1"
razorpay_payment_id: "pay_NEy5X9k2q3"
razorpay_signature: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

// HTTP 201 Created Response:
{
  "success": true,
  "athlete": {
    "_id": "65e8b10f2f91a82d4c000189",
    "firstName": "Rajesh",
    "lastName": "Kumar",
    "category": "Sub-Junior",
    "district": "Nizamabad",
    "chestNumber": "NIZ-SJ-04",
    "status": "Submitted",
    "paymentDetails": {
      "orderId": "order_NEy4T7b8p1",
      "paymentId": "pay_NEy5X9k2q3",
      "amount": 260,
      "status": "PAID"
    }
  }
}</code></pre>
  </div>
</section>

<!-- SECTION 12: SECURITY ARCHITECTURE & CONCEPTS -->
<section id="section-12" class="doc-section">
  <h2>
    <span>12. Security Architecture & Concepts</span>
    <span class="badge badge-implemented">OWASP TOP 10 HARDENED</span>
  </h2>

  <p>
    Security is implemented using a defense-in-depth model across transport, perimeter, routing, database, and credential layers.
  </p>

  <h3>OWASP Top 10 Mitigation Matrix</h3>
  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th>OWASP Category</th>
          <th>Vulnerability Vector</th>
          <th>Mitigation Implemented in Codebase</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>A01: Broken Access Control</strong></td>
          <td>Secretary tampering with other districts (IDOR).</td>
          <td><code>buildDistrictFilter(req.user.district)</code> structurally restricts database queries to authenticated district.</td>
        </tr>
        <tr>
          <td><strong>A02: Cryptographic Failures</strong></td>
          <td>Leaked passwords, weak tokens.</td>
          <td>Bcrypt salt factor 10, JWT pinned to <code>HS256</code>, HSTS enabled (31536000s), HttpOnly SameSite=strict cookies.</td>
        </tr>
        <tr>
          <td><strong>A03: Injection</strong></td>
          <td>MongoDB operator injection (<code>{"$gt": ""}</code>) and ReDoS.</td>
          <td>Recursive <code>noSqlSanitizer</code> removes <code>$</code> and <code>.</code> keys; <code>escapeRegex()</code> strips special regex tokens.</td>
        </tr>
        <tr>
          <td><strong>A04: Insecure Design</strong></td>
          <td>Chest number race collisions, price tampering.</td>
          <td>Atomic MongoDB sequence counters (<code>$inc</code>); server computes event fees (<code>events.length * ₹260</code>).</td>
        </tr>
        <tr>
          <td><strong>A05: Security Misconfiguration</strong></td>
          <td>Leaked stack traces, Clickjacking, MIME sniffing.</td>
          <td>Helmet CSP, <code>app.disable('x-powered-by')</code>, <code>X-Frame-Options: DENY</code>, <code>X-Content-Type-Options: nosniff</code>.</td>
        </tr>
        <tr>
          <td><strong>A07: Auth Failures</strong></td>
          <td>Credential brute-forcing, password DoS.</td>
          <td><code>loginLimiter</code> (10 attempts/15m); password length capped at 128 chars to prevent CPU exhaustion.</td>
        </tr>
        <tr>
          <td><strong>A08: Software & Data Integrity</strong></td>
          <td>Forged Razorpay payment callbacks.</td>
          <td>Cryptographic HMAC-SHA256 signature verification in <code>utils/payment.js</code>.</td>
        </tr>
        <tr>
          <td><strong>A09: Logging & Monitoring</strong></td>
          <td>Undetected credential stuffing.</td>
          <td><code>LoginLog</code> schema tracks IP, user agent, timestamp, and status for all login attempts.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <h3>NoSQL Injection Sanitization Engine</h3>
  <div class="code-container">
    <div class="code-header">
      <span>Recursive Key Sanitizer (middleware/sanitize.js)</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>function sanitizeNoSql(payload) {
  if (!payload || typeof payload !== 'object') return payload;

  if (Array.isArray(payload)) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] = sanitizeNoSql(payload[i]);
    }
    return payload;
  }

  for (const key of Object.keys(payload)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete payload[key]; // Neutralize MongoDB operator injection
    } else {
      payload[key] = sanitizeNoSql(payload[key]);
    }
  }
  return payload;
}</code></pre>
  </div>

  <h3>Path Traversal Defense in Document Serving</h3>
  <p>
    When serving athlete identity certificates via <code>GET /uploads/:filename</code>, the system validates the filename against a strict regex whitelist and verifies that the resolved canonical path remains within the designated uploads boundary:
  </p>
  <div class="code-container">
    <div class="code-header">
      <span>Directory Traversal Protection (services/storage.js)</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>function resolveFilePath(filename) {
  if (!filename || typeof filename !== 'string') return { isValid: false, filePath: null };

  // Block directory traversal sequences
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\\\')) {
    return { isValid: false, filePath: null };
  }

  const sanitized = path.basename(filename);
  const filePath = path.resolve(storageDir, sanitized);
  const resolvedStorageDir = path.resolve(storageDir);

  // Enforce boundary containment
  if (!filePath.startsWith(resolvedStorageDir)) {
    return { isValid: false, filePath: null };
  }

  return { isValid: true, filePath };
}</code></pre>
  </div>
</section>

<!-- SECTION 13: PAYMENT ARCHITECTURE & CONCEPTS -->
<section id="section-13" class="doc-section">
  <h2>
    <span>13. Payment Architecture & Concepts</span>
    <span class="badge badge-implemented">RAZORPAY INTEGRATION</span>
  </h2>

  <p>
    The payment subsystem integrates with <strong>Razorpay</strong>, India's leading sports and event payment infrastructure. The flow is engineered to ensure tamper-resistance, idempotency, and automated reconciliation.
  </p>

  <h3>Payment Lifecycle & Server-Side Integrity</h3>
  <div class="cards-grid">
    <div class="card">
      <div class="card-title">1. Server Price Control</div>
      <p>The client never submits monetary values. In <code>createOrder()</code>, the server computes <code>amountInPaise = events.length * 260 * 100</code>, eliminating price tampering.</p>
    </div>
    <div class="card">
      <div class="card-title">2. Order Creation</div>
      <p>Server calls <code>razorpay.orders.create()</code> passing amount, currency (<code>INR</code>), and unique receipt ID (<code>nom_{timestamp}</code>), receiving an authentic <code>order_id</code>.</p>
    </div>
    <div class="card">
      <div class="card-title">3. Client Checkout Modal</div>
      <p>The client loads Razorpay's verified SDK (whitelisted in Helmet CSP), opening the payment sheet supporting UPI, Cards, and Net Banking.</p>
    </div>
    <div class="card">
      <div class="card-title">4. Cryptographic HMAC Verification</div>
      <p>Server recalculates <code>crypto.createHmac('sha256', SECRET).update(orderId + '|' + paymentId).digest('hex')</code>, matching it against <code>razorpay_signature</code>.</p>
    </div>
  </div>

  <div class="code-container">
    <div class="code-header">
      <span>HMAC-SHA256 Signature Verification (utils/payment.js)</span>
      <button class="btn-copy-code">Copy</button>
    </div>
    <pre><code>function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;

  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
  hmac.update(\`\${orderId}|\${paymentId}\`);
  const generatedSignature = hmac.digest('hex');

  // Constant-time comparison ensures resilience against timing analysis attacks
  return crypto.timingSafeEqual(
    Buffer.from(generatedSignature, 'utf8'),
    Buffer.from(signature, 'utf8')
  );
}</code></pre>
  </div>
</section>
`;
