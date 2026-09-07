/**
 * Database Connection Manager
 * Provides cached, resilient connection handling for both long-running and serverless runtimes.
 */

const mongoose = require('mongoose');
const { MONGO_URI } = require('./constants');

let isConnected = false;
let cachedPromise = null;

const POOL_OPTIONS = {
  maxPoolSize: 20,              // Cap concurrent sockets to prevent Atlas connection exhaustion
  minPoolSize: 5,               // Maintain warm connections for instant response
  serverSelectionTimeoutMS: 5000,// Fail-fast if database cluster is unreachable
  socketTimeoutMS: 45000,       // Prune idle/stale sockets
  connectTimeoutMS: 10000,      // Connection establishment deadline
  family: 4                     // Prioritize IPv4 for faster DNS lookup
};

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  // Reset stale cache if disconnected or closed
  if (mongoose.connection.readyState === 0) {
    isConnected = false;
    cachedPromise = null;
  }

  // Prevent connection thundering herd by reusing active connection promise
  if (cachedPromise) {
    return cachedPromise;
  }

  cachedPromise = mongoose.connect(MONGO_URI, POOL_OPTIONS)
    .then((conn) => {
      isConnected = true;
      return conn;
    })
    .catch((err) => {
      cachedPromise = null;
      isConnected = false;
      console.error('Database connection failure:', err.message);
      throw err;
    });

  return cachedPromise;
}

// Reset cached state when connection is lost or explicitly disconnected
mongoose.connection.on('disconnected', () => {
  isConnected = false;
  cachedPromise = null;
});
mongoose.connection.on('close', () => {
  isConnected = false;
  cachedPromise = null;
});

module.exports = { connectDB, POOL_OPTIONS };
