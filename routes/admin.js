/**
 * Admin Management API Routes
 * Comprehensive administration for competitions, photos, announcements, notices, and audit logging.
 */

'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const sharp = require('sharp');

const Competition = require('../models/Competition');
const Photo = require('../models/Photo');
const Notice = require('../models/Notice');
const Athlete = require('../models/Athlete');
const AdminAuditLog = require('../models/AdminAuditLog');

const { requireAuth, requireRole, apiLimiter } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { getStorageDir, resolveFilePath, fileExists, deleteFile } = require('../services/storage');
const { sanitizeBoundedText, stripHtml } = require('../middleware/sanitize');
const { isValidObjectId, isValidFilename, normalizeDistrict } = require('../utils/validators');
const { logAdminAction } = require('../utils/audit');
const { resolveCompetition } = require('../services/competitionService');

const storageDir = getStorageDir();

// ==========================================
// 1. Photo Management Routes (Admin Protected)
// ==========================================

/**
 * GET /portal/admin/photos
 * Retrieves photos with district scoping for District Secretaries.
 */
router.get('/photos', requireAuth, async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== 'SUPER_ADMIN' && req.user.district !== 'ALL_DISTRICTS') {
      const userDist = normalizeDistrict(req.user.district) || req.user.district;
      query.$or = [{ district: userDist }, { district: 'ALL' }];
    }

    if (req.query.competitionId) {
      query.competitionId = String(req.query.competitionId).toLowerCase().trim();
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    const photos = await Photo.find(query).sort({ order: 1, createdAt: -1 }).lean();
    return res.json({ success: true, count: photos.length, photos });
  } catch (err) {
    console.error('Error fetching admin photos:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve photo records.' });
  }
});

/**
 * POST /portal/admin/photos
 * Uploads a competition photo, creates a thumbnail with sharp, and creates a Photo record.
 */
router.post('/photos', requireAuth, upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please select an image file to upload.' });
    }

    const { filename, path: tempPath } = req.file;
    const body = req.body || {};

    const title = sanitizeBoundedText(body.title || path.parse(req.file.originalname).name, 100);
    const caption = sanitizeBoundedText(body.caption || '', 300);
    const altText = sanitizeBoundedText(body.altText || title, 150);
    const competitionId = (body.competitionId || 'state-championship-2026').toLowerCase().trim();
    
    // Scoped district assignment
    let district = 'ALL';
    if (req.user.role === 'SUPER_ADMIN') {
      district = body.district ? normalizeDistrict(body.district) || body.district : 'ALL';
    } else {
      district = normalizeDistrict(req.user.district) || req.user.district || 'ALL';
    }

    const isCover = body.isCover === 'true' || body.isCover === true;
    const order = typeof body.order === 'number' ? body.order : parseInt(body.order, 10) || 0;
    const status = ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(body.status) ? body.status : 'PUBLISHED';

    // Generate optimized thumbnail using sharp
    let thumbnailFilename = filename;
    try {
      const thumbName = `thumb-${path.parse(filename).name}.webp`;
      const thumbDiskPath = path.join(storageDir, thumbName);

      await sharp(tempPath)
        .resize(480, 320, { fit: 'cover' })
        .toFormat('webp', { quality: 80 })
        .toFile(thumbDiskPath);

      thumbnailFilename = thumbName;
    } catch (sharpErr) {
      console.warn('Sharp thumbnail generation notice:', sharpErr.message);
      thumbnailFilename = filename;
    }

    // If marked as cover, unmark existing covers for this competition
    if (isCover) {
      await Photo.updateMany({ competitionId, isCover: true }, { isCover: false });
    }

    const newPhoto = await Photo.create({
      title,
      caption,
      altText,
      filePath: `/portal/photos/raw/${filename}`,
      thumbnailPath: `/portal/photos/raw/${thumbnailFilename}`,
      competitionId,
      district,
      isCover,
      order,
      status,
      uploadedBy: req.user.email
    });

    await logAdminAction({
      req,
      action: 'UPLOAD_PHOTO',
      targetType: 'PHOTO',
      targetId: String(newPhoto._id),
      details: { title, competitionId, district, isCover, status }
    });

    return res.status(201).json({ success: true, photo: newPhoto });
  } catch (err) {
    console.error('Error uploading photo:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to upload photo.' });
  }
});

/**
 * PATCH /portal/admin/photos/:id
 * Updates metadata, cover status, or publication status of a photo.
 */
