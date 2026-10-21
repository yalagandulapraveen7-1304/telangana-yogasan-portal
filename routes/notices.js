/**
 * Public Notices & Announcements API Routes
 * Serves published circulars, notices, marquee tickers, and attachment PDFs.
 */

'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const Notice = require('../models/Notice');
const { apiLimiter } = require('../middleware/auth');
const { getStorageDir, resolveFilePath, fileExists } = require('../services/storage');
const { isValidFilename, isValidObjectId } = require('../utils/validators');

const storageDir = getStorageDir();

/**
 * 1. GET /portal/notices
 * Public endpoint to list published notices and circulars.
 */
router.get('/', apiLimiter, async (req, res) => {
  try {
    const nowBuffer = new Date(Date.now() + 5 * 60 * 1000);
    const query = {
      status: 'PUBLISHED',
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: nowBuffer } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: new Date() } }] }
      ]
    };

    if (req.query.category) {
      query.category = req.query.category.toUpperCase().trim();
    }
    if (req.query.competitionId) {
      query.competitionId = String(req.query.competitionId).toLowerCase().trim();
    }
    if (req.query.district && req.query.district !== 'ALL') {
      query.$or = [{ district: req.query.district }, { district: 'ALL' }];
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
    const notices = await Notice.find(query)
      .sort({ order: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, count: notices.length, notices });
  } catch (err) {
    console.error('Error fetching public notices:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve notices.' });
  }
});

/**
 * 2. GET /portal/notices/marquee
 * Public endpoint to retrieve active marquee ticker updates.
 */
router.get('/marquee', apiLimiter, async (_req, res) => {
  try {
    const nowBuffer = new Date(Date.now() + 5 * 60 * 1000);
    const baseQuery = {
      status: 'PUBLISHED',
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: nowBuffer } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: new Date() } }] }
      ]
    };

    // 1. Primary: fetch notices explicitly flagged for marquee
    let items = await Notice.find({ ...baseQuery, isMarquee: true })
      .sort({ marqueeOrder: 1, createdAt: -1 })
      .limit(20)
      .lean();

    // 2. Fallback: If none flagged with isMarquee, automatically display recent published notices
    if (items.length === 0) {
      items = await Notice.find(baseQuery)
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    return res.json({ success: true, count: items.length, items });
  } catch (err) {
    console.error('Error fetching marquee ticker items:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve marquee ticker items.' });
  }
});

/**
 * 3. GET /portal/notices/attachment/:id
 * Public endpoint to safely serve notice attachment files (PDFs).
 */
router.get('/attachment/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid notice identifier.' });
    }

    const notice = await Notice.findById(id);
    if (!notice || !notice.attachmentPath) {
      return res.status(404).json({ success: false, error: 'Notice or attachment not found.' });
    }

    const filename = path.basename(notice.attachmentPath);
    if (!filename || !isValidFilename(filename)) {
      return res.status(400).json({ success: false, error: 'Disallowed file identifier.' });
    }

    const { isValid, filePath } = resolveFilePath(filename);
    if (!isValid || !filePath || !fileExists(filename)) {
      return res.status(404).json({ success: false, error: 'Attachment file not found.' });
    }

    const cleanTitle = (notice.title || 'document').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${cleanTitle}.pdf"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filename, { root: storageDir });
  } catch (err) {
    console.error('Error streaming notice attachment:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to stream notice attachment.' });
  }
});

/**
 * 4. GET /portal/notices/raw/:filename
 * Public fallback endpoint to safely serve notice attachment binaries by filename.
 */
router.get('/raw/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    if (!filename || !isValidFilename(filename)) {
      return res.status(400).json({ success: false, error: 'Invalid file identifier.' });
    }

    const { isValid, filePath } = resolveFilePath(filename);
    if (!isValid || !filePath || !fileExists(filename)) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(path.basename(filename), { root: storageDir });
  } catch (err) {
    console.error('Error streaming raw notice file:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to stream notice file.' });
  }
});

module.exports = router;
