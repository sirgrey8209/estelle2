module.exports = {
  apps: [
    {
      name: 'estelle-pylon-v2',
      script: 'dist/bin.js',
      cwd: './packages/pylon',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production'
      },
      // Log settings
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
