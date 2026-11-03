# README

## Présentation

Application web de gestion de projet multi-tenant en Node.js, Express et MongoDB. L’interface HTML/CSS/JavaScript est servie directement par Express. Cette première version met en place la création d’une entreprise et de son compte administrateur, la connexion JWT et l’ajout de comptes `MEMBER` ou `VIEWER` par un administrateur.

## Prérequis

- Docker Engine ou Docker Desktop avec Docker Compose v2.
- Un port local libre : `3000`.

Node.js local n’est pas nécessaire pour lancer la version Docker.

## Configuration et démarrage

1. Dans `.env`, remplacez `JWT_SECRET` par une valeur longue et aléatoire. Conservez ce fichier privé; il est ignoré par Git et exclu de l’image Docker.
2. À la racine du dépôt, lancez :

   ```sh
   docker compose up -d --build
   ```

3. Ouvrez <http://localhost:3000>.

Compose démarre MongoDB et attend son contrôle de santé avant de démarrer le serveur web. `MONGO_URI` est injectée au conteneur depuis `docker-compose.yml` et utilise le nom de service `mongodb`; aucune URI n’est codée en dur dans le backend.

### Commandes utiles

```sh
docker compose logs -f web
docker compose logs -f mongodb
docker compose down
```

Les données MongoDB sont conservées dans le volume Docker nommé `mongodb_data` après `docker compose down`. Pour supprimer aussi les données, utilisez `docker compose down -v`.

## Première utilisation

1. Sur la page d’accueil, choisissez **Créer une entreprise**.
2. Renseignez le nom de l’entreprise et les informations du compte administrateur.
3. La session est ouverte automatiquement et le tableau de bord affiche l’identifiant de l’entreprise.
4. Pour ajouter un utilisateur, utilisez le formulaire du tableau de bord. Le rôle `VIEWER` est proposé par défaut; `MEMBER` est aussi disponible.
5. Pour une nouvelle connexion, saisissez l’identifiant de l’entreprise, l’adresse email et le mot de passe du compte.

Les comptes ajoutés ne reçoivent pas de courriel dans cette version. L’administrateur doit communiquer au nouvel utilisateur son identifiant d’entreprise et son mot de passe temporaire par un canal adapté.

## API actuellement disponible

- `POST /auth/register` — crée une entreprise et son administrateur.
- `POST /auth/login` — authentifie un utilisateur à partir de `company_id`, `email` et `password`.
- `POST /company/users` — ajoute un `MEMBER` ou `VIEWER`; requiert `Authorization: Bearer <token>` d’un administrateur.

Les exemples de requêtes et réponses sont dans [SPEC_TECHNIQUE.md](SPEC_TECHNIQUE.md). Les modèles `Project` et `Task` sont définis, mais leurs routes de gestion et leurs écrans ne font pas encore partie de cette version.

## Structure du dépôt

```text
.
├── docker-compose.yml
├── Dockerfile
├── .env
├── package.json
├── src/
│   ├── app.js
│   ├── config/db.js
│   ├── models/ (Company, User, Project, Task)
│   └── routes/ (auth, company)
├── public/
│   ├── index.html
│   ├── dashboard.html
│   └── js/app.js
├── SPEC_TECHNIQUE.md
└── SPEC_FONCTIONNELLE.md
```
