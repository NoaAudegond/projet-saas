# Spécifications techniques

## Architecture

- **Serveur :** Node.js 22, Express 4.
- **Interface :** pages HTML/CSS et JavaScript natif, servies par Express depuis `public/`.
- **Données :** MongoDB 8 avec Mongoose 8.
- **Authentification :** JSON Web Token signé avec `JWT_SECRET`, durée de validité de 12 heures.
- **Mots de passe :** hashés avec `bcryptjs` (12 tours); le champ `password_hash` n’est pas sélectionné par défaut par Mongoose.
- **Conteneurs :** Docker Compose orchestre les services `web` et `mongodb`. Le backend lit l’URI depuis `process.env.MONGO_URI`.

## Modèles MongoDB

Tous les documents sont horodatés (`createdAt`, `updatedAt`). Les noms de champs JSON correspondent aux noms Mongoose.

### Company

```json
{
  "_id": "ObjectId",
  "name": "Acme",
  "createdAt": "2026-11-03T18:00:00.000Z",
  "updatedAt": "2026-11-03T18:00:00.000Z"
}
```

### User

```json
{
  "_id": "ObjectId",
  "company_id": "ObjectId",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password_hash": "<hash bcrypt non exposé par l’API>",
  "role": "ADMIN",
  "createdAt": "2026-11-03T18:00:00.000Z",
  "updatedAt": "2026-11-03T18:00:00.000Z"
}
```

`role` est limité à `ADMIN`, `MEMBER`, `VIEWER`. Un index unique composite sur `{ company_id, email }` empêche les doublons d’adresse dans une entreprise. Le même email peut être utilisé dans plusieurs entreprises; la connexion demande donc `company_id`.

### Project

```json
{
  "_id": "ObjectId",
  "company_id": "ObjectId",
  "name": "Refonte du site",
  "description": "Description du projet",
  "created_by": "ObjectId",
  "createdAt": "2026-11-03T18:00:00.000Z",
  "updatedAt": "2026-11-03T18:00:00.000Z"
}
```

### Task

```json
{
  "_id": "ObjectId",
  "company_id": "ObjectId",
  "project_id": "ObjectId",
  "title": "Préparer le cadrage",
  "description": "Rassembler les besoins",
  "status": "TODO",
  "priority": "MEDIUM",
  "assigned_to": null,
  "due_date": null,
  "created_by": "ObjectId",
  "createdAt": "2026-11-03T18:00:00.000Z",
  "updatedAt": "2026-11-03T18:00:00.000Z"
}
```

Valeurs autorisées : `status` = `TODO`, `IN_PROGRESS`, `DONE`; `priority` = `LOW`, `MEDIUM`, `HIGH`.

## API

Toutes les requêtes avec un corps JSON doivent utiliser `Content-Type: application/json`.

### Inscription — `POST /auth/register`

Requête :

```json
{
  "company_name": "Acme",
  "name": "Ada Lovelace",
  "email": "ada@example.com",
  "password": "motdepasse-solide"
}
```

Réponse `201 Created` :

```json
{
  "token": "<jwt valable 12 heures>",
  "user": {
    "id": "672a00000000000000000001",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "ADMIN",
    "company_id": "672a00000000000000000002"
  },
  "company": {
    "id": "672a00000000000000000002",
    "name": "Acme"
  }
}
```

Les champs sont tous obligatoires; le mot de passe doit comporter au moins huit caractères.

### Connexion — `POST /auth/login`

Requête :

```json
{
  "company_id": "672a00000000000000000002",
  "email": "ada@example.com",
  "password": "motdepasse-solide"
}
```

Réponse `200 OK` :

```json
{
  "token": "<jwt valable 12 heures>",
  "user": {
    "id": "672a00000000000000000001",
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "role": "ADMIN",
    "company_id": "672a00000000000000000002"
  }
}
```

Des identifiants incorrects renvoient `401 Unauthorized`.

### Lister les comptes — `GET /company/users`

Réservé à un administrateur; la recherche est filtrée par l’entreprise du JWT.

Réponse `200 OK` :

```json
{
  "users": [
    { "_id": "672a00000000000000000001", "name": "Ada Lovelace", "email": "ada@example.com", "role": "ADMIN", "createdAt": "2026-11-03T18:00:00.000Z" }
  ]
}
```

### Ajouter un compte — `POST /company/users`

En-tête : `Authorization: Bearer <token d’un ADMIN>`.

Requête :

```json
{
  "name": "Grace Hopper",
  "email": "grace@example.com",
  "password": "motdepasse-temporaire",
  "role": "VIEWER"
}
```

`role` peut valoir `MEMBER` ou `VIEWER`; en l’absence de rôle, le serveur utilise `VIEWER`. Le `company_id` est extrait du JWT, jamais accepté du corps de la requête.

Réponse `201 Created` :

```json
{
  "user": {
    "id": "672a00000000000000000003",
    "name": "Grace Hopper",
    "email": "grace@example.com",
    "role": "VIEWER",
    "company_id": "672a00000000000000000002"
  }
}
```

Un appel sans jeton valide renvoie `401`; un rôle autre qu’`ADMIN` renvoie `403`; email déjà présent dans cette entreprise renvoie `409`.

### Projets et tâches — préfixe `/projects`

Toutes les routes ci-dessous exigent `Authorization: Bearer <token>`. Les recherches sont systématiquement limitées au `company_id` du jeton.

- `GET /projects` — tous les rôles; liste les projets de l’entreprise avec leur nombre de tâches.
- `POST /projects` — `ADMIN`; corps `{ "name": "Projet", "description": "Description" }`.
- `PUT /projects/:projectId` — `ADMIN`; modifie `name` et/ou `description`.
- `DELETE /projects/:projectId` — `ADMIN`; supprime le projet et ses tâches.
- `GET /projects/:projectId/tasks` — tous les rôles; liste les tâches du projet.
- `POST /projects/:projectId/tasks` — `ADMIN` ou `MEMBER`; corps `{ "title": "Cadrage", "description": "", "status": "TODO", "priority": "MEDIUM", "assigned_to": null, "due_date": null }`.
- `PATCH /projects/:projectId/tasks/:taskId` — `ADMIN` ou `MEMBER`; modifie les champs transmis, dont le statut.
- `DELETE /projects/:projectId/tasks/:taskId` — `ADMIN`.

Les rôles `VIEWER` peuvent lire les projets et tâches, sans les modifier. Toute tâche assignée à un utilisateur est validée comme appartenant à la même entreprise. Les projets et tâches d’une autre entreprise sont traités comme introuvables.

## Configuration et conteneurs

- `MONGO_URI` est obligatoire pour `src/config/db.js`; Compose l’injecte comme `mongodb://mongodb:27017/gestion_projet`.
- `JWT_SECRET` est injectée par Compose depuis `.env`. En dehors du contexte local d’exercice, il faut définir une valeur aléatoire privée et robuste.
- `PORT` vaut `3000` dans Compose.
- Le volume `mongodb_data` conserve les données entre redémarrages.

## Limites de cette version

Le tableau de bord permet de créer des projets, ajouter des tâches et modifier leur statut. La modification complète des détails d’un projet ou d’une tâche est accessible par API, mais aucun formulaire dédié n’est proposé pour tous ces champs. Les comptes ajoutés reçoivent leur mot de passe temporaire hors application; aucun courriel d’invitation n’est envoyé.
