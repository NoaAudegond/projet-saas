const mongoose = require('mongoose');
const config = require('./index');

async function connectDB({ retries = 10, delayMs = 3000 } = {}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(config.mongo.uri, {
        maxPoolSize: config.mongo.maxPoolSize,
        serverSelectionTimeoutMS: config.mongo.serverSelectionTimeoutMS,
      });
      // On masque les éventuels identifiants de l'URI dans les logs.
      console.log(`Connexion à MongoDB établie (${config.mongo.uri.replace(/\/\/[^@]*@/, '//***@')}).`);
      // Crée les index déclarés dans les schémas (index uniques notamment).
      await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
      return;
    } catch (error) {
      console.error(`Tentative ${attempt}/${retries} de connexion à MongoDB échouée : ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = connectDB;
