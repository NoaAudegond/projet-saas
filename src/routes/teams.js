const express = require('express');
const Team = require('../models/Team');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  asyncHandler, httpError, isId, requireString, optionalString,
} = require('../utils/http');

const router = express.Router();
router.use(requireAuth);

async function loadTeam(req) {
  if (!isId(req.params.teamId)) throw httpError(404, 'Équipe introuvable.');
  const team = await Team.findOne({ _id: req.params.teamId, company_id: req.auth.companyId });
  if (!team) throw httpError(404, 'Équipe introuvable.');
  return team;
}

async function parseMembers(req, value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw httpError(400, 'members doit être une liste d’identifiants.');
  const ids = [...new Set(value.map(String))];
  if (!ids.every(isId)) throw httpError(400, 'Identifiant d’utilisateur invalide.');
  const count = await User.countDocuments({ _id: { $in: ids }, company_id: req.auth.companyId });
  if (count !== ids.length) throw httpError(400, 'Tous les membres doivent appartenir à votre entreprise.');
  return ids;
}

function parseColor(value) {
  if (value === undefined) return undefined;
  if (!Team.COLORS.includes(value)) throw httpError(400, 'Couleur invalide.');
  return value;
}

router.get('/', asyncHandler(async (req, res) => {
  const teams = await Team.find({ company_id: req.auth.companyId })
    .populate('members', 'name email role job_title')
    .sort({ name: 1 });
  res.json({ teams });
}));

router.get('/:teamId', asyncHandler(async (req, res) => {
  res.json({ team: await loadTeam(req) });
}));

router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const members = (await parseMembers(req, req.body.members)) || [];
  try {
    const team = await Team.create({
      company_id: req.auth.companyId,
      name: requireString(req.body.name, 'Le nom de l’équipe', { max: 80 }),
      description: optionalString(req.body.description, 'La description', 500) || '',
      color: parseColor(req.body.color),
      members,
      created_by: req.auth.userId,
    });
    await team.populate('members', 'name email role job_title');
    res.status(201).json({ team });
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'Une équipe porte déjà ce nom dans votre entreprise.');
    throw error;
  }
}));

router.put('/:teamId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const team = await loadTeam(req);
  if (req.body.name !== undefined) team.name = requireString(req.body.name, 'Le nom de l’équipe', { max: 80 });
  const description = optionalString(req.body.description, 'La description', 500);
  if (description !== undefined) team.description = description;
  const color = parseColor(req.body.color);
  if (color !== undefined) team.color = color;
  const members = await parseMembers(req, req.body.members);
  if (members !== undefined) team.members = members;

  try {
    await team.save();
  } catch (error) {
    if (error.code === 11000) throw httpError(409, 'Une équipe porte déjà ce nom dans votre entreprise.');
    throw error;
  }
  await team.populate('members', 'name email role job_title');
  res.json({ team });
}));

// La suppression ne retire pas l'équipe des projets/tâches : elle les désassocie.
router.delete('/:teamId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const team = await loadTeam(req);
  await Project.updateMany({ company_id: req.auth.companyId, team_id: team._id }, { $set: { team_id: null } });
  await Task.updateMany({ company_id: req.auth.companyId, team_id: team._id }, { $set: { team_id: null } });
  await team.deleteOne();
  res.json({ message: 'Équipe supprimée et désassociée des projets et tâches.' });
}));

module.exports = router;
