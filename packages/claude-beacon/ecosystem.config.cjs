module.exports = {
  apps: [
    {
      name: 'estelle-beacon',
      script: 'dist/bin.js',
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        BEACON_PORT: '9875',
        CLAUDE_CONFIG_DIR: 'C:\\Users\\LINEGAMES\\.claude-release'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
