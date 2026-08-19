const mongoose = require('mongoose');

const AthleteSchema = new mongoose.Schema(
  {
    district: { type: String, required: true, index: true },
    chestNumber: { type: String, unique: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dob: { type: Date, required: true },
    category: {
      type: String,
      enum: ['Sub-Junior', 'Junior', 'Senior'],
      required: true
    },
    gender: { type: String, enum: ['Male', 'Female'], required: true },
    aadhaarLast4: { type: String, required: true, maxlength: 4 },
    guardianName: { type: String, required: true },
    institutionName: { type: String, required: true },
    mobileNumber: { type: String, required: true },
    residentialAddress: { type: String, required: true },
    events: [{ type: String, required: true }],
    photoPath: { type: String, required: true },
    dobProofPath: { type: String, required: true },
    status: {
      type: String,
      enum: ['Submitted', 'Verified', 'Clarification'],
      default: 'Submitted'
    }
  },
  { timestamps: true }
);

// Modern async pre-save hook (no next parameter required)
AthleteSchema.pre('save', async function () {
  if (!this.chestNumber) {
    const count = await this.constructor.countDocuments({ district: this.district });
    const distCode = this.district.substring(0, 3).toUpperCase();
    const catCode =
      this.category === 'Sub-Junior'
        ? 'SJ'
        : this.category === 'Junior'
        ? 'JR'
        : 'SR';
    this.chestNumber = `${distCode}-${catCode}-${String(count + 1).padStart(2, '0')}`;
  }
});

module.exports = mongoose.model('Athlete', AthleteSchema);