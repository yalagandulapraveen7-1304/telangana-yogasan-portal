const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const SecretarySchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  district: { type: String, required: true, default: 'Hyderabad' },
  role: { type: String, enum: ['SECRETARY', 'SUPER_ADMIN'], default: 'SECRETARY' },
  secretaryName: { type: String, default: 'District Secretary' }
}, { timestamps: true });

SecretarySchema.pre('save', async function () {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

SecretarySchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.models.Secretary || mongoose.model('Secretary', SecretarySchema);