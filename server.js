require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');

const app = express();

// Disable CSP during development for CDNs
app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static assets and uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.static(path.join(__dirname, 'templates'), { index: 'index.html' }));

// Database connection
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tya_yogasana')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// Fallback explicit route for root
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: path.join(__dirname, 'templates') });
});

// Mount Athlete Portal Routes
app.use('/portal/athletes', require('./routes/nominate'));

// Fallback error logger
app.use((err, req, res, next) => {
  console.error('SERVER ERROR LOG:', err.stack);
  res.status(500).send('Internal Server Error: ' + err.message);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 👉 ADD THIS EXACT LINE HERE:
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Your other static routes
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.static(path.join(__dirname, 'templates'), { index: 'index.html' }));
// In server.js (near top with other middleware)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));