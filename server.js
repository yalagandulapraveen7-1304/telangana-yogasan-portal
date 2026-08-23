require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');

const { router: authRoutes, requireAuth } = require('./routes/auth');
const nominateRoutes = require('./routes/nominate');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/telangana_yoga';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  console.log(`➡️ [${req.method}] ${req.url}`);
  next();
});

// Static assets
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/auth', authRoutes);
app.use('/portal/athletes', nominateRoutes);

// THE FIX: Define the root directory for templates explicitly
const templateDir = path.join(__dirname, 'templates');

// Protected HTML pages
app.get('/dashboard.html', requireAuth, (req, res) => {
  res.sendFile('dashboard.html', { root: templateDir });
});

app.get('/nominate.html', requireAuth, (req, res) => {
  res.sendFile('nominate.html', { root: templateDir });
});

// Public HTML pages
app.get('/login.html', (req, res) => {
  res.sendFile('login.html', { root: templateDir });
});

app.get(['/', '/index.html'], (req, res) => {
  res.sendFile('index.html', { root: templateDir });
});

// Database & Server
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err);
  });