router.patch('/photos/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid photo identifier.' });
    }

    const photo = await Photo.findById(id);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found.' });
    }

    // Scope check: Secretaries can only edit photos of their district
    if (req.user.role !== 'SUPER_ADMIN' && req.user.district !== 'ALL_DISTRICTS') {
      const userDist = normalizeDistrict(req.user.district) || req.user.district;
      if (photo.district !== 'ALL' && photo.district !== userDist) {
        return res.status(403).json({ success: false, error: 'Unauthorized to modify photos of another district.' });
      }
    }

    const body = req.body || {};
    const updates = {};

    if (body.title !== undefined) updates.title = sanitizeBoundedText(body.title, 100);
    if (body.caption !== undefined) updates.caption = sanitizeBoundedText(body.caption, 300);
    if (body.altText !== undefined) updates.altText = sanitizeBoundedText(body.altText, 150);
    if (body.competitionId) updates.competitionId = String(body.competitionId).toLowerCase().trim();
    if (body.order !== undefined) updates.order = parseInt(body.order, 10) || 0;
    if (body.status && ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(body.status)) {
      updates.status = body.status;
    }

    if (req.user.role === 'SUPER_ADMIN' && body.district !== undefined) {
      updates.district = body.district ? normalizeDistrict(body.district) || body.district : 'ALL';
    }

    if (body.isCover !== undefined) {
      const isCover = body.isCover === 'true' || body.isCover === true;
      updates.isCover = isCover;
      if (isCover) {
        const targetComp = updates.competitionId || photo.competitionId;
        await Photo.updateMany(
          { _id: { $ne: photo._id }, competitionId: targetComp, isCover: true },
          { isCover: false }
        );
      }
    }

    const updated = await Photo.findByIdAndUpdate(photo._id, updates, {
      returnDocument: 'after',
      runValidators: true
    });

    await logAdminAction({
      req,
      action: 'UPDATE_PHOTO',
      targetType: 'PHOTO',
      targetId: String(photo._id),
      details: updates
    });

    return res.json({ success: true, photo: updated });
  } catch (err) {
    console.error('Error updating photo:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update photo.' });
  }
});

/**
 * DELETE /portal/admin/photos/:id
 * Safely removes photo record and unlinks storage file if not referenced by another record.
 */
router.delete('/photos/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid photo identifier.' });
    }

    const photo = await Photo.findById(id);
    if (!photo) {
      return res.status(404).json({ success: false, error: 'Photo not found.' });
    }

    // Scope check
    if (req.user.role !== 'SUPER_ADMIN' && req.user.district !== 'ALL_DISTRICTS') {
      const userDist = normalizeDistrict(req.user.district) || req.user.district;
      if (photo.district !== 'ALL' && photo.district !== userDist) {
        return res.status(403).json({ success: false, error: 'Unauthorized to delete photos of another district.' });
      }
    }

    const originalFilename = path.basename(photo.filePath || '');
    const thumbFilename = path.basename(photo.thumbnailPath || '');

    await Photo.findByIdAndDelete(photo._id);

    // Only delete physical file if no other record shares it
    if (originalFilename) {
      const countOriginal = await Photo.countDocuments({
        filePath: { $regex: originalFilename, $options: 'i' }
      });
      if (countOriginal === 0) {
        deleteFile(originalFilename);
      }
    }

    if (thumbFilename && thumbFilename !== originalFilename) {
      const countThumb = await Photo.countDocuments({
        thumbnailPath: { $regex: thumbFilename, $options: 'i' }
      });
      if (countThumb === 0) {
        deleteFile(thumbFilename);
      }
    }

    await logAdminAction({
      req,
      action: 'DELETE_PHOTO',
      targetType: 'PHOTO',
      targetId: String(photo._id),
      details: { title: photo.title, filePath: photo.filePath }
    });

    return res.json({ success: true, message: 'Photo safely deleted.' });
  } catch (err) {
    console.error('Error deleting photo:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete photo.' });
  }
});

// ==========================================
// 2. Announcements & Notices Routes (Admin Protected)
// ==========================================

/**
 * GET /portal/admin/notices
 * Retrieves all notices/circulars with district filtering.
 */
router.get('/notices', requireAuth, async (req, res) => {
  try {
    const query = {};
    if (req.user.role !== 'SUPER_ADMIN' && req.user.district !== 'ALL_DISTRICTS') {
      const userDist = normalizeDistrict(req.user.district) || req.user.district;
      query.$or = [{ district: userDist }, { district: 'ALL' }];
    }

    if (req.query.category) {
      query.category = req.query.category;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    const notices = await Notice.find(query).sort({ order: 1, createdAt: -1 }).lean();
    return res.json({ success: true, count: notices.length, notices });
  } catch (err) {
    console.error('Error fetching admin notices:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve notices.' });
  }
});

