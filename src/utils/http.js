const mongoose = require('mongoose');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// Petit helper pour éviter les try/catch répétés dans chaque route.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const isId = (value) => typeof value === 'string' && mongoose.isValidObjectId(value) && /^[a-f0-9]{24}$/i.test(value);

function requireString(value, label, { min = 1, max = 1000 } = {}) {
  if (typeof value !== 'string' || value.trim().length < min) {
    throw httpError(400, `${label} est obligatoire${min > 1 ? ` (${min} caractères minimum)` : ''}.`);
  }
  if (value.trim().length > max) throw httpError(400, `${label} ne doit pas dépasser ${max} caractères.`);
  return value.trim();
}

function optionalString(value, label, max) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw httpError(400, `${label} doit être un texte.`);
  if (value.trim().length > max) throw httpError(400, `${label} ne doit pas dépasser ${max} caractères.`);
  return value.trim();
}

function optionalDate(value, label) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${label} n’est pas une date valide.`);
  return date;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function requireEmail(value) {
  const email = requireString(value, 'L’adresse email', { max: 254 }).toLowerCase();
  if (!EMAIL_RE.test(email)) throw httpError(400, 'L’adresse email n’est pas valide.');
  return email;
}

function requirePassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    throw httpError(400, 'Le mot de passe doit contenir au moins 8 caractères.');
  }
  if (value.length > 128) throw httpError(400, 'Le mot de passe ne doit pas dépasser 128 caractères.');
  return value;
}

module.exports = {
  httpError, asyncHandler, isId, requireString, optionalString, optionalDate, requireEmail, requirePassword,
};
