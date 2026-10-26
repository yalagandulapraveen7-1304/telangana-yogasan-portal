/**
 * Competitions Management API Routes
 * Supports public competition discovery and Super Admin tournament administration.
 */

'use strict';

const express = require('express');
const router = express.Router();
const Competition = require('../models/Competition');
const Athlete = require('../models/Athlete');
const Photo = require('../models/Photo');
const { requireAuth, requireRole, apiLimiter } = require('../middleware/auth');
const {
  getPublishedCompetitions,
  resolveCompetition,
  ensureDefaultCompetition
} = require('../services/competitionService');
const { sanitizeBoundedText, stripHtml } = require('../middleware/sanitize');
const { logAdminAction } = require('../utils/audit');

/**
 * 1. GET /portal/competitions
 * Public endpoint to list all active/published competitions available for nomination.
 */
router.get('/', apiLimiter, async (_req, res) => {
  try {
    const competitions = await getPublishedCompetitions();
    return res.json({ success: true, count: competitions.length, competitions });
  } catch (err) {
    console.error('Error fetching competitions:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve competition listings.' });
  }
});

/**
 * 1b. GET /portal/competitions/all
 * Protected endpoint for District Secretaries and Admins to view all competitions (including DRAFT/CLOSED).
 */
router.get('/all', requireAuth, async (_req, res) => {
  res.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=30');
  try {
    await ensureDefaultCompetition();
    const competitions = await Competition.find().sort({ createdAt: -1 }).lean();
    return res.json({ success: true, count: competitions.length, competitions });
  } catch (err) {
    console.error('Error fetching all competitions:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve competitions.' });
  }
});

/**
 * 2. GET /portal/competitions/:id
 * Public endpoint to fetch details of a specific competition.
 */
router.get('/:id', apiLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const competition = await resolveCompetition(id);

    if (!competition) {
      return res.status(404).json({ success: false, error: 'Competition not found.' });
    }

    return res.json({ success: true, competition });
  } catch (err) {
    console.error('Error fetching competition:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to retrieve competition details.' });
  }
});

/**
 * 3. POST /portal/competitions
 * Protected endpoint: Super Admin can configure and publish a new competition.
 */
