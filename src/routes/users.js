const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Team = require('../models/Team');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  asyncHandler, httpError, isId, requireString, optionalString, requireEmail, requirePassword,
} = require('../utils/http');

const router = express.Router();
const SALT_ROUNDS = 12;
router.use(requireAuth);

async function findCompanyUser(companyId, userId) {
  if (!isId(userId)) throw httpError(404, 'Utilisateur introuvable.');
  const user = await User.findOne({ _id: userId, company_id: companyId });
  if (!user) throw httpError(404, 'Utilisateur introuvable.');
  return user;
}

async function ensureAnotherAdmin(companyId, userId) {
  const admins = await User.countDocuments({ company_id: companyId, role: 'ADMIN', _id: { $ne: userId } });
  if (admins === 0) throw httpError(400, 'L’entreprise doit garder au moins un administrateur.');
}

// Tous les rôles peuvent voir l'annuaire de leur entreprise (nécessaire pour assigner les tâches).
router.get('/', asyncHandler(async (req, res) => {
  const users = await User.find({ company_id: req.auth.companyId }).sort({ name: 1 });
  res.json({ users: users.map((user) => user.toPublic()) });
}));

router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const role = req.body.role || 'MEMBER';
  if (!User.ROLES.includes(role)) throw httpError(400, 'Rôle invalide.');
  try {
    const user = await User.create({
      company_id: req.auth.companyId, // jamais lu depuis le corps de la requête
      name: requireString(req.body.name, 'Le nom', { max: 120 }),
      email: requireEmail(req.body.email),
      password_hash: await bcrypt.hash(requirePassword(req.body.password), SALT_ROUNDS),
      role,
      job_title: optionalString(req.body.job_title, 'Le poste', 120) || '',
    });
    res.status(201).json({ user: user.toPublic() });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'Cette adresse email existe déjà dans votre entreprise.');
    throw error;
  }
}));

// Un admin peut tout modifier ; un utilisateur peut modifier son propre nom, poste et mot de passe.
router.put('/:userId', asyncHandler(async (req, res) => {
  const isAdmin = req.auth.role === 'ADMIN';
  const isSelf = String(req.auth.userId) === req.params.userId;
  if (!isAdmin && !isSelf) throw httpError(403, 'Vous ne pouvez modifier que votre propre profil.');

  const user = await findCompanyUser(req.auth.companyId, req.params.userId);
  const { name, job_title: jobTitle, email, role, password } = req.body;

  if (name !== undefined) user.name = requireString(name, 'Le nom', { max: 120 });
  if (jobTitle !== undefined) user.job_title = optionalString(jobTitle, 'Le poste', 120);
  if (password) user.password_hash = await bcrypt.hash(requirePassword(password), SALT_ROUNDS);

  if (email !== undefined || role !== undefined) {
    if (!isAdmin) throw httpError(403, 'Seul un administrateur peut changer l’email ou le rôle.');
    if (email !== undefined) user.email = requireEmail(email);
    if (role !== undefined && role !== user.role) {
      if (!User.ROLES.includes(role)) throw httpError(400, 'Rôle invalide.');
      if (user.role === 'ADMIN') await ensureAnotherAdmin(req.auth.companyId, user._id);
      user.role = role;
    }
  }

  try {
    await user.save();
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'Cette adresse email existe déjà dans votre entreprise.');
    throw error;
  }
  res.json({ user: user.toPublic() });
}));

router.delete('/:userId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  if (String(req.auth.userId) === req.params.userId) {
    throw httpError(400, 'Vous ne pouvez pas supprimer votre propre compte.');
  }
  const user = await findCompanyUser(req.auth.companyId, req.params.userId);
  if (user.role === 'ADMIN') await ensureAnotherAdmin(req.auth.companyId, user._id);

  // Nettoyage des références : la personne est retirée des projets et ses tâches sont désassignées.
  await Project.updateMany({ company_id: req.auth.companyId }, { $pull: { members: user._id } });
  await Team.updateMany({ company_id: req.auth.companyId }, { $pull: { members: user._id } });
  await Task.updateMany({ company_id: req.auth.companyId, assigned_to: user._id }, { $set: { assigned_to: null } });
  await user.deleteOne();
  res.json({ message: 'Utilisateur supprimé.' });
}));

module.exports = router;