/**
 * POST /portal/admin/notices
 * Creates an announcement, circular, or marquee notice with optional PDF upload.
 */
router.post('/notices', requireAuth, upload.single('attachment'), async (req, res) => {
  try {
    const body = req.body || {};

    const title = sanitizeBoundedText(body.title, 150);
    if (!title || title.length < 3) {
      return res.status(400).json({ success: false, error: 'Notice title is required (min 3 chars).' });
    }

    const summary = sanitizeBoundedText(body.summary || '', 300);
    const noticeBody = sanitizeBoundedText(body.body || '', 3000);
    const category = ['NOTICE', 'CIRCULAR', 'SCHEDULE_UPDATE', 'EVENT_NOTICE'].includes(body.category)
      ? body.category
      : 'NOTICE';

    const linkUrl = sanitizeBoundedText(body.linkUrl || '', 255);
    const linkLabel = sanitizeBoundedText(body.linkLabel || 'View Details', 60);
    const competitionId = (body.competitionId || '').toLowerCase().trim();

    let district = 'ALL';
    if (req.user.role === 'SUPER_ADMIN') {
      district = body.district ? normalizeDistrict(body.district) || body.district : 'ALL';
    } else {
      district = normalizeDistrict(req.user.district) || req.user.district || 'ALL';
    }

    const status = ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED'].includes(body.status)
      ? body.status
      : 'PUBLISHED';
    const isMarquee = body.isMarquee === 'true' || body.isMarquee === true;
    const order = parseInt(body.order, 10) || 0;
    const marqueeOrder = parseInt(body.marqueeOrder, 10) || 0;

    let attachmentPath = '';
    if (req.file) {
      attachmentPath = `/portal/notices/raw/${req.file.filename}`;
    }

    const newNotice = await Notice.create({
      title,
      summary,
      body: noticeBody,
      category,
      attachmentPath,
      linkUrl,
      linkLabel,
      competitionId,
      district,
      status,
      isMarquee,
      order,
      marqueeOrder,
      uploadedBy: req.user.email,
      startDate: body.startDate ? new Date(body.startDate) : new Date(),
      endDate: body.endDate ? new Date(body.endDate) : undefined
    });

    await logAdminAction({
      req,
      action: 'CREATE_NOTICE',
      targetType: 'NOTICE',
      targetId: String(newNotice._id),
      details: { title, category, isMarquee, status, district }
    });

    return res.status(201).json({ success: true, notice: newNotice });
  } catch (err) {
    console.error('Error creating notice:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create notice.' });
  }
});

/**
 * PATCH /portal/admin/notices/:id
 * Updates an announcement or circular, updates marquee toggle, or replaces attachment.
 */
router.patch('/notices/:id', requireAuth, upload.single('attachment'), async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid notice identifier.' });
    }

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({ success: false, error: 'Notice not found.' });
    }

    // Scope check
    if (req.user.role !== 'SUPER_ADMIN' && req.user.district !== 'ALL_DISTRICTS') {
      const userDist = normalizeDistrict(req.user.district) || req.user.district;
      if (notice.district !== 'ALL' && notice.district !== userDist) {
        return res.status(403).json({ success: false, error: 'Unauthorized to modify notices of another district.' });
      }
    }

    const body = req.body || {};
    const updates = {};

    if (body.title !== undefined) updates.title = sanitizeBoundedText(body.title, 150);
    if (body.summary !== undefined) updates.summary = sanitizeBoundedText(body.summary, 300);
    if (body.body !== undefined) updates.body = sanitizeBoundedText(body.body, 3000);
    if (body.category && ['NOTICE', 'CIRCULAR', 'SCHEDULE_UPDATE', 'EVENT_NOTICE'].includes(body.category)) {
      updates.category = body.category;
    }
    if (body.linkUrl !== undefined) updates.linkUrl = sanitizeBoundedText(body.linkUrl, 255);
    if (body.linkLabel !== undefined) updates.linkLabel = sanitizeBoundedText(body.linkLabel, 60);
    if (body.competitionId !== undefined) updates.competitionId = (body.competitionId || '').toLowerCase().trim();
    if (body.status && ['DRAFT', 'SCHEDULED', 'PUBLISHED', 'EXPIRED', 'ARCHIVED'].includes(body.status)) {
      updates.status = body.status;
    }
    if (body.isMarquee !== undefined) {
      updates.isMarquee = body.isMarquee === 'true' || body.isMarquee === true;
    }
    if (body.order !== undefined) updates.order = parseInt(body.order, 10) || 0;
    if (body.marqueeOrder !== undefined) updates.marqueeOrder = parseInt(body.marqueeOrder, 10) || 0;
    if (body.startDate) updates.startDate = new Date(body.startDate);
    if (body.endDate) updates.endDate = new Date(body.endDate);

    if (req.user.role === 'SUPER_ADMIN' && body.district !== undefined) {
      updates.district = body.district ? normalizeDistrict(body.district) || body.district : 'ALL';
    }

    if (req.file) {
      updates.attachmentPath = `/portal/notices/raw/${req.file.filename}`;
    }

    const updated = await Notice.findByIdAndUpdate(notice._id, updates, {
      returnDocument: 'after',
      runValidators: true
    });

    await logAdminAction({
      req,
      action: 'UPDATE_NOTICE',
      targetType: 'NOTICE',
      targetId: String(notice._id),
      details: updates
    });

    return res.json({ success: true, notice: updated });
  } catch (err) {
    console.error('Error updating notice:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update notice.' });
  }
});

