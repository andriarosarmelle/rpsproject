# RPS Platform - Gestion des Risques Psychosociaux

![RPS Platform](https://img.shields.io/badge/Version-1.0.0-blue)
![NestJS](https://img.shields.io/badge/Backend-NestJS_11-green)
![Next.js](https://img.shields.io/badge/Frontend-Next.js_16-green)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-blue)

Plateforme de gestion des Risques Psychosociaux (RPS) pour LaRoche Consulting. Cette application permet de créer, gérer et analyser les campagnes d'évaluation des risques psychosociaux en entreprise.

---

## Table des Matières

1. [Description du Projet](#description-du-projet)
2. [Architecture Technique](#architecture-technique)
3. [Prérequis](#prérequis)
4. [Installation Locale](#installation-locale)
5. [Structure du Projet](#structure-du-projet)
6. [Variables d'Environnement](#variables-denvironnement)
7. [Commandes Utiles](#commandes-utiles)
8. [Déploiement CI/CD](#déploiement-cicd)
9. [Déploiement VPS Manuel](#déploiement-vps-manuel)
10. [Préparations Nécessaires au Déploiement](#préparations-nécessaires-au-déploiement)

---

## Description du Projet

La plateforme RPS (Risques Psychosociaux) est une solution complète pour :

- **Gestion des campagnes** : Création et suivi des campagnes d'évaluation RPS
- **Questionnaires** : Questionnaire standardisé sur les risques psychosociaux
- **Suivi des participants** : Gestion et relance des employés participants
- **Génération de rapports** : Création de rapports détaillés au format Word (.docx)
- **Dashboard analytique** : Visualisation des données et statistiques

### Fonctionnalités Principales

| Module | Fonctionnalités |
|--------|-----------------|
| **Authentification** | Login/Logout, JWT tokens, Protection des routes |
| **Dashboard** | Vue d'ensemble des campagnes, Taux de participation, Scores de stress |
| **Campagnes** | Création de campagnes, Gestion des questions RPS, Suivi des participants |
| **Employés** | Liste des employés, Statut de participation, Relances automatiques |
| **Rapports** | Génération de rapports, Export Word (.docx), Analyse par département |

---

## Architecture Technique

```text
+-----------------------------------------------------------------+
é                        RPS PLATFORM                             é
+-----------------------------------------------------------------é
é                                                                 é
é   +-------------+           +-------------+                   é
é   é   Frontend  é           é   Backend   é                   é
é   é  Next.js 16 é?---------?é  NestJS 11  é                   é
é   é  React 19   é   HTTP    é  TypeORM    é                   é
é   é  Tailwind   é           é    JWT      é                   é
é   +-------------+           +-------------+                   é
é         é                         é                             é
é         é Port 3001              é Port 3000                   é
é         ?                         ?                             é
é   +-----------------------------------------+                  é
é   é              NGINX (Reverse Proxy)     é                  é
é   é              Port 80                    é                  é
é   +-----------------------------------------+                  é
é                                                 é              é
é                                                 ?              é
é                                    +---------------------+    é
é                                    é   PostgreSQL 14+    é    é
é                                    é   Port 5432         é    é
é                                    +---------------------+    é
é                                                                 é
+-----------------------------------------------------------------+
```

### Stack Technologique

| Composant | Technologie | Version |
|-----------|-------------|---------|
| **Frontend** | Next.js | 16.1.6 |
| | React | 19.2.3 |
| | TypeScript | 5.x |
| | Tailwind CSS | 4.x |
| **Backend** | NestJS | 11.0.1 |
| | TypeORM | 0.3.28 |
| | JWT | 11.0.0 |
| | bcrypt | 6.0.0 |
| **Base de données** | PostgreSQL | 14+ |
| **Serveur** | PM2 | - |
| **Proxy** | Nginx | - |

---

## Prérequis

### Logiciels Requis

| Logiciel | Version Minimum | Usage |
|----------|----------------|-------|
| **Node.js** | 22.x | Runtime JavaScript |
| **npm** | 10.x | Gestionnaire de paquets |
| **PostgreSQL** | 14.x | Base de données |
| **Git** | 2.x | Contréle de version |

### Outils Optionnels

| Outil | Usage |
|-------|-------|
| **PM2** | Gestion des processus en production |
| **Nginx** | Reverse proxy et serveur web |
| **Certbot** | Certification SSL (HTTPS) |

---

## Installation Locale

### 1. Cloner le Projet

```bash
git clone <repository-url>
cd rpsproject
```

### 2. Configuration de la Base de Données

#### Création de la base de données

```bash
# Se connecter é PostgreSQL
psql -U postgres

# Créer la base de données
CREATE DATABASE rps_platform;

# Quitter psql
\q
```

#### Initialisation du schéma

Le chemin supporté par l'application est basé sur les migrations TypeORM du backend.
Les références `rps-database/*.sql` encore présentes dans cette documentation sont historiques et ne correspondent pas au workflow réellement utilisé par le projet.

```bash
# Naviguer vers le backend
cd rps-backend

# Appliquer les migrations TypeORM
npm run migration:run

# Optionnel : créer un compte d'amoréage via le seed TS
npm run seed
```

### 3. Backend - Installation et Configuration

```bash
# Naviguer vers le backend
cd rps-backend/rps-backend

# Installer les dépendances
npm install

# Créer le fichier .env é partir de l'exemple
cp .env.example .env

# Modifier les paramétres de connexion DB dans .env
```

### 4. Frontend - Installation et Configuration

```bash
# Naviguer vers le frontend
cd rps-frontend/nextjs-app

# Installer les dépendances
npm install

# Créer le fichier .env.local é partir de l'exemple (si présent)
# ou le créer manuellement
```

### 5. Lancement en Mode Développement

#### Terminal 1 - Backend

```bash
cd rps-backend/rps-backend
npm run start:dev
```

Le backend sera disponible sur : `http://localhost:3000`

#### Terminal 2 - Frontend

```bash
cd rps-frontend/nextjs-app
npm run dev
```

Le frontend sera disponible sur : `http://localhost:3001`

### 6. Compte de Test

Aprés avoir exécuté `npm run seed` :

- **Email** : premiére adresse de `ADMIN_BOOTSTRAP_EMAILS`
- **Mot de passe** : valeur de `ADMIN_BOOTSTRAP_PASSWORD`

---

## Structure du Projet

```text
rpsproject/
+-- .github/
é   +-- workflows/
é       +-- rps_deployment.yml      # Pipeline CI/CD GitHub Actions
+-- rps-backend/
é   +-- rps-backend/
é       +-- src/
é       é   +-- auth/                # Module d'authentification
é       é   +-- campaign/            # Module des campagnes
é       é   +-- company/             # Module des entreprises
é       é   +-- employee/            # Module des employés
é       é   +-- question/            # Module des questions
é       é   +-- response/            # Module des réponses
é       é   +-- report/              # Module des rapports
é       +-- package.json
é       +-- .env.example
+-- rps-frontend/
é   +-- nextjs-app/
é       +-- app/                     # Pages Next.js (App Router)
é       é   +-- (app)/               # Pages authentifiées
é       é   +-- api/                 # API routes
é       é   +-- login/               # Page de connexion
é       +-- components/              # Composants React
é       +-- lib/                    # Utilitaires et API client
é       +-- package.json
+-- scripts/
    +-- vps/
        +-- deploy.sh               # Script de déploiement VPS
        +-- ecosystem.config.cjs   # Configuration PM2
        +-- nginx.rps.conf          # Configuration Nginx
        +-- setup-nginx.sh         # Script d'installation Nginx
```

---

## Variables d'Environnement

### Backend (`.env`)

```env
# Port du serveur
PORT=3000

# Environnement
NODE_ENV=development

# JWT
JWT_SECRET=votre-secret-jwt-tres-securise

# Base de données
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=rps_platform

# Options TypeORM
DB_SYNCHRONIZE=true
DB_LOGGING=false
```

### Frontend (`.env.local`)

```env
# URL de l'API backend
NEXT_PUBLIC_API_URL=http://localhost:3000
API_URL=http://localhost:3000

# Optionnel : Configuration Strapi
NEXT_PUBLIC_STRAPI_URL=
STRAPI_API_TOKEN=
```

---

## Commandes Utiles

### Backend

```bash
# Développement (avec hot-reload)
npm run start:dev

# Build production
npm run build

# Démarrage production (aprés build)
npm run start:prod

# Tests unitaires
npm run test

# Tests avec couverture
npm run test:cov

# Tests e2e
npm run test:e2e
```

### Frontend

```bash
# Développement
npm run dev

# Build production
npm run build

# Démarrage production
npm run start

# Linting
npm run lint
```

---

## Déploiement CI/CD

Le projet utilise GitHub Actions pour le déploiement automatique sur VPS.

### Workflow CI/CD

Le pipeline [`.github/workflows/rps_deployment.yml`](.github/workflows/rps_deployment.yml) exécute :

1. **Backend CI** : Installation des dépendances, tests unitaires, build
2. **Frontend CI** : Installation des dépendances, build
3. **Deploy** : Déploiement sur VPS si les tests passent

### Déclencheurs

| Evénement | Branche | Action |
|-----------|---------|--------|
| Push | `main` | Build + déploiement sur `rps_dev` |
| Push | `deploy` | Build + déploiement sur `development` |
| Pull Request | `main` | Tests seulement |
| Manual | - | Déploiement manuel |

### Configuration des Secrets GitHub

Pour configurer le déploiement, ajouter ces secrets dans les settings du repository :

| Secret | Description | Exemple |
|--------|-------------|---------|
| `VPS_HOST` | Adresse IP du VPS | `192.168.1.100` |
| `VPS_USER` | Utilisateur SSH | `ubuntu` |
| `VPS_SSH_PRIVATE_KEY` | Clé privée SSH | `-----BEGIN...` |
| `VPS_PORT` | Port SSH (optionnel) | `22` |
| `JWT_SECRET` | Secret JWT backend | `chaine-securisee` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Paramétres PostgreSQL backend | `localhost`, `5432`, ... |

---

## Déploiement VPS Manuel

### Prérequis VPS

1. Serveur Ubuntu 20.04+ avec accés root
2. PostgreSQL installé
3. Node.js 22.x installé
4. Nginx installé
5. Accés SSH avec clé privée

### Etapes de Déploiement

#### 1. Connexion au VPS

```bash
ssh -i votre-cle-privee user@vps-ip
```

#### 2. Préparation des Répertoires

```bash
# Créer les répertoires
sudo mkdir -p /var/www/rps-dev /var/www/rps-prod

# Définir les permissions
sudo chown $USER:$USER /var/www/rps-dev /var/www/rps-prod
```

#### 3. Installation de PM2

```bash
# Installation globale de PM2
sudo npm install -g pm2

# Configuration du démarrage automatique
pm2 startup
# Suivre les instructions affichées
```

#### 4. Clône du Repository

```bash
cd /var/www/rps-prod
git clone -b main https://github.com/votre-repo/rpsproject.git .
```

#### 5. Configuration des Variables d'Environnement

```bash
# Backend
cd rps-backend/rps-backend
cp .env.example .env
nano .env  # Modifier avec les valeurs de production

# Frontend
cd ../../rps-frontend/nextjs-app
nano .env.local  # Créer avec les URLs de production
```

#### 6. Installation et Build

```bash
# Backend
cd /var/www/rps-prod/rps-backend/rps-backend
npm ci
npm run build

# Frontend
cd /var/www/rps-prod/rps-frontend/nextjs-app
npm ci
npm run build
```

#### 7. Configuration de PM2

```bash
cd /var/www/rps-prod
pm2 start scripts/vps/ecosystem.config.cjs
pm2 save
```

#### 8. Configuration Nginx

```bash
# Copier la configuration
sudo cp scripts/vps/nginx.rps.conf /etc/nginx/sites-available/rps.conf

# Activer le site
sudo ln -s /etc/nginx/sites-available/rps.conf /etc/nginx/sites-enabled/

# Tester la configuration
sudo nginx -t

# Redémarrer Nginx
sudo systemctl reload nginx
```

---

## Préparations Nécessaires au Déploiement

Avant de déployer en production, effectuez les préparation suivantes :

### 1. Configuration de la Base de Données

```bash
# Se connecter é PostgreSQL sur le VPS
sudo -u postgres psql

# Créer l'utilisateur et la base de données
CREATE USER rpsuser WITH PASSWORD 'mot_de_passe_securise';
CREATE DATABASE rps_platform OWNER rpsuser;
GRANT ALL PRIVILEGES ON DATABASE rps_platform TO rpsuser;

# Quitter psql
\q

# Modifier pg_hba.conf pour permettre l'authentification
# Ou exécuter :
sudo -u postgres psql -c "ALTER USER rpsuser WITH PASSWORD 'mot_de_passe_securise';"
```

### 2. Configuration des Variables d'Environnement de Production

Créez les fichiers `.env` avec des valeurs sécurisées :

```env
# BACKEND - .env
NODE_ENV=production
PORT=3000
JWT_SECRET=generer-une-cle-securise-avec-openssl-random
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=rpsuser
DB_PASSWORD=mot_de_passe_securise
DB_NAME=rps_platform
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

```env
# FRONTEND - .env.local
NEXT_PUBLIC_API_URL=http://votre-ip-publique
API_URL=http://votre-ip-publique
```

### 3. Génération de la Clé JWT

```bash
# Générer une clé secréte sécurisée
openssl rand -base64 32
```

### 4. Configuration du Pare-feu (UFW)

```bash
# Activer le pare-feu
sudo ufw enable

# Autoriser SSH
sudo ufw allow ssh

# Autoriser HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Vérifier le statut
sudo ufw status
```

### 5. Préparation du Déploiement GitHub Actions

1. **Générer une clé SSH** pour le déploiement :

```bash
# Sur votre machine locale
ssh-keygen -t ed25519 -C "github-actions@vps" -f deploy_key

# Ajouter la clé publique sur le VPS
cat deploy_key.pub >> ~/.ssh/authorized_keys
```

2. **Ajouter les secrets** dans GitHub :
   - `VPS_SSH_PRIVATE_KEY` : Contenu de `deploy_key` (clé privée)
   - `VPS_HOST` : IP publique du VPS
   - `VPS_USER` : Nom d'utilisateur SSH
   - `VPS_PORT` : Port SSH (22 par défaut)
   - `JWT_SECRET` : Secret JWT du backend
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` : paramétres PostgreSQL du backend

### 6. Vérification Post-Déploiement

Aprés le déploiement, vérifiez :

```bash
# Statut des services PM2
pm2 status

# Logs du backend
pm2 logs rps-backend

# Logs du frontend
pm2 logs rps-frontend

# Test de connectivité
curl http://localhost:3000/health
curl http://localhost:3001

# Vérification Nginx
sudo nginx -t
sudo systemctl status nginx
```

---

## Dépannage

### Problémes Courants

| Probléme | Solution |
|----------|----------|
| **Erreur de connexion é la DB** | Vérifier les credentials dans `.env` |
| **Port déjé utilisé** | Vérifier que les ports 3000/3001 sont libres |
| **Build échoue** | Nettoyer le cache : `npm run clean` ou supprimer `node_modules` |
| **Erreur JWT** | Vérifier que `JWT_SECRET` est identique entre backend et frontend |
| **502 Bad Gateway** | Vérifier que PM2 fonctionne et que les services sont démarrés |

### Commandes de Diagnostic

```bash
# Voir les processus PM2
pm2 status

# Voir les logs en temps réel
pm2 logs

# Redémarrer un service
pm2 restart rps-backend

# Nettoyer et redémarrer
pm2 delete all
pm2 start scripts/vps/ecosystem.config.cjs
```

---

## Support

Pour toute question ou probléme, contacter l'équipe de développement.

---

Derniére mise é jour : Mars 2026
