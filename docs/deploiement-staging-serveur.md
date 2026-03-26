# Staging serveur

## Objectif
Ajouter un environnement de staging sur le meme serveur sans casser la production actuelle.

## Fichiers fournis
- `docker-compose.staging.yml`
- `deploy/.env.staging.example`
- `deploy/nginx.staging.conf`

## Principes
- branche GitHub cible : `staging`
- dossier serveur cible : `/opt/atelier_backend_staging/app`
- base PostgreSQL separee : `atelier_staging`
- stockage separe : `/opt/atelier_backend_staging/storage`
- ports separes :
  - frontend staging : `8080`
  - backend host : `3100`
  - uptime kuma : `3002`

## Preparation serveur
```bash
sudo mkdir -p /opt/atelier_backend_staging/storage
sudo mkdir -p /opt/atelier_backend_staging/backups
cd /opt/atelier_backend_staging
sudo git clone --branch staging --single-branch https://github.com/DANIELKIKUNDA/gestion-couture.git app
cd app
cp deploy/.env.staging.example deploy/.env.staging
```

## Ajuster l'environnement staging
Modifier au minimum :
- `PGPASSWORD`
- `AUTH_JWT_SECRET`
- `CORS_ALLOWED_ORIGINS`

## Demarrage
```bash
docker compose -f docker-compose.staging.yml --env-file deploy/.env.staging -p atelier-staging up -d postgres
docker compose -f docker-compose.staging.yml --env-file deploy/.env.staging -p atelier-staging run --rm backend sh /app/deploy/scripts/init-db.sh
docker compose -f docker-compose.staging.yml --env-file deploy/.env.staging -p atelier-staging run --rm backend sh /app/deploy/scripts/migrate.sh
docker compose -f docker-compose.staging.yml --env-file deploy/.env.staging -p atelier-staging up -d --build
```

## Verification
```bash
docker compose -f docker-compose.staging.yml --env-file deploy/.env.staging -p atelier-staging ps
curl http://127.0.0.1:3100/health
curl http://49.12.239.135:8080/health
```

## Mise a jour ulterieure
```bash
cd /opt/atelier_backend_staging/app
git checkout staging
git pull --ff-only origin staging
docker compose -f docker-compose.staging.yml --env-file deploy/.env.staging -p atelier-staging up -d --build
```

## Important
- ne pas reutiliser `docker-compose.yml` pour le staging
- ne pas reutiliser `deploy/.env.production`
- ne pas partager le stockage avec la production
- ne pas partager la base avec la production
