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


mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tya_yogasana')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// 1. Serve static assets (CSS, JS)
app.use('/static', express.static(path.join(__dirname, 'static')));

// 2. Serve HTML templates directory directly
app.use(express.static(path.join(__dirname, 'templates'), { index: 'index.html' }));

// 3. Fallback explicit route for root
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: path.join(__dirname, 'templates') });
});
// Static files
app.use('/static', express.static(path.join(__dirname, 'static')));
app.use(express.static(path.join(__dirname, 'templates')));
// Fallback error logger
app.use('/portal/athletes', require('./routes/nominate'));
app.use((err, req, res, next) => {
  console.error('SERVER ERROR LOG:', err.stack);
  res.status(500).send('Internal Server Error: ' + err.message);
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});