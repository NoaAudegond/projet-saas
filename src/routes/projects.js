const express = require('express');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  asyncHandler, httpError, isId, requireString, optionalString, optionalDate,
} = require('../utils/http');

const router = express.Router();
router.use(requireAuth);

const isAdmin = (req) => req.auth.role === 'ADMIN';
const canEdit = (req) => ['ADMIN', 'MEMBER'].includes(req.auth.role);

// Filtre de visibilité : un admin voit tous les projets de l'entreprise,
// les autres uniquement ceux auxquels ils sont assignés. Toujours borné au company_id.
function visibleFilter(req) {
  const filter = { company_id: req.auth.companyId };
  if (!isAdmin(req)) filter.members = req.auth.userId;
  return filter;
}

async function loadProject(req) {
  if (!isId(req.params.projectId)) throw httpError(404, 'Projet introuvable.');
  const project = await Project.findOne({ ...visibleFilter(req), _id: req.params.projectId });
  if (!project) throw httpError(404, 'Projet introuvable.');
  return project;
}

// Vérifie qu'une liste d'utilisateurs appartient bien à l'entreprise du compte connecté.
async function parseMembers(req, value) {
  if (!Array.isArray(value)) throw httpError(400, 'members doit être une liste d’identifiants.');
  const ids = [...new Set(value.map(String))];
  if (!ids.every(isId)) throw httpError(400, 'Identifiant d’utilisateur invalide.');
  const count = await User.countDocuments({ _id: { $in: ids }, company_id: req.auth.companyId });
  if (count !== ids.length) throw httpError(400, 'Tous les membres doivent appartenir à votre entreprise.');
  return ids;
}

function ensureMemberOfProject(project, userId) {
  return project.members.some((id) => String(id) === String(userId));
}

async function parseAssignee(project, value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (!isId(String(value)) || !ensureMemberOfProject(project, value)) {
    throw httpError(400, 'La tâche doit être assignée à un membre du projet.');
  }
  return value;
}

function parseTags(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw httpError(400, 'tags doit être une liste.');
  return [...new Set(value.map((tag) => String(tag).trim()).filter(Boolean))].slice(0, 10);
}

// ---------- Projets ----------

router.get('/', asyncHandler(async (req, res) => {
  const projects = await Project.find(visibleFilter(req))
    .populate('members', 'name email role job_title')
    .sort({ createdAt: -1 })
    .lean();

  // Statistiques par statut en une seule agrégation (pas de requête par projet).
  const stats = await Task.aggregate([
    { $match: { company_id: new mongoose.Types.ObjectId(String(req.auth.companyId)), project_id: { $in: projects.map((p) => p._id) } } },
    { $group: { _id: { project: '$project_id', status: '$status' }, count: { $sum: 1 } } },
  ]);
  const byProject = {};
  stats.forEach(({ _id, count }) => {
    const key = String(_id.project);
    byProject[key] = byProject[key] || { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0, total: 0 };
    byProject[key][_id.status] = count;
    byProject[key].total += count;
  });

  res.json({
    projects: projects.map((project) => ({
      ...project,
      stats: byProject[String(project._id)] || { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0, total: 0 },
    })),
  });
}));

router.post('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const { status = 'ACTIVE', color } = req.body;
  if (!Project.STATUSES.includes(status)) throw httpError(400, 'Statut de projet invalide.');
  if (color !== undefined && !Project.COLORS.includes(color)) throw httpError(400, 'Couleur invalide.');

  const members = req.body.members !== undefined ? await parseMembers(req, req.body.members) : [];
  // Le créateur fait partie de l'équipe par défaut.
  if (!members.includes(String(req.auth.userId))) members.unshift(String(req.auth.userId));

  const project = await Project.create({
    company_id: req.auth.companyId,
    name: requireString(req.body.name, 'Le nom du projet', { max: 160 }),
    description: optionalString(req.body.description, 'La description', 5000) || '',
    status,
    color,
    members,
    due_date: optionalDate(req.body.due_date, 'L’échéance') ?? null,
    created_by: req.auth.userId,
  });
  await project.populate('members', 'name email role job_title');
  res.status(201).json({ project });
}));

router.get('/:projectId', asyncHandler(async (req, res) => {
  const project = await loadProject(req);
  await project.populate('members', 'name email role job_title');
  res.json({ project });
}));

router.put('/:projectId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const project = await loadProject(req);
  const { name, description, status, color, members, due_date: dueDate } = req.body;

  if (name !== undefined) project.name = requireString(name, 'Le nom du projet', { max: 160 });
  if (description !== undefined) project.description = optionalString(description, 'La description', 5000);
  if (status !== undefined) {
    if (!Project.STATUSES.includes(status)) throw httpError(400, 'Statut de projet invalide.');
    project.status = status;
  }
  if (color !== undefined) {
    if (!Project.COLORS.includes(color)) throw httpError(400, 'Couleur invalide.');
    project.color = color;
  }
  if (dueDate !== undefined) project.due_date = optionalDate(dueDate, 'L’échéance');

  if (members !== undefined) {
    const ids = await parseMembers(req, members);
    project.members = ids;
    // Les tâches assignées à une personne retirée du projet repassent « non assignées ».
    await Task.updateMany(
      { company_id: req.auth.companyId, project_id: project._id, assigned_to: { $nin: [...ids, null] } },
      { $set: { assigned_to: null } }
    );
  }

  await project.save();
  await project.populate('members', 'name email role job_title');
  res.json({ project });
}));

