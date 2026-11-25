// Toute la configuration vient des variables d'environnement (fichier .env lu par Docker Compose).
// Aucune valeur de connexion n'est codée en dur : pour passer sur un replica set ou un cluster
// shardé (partie II), il suffit de changer MONGO_URI dans le .env.
require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`La variable d'environnement ${name} est obligatoire.`);
  return value;
}

const config = {
  port: Number(process.env.PORT) || 3000,
  mongo: {
    uri: required('MONGO_URI'),
    // Options facultatives, utiles en environnement distribué.
    maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 20,
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000,
  },
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '12h',
  },
  seedDemo: String(process.env.SEED_DEMO).toLowerCase() === 'true',
};

module.exports = config;
