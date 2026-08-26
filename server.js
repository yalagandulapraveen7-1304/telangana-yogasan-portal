require('dotenv').config();

const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const https = require('https');
const express = require('express');

const { router: authRoutes, requireAuth } = require('./routes/auth');
const nominateRoutes = require('./routes/nominate');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/telangana_yoga';
const IS_PROD = process.env.NODE_ENV === 'production'; // NEW: Check environment

// 1. MUST DEFINE 'app' FIRST
const app = express();

// 2. Setup Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`➡️ [${req.method}] ${req.url}`);
  next();
});

// 3. Static assets
app.use('/static', express.static(path.join(__dirname, 'static')));

// SECURE UPLOADS ROUTE: Only logged-in District Secretaries can fetch documents
app.get('/uploads/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename;

  // Security check: Prevent Directory Traversal Attacks (e.g., requesting "../../.env")
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(403).json({ success: false, message: 'Forbidden path execution.' });
  }

  // Construct the absolute path to the file
  const filePath = path.join(__dirname, 'uploads', filename);

  // Verify the file actually exists on the disk before sending
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ success: false, message: 'Identity document not found or removed.' });
  }
});
// 4. API Routes
app.use('/auth', authRoutes);
app.use('/portal/athletes', nominateRoutes);

// 5. Template Directory Setup
const templateDir = path.join(__dirname, 'templates');

// Protected HTML pages
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile('dashboard.html', { root: templateDir });
});

app.get('/nominate.html', requireAuth, (req, res) => {
  res.sendFile('nominate.html', { root: templateDir });
});

app.get('/admitcard.html', requireAuth, (req, res) => {
  res.sendFile('admitcard.html', { root: templateDir });
});

// Public HTML pages
app.get('/login.html', (req, res) => {
  res.sendFile('login.html', { root: templateDir });
});

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile('index.html', { root: templateDir });
});

// 6. Database Connection & Environment-Aware Server Startup
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    if (IS_PROD) {
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
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err);
  });