router.delete('/:projectId', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const project = await loadProject(req);
  await Task.deleteMany({ company_id: req.auth.companyId, project_id: project._id });
  await project.deleteOne();
  res.json({ message: 'Projet et tâches supprimés.' });
}));

// ---------- Tâches d'un projet ----------

router.get('/:projectId/tasks', asyncHandler(async (req, res) => {
  const project = await loadProject(req);
  const tasks = await Task.find({ company_id: req.auth.companyId, project_id: project._id })
    .populate('assigned_to', 'name email')
    .sort({ status: 1, position: 1, createdAt: 1 });
  res.json({ tasks });
}));

// Un membre (MEMBER) ne peut écrire que dans les projets dont il fait partie ; loadProject le garantit déjà.
function requireEditor(req, res, next) {
  if (!canEdit(req)) return next(httpError(403, 'Les comptes Viewer sont en lecture seule.'));
  return next();
}

router.post('/:projectId/tasks', requireEditor, asyncHandler(async (req, res) => {
  const project = await loadProject(req);
  const { status = 'TODO', priority = 'MEDIUM' } = req.body;
  if (!Task.STATUSES.includes(status)) throw httpError(400, 'Statut invalide.');
  if (!Task.PRIORITIES.includes(priority)) throw httpError(400, 'Priorité invalide.');

  const last = await Task.findOne({ company_id: req.auth.companyId, project_id: project._id, status })
    .sort({ position: -1 }).select('position');

  const task = await Task.create({
    company_id: req.auth.companyId,
    project_id: project._id,
    title: requireString(req.body.title, 'Le titre', { max: 200 }),
    description: optionalString(req.body.description, 'La description', 10000) || '',
    status,
    priority,
    assigned_to: (await parseAssignee(project, req.body.assigned_to)) ?? null,
    due_date: optionalDate(req.body.due_date, 'L’échéance') ?? null,
    tags: parseTags(req.body.tags) || [],
    position: last ? last.position + 1 : 0,
    created_by: req.auth.userId,
  });
  await task.populate('assigned_to', 'name email');
  res.status(201).json({ task });
}));

async function loadTask(req, project) {
  if (!isId(req.params.taskId)) throw httpError(404, 'Tâche introuvable.');
  const task = await Task.findOne({ _id: req.params.taskId, company_id: req.auth.companyId, project_id: project._id });
  if (!task) throw httpError(404, 'Tâche introuvable.');
  return task;
}

router.patch('/:projectId/tasks/:taskId', requireEditor, asyncHandler(async (req, res) => {
  const project = await loadProject(req);
  const task = await loadTask(req, project);
  const { title, description, status, priority, position, tags } = req.body;

  if (title !== undefined) task.title = requireString(title, 'Le titre', { max: 200 });
  if (description !== undefined) task.description = optionalString(description, 'La description', 10000);
  if (status !== undefined) {
    if (!Task.STATUSES.includes(status)) throw httpError(400, 'Statut invalide.');
    task.status = status;
  }
  if (priority !== undefined) {
    if (!Task.PRIORITIES.includes(priority)) throw httpError(400, 'Priorité invalide.');
    task.priority = priority;
  }
  if (position !== undefined) {
    if (typeof position !== 'number' || !Number.isFinite(position)) throw httpError(400, 'Position invalide.');
    task.position = position;
  }
  const assignee = await parseAssignee(project, req.body.assigned_to);
  if (assignee !== undefined) task.assigned_to = assignee;
  const dueDate = optionalDate(req.body.due_date, 'L’échéance');
  if (dueDate !== undefined) task.due_date = dueDate;
  const parsedTags = parseTags(tags);
  if (parsedTags !== undefined) task.tags = parsedTags;

  await task.save();
  await task.populate('assigned_to', 'name email');
  res.json({ task });
}));

// Suppression : un admin, ou le membre qui a créé la tâche.
router.delete('/:projectId/tasks/:taskId', requireEditor, asyncHandler(async (req, res) => {
  const project = await loadProject(req);
  const task = await loadTask(req, project);
  if (!isAdmin(req) && String(task.created_by) !== String(req.auth.userId)) {
    throw httpError(403, 'Seul un administrateur ou l’auteur de la tâche peut la supprimer.');
  }
  await task.deleteOne();
  res.json({ message: 'Tâche supprimée.' });
}));

module.exports = router;
