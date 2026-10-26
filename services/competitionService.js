/**
 * Competition Service
 * Manages competition retrieval, automatic default seeding, registration eligibility,
 * and date cutoff validations.
 */

'use strict';

const Competition = require('../models/Competition');
const { calculateAgeCategory } = require('../utils/category');

const DEFAULT_COMPETITION_ID = 'tysc-state-2026';

const DEFAULT_COMPETITION = {
  competitionId: DEFAULT_COMPETITION_ID,
  name: '13th Telangana State Inter-District Yogasana Sports Championship',
  type: 'STATE',
  description: 'Official state championship and selection trials conducted in accordance with Yoga Federation of India rules.',
  venue: 'Telangana State Sports Complex / District Headquarters, Hyderabad',
  startDate: new Date('2026-11-15'),
  endDate: new Date('2026-11-18'),
  regStartDate: new Date('2026-01-01'),
  regEndDate: new Date('2026-12-31'),
  status: 'OPEN',
  ageCutoffDate: new Date('2026-12-31'),
  minAge: 8,
  maxAge: 100,
  feePerEvent: 260,
  currency: 'INR',
  disciplines: [
    'Traditional Yogasana',
    'Artistic Yogasana (Single)',
    'Artistic Yogasana (Pair)',
    'Rhythmic Yogasana (Pair)',
    'Free Flow'
  ],
  categories: ['Sub-Junior', 'Junior', 'Senior'],
  districtsAllowed: ['ALL'],
  isDefault: true
};

let cachedDefaultComp = null;

/**
 * Ensures at least the default competition exists in the database.
 * Caches in-memory to prevent repeated redundant DB lookups on high-frequency endpoints.
 */
async function ensureDefaultCompetition() {
  if (cachedDefaultComp) {
    return cachedDefaultComp;
  }
  try {
    let comp = await Competition.findOne({ competitionId: DEFAULT_COMPETITION_ID });
    if (!comp) {
      comp = await Competition.create(DEFAULT_COMPETITION);
    }
    cachedDefaultComp = comp;
    return comp;
  } catch (err) {
    if (err.code === 11000) {
      cachedDefaultComp = await Competition.findOne({ competitionId: DEFAULT_COMPETITION_ID });
      return cachedDefaultComp;
    }
    throw err;
  }
}

/**
 * Retrieves all published or open competitions for public nomination.
 */
async function getPublishedCompetitions() {
  await ensureDefaultCompetition();
  const now = new Date();

  const competitions = await Competition.find({
    status: { $in: ['OPEN', 'PUBLISHED'] }
  })
    .sort({ isDefault: -1, startDate: 1, createdAt: -1 })
    .lean();

  // Filter by registration window if dates are set
  return competitions.filter((c) => {
    if (c.status === 'OPEN') {
      if (c.regStartDate && now < new Date(c.regStartDate)) return false;
      if (c.regEndDate && now > new Date(c.regEndDate)) return false;
      return true;
    }
    return c.status === 'PUBLISHED';
  });
}

/**
 * Finds a competition by ID (slug or ObjectId) or falls back to default competition.
 */
async function resolveCompetition(idOrSlug) {
  if (!idOrSlug || idOrSlug === 'default' || idOrSlug === DEFAULT_COMPETITION_ID) {
    return ensureDefaultCompetition();
  }

  const query = {
    $or: [{ competitionId: String(idOrSlug).trim().toLowerCase() }]
  };

  if (/^[0-9a-fA-F]{24}$/.test(idOrSlug)) {
    query.$or.push({ _id: idOrSlug });
  }

  const comp = await Competition.findOne(query);
  return comp || null;
}

/**
 * Validates athlete eligibility for a given competition.
 */
function validateEligibility(competition, athleteData) {
  if (!competition) {
    return { isValid: false, error: 'Competition not found.' };
  }

  // 1. Check registration status
  if (competition.status !== 'OPEN' && competition.status !== 'PUBLISHED') {
    return {
      isValid: false,
      error: `Registration for "${competition.name}" is currently closed (${competition.status.toLowerCase()}).`
    };
  }

  const now = new Date();
  if (competition.regStartDate && now < new Date(competition.regStartDate)) {
    return {
      isValid: false,
      error: `Registration for this competition opens on ${new Date(competition.regStartDate).toLocaleDateString('en-GB')}.`
    };
  }
  if (competition.regEndDate && now > new Date(competition.regEndDate)) {
    return {
      isValid: false,
      error: `Registration for this competition closed on ${new Date(competition.regEndDate).toLocaleDateString('en-GB')}.`
    };
  }

  // 2. Check age against competition cutoff
  if (athleteData.dob) {
    const dob = new Date(athleteData.dob);
    if (!isNaN(dob.getTime())) {
      const cutoff = competition.ageCutoffDate || new Date(new Date().getFullYear(), 11, 31);
      const age = (new Date(cutoff) - dob) / (1000 * 60 * 60 * 24 * 365.25);

      if (competition.minAge && age < competition.minAge) {
        return {
          isValid: false,
          error: `Athlete does not meet the minimum age of ${competition.minAge} years for this competition (Championship Age: ${Math.floor(age)}).`
        };
      }
      if (competition.maxAge && age > competition.maxAge) {
        return {
          isValid: false,
          error: `Athlete exceeds the maximum age of ${competition.maxAge} years for this competition.`
        };
      }
    }
  }

  // 3. Check district eligibility
  if (
    athleteData.district &&
    competition.districtsAllowed &&
    !competition.districtsAllowed.includes('ALL') &&
    competition.districtsAllowed.length > 0
  ) {
    const normDist = String(athleteData.district).trim().toLowerCase();
    const isAllowed = competition.districtsAllowed.some(
      (d) => d.trim().toLowerCase() === normDist || d === 'ALL'
    );
    if (!isAllowed) {
      return {
        isValid: false,
        error: `Athletes from ${athleteData.district} district are not eligible for this competition.`
      };
    }
  }

  // 4. Check selected disciplines
  if (athleteData.events && Array.isArray(athleteData.events) && competition.disciplines?.length > 0) {
    const invalidEvents = athleteData.events.filter(
      (ev) => !competition.disciplines.includes(ev)
    );
    if (invalidEvents.length > 0) {
      return {
        isValid: false,
        error: `Discipline(s) not offered in this competition: ${invalidEvents.join(', ')}`
      };
    }
  }

  return { isValid: true };
}

module.exports = {
  DEFAULT_COMPETITION_ID,
  DEFAULT_COMPETITION,
  ensureDefaultCompetition,
  getPublishedCompetitions,
  resolveCompetition,
  validateEligibility
};
