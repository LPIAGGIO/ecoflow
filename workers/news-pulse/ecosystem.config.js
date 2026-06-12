// PM2 ecosystem para news-pulse (patrón one-shot + cron, como
// futures-settlement / caucion-acreditacion).
// Corre cada 30 minutos, 24/7 (las noticias no respetan horario de rueda).
module.exports = {
  apps: [
    {
      name: "news-pulse",
      script: "./worker.js",
      cwd: "/home/midas/workers/news-pulse",
      exec_mode: "fork",
      instances: 1,
      autorestart: false,
      cron_restart: "*/30 * * * *",
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      time: true,
    },
  ],
};
