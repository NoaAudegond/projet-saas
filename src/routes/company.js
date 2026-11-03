const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();
const SALT_ROUNDS = 12;

function requireAuth(req, res, next) {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }

  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'La variable JWT_SECRET est obligatoire.' });
    }
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Jeton invalide ou expiré.' });
  }
}

function requireAdmin(req, res, next) {
  if (req.auth.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Réservé aux administrateurs de l’entreprise.' });
  }
  return next();
}

// Ajouter un membre ou un viewer dans l’entreprise du compte authentifié.
router.post('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, email, password, role = 'VIEWER' } = req.body;
    if (![name, email, password].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ error: 'name, email et password sont obligatoires.' });
    }
    if (!['MEMBER', 'VIEWER'].includes(role)) {
      return res.status(400).json({ error: 'Le rôle doit être MEMBER ou VIEWER.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    // company_id vient du JWT vérifié, jamais du corps de la requête.
    const user = await User.create({
      company_id: req.auth.company_id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: await bcrypt.hash(password, SALT_ROUNDS),
      role,
    });

    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        company_id: user.company_id,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Cette adresse email existe déjà dans votre entreprise.' });
    }
    return next(error);
  }
});

module.exports = router;
