require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');

const { PORT, IS_PROD } = require('./config/constants');
const { connectDB } = require('./config/db');
const { requireAuth, apiLimiter, publicReadLimiter } = require('./middleware/auth');
const { noSqlSanitizer, originGuard } = require('./middleware/sanitize');
const { resolveFilePath, fileExists } = require('./services/storage');
const { router: authRoutes } = require('./routes/auth');
const nominateRoutes = require('./routes/nominate');
const { validateEnv } = require('./config/env');
const { isValidFilename } = require('./utils/validators');

validateEnv();

const app = express();

// Trust reverse proxy (Nginx, Vercel, Cloudflare) for accurate client IP rate limiting
app.set('trust proxy', 1);

const { telemetryMiddleware, getTelemetrySnapshot, resetTelemetry } = require('./utils/telemetry');

// Disable technology disclosure headers
app.disable('x-powered-by');

// Diagnostic & Performance Telemetry
app.use(telemetryMiddleware);
app.get('/_telemetry', (_req, res) => {
  res.json(getTelemetrySnapshot());
});
app.post('/_telemetry/reset', (_req, res) => {
  resetTelemetry();
  res.json({ success: true, message: 'Telemetry reset' });
});

// 1. Security & Core Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://checkout.razorpay.com'],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
        connectSrc: ["'self'", 'https://api.razorpay.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: IS_PROD ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    hsts: IS_PROD
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false
  })
);

// Permissions-Policy & Cache control headers
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self "https://api.razorpay.com")');
  next();
});

// 2. HTTP Compression (Gzip/Deflate) - Filtered to prevent CPU saturation on pre-compressed binaries
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      const rawPath = (req.path || '').toLowerCase();
      if (rawPath.endsWith('.pdf') || rawPath.endsWith('.gz') || rawPath.endsWith('.zip') || rawPath.endsWith('.webp')) {
        return false;
      }
      return compression.filter(req, res);
    }
  })
);

// Request body limits to prevent Denial of Service
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

// NoSQL injection defense & CSRF Origin verification
app.use(noSqlSanitizer);
app.use(originGuard);

app.get('/favicon.ico', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
  res.sendFile('favicon.ico', { root: path.join(__dirname, 'static', 'images') });
});

// 3. Static Assets with aggressive caching headers (served without waiting on database)
app.use('/static', express.static(path.join(__dirname, 'static'), {
  maxAge: '30d',
  immutable: true,
  etag: true,
  lastModified: true
}));

// 4. Ensure Database Connection before handling dynamic routes
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Uploaded Document Images & Certificates Route (with path traversal defense)
app.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;

  if (!filename || !isValidFilename(filename)) {
    return res.status(400).json({ success: false, message: 'Invalid or disallowed file identifier.' });
  }

  const { isValid, filePath } = resolveFilePath(filename);

  if (!isValid || !filePath) {
    return res.status(403).json({ success: false, message: 'Forbidden path execution.' });
  }

  if (fileExists(filename)) {
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  }
  return res.status(404).json({ success: false, message: 'Identity document not found or removed.' });
});

// Database connection assurance for serverless environments (Vercel)
app.use(async (req, _res, next) => {
  if (req.path.startsWith('/auth') || req.path.startsWith('/portal')) {
    try {
      await connectDB();
    } catch (err) {
      console.error('Serverless database connection error:', err.message);
    }
  }
  next();
});

// 4. API Routes
app.use('/auth', apiLimiter, authRoutes);
app.use(
  '/portal/athletes',
  (req, res, next) => {
    // Dedicated higher read limit for public admit card lookups
    if (req.path.endsWith('/public-card')) {
      return publicReadLimiter(req, res, next);
    }
    return apiLimiter(req, res, next);
  },
  nominateRoutes
);

// 5. Template Directory Setup & Page Routing
const templateDir = path.join(__dirname, 'templates');

function sendHtmlPage(res, filename) {
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');
  res.sendFile(filename, { root: templateDir });
}

// Protected HTML pages (Admin & District Secretaries)
app.get(['/dashboard', '/dashboard.html'], requireAuth, (_req, res) => {
  sendHtmlPage(res, 'dashboard.html');
});

// Public HTML pages (Clean URLs & .html fallback)
app.get(['/admitcard', '/admitcard.html'], (_req, res) => {
  sendHtmlPage(res, 'admitcard.html');
});

app.get(['/nominate', '/nominate.html'], (_req, res) => {
  sendHtmlPage(res, 'nominate.html');
});

app.get(['/school-nominate', '/school-nominate.html'], (_req, res) => {
  sendHtmlPage(res, 'school-nominate.html');
});

app.get(['/login', '/login.html'], (_req, res) => {
  sendHtmlPage(res, 'login.html');
});

app.get(['/', '/index', '/index.html'], (_req, res) => {
  sendHtmlPage(res, 'index.html');
});

// 6. Multer / File Upload Error Handler
app.use((err, _req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, error: 'Uploaded file exceeds 5MB size limit.' });
  }
  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ success: false, error: err.message });
  }
  return next(err);
});

// 7. Global Error Handler
app.use((err, _req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  // Handle malformed JSON body from body-parser
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload.'
    });
  }

  console.error('Unhandled server error:', err.message);
  return res.status(err.status || 500).json({
    success: false,
    error: 'An unexpected error occurred. Please try again later.'
  });
});

// 8. Server Startup (for local development and persistent hosts)
if (require.main === module && !process.env.VERCEL) {
  connectDB()
    .then(() => {
      const hasSslCerts = fs.existsSync('localhost+2-key.pem') && fs.existsSync('localhost+2.pem');

      if (IS_PROD || !hasSslCerts) {
        const srv = app.listen(PORT, 2048, () => {
          console.log(`Production server running on port ${PORT}`);
        });
        srv.keepAliveTimeout = 65000;
        srv.headersTimeout = 66000;
      } else {
        const sslOptions = {
          key: fs.readFileSync('localhost+2-key.pem'),
          cert: fs.readFileSync('localhost+2.pem')
        };

        const srv = https.createServer(sslOptions, app).listen(PORT, 2048, () => {
          console.log(`Local secure server running at https://localhost:${PORT}`);
        });
        srv.keepAliveTimeout = 65000;
        srv.headersTimeout = 66000;
      }
    })
    .catch((err) => {
      console.error('Fatal database startup error:', err.message);
    });
}

module.exports = app;