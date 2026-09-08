/**
 * Architecture Documentation Stylesheet Module
 * Provides clean, modern executive dashboard styling with responsive layout,
 * dark/light themes, sticky navigation, badges, code blocks, and print optimization.
 */

module.exports = `
:root {
  --bg-primary: #0f172a;
  --bg-secondary: #1e293b;
  --bg-card: #1e293b;
  --bg-code: #090d16;
  --border-color: #334155;
  --text-primary: #f8fafc;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;
  --accent-cyan: #06b6d4;
  --accent-indigo: #6366f1;
  --accent-emerald: #10b981;
  --accent-amber: #f59e0b;
  --accent-rose: #f43f5e;
  --sidebar-width: 320px;
  --header-height: 64px;
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
}

[data-theme="light"] {
  --bg-primary: #f8fafc;
  --bg-secondary: #ffffff;
  --bg-card: #ffffff;
  --bg-code: #0f172a;
  --border-color: #e2e8f0;
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #94a3b8;
  --accent-cyan: #0284c7;
  --accent-indigo: #4f46e5;
  --accent-emerald: #059669;
  --accent-amber: #d97706;
  --accent-rose: #e11d48;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
  scroll-padding-top: calc(var(--header-height) + 20px);
}

body {
  font-family: var(--font-sans);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.65;
  font-size: 15px;
  -webkit-font-smoothing: antialiased;
}

/* Header */
.doc-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  background-color: rgba(15, 23, 42, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
}

[data-theme="light"] .doc-header {
  background-color: rgba(255, 255, 255, 0.85);
}

.doc-logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.doc-logo .badge-portal {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: #fff;
  padding: 0.2rem 0.6rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.btn-icon {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  padding: 0.45rem 0.9rem;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background: var(--border-color);
}

/* Main Layout */
.doc-container {
  display: flex;
  margin-top: var(--header-height);
  min-height: calc(100vh - var(--header-height));
}

/* Sidebar */
.doc-sidebar {
  width: var(--sidebar-width);
  position: fixed;
  top: var(--header-height);
  bottom: 0;
  left: 0;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-color);
  overflow-y: auto;
  padding: 1.25rem 1rem;
  z-index: 50;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.sidebar-search-box {
  margin-bottom: 1.25rem;
}

.sidebar-search-input {
  width: 100%;
  padding: 0.55rem 0.85rem;
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: 0.85rem;
  outline: none;
  transition: border-color 0.2s;
}

.sidebar-search-input:focus {
  border-color: var(--accent-cyan);
}

.toc-nav-list {
  list-style: none;
}

.toc-section-title {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin: 1.2rem 0 0.5rem 0.5rem;
}

.toc-item a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.65rem;
  border-radius: 0.375rem;
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.85rem;
  transition: all 0.15s ease;
  line-height: 1.4;
}

.toc-item a:hover {
  color: var(--text-primary);
  background-color: rgba(255, 255, 255, 0.04);
}

.toc-item.active a {
  color: var(--accent-cyan);
  background-color: rgba(6, 182, 212, 0.1);
  font-weight: 600;
  border-left: 3px solid var(--accent-cyan);
}

/* Content Area */
.doc-content {
  margin-left: var(--sidebar-width);
  padding: 2.5rem 3.5rem;
  max-width: 1200px;
  flex: 1;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
  color: var(--text-primary);
  font-weight: 700;
  line-height: 1.3;
}

h1.doc-title {
  font-size: 2.35rem;
  margin-bottom: 0.75rem;
  background: linear-gradient(135deg, #38bdf8, #818cf8, #c084fc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.doc-subtitle {
  font-size: 1.15rem;
  color: var(--text-secondary);
  margin-bottom: 2rem;
  line-height: 1.5;
}

.doc-section {
  margin-bottom: 3.5rem;
  padding-bottom: 2.5rem;
  border-bottom: 1px solid var(--border-color);
}

.doc-section:last-child {
  border-bottom: none;
}

.doc-section h2 {
  font-size: 1.65rem;
  margin-bottom: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.doc-section h3 {
  font-size: 1.25rem;
  margin: 1.75rem 0 0.85rem;
  color: var(--accent-cyan);
}

.doc-section h4 {
  font-size: 1.05rem;
  margin: 1.25rem 0 0.5rem;
  color: var(--text-primary);
}

p {
  margin-bottom: 1rem;
  color: var(--text-secondary);
}

ul, ol {
  margin-bottom: 1rem;
  padding-left: 1.5rem;
  color: var(--text-secondary);
}

li {
  margin-bottom: 0.35rem;
}

/* Badges */
.badge {
  display: inline-flex;
  align-items: center;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.18rem 0.55rem;
  border-radius: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  line-height: 1;
}

.badge-implemented {
  background-color: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.badge-recommended {
  background-color: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.badge-proposed {
  background-color: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.badge-http-get { background: #0284c7; color: #fff; font-family: var(--font-mono); }
.badge-http-post { background: #16a34a; color: #fff; font-family: var(--font-mono); }
.badge-http-patch { background: #d97706; color: #fff; font-family: var(--font-mono); }
.badge-http-delete { background: #dc2626; color: #fff; font-family: var(--font-mono); }

/* Tables */
.table-wrapper {
  width: 100%;
  overflow-x: auto;
  margin: 1.25rem 0 2rem;
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  background-color: var(--bg-card);
}

table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: 0.88rem;
}

th {
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  font-weight: 600;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  white-space: nowrap;
}

td {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-secondary);
  vertical-align: top;
}

tr:last-child td {
  border-bottom: none;
}

tr:hover td {
  background-color: rgba(255, 255, 255, 0.02);
}

/* Callout Alerts */
.callout {
  padding: 1.1rem 1.25rem;
  margin: 1.25rem 0;
  border-radius: 0.5rem;
  border-left: 4px solid;
  background-color: var(--bg-card);
  font-size: 0.92rem;
}

.callout-info {
  border-color: var(--accent-cyan);
  background-color: rgba(6, 182, 212, 0.08);
}

.callout-warning {
  border-color: var(--accent-amber);
  background-color: rgba(245, 158, 11, 0.08);
}

.callout-danger {
  border-color: var(--accent-rose);
  background-color: rgba(244, 63, 94, 0.08);
}

.callout-success {
  border-color: var(--accent-emerald);
  background-color: rgba(16, 185, 129, 0.08);
}

.callout-title {
  font-weight: 700;
  margin-bottom: 0.35rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Code Blocks */
.code-container {
  margin: 1.25rem 0;
  border-radius: 0.5rem;
  overflow: hidden;
  border: 1px solid var(--border-color);
  background-color: var(--bg-code);
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 1rem;
  background-color: rgba(255, 255, 255, 0.03);
  border-bottom: 1px solid var(--border-color);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.btn-copy-code {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  border-radius: 0.25rem;
  padding: 0.2rem 0.5rem;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-copy-code:hover {
  color: var(--text-primary);
  border-color: var(--text-muted);
}

pre {
  padding: 1.1rem;
  overflow-x: auto;
  font-family: var(--font-mono);
  font-size: 0.84rem;
  line-height: 1.55;
  color: #e2e8f0;
}

code {
  font-family: var(--font-mono);
  background-color: rgba(255, 255, 255, 0.08);
  padding: 0.15rem 0.35rem;
  border-radius: 0.25rem;
  font-size: 0.88em;
  color: #38bdf8;
}

pre code {
  background-color: transparent;
  padding: 0;
  color: inherit;
}

/* Cards Grid */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.25rem;
  margin: 1.25rem 0;
}

.card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1.25rem;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.card:hover {
  border-color: var(--accent-cyan);
  transform: translateY(-2px);
}

.card-title {
  font-size: 1.05rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

/* Diagram Box */
.diagram-box {
  background-color: var(--bg-code);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1.5rem;
  margin: 1.25rem 0;
  overflow-x: auto;
}

.diagram-svg {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
}

/* Scorecard */
.scorecard-bar-wrapper {
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 9999px;
  height: 8px;
  width: 100%;
  overflow: hidden;
  margin-top: 0.4rem;
}

.scorecard-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #06b6d4);
  border-radius: 9999px;
}

/* Print Optimization */
@media print {
  body {
    background-color: #fff !important;
    color: #000 !important;
  }
  .doc-header, .doc-sidebar, .sidebar-search-box, .btn-icon, .btn-copy-code {
    display: none !important;
  }
  .doc-content {
    margin-left: 0 !important;
    padding: 0 !important;
    max-width: 100% !important;
  }
  .doc-section {
    page-break-after: auto;
    border-bottom: 1px solid #ccc;
  }
  pre, code, .code-container {
    background-color: #f1f5f9 !important;
    color: #0f172a !important;
    border-color: #cbd5e1 !important;
  }
  .table-wrapper, table {
    border-color: #cbd5e1 !important;
  }
  th, td {
    color: #0f172a !important;
  }
}

/* Responsive */
@media (max-width: 1024px) {
  .doc-sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }
  .doc-sidebar.open {
    transform: translateX(0);
  }
  .doc-content {
    margin-left: 0;
    padding: 2rem 1.5rem;
  }
}
`;
