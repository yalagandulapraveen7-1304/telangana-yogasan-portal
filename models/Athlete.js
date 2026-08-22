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

// Safe Auto-generation of Chest Number before saving
AthleteSchema.pre('save', async function (next) {
  if (!this.chestNumber) {
    try {
      // 1. Safe District Code (3 letters)
      const distStr = (this.district || 'HYD').trim().toUpperCase();
      const distCode = distStr.length >= 3 ? distStr.substring(0, 3) : 'HYD';

      // 2. Safe Category Code
      let catCode = 'JR';
      const cat = (this.category || '').toLowerCase();
      if (cat.includes('sub')) {
        catCode = 'SJ';
      } else if (cat.includes('sen')) {
        catCode = 'SR';
      }

      // 3. Count existing athletes in category to determine serial number
      const count = await mongoose.model('Athlete', AthleteSchema).countDocuments({
        district: this.district,
        category: this.category
      });

      const serial = String(count + 1).padStart(2, '0');
      this.chestNumber = `${distCode}-${catCode}-${serial}`;
    } catch (err) {
      // Fallback in case counting fails
      this.chestNumber = `HYD-JR-${Math.floor(10 + Math.random() * 90)}`;
    }
  }
  next();
});

module.exports = mongoose.models.Athlete || mongoose.model('Athlete', AthleteSchema);