router.post('/', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const body = req.body || {};

    const rawName = body.name;
    if (!rawName || typeof rawName !== 'string' || rawName.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Competition name is required (minimum 3 characters).'
      });
    }

    let slug = body.competitionId;
    if (!slug || typeof slug !== 'string' || slug.trim().length < 2) {
      slug = rawName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 50);
      slug = `${slug}-${Date.now().toString(36)}`;
    } else {
      slug = slug
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '')
        .substring(0, 50);
    }

    const existing = await Competition.findOne({ competitionId: slug });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Competition ID '${slug}' already exists. Please choose a different identifier.`
      });
    }

    const payload = {
      competitionId: slug,
      name: sanitizeBoundedText(rawName, 150),
      type: ['STATE', 'DISTRICT', 'INTER_SCHOOL', 'NATIONAL_TRIALS', 'OPEN'].includes(body.type)
        ? body.type
        : 'STATE',
      description: sanitizeBoundedText(body.description || '', 500),
      venue: sanitizeBoundedText(body.venue || 'Telangana State Sports Complex, Hyderabad', 150),
      status: ['DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'ARCHIVED'].includes(body.status)
        ? body.status
        : 'OPEN',
      minAge: typeof body.minAge === 'number' && body.minAge >= 0 ? body.minAge : 8,
      maxAge: typeof body.maxAge === 'number' && body.maxAge >= body.minAge ? body.maxAge : 100,
      feePerEvent: typeof body.feePerEvent === 'number' && body.feePerEvent >= 0 ? body.feePerEvent : 260,
      currency: 'INR'
    };

    if (body.startDate) payload.startDate = new Date(body.startDate);
    if (body.endDate) payload.endDate = new Date(body.endDate);
    if (body.regStartDate) payload.regStartDate = new Date(body.regStartDate);
    if (body.regEndDate) payload.regEndDate = new Date(body.regEndDate);
    if (body.ageCutoffDate) payload.ageCutoffDate = new Date(body.ageCutoffDate);

    if (Array.isArray(body.disciplines) && body.disciplines.length > 0) {
      payload.disciplines = body.disciplines.map((d) => stripHtml(String(d)).trim()).filter(Boolean);
    }

    if (Array.isArray(body.categories) && body.categories.length > 0) {
      payload.categories = body.categories.map((c) => stripHtml(String(c)).trim()).filter(Boolean);
    }

    if (Array.isArray(body.districtsAllowed) && body.districtsAllowed.length > 0) {
      payload.districtsAllowed = body.districtsAllowed.map((d) => stripHtml(String(d)).trim()).filter(Boolean);
    }

    const newComp = await Competition.create(payload);
    await logAdminAction({
      req,
      action: 'CREATE_COMPETITION',
      targetType: 'COMPETITION',
      targetId: newComp.competitionId,
      details: { name: newComp.name, type: newComp.type, status: newComp.status }
    });
    return res.status(201).json({ success: true, competition: newComp });
  } catch (err) {
    console.error('Error creating competition:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to create competition.' });
  }
});

/**
 * 4. PATCH /portal/competitions/:id
 * Protected endpoint: Super Admin can update competition details and status.
 */
router.patch('/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const comp = await resolveCompetition(id);
    if (!comp) {
      return res.status(404).json({ success: false, error: 'Competition not found.' });
    }

    const updates = {};
    if (body.name) updates.name = sanitizeBoundedText(body.name, 150);
    if (body.type && ['STATE', 'DISTRICT', 'INTER_SCHOOL', 'NATIONAL_TRIALS', 'OPEN'].includes(body.type)) {
      updates.type = body.type;
    }
    if (body.description !== undefined) updates.description = sanitizeBoundedText(body.description, 500);
    if (body.venue !== undefined) updates.venue = sanitizeBoundedText(body.venue, 150);
    if (body.status && ['DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'ARCHIVED'].includes(body.status)) {
      updates.status = body.status;
    }
    if (body.feePerEvent !== undefined && typeof body.feePerEvent === 'number' && body.feePerEvent >= 0) {
      updates.feePerEvent = body.feePerEvent;
    }
    if (body.minAge !== undefined && typeof body.minAge === 'number') updates.minAge = body.minAge;
    if (body.maxAge !== undefined && typeof body.maxAge === 'number') updates.maxAge = body.maxAge;
    if (body.startDate) updates.startDate = new Date(body.startDate);
    if (body.endDate) updates.endDate = new Date(body.endDate);
    if (body.regStartDate) updates.regStartDate = new Date(body.regStartDate);
    if (body.regEndDate) updates.regEndDate = new Date(body.regEndDate);
    if (body.ageCutoffDate) updates.ageCutoffDate = new Date(body.ageCutoffDate);

    if (Array.isArray(body.disciplines)) {
      updates.disciplines = body.disciplines.map((d) => stripHtml(String(d)).trim()).filter(Boolean);
    }
    if (Array.isArray(body.categories)) {
      updates.categories = body.categories.map((c) => stripHtml(String(c)).trim()).filter(Boolean);
    }
    if (Array.isArray(body.districtsAllowed)) {
      updates.districtsAllowed = body.districtsAllowed.map((d) => stripHtml(String(d)).trim()).filter(Boolean);
    }

    const updated = await Competition.findByIdAndUpdate(comp._id, updates, {
      returnDocument: 'after',
      runValidators: true
    });

    await logAdminAction({
      req,
      action: 'UPDATE_COMPETITION',
      targetType: 'COMPETITION',
      targetId: comp.competitionId,
      details: updates
    });

    return res.json({ success: true, competition: updated });
  } catch (err) {
    console.error('Error updating competition:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to update competition.' });
  }
});

/**
 * 5. DELETE /portal/competitions/:id
 * Protected endpoint: Super Admin can safely delete a competition ONLY if it has zero nominations or photos.
 */
router.delete('/:id', requireAuth, requireRole('SUPER_ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const comp = await resolveCompetition(id);
    if (!comp) {
      return res.status(404).json({ success: false, error: 'Competition not found.' });
    }

    // Safety guard: check dependent athlete nominations
    const athleteCount = await Athlete.countDocuments({
      competitionId: comp.competitionId.toLowerCase()
    });

    if (athleteCount > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete competition '${comp.name}' because it contains ${athleteCount} existing athlete nomination(s). Please archive or close the competition instead.`
      });
    }

    // Safety guard: check dependent gallery photos
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
    console.error('Error deleting competition:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to delete competition.' });
  }
});

module.exports = router;

