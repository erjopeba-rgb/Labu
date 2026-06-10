// PM2 ecosystem config — Labu
// Uso: pm2 start ecosystem.config.js --env production

module.exports = {
  apps: [
    {
      name: 'labu',
      script: './backend/server.js',

      // Cluster mode: un proceso por CPU disponible
      instances: 'max',
      exec_mode: 'cluster',

      // Reinicio automático si la memoria supera 500 MB
      max_memory_restart: '500M',

      // Esperar señal SIGINT antes de matar el proceso (graceful shutdown)
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Reintentos ante crash
      max_restarts: 10,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      // Logs
      out_file: './logs/pm2-out.log',
      error_file: './logs/pm2-error.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // Rotación de logs (requiere pm2-logrotate instalado)
      // pm2 install pm2-logrotate

      // Variables de entorno — desarrollo
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      // Variables de entorno — producción
      // Las sensibles se cargan desde el archivo .env del servidor, NO desde aquí
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
