module.exports = {
  apps: [
    {
      name: "equity-snapshot",
      script: "worker.js",
      // 18:00 ART lun-vie (30 min post-cierre). TZ del VPS = America/Argentina.
      cron_restart: "0 18 * * 1-5",
      autorestart: false,
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
