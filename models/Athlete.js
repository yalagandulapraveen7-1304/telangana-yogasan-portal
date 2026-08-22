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
    remarks: { type: String, default: '' },
    photoPath: { type: String, default: '' },
    dobProofPath: { type: String, default: '' },
    chestNumber: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Athlete || mongoose.model('Athlete', AthleteSchema);