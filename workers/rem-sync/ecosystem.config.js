module.exports = {
  apps: [
    {
      name: "rem-sync",
      script: "worker.js",
      // El REM se publica a principios de cada mes (con ~1 mes de lag: la
      // encuesta de mayo sale a principios de junio). Corremos a las 12:00 ART
      // los dias 4, 7, 10 y 14 para captar la publicacion sin depender del dia
      // exacto. El worker es idempotente (upsert por variable+period_date), asi
      // que repetir con la misma encuesta es un no-op; en cuanto aparece la
      // nueva, la levanta. TZ del VPS = America/Argentina.
      cron_restart: "0 12 4,7,10,14 * *",
      autorestart: false,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "200M",
    },
  ],
};
