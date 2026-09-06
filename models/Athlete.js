/**
 * Athlete Mongoose Model
 * Stores nominated athlete records, competition events, credentials, and verification status.
 */

const mongoose = require('mongoose');

const AthleteSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: '', trim: true },
    dob: { type: Date, required: true },
    gender: { type: String, required: true, enum: ['Male', 'Female', 'Other'] },
    aadhaarLast4: { type: String, default: '0000', trim: true },
    guardianName: { type: String, default: '', trim: true },
    institutionName: { type: String, default: '', trim: true },
    mobileNumber: { type: String, default: '', trim: true },
    residentialAddress: { type: String, default: '', trim: true },
    district: { type: String, default: 'Hyderabad', trim: true },
    events: { type: [String], default: ['Traditional Yogasana'] },
    category: { type: String, default: 'Junior' },
    status: {
      type: String,
      enum: ['Submitted', 'Verified', 'Clarification', 'Pending'],
      default: 'Submitted'
    },
    dobProofType: { type: String, default: 'Birth Certificate', trim: true },
    coachName: { type: String, default: '', trim: true },
    coachMobile: { type: String, default: '', trim: true },
    remarks: { type: String, default: '' },
    photoPath: { type: String, default: '' },
    dobProofPath: { type: String, default: '' },
    chestNumber: { type: String },
    paymentDetails: {
      orderId: { type: String },
      paymentId: { type: String },
      amount: { type: Number },
      status: { type: String, enum: ['PENDING', 'PAID', 'FAILED'] },
      paidAt: { type: Date }
    }
  },
  { timestamps: true }
);

// Indexes optimized for application query patterns:
// 1. Fast unique lookup for admit cards and public certificates
AthleteSchema.index({ chestNumber: 1 });

// 2. High-performance compound index for District Secretary dashboard listing
AthleteSchema.index({ district: 1, createdAt: -1 });

// 3. High-performance compound index for status-filtered queries within a district
AthleteSchema.index({ district: 1, status: 1, createdAt: -1 });

// 4. District & category index for category aggregations and baseline counts
AthleteSchema.index({ district: 1, category: 1 });

// 5. Global date index for Super Admin statewide chronological listing
AthleteSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Athlete || mongoose.model('Athlete', AthleteSchema, 'athletes');