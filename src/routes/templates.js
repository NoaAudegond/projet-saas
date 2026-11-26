const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Team = require('../models/Team');
const User = require('../models/User');
const ProjectTemplate = require('../models/ProjectTemplate');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  asyncHandler, httpError, isId, requireString, optionalString, optionalDate,
} = require('../utils/http');

const router = express.Router();
router.use(requireAuth);

async function loadTemplate(req) {
  if (!isId(req.params.templateId)) throw httpError(404, 'Modèle introuvable.');
  const template = await ProjectTemplate.findOne({ _id: req.params.templateId, company_id: req.auth.companyId });
  if (!template) throw httpError(404, 'Modèle introuvable.');
  return template;
}

function parseTags(value, label) {
  if (!Array.isArray(value)) throw httpError(400, `${label} doit être une liste.`);
  const tags = [...new Set(value.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 10);
  if (tags.some((tag) => tag.length > 30)) throw httpError(400, `${label} : 30 caractères maximum par étiquette.`);
  return tags;
}

function parseTasks(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw httpError(400, 'tasks doit être une liste.');
  if (value.length > 50) throw httpError(400, 'Un modèle ne peut pas contenir plus de 50 tâches initiales.');
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw httpError(400, `Tâche ${index + 1} invalide.`);
    const status = item.status ?? 'TODO';
    const priority = item.priority ?? 'MEDIUM';
    if (!Task.STATUSES.includes(status)) throw httpError(400, `Statut invalide pour la tâche ${index + 1}.`);
    if (!Task.PRIORITIES.includes(priority)) throw httpError(400, `Priorité invalide pour la tâche ${index + 1}.`);
    return {
      title: requireString(item.title, `Titre de la tâche ${index + 1}`, { max: 200 }),
      description: optionalString(item.description, 'La description', 10000) || '',
      status,
      priority,
      tags: item.tags === undefined ? [] : parseTags(item.tags, `Étiquettes de la tâche ${index + 1}`),
    };
  });
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

async function parseTeam(req, value) {
  if (value === undefined || value === null || value === '') return null;
  if (!isId(String(value)) || !(await Team.exists({ _id: value, company_id: req.auth.companyId }))) {
    throw httpError(400, 'L’équipe doit appartenir à votre entreprise.');
  }
  return value;
}

router.get('/', asyncHandler(async (req, res) => {
  const templates = await ProjectTemplate.find({ company_id: req.auth.companyId }).sort({ createdAt: -1 });
  res.json({ templates });
}));

router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const tasks = parseTasks(req.body.tasks) || [];
  const color = req.body.color;
  if (color !== undefined && !Project.COLORS.includes(color)) throw httpError(400, 'Couleur invalide.');
  const template = await ProjectTemplate.create({
    company_id: req.auth.companyId,
    name: requireString(req.body.name, 'Le nom du modèle', { max: 160 }),
    description: optionalString(req.body.description, 'La description', 5000) || '',
    color: color || Project.COLORS[0],
    tasks,
    created_by: req.auth.userId,
  });
  res.status(201).json({ template });
}));

router.get('/:templateId', asyncHandler(async (req, res) => {
  res.json({ template: await loadTemplate(req) });
}));

router.put('/:templateId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const template = await loadTemplate(req);
  if (req.body.name !== undefined) template.name = requireString(req.body.name, 'Le nom du modèle', { max: 160 });
  const description = optionalString(req.body.description, 'La description', 5000);
  if (description !== undefined) template.description = description;
  if (req.body.color !== undefined) {
    if (!Project.COLORS.includes(req.body.color)) throw httpError(400, 'Couleur invalide.');
    template.color = req.body.color;
  }
  const tasks = parseTasks(req.body.tasks);
  if (tasks !== undefined) template.tasks = tasks;
  await template.save();
  res.json({ template });
}));

router.delete('/:templateId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const template = await loadTemplate(req);
  await template.deleteOne();
  res.json({ message: 'Modèle supprimé.' });
}));

// Génère un projet et ses tâches initiales à partir du modèle.
router.post('/:templateId/create', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const template = await loadTemplate(req);
  const status = req.body.status ?? 'ACTIVE';
  if (!Project.STATUSES.includes(status)) throw httpError(400, 'Statut de projet invalide.');

  const members = (await parseMembers(req, req.body.members)) || [];
  if (!members.includes(String(req.auth.userId))) members.unshift(String(req.auth.userId));

  const project = await Project.create({
    company_id: req.auth.companyId,
    name: requireString(req.body.name, 'Le nom du projet', { max: 160 }),
    description: optionalString(req.body.description, 'La description', 5000) ?? template.description,
    status,
    color: template.color,
    members,
    team_id: await parseTeam(req, req.body.team_id),
    due_date: optionalDate(req.body.due_date, 'L’échéance') ?? null,
    created_by: req.auth.userId,
  });

  try {
    await Task.insertMany(template.tasks.map((task, index) => ({
      company_id: req.auth.companyId,
      project_id: project._id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      tags: task.tags,
      position: index,
      created_by: req.auth.userId,
    })));
  } catch (error) {
    // Pas de transaction en mode standalone : on évite un projet orphelin.
    await Task.deleteMany({ company_id: req.auth.companyId, project_id: project._id }).catch(() => {});
    await Project.deleteOne({ _id: project._id }).catch(() => {});
    throw error;
  }

  await project.populate('members', 'name email role job_title');
  await project.populate('team_id', 'name color');
  res.status(201).json({ project });
}));

module.exports = router;
