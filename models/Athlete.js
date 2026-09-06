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

// Indexes for query performance and fast lookup
AthleteSchema.index({ chestNumber: 1 });
AthleteSchema.index({ district: 1, category: 1 });
AthleteSchema.index({ status: 1 });
AthleteSchema.index({ createdAt: -1 });

module.exports = mongoose.models.Athlete || mongoose.model('Athlete', AthleteSchema, 'athletes');