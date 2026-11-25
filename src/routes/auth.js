const express = require('express');
const bcrypt = require('bcryptjs');
const Company = require('../models/Company');
const User = require('../models/User');
const { signToken, requireAuth } = require('../middleware/auth');
const {
  asyncHandler, httpError, requireString, requireEmail, requirePassword,
} = require('../utils/http');

const router = express.Router();
const SALT_ROUNDS = 12;

function slugify(text) {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'entreprise';
}

async function uniqueSlug(name) {
  const base = slugify(name);
  if (!(await Company.exists({ slug: base }))) return base;
  for (let i = 0; i < 5; i += 1) {
    const candidate = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await Company.exists({ slug: candidate }))) return candidate;
  }
  throw httpError(500, 'Impossible de générer un code entreprise unique.');
}

const companyDto = (company) => ({
  _id: company._id, name: company.name, slug: company.slug, description: company.description,
});

// Création d'une entreprise et de son premier administrateur.
router.post('/register', asyncHandler(async (req, res) => {
  const companyName = requireString(req.body.company_name, 'Le nom de l’entreprise', { max: 120 });
  const name = requireString(req.body.name, 'Votre nom', { max: 120 });
  const email = requireEmail(req.body.email);
  const password = requirePassword(req.body.password);

  const company = await Company.create({ name: companyName, slug: await uniqueSlug(companyName) });
  try {
    const user = await User.create({
      company_id: company._id,
      name,
      email,
      password_hash: await bcrypt.hash(password, SALT_ROUNDS),
      role: 'ADMIN',
    });
    res.status(201).json({ token: signToken(user), user: user.toPublic(), company: companyDto(company) });
  } catch (error) {
    // Pas de transaction en mode standalone : on supprime l'entreprise pour ne pas la laisser orpheline.
    await Company.deleteOne({ _id: company._id }).catch(() => {});
    throw error;
  }
}));

// Connexion : code entreprise + email + mot de passe (un même email peut exister dans plusieurs entreprises).
router.post('/login', asyncHandler(async (req, res) => {
  const slug = requireString(req.body.company, 'Le code entreprise', { max: 60 }).toLowerCase();
  const email = requireEmail(req.body.email);
  if (typeof req.body.password !== 'string' || !req.body.password) throw httpError(400, 'Le mot de passe est obligatoire.');

  const company = await Company.findOne({ slug });
  const user = company
    ? await User.findOne({ company_id: company._id, email }).select('+password_hash')
    : null;

  // Même message dans tous les cas pour ne pas révéler quels comptes existent.
  if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
    throw httpError(401, 'Code entreprise, email ou mot de passe incorrect.');
  }

  res.json({ token: signToken(user), user: user.toPublic(), company: companyDto(company) });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const company = await Company.findById(req.auth.companyId);
  res.json({ user: req.user.toPublic(), company: companyDto(company) });
}));

module.exports = router;
