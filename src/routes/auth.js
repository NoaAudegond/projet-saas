const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Company = require('../models/Company');
const User = require('../models/User');

const router = express.Router();
const SALT_ROUNDS = 12;

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('La variable JWT_SECRET est obligatoire.');
    error.status = 500;
    throw error;
  }
  return secret;
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    company_id: user.company_id,
  };
}

// Inscription d’une entreprise et de son premier administrateur.
router.post('/register', async (req, res, next) => {
  let company;

  try {
    const { company_name, name, email, password } = req.body;
    if (![company_name, name, email, password].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ error: 'company_name, name, email et password sont obligatoires.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const jwtSecret = getJwtSecret();
    company = await Company.create({ name: company_name.trim() });
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await User.create({
      company_id: company._id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password_hash,
      role: 'ADMIN',
    });

    const token = jwt.sign(
      { sub: user._id.toString(), company_id: company._id.toString(), role: user.role },
      jwtSecret,
      { expiresIn: '12h' }
    );

    return res.status(201).json({
      token,
      user: publicUser(user),
      company: { id: company._id, name: company.name },
    });
  } catch (error) {
    // Sans transaction MongoDB (non disponible en configuration standalone), évite une entreprise orpheline.
    if (company && !error.status) {
      await Company.deleteOne({ _id: company._id }).catch(() => {});
    }
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Un compte avec cette adresse existe déjà dans cette entreprise.' });
    }
    return next(error);
  }
});

// company_id est requis car une adresse email peut exister dans plusieurs entreprises.
router.post('/login', async (req, res, next) => {
  try {
    const { company_id, email, password } = req.body;
    if (![company_id, email, password].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({ error: 'company_id, email et password sont obligatoires.' });
    }

    const user = await User.findOne({
      company_id,
      email: email.trim().toLowerCase(),
    }).select('+password_hash');

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Identifiants invalides.' });
    }

    const token = jwt.sign(
      { sub: user._id.toString(), company_id: user.company_id.toString(), role: user.role },
      getJwtSecret(),
      { expiresIn: '12h' }
    );

    return res.json({ token, user: publicUser(user) });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
