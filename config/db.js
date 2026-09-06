/**
 * Database Connection Manager
 * Provides cached, resilient connection handling for both long-running and serverless runtimes.
 */

const mongoose = require('mongoose');
const { MONGO_URI } = require('./constants');

let isConnected = false;

async function connectDB() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  try {
    const conn = await mongoose.connect(MONGO_URI);
    isConnected = true;
    return conn;
  } catch (err) {
    console.error('Database connection failure:', err.message);
    throw err;
  }
}

module.exports = { connectDB };
