# Guía de Deploy — Labu en VPS Ubuntu

Guía paso a paso para desplegar Labu en un VPS con Ubuntu 22.04 LTS.  
Tiempo estimado: 30–60 minutos la primera vez.

---

## Requisitos previos

- VPS con Ubuntu 22.04 (mínimo 2 GB RAM, 20 GB disco)
- Dominio apuntando a la IP del VPS (registro A en tu DNS)
- Acceso SSH como root o usuario con sudo

---

## 1. Preparar el servidor

```bash
# Actualizar paquetes
sudo apt update && sudo apt upgrade -y

# Crear usuario no-root para la app (recomendado)
sudo adduser deploy
sudo usermod -aG sudo deploy
su - deploy
```

---

## 2. Instalar Node.js 20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # debe mostrar v20.x.x
npm --version
```

---

## 3. Instalar PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib

# Iniciar y habilitar el servicio
sudo systemctl enable --now postgresql

# Crear usuario y base de datos para la app
sudo -u postgres psql <<EOF
CREATE USER rtype1_user WITH PASSWORD 'contraseña_segura_aqui';
CREATE DATABASE rtype1 OWNER rtype1_user;
GRANT ALL PRIVILEGES ON DATABASE rtype1 TO rtype1_user;
EOF
```

---

## 4. Instalar Redis

```bash
sudo apt install -y redis-server

# Habilitar y arrancar
sudo systemctl enable --now redis-server

# Verificar
redis-cli ping   # debe responder PONG
```

Para Redis con contraseña (recomendado en producción), editar `/etc/redis/redis.conf`:
```
requirepass tu_contraseña_redis
```
Luego reiniciar: `sudo systemctl restart redis-server`

---

## 5. Instalar Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
```

---

## 6. Instalar PM2 globalmente

```bash
sudo npm install -g pm2

# Configurar PM2 para arrancar al reiniciar el servidor
pm2 startup
# El comando imprime una línea — ejecutarla con sudo
```

---

## 7. Instalar Certbot (SSL gratuito con Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
```

---

## 8. Clonar el repositorio

```bash
cd /home/deploy
git clone https://github.com/TU_USUARIO/rtype1.git
cd rtype1
npm install --omit=dev
```

---

## 9. Configurar variables de entorno

```bash
cp .env.production.example .env
nano .env   # completar todos los valores reales
```

Campos obligatorios a completar:
- `DB_PASSWORD` — la contraseña creada en el paso 3
- `JWT_SECRET` — cadena aleatoria larga (genera con: `openssl rand -hex 64`)
- `SMTP_*` — credenciales de tu proveedor de email
- `MP_ACCESS_TOKEN` / `MP_WEBHOOK_SECRET` — credenciales MercadoPago producción
- `AWS_*` — credenciales S3 para uploads y backups
- `APP_URL` / `CORS_ORIGIN` — tu dominio real

---

## 10. Crear carpeta de logs

```bash
mkdir -p /home/deploy/rtype1/logs
```

---

## 11. Correr migraciones de base de datos

```bash
cd /home/deploy/rtype1

# Aplicar blueprints (estructura base)
PGPASSWORD=contraseña ls database/data/blueprints/*.sql | sort | xargs -I{} \
  psql -h 127.0.0.1 -U rtype1_user -d rtype1 -f {}

# Aplicar migraciones
PGPASSWORD=contraseña ls database/migrations/*.sql | sort | xargs -I{} \
  psql -h 127.0.0.1 -U rtype1_user -d rtype1 -f {}
```

---

## 12. Configurar Nginx

```bash
# Copiar la configuración de Nginx
sudo cp nginx.conf /etc/nginx/sites-available/rtype1

# Editar el archivo y reemplazar "tudominio.com" con tu dominio real
sudo nano /etc/nginx/sites-available/rtype1

# Habilitar el sitio
sudo ln -s /etc/nginx/sites-available/rtype1 /etc/nginx/sites-enabled/

# Verificar configuración
sudo nginx -t

# Recargar Nginx
sudo systemctl reload nginx
```

---

## 13. Obtener certificado SSL

```bash
# Obtener certificado (reemplazar con tu dominio real)
sudo certbot --nginx -d tudominio.com -d www.tudominio.com

# Verificar renovación automática
sudo certbot renew --dry-run
```

Certbot modifica el bloque HTTPS del nginx.conf automáticamente con las rutas del certificado.

---

## 14. Iniciar la app con PM2

```bash
cd /home/deploy/rtype1
pm2 start ecosystem.config.js --env production

# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs rtype1

# Guardar configuración de PM2 para sobrevivir reinicios
pm2 save
```

---

## 15. Verificar que todo funciona

```bash
# Health check del backend
curl https://tudominio.com/api/health

# Estado de PM2
pm2 status

# Logs de Nginx
sudo tail -f /var/log/nginx/error.log
```

---

## Comandos útiles post-deploy

```bash
# Redeployar (nuevo código)
cd /home/deploy/rtype1
git pull
npm install --omit=dev
pm2 reload rtype1   # recarga sin downtime (graceful)

# Ver logs de la app
pm2 logs rtype1 --lines 100

# Reiniciar completamente
pm2 restart rtype1

# Monitoreo en tiempo real
pm2 monit
```

---

## Variables de entorno obligatorias en producción

| Variable | Descripción |
|---|---|
| `NODE_ENV` | Debe ser `production` |
| `PORT` | Puerto de Node (3000 por defecto) |
| `DB_PASSWORD` | Contraseña de PostgreSQL |
| `JWT_SECRET` | Mínimo 64 caracteres aleatorios |
| `MP_ACCESS_TOKEN` | Token de producción de MercadoPago |
| `MP_WEBHOOK_SECRET` | Clave HMAC del webhook de MercadoPago |
| `AWS_S3_BUCKET` | Bucket para uploads de usuarios |
| `SMTP_HOST` + `SMTP_USER` + `SMTP_PASS` | Credenciales SMTP para emails |

Ver `.env.production.example` para la lista completa.

---

## Seguridad adicional recomendada

```bash
# Firewall: solo puertos necesarios
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Deshabilitar acceso root por SSH
sudo nano /etc/ssh/sshd_config
# → PermitRootLogin no
sudo systemctl restart sshd

# Instalar fail2ban (bloquea IPs con muchos intentos fallidos)
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```
