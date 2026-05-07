# Deploiement VPS apres reconstruction

## Ce qui cassait

- Le controle de sante backend testait la base de donnees avec une logique inversee.
- Plusieurs fichiers de deploiement pointaient encore vers `rps-backend/rps-backend`, alors que le depot reel utilise `rps-backend/`.
- Le depot mentionnait une configuration Nginx qui n'existait pas encore.
- Le chargement de Node.js sur le VPS dependait d'un chemin trop precis, donc fragile apres reinstallation.

## Ce qui a ete ajoute

- `scripts/vps/bootstrap-server.sh`
  Prepare un VPS Ubuntu neuf avec Git, Node.js LTS via nvm, npm, PM2, PostgreSQL, Docker, Docker Compose, Nginx, Certbot, UFW et n8n.
- `scripts/vps/.env.server.example`
  Sert de base pour les variables serveur.
- `scripts/vps/nginx.rps.conf`
  Reverse proxy pour le frontend, l'API et n8n.
- `rps-backend/Dockerfile`
- `rps-frontend/nextjs-app/Dockerfile`

## Strategie recommande pour vos outils

- `Git` : source unique de verite du code et des scripts serveur.
- `GitHub Actions` : build, tests et deploiement applicatif, pas reinstallation complete du VPS.
- `Node.js (LTS)` et `npm` : execution et build du frontend/backend.
- `PM2` : supervision du frontend Next.js et du backend NestJS sur le VPS.
- `PostgreSQL` : base principale, soit installee sur l'hote, soit geree via Docker selon vos contraintes de sauvegarde.
- `Nginx` : point d'entree public en 80/443 et reverse proxy vers frontend, backend et n8n.
- `Certbot` : activation et renouvellement TLS.
- `n8n` : automatisations, idealement isole dans Docker.
- `Docker` et `Docker Compose` : services auxiliaires et environnement reproductible. Pour ce projet, le plus simple est un usage hybride: PM2 pour l'app, Docker Compose pour Postgres et n8n si vous voulez limiter les surprises.
- `UFW` : n'exposer que SSH, HTTP et HTTPS.

## Ordre de remise en service

1. Preparer le VPS avec `scripts/vps/bootstrap-server.sh`.
2. Installer la configuration Nginx.
3. Creer les variables d'environnement reelles a partir de `scripts/vps/.env.server.example`.
4. Initialiser PostgreSQL.
5. Lancer GitHub Actions pour deployer l'application.
6. Verifier `api/health`, l'interface web et `n8n/`.

## Commandes de depart

```bash
cp scripts/vps/.env.server.example .env.server
sudo --preserve-env=DEPLOY_USER,NODE_MAJOR,DOMAIN_NAME,PUBLIC_EMAIL ./scripts/vps/bootstrap-server.sh
```

Puis adaptez `scripts/vps/nginx.rps.conf` avec votre domaine avant activation.
