/**
 * Public Photos API Routes
 * Serves published competition gallery photos and binary image files safely.
 */

'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const Photo = require('../models/Photo');
const { apiLimiter } = require('../middleware/auth');
const { getStorageDir, resolveFilePath, fileExists } = require('../services/storage');
const { isValidFilename } = require('../utils/validators');

const storageDir = getStorageDir();

const MIME_MAP = {
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png'
};

/**
 * 1. GET /portal/photos
 * Public endpoint to list published competition photos.
 */
router.get('/', apiLimiter, async (req, res) => {
  try {
    const query = { status: 'PUBLISHED' };

    if (req.query.competitionId) {
      query.competitionId = String(req.query.competitionId).toLowerCase().trim();
    }
    if (req.query.district && req.query.district !== 'ALL') {
      query.$or = [{ district: req.query.district }, { district: 'ALL' }];
    }
    if (req.query.isCover === 'true') {
      query.isCover = true;
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const photos = await Photo.find(query)
      .sort({ order: 1, createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json({ success: true, count: photos.length, photos });
  } catch (err) {
    console.error('Error fetching public photos:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve photo gallery.' });
  }
});

/**
 * 2. GET /portal/photos/raw/:filename
 * Public endpoint to safely serve published gallery photo or thumbnail binaries.
 * Automatically recovers from ephemeral serverless cold starts using MongoDB binary storage.
 */
router.get('/raw/:filename', async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename || !isValidFilename(filename)) {
      return res.status(400).json({ success: false, error: 'Invalid file identifier.' });
    }

    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    // 1. Check local filesystem cache
    const { isValid, filePath } = resolveFilePath(filename);
    if (isValid && filePath && fileExists(filename)) {
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
      return res.sendFile(path.basename(filename), { root: storageDir });
    }

    // 2. Serverless fallback: Retrieve binary buffer from MongoDB Atlas
    const photo = await Photo.findOne({
      $or: [
        { filePath: new RegExp(filename, 'i') },
        { thumbnailPath: new RegExp(filename, 'i') }
      ]
    }).select('+imageData +thumbnailData');

    if (photo) {
      const isThumb = filename.startsWith('thumb-');
      const buffer = (isThumb && photo.thumbnailData && photo.thumbnailData.length > 0)
        ? photo.thumbnailData
        : (photo.imageData || photo.thumbnailData);

      if (buffer && buffer.length > 0) {
        // Cache to storage directory for fast subsequent reads
        try {
          const cachePath = path.join(storageDir, path.basename(filename));
          fs.writeFileSync(cachePath, buffer);
        } catch (_) {}

        res.setHeader('Content-Type', photo.mimeType || contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
        return res.end(buffer);
      }
    }

    // 3. Graceful fallback to default championship photo
    const fallbackPath = path.join(__dirname, '../static/images/gallery/DSC_8586.jpg');
    if (fs.existsSync(fallbackPath)) {
      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.sendFile(path.resolve(fallbackPath));
    }

    return res.status(404).json({ success: false, error: 'Photo not found.' });
  } catch (err) {
    console.error('Error serving photo binary:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to load photo.' });
  }
});

module.exports = router;
