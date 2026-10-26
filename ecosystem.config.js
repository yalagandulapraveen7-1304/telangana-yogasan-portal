/**
 * PM2 Process Manager Configuration for Yogasana Portal
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 reload ecosystem.config.js --env production (zero-downtime)
 *   pm2 logs yogasana-portal
 */

'use strict';

module.exports = {
  apps: [
    {
      name: 'yogasana-portal',
      script: './server.js',
      instances: 'max', // Utilize all available CPU cores in cluster mode
      exec_mode: 'cluster',
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
      restart_delay: 2000,
      kill_timeout: 5000
    }
  ]
};
