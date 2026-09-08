/**
 * Master Architecture Documentation Compiler
 * Compiles modular documentation sections into a standalone, interactive,
 * zero-dependency HTML document in docs/architecture-documentation.html.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const styles = require('./docs-modules/styles');
const scripts = require('./docs-modules/scripts');
const part1 = require('./docs-modules/part1-overview-stack');
const part2 = require('./docs-modules/part2-workflows-pages');
const part3 = require('./docs-modules/part3-frontend-backend-db');
const part4 = require('./docs-modules/part4-api-security-payment');
const part5 = require('./docs-modules/part5-performance-testing-a11y');
const part6 = require('./docs-modules/part6-devops-git-business');
const part7 = require('./docs-modules/part7-flows-failures-tradeoffs');
const part8 = require('./docs-modules/part8-mappings-scorecard-future');

const tocItems = [
  { id: 'section-1', title: '1. Project Overview', badge: 'Overview' },
  { id: 'section-2', title: '2. Complete Technology Stack', badge: 'Stack' },
  { id: 'section-3', title: '3. Programming Languages Breakdown', badge: 'Languages' },
  { id: 'section-4', title: '4. Complete System Architecture', badge: 'Topology' },
  { id: 'section-5', title: '5. User Workflows', badge: 'Workflows' },
  { id: 'section-6', title: '6. District Login & Auth Workflow', badge: 'Security' },
  { id: 'section-7', title: '7. Page-by-Page Technical Breakdown', badge: 'Pages' },
  { id: 'section-8', title: '8. Frontend Architecture & Concepts', badge: 'Client' },
  { id: 'section-9', title: '9. Backend Architecture & Concepts', badge: 'Server' },
  { id: 'section-10', title: '10. Database Architecture & Schemas', badge: 'Database' },
  { id: 'section-11', title: '11. Complete API Architecture', badge: 'REST API' },
  { id: 'section-12', title: '12. Security Architecture & Defense', badge: 'Security' },
  { id: 'section-13', title: '13. Payment Architecture & Integrity', badge: 'Razorpay' },
  { id: 'section-14', title: '14. Performance & Caching Engine', badge: 'Latency' },
  { id: 'section-15', title: '15. Scalability & Concurrency (10k RCA)', badge: 'Scale' },
  { id: 'section-16', title: '16. Testing Architecture (214 Tests)', badge: 'Testing' },
  { id: 'section-17', title: '17. Accessibility Architecture (WCAG)', badge: 'WCAG' },
  { id: 'section-18', title: '18. SEO & Social Discoverability', badge: 'SEO' },
  { id: 'section-19', title: '19. DevOps & Deployment Architecture', badge: 'DevOps' },
  { id: 'section-20', title: '20. Git & GitHub Repository Hygiene', badge: 'Git' },
  { id: 'section-21', title: '21. Complete Folder Structure', badge: 'Files' },
  { id: 'section-22', title: '22. Complete Business Logic Matrix', badge: 'Rules' },
  { id: 'section-23', title: '23. Data Flow Diagrams & Lifecycles', badge: 'Flows' },
  { id: 'section-24', title: '24. Failure Handling & Recovery', badge: 'Resilience' },
  { id: 'section-25', title: '25. Technology Tradeoffs & Decisions', badge: 'Tradeoffs' },
  { id: 'section-26', title: '26. Concept-to-Page Mapping Table', badge: 'Matrix' },
  { id: 'section-27', title: '27. Technology-to-Feature Mapping', badge: 'Matrix' },
  { id: 'section-28', title: '28. Developer Learning Roadmap', badge: 'Skills' },
  { id: 'section-29', title: '29. Architectural Weaknesses & Risks', badge: 'Risks' },
  { id: 'section-30', title: '30. Production Readiness Scorecard', badge: '91.5/100' },
  { id: 'section-31', title: '31. Future Architectural Roadmap', badge: 'v2.0' },
  { id: 'section-32', title: '32. Final End-to-End System Map', badge: 'Blueprint' }
];

const tocHtml = tocItems.map((item) => `
  <li class="toc-item">
    <a href="#${item.id}">
      <span>${item.title}</span>
      <span class="badge badge-implemented">${item.badge}</span>
    </a>
  </li>
`).join('\n');

const fullHtml = `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Technical Architecture Documentation | Telangana State Inter-District Yogasana Sports Championship</title>
  <meta name="description" content="Complete, deeply detailed technical documentation and architecture analysis of the Telangana State Inter-District Yogasana Sports Championship Portal.">
  <link rel="icon" type="image/x-icon" href="../static/images/favicon.ico">
  <style>
${styles}
  </style>
</head>
<body>
  <!-- Fixed Header -->
  <header class="doc-header">
    <div class="doc-logo">
      <button id="mobileMenuBtn" class="btn-icon mobile-menu-trigger" aria-label="Toggle Navigation Sidebar" style="display: none;">
        ☰
      </button>
      <span style="font-size: 1.25rem;">🧘</span>
      <span>Telangana Yogasana Portal</span>
      <span class="badge-portal">Architecture Master</span>
    </div>
    <div class="header-actions">
      <button id="printDocBtn" class="btn-icon" title="Print or Export to PDF">
        🖨️ <span>Print / PDF</span>
      </button>
      <button id="themeToggleBtn" class="btn-icon" title="Switch Theme">
        ☀️ Light Mode
      </button>
      <a href="https://github.com/yalagandulapraveen7-1304/telangana-yogasan-portal.git" target="_blank" class="btn-icon" style="text-decoration: none;">
        <span>GitHub</span> ↗
      </a>
    </div>
  </header>

  <div class="doc-container">
    <!-- Sticky Sidebar Navigation -->
    <aside id="docSidebar" class="doc-sidebar">
      <div class="sidebar-search-box">
        <label for="sidebarSearch" class="sr-only">Search Documentation Sections</label>
        <input type="text" id="sidebarSearch" class="sidebar-search-input" placeholder="Quick search topics & sections...">
      </div>

      <div class="toc-section-title">Documentation Index (32 Sections)</div>
      <ul class="toc-nav-list">
${tocHtml}
      </ul>
    </aside>

    <!-- Main Content Area -->
    <main class="doc-content">
      <h1 class="doc-title">System Architecture & Engineering Specification</h1>
      <p class="doc-subtitle">
        A definitive, deeply detailed architectural analysis of the <strong>Telangana State Inter-District Yogasana Sports Championship Portal</strong> (<code>yogasana-portal</code>). Audited against actual source code, 214 automated test suites, empirical 10k-user benchmark telemetry, and WCAG 2.2 AA accessibility criteria.
      </p>

      ${part1}
      ${part2}
      ${part3}
      ${part4}
      ${part5}
      ${part6}
      ${part7}
      ${part8}
    </main>
  </div>

  <script>
${scripts}
  </script>
</body>
</html>
`;

const docsDir = path.join(__dirname, '../docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const targetPath = path.join(docsDir, 'architecture-documentation.html');
fs.writeFileSync(targetPath, fullHtml, 'utf8');
console.log(`[SUCCESS] Compiled master documentation: ${targetPath} (${Buffer.byteLength(fullHtml, 'utf8')} bytes)`);

// Also save an index.html in docs/ for instant root serving
const indexPath = path.join(docsDir, 'index.html');
fs.writeFileSync(indexPath, fullHtml, 'utf8');
console.log(`[SUCCESS] Created mirror index: ${indexPath}`);
