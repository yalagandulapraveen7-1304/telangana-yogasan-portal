const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Secretary = require('../models/Secretary');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/telangana_yoga';

const districts = [
  "Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon",
  "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar",
  "Khammam", "Komaram Bheem Asifabad", "Mahabubabad", "Mahabubnagar",
  "Mancherial", "Medak", "Medchal Malkajgiri", "Mulugu", "Nagarkurnool",
  "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli",
  "Rajanna Sircilla", "Ranga Reddy", "Sangareddy", "Siddipet", "Suryapet",
  "Vikarabad", "Wanaparthy", "Warangal", "Hanamkonda", "Yadadri Bhuvanagiri"
];

function generateSecurePassword() {
  return crypto.randomBytes(8).toString('hex') + '!' + (Math.floor(100 + Math.random() * 900));
}

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB Target:', mongoose.connection.name);

    await Secretary.deleteMany({});
    console.log('🧹 Cleared existing accounts.');

    const credentialsLog = {
      generatedAt: new Date().toISOString(),
      districtSecretaries: [],
      superAdmins: []
    };

    // 1. Seed 33 District Secretary Accounts with Secure Random Passwords
    for (const dist of districts) {
      const prefix = dist.toLowerCase().replace(/[^a-z0-9]/g, '');
      const password = process.env.SEED_DEFAULT_PASS || generateSecurePassword();

      const sec = new Secretary({
        email: `sec_${prefix}@telanganayoga.org`,
        password: password,
        district: dist,
        role: 'SECRETARY',
        secretaryName: `${dist} District Secretary`
      });
      await sec.save();

      credentialsLog.districtSecretaries.push({
        district: dist,
        email: sec.email,
        temporaryPassword: password
      });
    }
    console.log(`✅ Seeded 33 District Secretary accounts.`);

    // 2. Seed 10 State Admin Accounts
    for (let i = 1; i <= 10; i++) {
      const password = process.env.SEED_DEFAULT_PASS || generateSecurePassword();
      const admin = new Secretary({
        email: `admin${i}@telanganayoga.org`,
        password: password,
        district: 'ALL_DISTRICTS',
        role: 'SUPER_ADMIN',
        secretaryName: `State Executive Member ${i}`
      });
      await admin.save();

      credentialsLog.superAdmins.push({
        email: admin.email,
        temporaryPassword: password
      });
    }
    console.log(`✅ Seeded 10 Statewide Super Admin accounts (admin1 to admin10).`);

    // Write credentials to a private local file for administrator distribution
    const credsPath = path.join(__dirname, '.seeded_credentials.json');
    fs.writeFileSync(credsPath, JSON.stringify(credentialsLog, null, 2), { mode: 0o600 });
    console.log(`🔒 Credentials saved to secure local file: scripts/.seeded_credentials.json (excluded from Git).`);

    process.exit(0);
  } catch (err) {
    console.error('Seeding Error:', err);
    process.exit(1);
  }
}

seed();