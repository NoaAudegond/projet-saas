const mongoose = require('mongoose');

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('La variable d’environnement MONGO_URI est obligatoire.');
  }

  await mongoose.connect(mongoUri);
  console.log('Connexion à MongoDB établie.');
}

module.exports = connectDB;
