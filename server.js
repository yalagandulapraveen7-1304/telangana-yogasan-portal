require('dotenv').config();

const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const https = require('https');
const express = require('express');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { router: authRoutes, requireAuth } = require('./routes/auth');
const nominateRoutes = require('./routes/nominate');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/telangana_yoga';
const IS_PROD = process.env.NODE_ENV === 'production';

// Warn if using default secrets in production
if (IS_PROD && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'tya_secure_jwt_secret_key_2026')) {
  console.warn('⚠️ [SECURITY WARNING] Default JWT_SECRET is in use in production! Please set a strong JWT_SECRET in environment variables.');
}

// 1. MUST DEFINE 'app' FIRST
const app = express();

// 2. Setup Security & Core Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://api.razorpay.com"],
        frameSrc: ["'self'", "https://api.razorpay.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: IS_PROD ? [] : null
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// General Rate Limiter for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`➡️ [${req.method}] ${req.url}`);
  next();
});

// 3. Static assets
app.use('/static', express.static(path.join(__dirname, 'static')));

// Uploaded Document Images & Certificates Route
const uploadDir = process.env.VERCEL ? require('os').tmpdir() : path.join(__dirname, 'uploads');

app.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;

  // Security check: Prevent Directory Traversal Attacks (e.g., requesting "../../.env")
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(403).json({ success: false, message: 'Forbidden path execution.' });
  }

  // Construct the absolute path to the file
  const filePath = path.join(uploadDir, filename);

  // Verify the file actually exists on the disk before sending
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ success: false, message: 'Identity document not found or removed.' });
  }
});

// 4. API Routes
app.use('/auth', apiLimiter, authRoutes);
app.use('/portal/athletes', apiLimiter, nominateRoutes);

// 5. Template Directory Setup
const templateDir = path.join(__dirname, 'templates');

// Protected HTML pages (Admin & District Secretaries)
app.get(['/dashboard', '/dashboard.html'], requireAuth, (req, res) => {
  res.sendFile('dashboard.html', { root: templateDir });
});

// Public HTML pages (Clean URLs & .html fallback)
app.get(['/admitcard', '/admitcard.html'], (req, res) => {
  res.sendFile('admitcard.html', { root: templateDir });
});

app.get(['/nominate', '/nominate.html'], (req, res) => {
  res.sendFile('nominate.html', { root: templateDir });
});

app.get(['/school-nominate', '/school-nominate.html'], (req, res) => {
  res.sendFile('school-nominate.html', { root: templateDir });
});

app.get(['/login', '/login.html'], (req, res) => {
  res.sendFile('login.html', { root: templateDir });
});

app.get(['/', '/index', '/index.html'], (req, res) => {
  res.sendFile('index.html', { root: templateDir });
});

// Global Error Handler (Hides stack traces and sensitive error details from clients)
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    success: false,
    error: 'An unexpected error occurred. Please try again later.'
  });
});

// 6. Database Connection & Environment-Aware Server Startup
let isConnected = false;
const connectDB = async () => {
  if (isConnected || mongoose.connection.readyState === 1) return;
  try {
    await mongoose.connect(MONGO_URI);
    isConnected = true;
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.error('❌ Database connection error:', err);
  }
};

// Ensure DB connection for incoming serverless requests
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// Start HTTP/HTTPS server for long-running hosts (Local dev / Render)
if (!process.env.VERCEL) {
  connectDB().then(() => {
    const hasSslCerts = fs.existsSync('localhost+2-key.pem') && fs.existsSync('localhost+2.pem');

    if (IS_PROD || !hasSslCerts) {
      // Production: Live host (Render/AWS/etc.) handles SSL reverse-proxy
      app.listen(PORT, () => {
        console.log(`🚀 Production server running on port ${PORT}`);
      });
    } else {
      // Local Development: Use mkcert generated certificates
      const sslOptions = {
        key: fs.readFileSync('localhost+2-key.pem'),
        cert: fs.readFileSync('localhost+2.pem')
      };
      
      https.createServer(sslOptions, app).listen(PORT, () => {
        console.log(`🔒 Local secure server running at https://localhost:${PORT}`);
      });
    }
  });
}

module.exports = app;