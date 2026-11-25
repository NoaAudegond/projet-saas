const mongoose = require('mongoose');

function notFound(req, res) {
  res.status(404).json({ error: 'Route introuvable.' });
}

// Traduit les erreurs Mongoose en réponses HTTP lisibles plutôt qu'en 500.
// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (error.status) return res.status(error.status).json({ error: error.message });
  if (error instanceof mongoose.Error.ValidationError) {
    const first = Object.values(error.errors)[0];
    return res.status(400).json({ error: first ? first.message : 'Données invalides.' });
  }
  if (error instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: `Valeur invalide pour le champ ${error.path}.` });
  }
  if (error.code === 11000) return res.status(409).json({ error: 'Cette valeur existe déjà.' });
  if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide.' });

  console.error(error);
  return res.status(500).json({ error: 'Une erreur interne est survenue.' });
}

module.exports = { notFound, errorHandler };
