module.exports = {
  apps: [
    {
      name: "telegram-notifier",
      script: "worker.js",
      // Servicio permanente (no cron): mantiene el long-poll de getUpdates
      // abierto y evalua las alertas cada 30s.
      autorestart: true,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "150M",
    },
  ],
};
