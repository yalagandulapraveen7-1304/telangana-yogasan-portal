const path = require('path');
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

async function seed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB Target:', mongoose.connection.name);

    await Secretary.deleteMany({});
    console.log('🧹 Cleared existing accounts.');

    // 1. Seed 33 District Secretary Accounts
    for (const dist of districts) {
      const prefix = dist.toLowerCase().replace(/[^a-z0-9]/g, '');
      const safePass = dist.replace(/\s+/g, '');

      const sec = new Secretary({
        email: `sec_${prefix}@telanganayoga.org`,
        password: `${safePass}@2026`,
        district: dist,
        role: 'SECRETARY',
        secretaryName: `${dist} District Secretary`
      });
      await sec.save();
    }
    console.log(`✅ Seeded 33 District Secretary accounts.`);

    // 2. Seed 10 State Admin Accounts
    for (let i = 1; i <= 10; i++) {
      const admin = new Secretary({
        email: `admin${i}@telanganayoga.org`,
        password: `StateAdmin${i}@2026`,
        district: 'ALL_DISTRICTS',
        role: 'SUPER_ADMIN',
        secretaryName: `State Executive Member ${i}`
      });
      await admin.save();
    }
    console.log(`✅ Seeded 10 Statewide Super Admin accounts (admin1 to admin10).`);

    process.exit(0);
  } catch (err) {
    console.error('Seeding Error:', err);
    process.exit(1);
  }
}

seed();