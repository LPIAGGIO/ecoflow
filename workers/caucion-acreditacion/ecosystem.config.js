module.exports = {
  apps: [
    {
      name: 'caucion-acreditacion',
      script: './worker.js',
      cwd: '/home/midas/workers/caucion-acreditacion',
      // No daemon: corre, termina, espera al próximo tick del cron.
      autorestart: false,
      // Cron: 7:00 AM ART de lunes a viernes.
      cron_restart: '0 7 * * 1-5',
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