/**
 * DELETE /portal/admin/notices/:id
 * Removes a notice record and safely unlinks attachment file.
 */
router.delete('/notices/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({ success: false, error: 'Invalid notice identifier.' });
    }

    const notice = await Notice.findById(id);
    if (!notice) {
      return res.status(404).json({ success: false, error: 'Notice not found.' });
    }

    // Scope check
    if (req.user.role !== 'SUPER_ADMIN' && req.user.district !== 'ALL_DISTRICTS') {
      const userDist = normalizeDistrict(req.user.district) || req.user.district;
      if (notice.district !== 'ALL' && notice.district !== userDist) {
        return res.status(403).json({ success: false, error: 'Unauthorized to delete notices of another district.' });
      }
    }

    const attachmentFilename = path.basename(notice.attachmentPath || '');
    await Notice.findByIdAndDelete(notice._id);

    if (attachmentFilename) {
      const countAttachment = await Notice.countDocuments({
        attachmentPath: { $regex: attachmentFilename, $options: 'i' }
      });
      if (countAttachment === 0) {
        deleteFile(attachmentFilename);
      }
    }

    await logAdminAction({
      req,
      action: 'DELETE_NOTICE',
      targetType: 'NOTICE',
      targetId: String(notice._id),
      details: { title: notice.title, category: notice.category }
    });

    return res.json({ success: true, message: 'Notice safely deleted.' });
  } catch (err) {
    console.error('Error deleting notice:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete notice.' });
  }
});

// ==========================================
// 3. Competitions Deletion Safeguard Route (Admin Protected)
// ==========================================

/**
 * DELETE /portal/admin/competitions/:id
 * Safeguarded competition removal route forwarding to competition model check.
 */
router.delete('/competitions/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const comp = await resolveCompetition(id);
    if (!comp) {
      return res.status(404).json({ success: false, error: 'Competition not found.' });
    }

    const athleteCount = await Athlete.countDocuments({
      competitionId: comp.competitionId.toLowerCase()
    });

    if (athleteCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete competition '${comp.name}' because it contains ${athleteCount} existing athlete nomination(s). Please archive or close the competition instead.`
      });
    }

    const photoCount = await Photo.countDocuments({
      competitionId: comp.competitionId.toLowerCase()
    });

    if (photoCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete competition '${comp.name}' because it is linked to ${photoCount} gallery photo(s). Please remove or reassign the photos first, or archive the competition.`
      });
    }

    await Competition.findByIdAndDelete(comp._id);

    await logAdminAction({
      req,
      action: 'DELETE_COMPETITION',
      targetType: 'COMPETITION',
      targetId: comp.competitionId,
      details: { name: comp.name, type: comp.type }
    });

    return res.json({
      success: true,
      message: `Competition '${comp.name}' was safely deleted.`
    });
  } catch (err) {
    console.error('Error deleting competition via admin router:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete competition.' });
  }
});

// ==========================================
// 4. Admin Audit Logs Route (Super Admin Only)
// ==========================================

/**
 * GET /portal/admin/audit-logs
 * Paginated forensic trail of administrative mutations.
 */
router.get('/audit-logs', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const skip = Math.max(parseInt(req.query.skip, 10) || 0, 0);

    const query = {};
    if (req.query.targetType) {
      query.targetType = req.query.targetType;
    }
    if (req.query.actorEmail) {
      query.actorEmail = String(req.query.actorEmail).toLowerCase().trim();
    }

    const [logs, total] = await Promise.all([
      AdminAuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AdminAuditLog.countDocuments(query)
    ]);

    return res.json({ success: true, count: logs.length, total, logs });
  } catch (err) {
    console.error('Error fetching audit logs:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve audit trail.' });
  }
});

module.exports = router;
