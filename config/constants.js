/**
 * Application Constants & Configuration
 * Centralized settings for environment variables, defaults, and business rules.
 */

const PORT = parseInt(process.env.PORT, 10) || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/telangana_yoga';
const JWT_SECRET = process.env.JWT_SECRET || 'tya_secure_jwt_secret_key_2026';
const IS_PROD = process.env.NODE_ENV === 'production';

// Championship Business Rules
const FEE_PER_EVENT = 260; // ₹260 per event registration

// Razorpay Credentials
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_YOUR_KEY';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'YOUR_SECRET';

// 33 Administrative Districts of Telangana
const TELANGANA_DISTRICTS = [
  'Adilabad', 'Bhadradri Kothagudem', 'Hyderabad', 'Jagtial', 'Jangaon',
  'Jayashankar Bhupalpally', 'Jogulamba Gadwal', 'Kamareddy', 'Karimnagar',
  'Khammam', 'Komaram Bheem Asifabad', 'Mahabubabad', 'Mahabubnagar',
  'Mancherial', 'Medak', 'Medchal Malkajgiri', 'Mulugu', 'Nagarkurnool',
  'Nalgonda', 'Narayanpet', 'Nirmal', 'Nizamabad', 'Peddapalli',
  'Rajanna Sircilla', 'Ranga Reddy', 'Sangareddy', 'Siddipet', 'Suryapet',
  'Vikarabad', 'Wanaparthy', 'Warangal', 'Hanamkonda', 'Yadadri Bhuvanagiri'
];

module.exports = {
  PORT,
  MONGO_URI,
  JWT_SECRET,
  IS_PROD,
  FEE_PER_EVENT,
  RAZORPAY_KEY_ID,
  RAZORPAY_KEY_SECRET,
  TELANGANA_DISTRICTS
};
