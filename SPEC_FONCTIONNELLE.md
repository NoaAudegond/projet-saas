# Spécifications fonctionnelles

## Objectif

Fournir une première base d’application SaaS de gestion de projet accessible depuis un navigateur, avec des espaces séparés par entreprise, une authentification et la gestion initiale des utilisateurs de l’entreprise.

## Acteurs et rôles

- **ADMIN** : crée l’espace entreprise et son compte initial; peut ajouter des membres et viewers de son entreprise.
- **MEMBER** : rôle prévu pour un utilisateur participant à l’entreprise. La gestion et l’édition des projets/tâches ne sont pas encore implémentées dans cette version.
- **VIEWER** : rôle prévu pour consulter les données de l’entreprise. La lecture de projets et tâches n’est pas encore implémentée dans cette version.

Chaque compte appartient à une seule entreprise via `company_id`. L’adresse email est unique au sein d’une entreprise. Une même adresse peut correspondre à des comptes dans des entreprises différentes.

## Parcours utilisateur

### Créer un espace

1. L’utilisateur ouvre la page d’accueil et choisit « Créer une entreprise ».
2. Il renseigne le nom de l’entreprise, son nom, son adresse email et un mot de passe d’au moins huit caractères.
3. Le système crée l’entreprise et le premier compte avec le rôle `ADMIN`.
4. Le système ouvre une session et affiche le tableau de bord avec l’identifiant de l’entreprise.

### Se connecter

1. L’utilisateur fournit l’identifiant de son entreprise, son email et son mot de passe.
2. Le système vérifie le compte dans cette entreprise.
3. Si les identifiants sont valides, le système renvoie un JWT valable 12 heures et le navigateur ouvre le tableau de bord.
4. Si les identifiants sont invalides, un message d’erreur est affiché.

### Ajouter un membre ou viewer

1. Un administrateur connecté ouvre le tableau de bord.
2. Il saisit le nom, l’email, un mot de passe temporaire d’au moins huit caractères et le rôle `MEMBER` ou `VIEWER`.
3. Le système associe le compte à l’entreprise de l’administrateur authentifié.
4. Le système confirme l’ajout ou affiche une erreur, par exemple si l’email existe déjà dans cette entreprise.

Les utilisateurs non administrateurs ne voient pas le formulaire et ne peuvent pas ajouter de comptes via l’API.

### Fermer une session

Le bouton « Déconnexion » supprime le JWT et le profil conservés dans le stockage local du navigateur et renvoie à la page d’accueil.

## Règles de gestion

- Un nouvel espace est créé avec un seul compte initial de rôle `ADMIN`.
- Seuls `ADMIN`, `MEMBER` et `VIEWER` sont des rôles reconnus par le modèle.
- La route d’ajout d’utilisateurs accepte uniquement les rôles `MEMBER` et `VIEWER`; elle ne permet pas de créer un second administrateur.
- Les nouveaux comptes doivent avoir un mot de passe d’au moins huit caractères.
- Chaque compte, projet et tâche est associé à un `company_id`.
- Les projets et tâches possèdent des références d’entreprise. Leur accès fonctionnel n’est pas encore disponible dans cette version.
- Le JWT contient l’identifiant du compte, l’entreprise et le rôle; il expire après 12 heures.

## Écrans livrés

- **Page d’accueil** : inscription d’une entreprise et connexion d’un utilisateur.
- **Tableau de bord** : résumé du profil et de l’entreprise; formulaire d’ajout d’un membre ou viewer pour les administrateurs.

La gestion visuelle des projets et des tâches reste à réaliser dans une étape ultérieure.
