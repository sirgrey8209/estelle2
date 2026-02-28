module.exports = {
  apps: [
    {
      name: 'estelle-relay',
      script: 'packages/relay/dist/bin.js',
      cwd: '/home/estelle/estelle2',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        PORT: '8080',
        ENV_ID: '0',
        STATIC_DIR: './packages/relay/public'
      }
    },
    {
      name: 'estelle-pylon',
      script: 'packages/pylon/dist/bin.js',
      cwd: '/home/estelle/estelle2',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
        ESTELLE_ENV_CONFIG: JSON.stringify({
          envId: 0,
          pylon: {
            pylonIndex: '3',
            relayUrl: 'ws://localhost:8080',
            configDir: '/home/estelle/.claude',
            credentialsBackupDir: '/home/estelle/.claude-credentials',
            dataDir: '/home/estelle/estelle2/release-data',
            mcpPort: 9876,
            defaultWorkingDir: '/home/estelle'
          }
        })
      }
    }
  ]
};
