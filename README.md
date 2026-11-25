# Plania : gestion de projet SaaS

Projet BUT Informatique 3e année (Nouveaux paradigmes de bases de données), TD1 partie I.

Application web de gestion de projet multi-entreprises inspirée de Trello : chaque entreprise a son espace isolé avec ses utilisateurs, ses projets et ses tâches, affichées dans un tableau Kanban.

**Stack :** Node.js 22, Express 4, MongoDB 8 (Mongoose), HTML/CSS/JS, Docker Compose.

## Prérequis

- Docker et Docker Compose (v2)
- Le port `3000` libre

Rien d'autre à installer (pas besoin de Node.js ni de MongoDB sur la machine).

## Lancement

À la racine du projet :

```bash
docker compose up -d --build
```

Puis ouvrir **http://localhost:3000**.

Au premier démarrage, l'application crée des données de démonstration (si `SEED_DEMO=true`).

## Comptes de démonstration

Mot de passe pour tous : `demo1234`

| Code entreprise | Email | Rôle |
|---|---|---|
| `acme` | alice@acme.fr | Administrateur |
| `acme` | bob@acme.fr | Membre |
| `acme` | chloe@acme.fr | Membre |
| `acme` | david@acme.fr | Viewer (lecture seule) |
| `globex` | emma@globex.fr | Administrateur |

Sur la page de connexion, des boutons remplissent automatiquement ces comptes. Il est aussi possible de créer sa propre entreprise avec l'onglet « Créer une entreprise ».

## Fonctionnalités

- Création, modification et suppression d'une entreprise (avec un code entreprise pour se connecter)
- Gestion des utilisateurs avec 3 rôles : Administrateur, Membre, Viewer
- Projets avec membres assignés, statut, couleur et échéance
- Tâches avec statut, priorité, personne assignée, échéance et étiquettes
- Tableau Kanban (À faire, En cours, En revue, Terminé) avec glisser-déposer, recherche et filtres
- Tableau de bord et liste « Mes tâches »
- Isolation stricte des données entre entreprises

Le détail est dans `SPEC_FONCTIONNELLE.md` (et la version PDF/Word) et l'architecture dans `SPEC_TECHNIQUE.md`.

## Configuration

Toute la configuration est dans le fichier **`.env`** (lu automatiquement par Docker Compose). Le fichier `.env.example` est un modèle commenté.

| Variable | Défaut | Rôle |
|---|---|---|
| `APP_PORT` | `3000` | Port sur la machine hôte |
| `MONGO_URI` | `mongodb://mongodb:27017/gestion_projet` | Connexion MongoDB |
| `MONGO_MAX_POOL_SIZE` | `20` | Taille du pool de connexions |
| `JWT_SECRET` | | Secret des jetons de connexion (à changer) |
| `JWT_EXPIRES_IN` | `12h` | Durée d'une session |
| `SEED_DEMO` | `true` | Données de démo si la base est vide |

Pour la partie II (replica set / sharding), il suffit de modifier `MONGO_URI`, sans toucher au code :

```bash
MONGO_URI=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/gestion_projet?replicaSet=rs0
```

Après une modification du `.env` : `docker compose up -d` (recrée le conteneur avec la nouvelle config).

## Commandes utiles

```bash
docker compose ps                 # état des conteneurs
docker compose logs -f web        # logs de l'application
docker compose down               # arrêter (les données sont conservées)
docker compose down -v            # arrêter et supprimer les données
```

## Tests

Avec l'application lancée (et les données de démo) :

```bash
node tests/api.test.mjs
```

64 tests : authentification, isolation entre entreprises, droits par rôle, validation, CRUD et suppressions en cascade.

## API

Toutes les routes sont sous `/api` (JSON, jeton dans l'en-tête `Authorization: Bearer <token>`).

| Route | Description |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` | Inscription, connexion, profil |
| `GET / PUT / DELETE /api/company` | Entreprise courante |
| `GET / POST /api/users`, `PUT / DELETE /api/users/:id` | Utilisateurs |
| `GET / POST /api/projects`, `GET / PUT / DELETE /api/projects/:id` | Projets |
| `GET / POST /api/projects/:id/tasks`, `PATCH / DELETE /api/projects/:id/tasks/:taskId` | Tâches |
| `GET /api/tasks/mine` | Mes tâches |
| `GET /health` | État de l'application |

## Structure

```text
.
├── compose.yml
├── Dockerfile
├── .env / .env.example
├── package.json
├── src/
│   ├── app.js
│   ├── config/        # variables d'environnement, connexion MongoDB
│   ├── middleware/    # authentification, gestion des erreurs
│   ├── models/        # Company, User, Project, Task
│   ├── routes/        # auth, company, users, projects, tasks
│   ├── seed/          # données de démonstration
│   └── utils/
├── public/            # interface (index.html, app.html, css, js)
├── tests/
└── docs/img/          # schémas et captures pour les spécifications
```
