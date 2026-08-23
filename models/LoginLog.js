const mongoose = require('mongoose');

const LoginLogSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  district: { type: String, required: true },
  role: { type: String, required: true },
  secretaryName: { type: String, default: 'Unknown' },
  ipAddress: { type: String, default: 'Unknown' },
  userAgent: { type: String, default: 'Unknown' },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], default: 'SUCCESS' },
  loginAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.models.LoginLog || mongoose.model('LoginLog', LoginLogSchema);