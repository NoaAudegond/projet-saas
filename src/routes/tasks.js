const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Team = require('../models/Team');
const Comment = require('../models/Comment');
const SubTask = require('../models/SubTask');
const { requireAuth } = require('../middleware/auth');
const {
  asyncHandler, httpError, isId, requireString,
} = require('../utils/http');

const router = express.Router();
router.use(requireAuth);

const canEdit = (req) => ['ADMIN', 'MEMBER'].includes(req.auth.role);
function requireEditor(req, _res, next) {
  if (!canEdit(req)) return next(httpError(403, 'Les comptes Viewer sont en lecture seule.'));
  return next();
}

// Mêmes règles de visibilité que la liste des projets : admin = tout, autres = leurs projets.
async function visibleProjectIds(req) {
  const filter = { company_id: req.auth.companyId };
  if (req.auth.role !== 'ADMIN') filter.members = req.auth.userId;
  return Project.find(filter).distinct('_id');
}

async function loadTask(req) {
  if (!isId(req.params.taskId)) throw httpError(404, 'Tâche introuvable.');
  const task = await Task.findOne({
    _id: req.params.taskId,
    company_id: req.auth.companyId,
    project_id: { $in: await visibleProjectIds(req) },
  });
  if (!task) throw httpError(404, 'Tâche introuvable.');
  return task;
}

// Toutes les tâches visibles par le compte connecté (vue calendrier).
router.get('/', asyncHandler(async (req, res) => {
  const tasks = await Task.find({ company_id: req.auth.companyId, project_id: { $in: await visibleProjectIds(req) } })
    .populate('project_id', 'name color')
    .populate('assigned_to', 'name email')
    .populate('team_id', 'name color')
    .sort({ due_date: 1, createdAt: -1 });

  res.json({ tasks });
}));

// Tâches assignées au compte connecté, tous projets confondus (vue « Mes tâches »).
router.get('/mine', asyncHandler(async (req, res) => {
  const tasks = await Task.find({
    company_id: req.auth.companyId,
    project_id: { $in: await visibleProjectIds(req) },
    assigned_to: req.auth.userId,
  })
    .populate('project_id', 'name color')
    .sort({ due_date: 1, createdAt: -1 })
    .limit(100);

  res.json({ tasks });
}));

// ---------- Discussion d'une tâche ----------

router.get('/:taskId/comments', asyncHandler(async (req, res) => {
  await loadTask(req);
  const comments = await Comment.find({ company_id: req.auth.companyId, task_id: req.params.taskId })
    .sort({ createdAt: 1, _id: 1 })
    .limit(200);
  res.json({ comments });
}));

router.post('/:taskId/comments', requireEditor, asyncHandler(async (req, res) => {
  const task = await loadTask(req);
  const comment = await Comment.create({
    company_id: req.auth.companyId,
    task_id: task._id,
    author_id: req.auth.userId,
    author_name: req.user.name,
    body: requireString(req.body.body, 'Le commentaire', { max: 5000 }),
  });
  res.status(201).json({ comment });
}));

// ---------- Sous-tâches ----------

router.get('/:taskId/subtasks', asyncHandler(async (req, res) => {
  await loadTask(req);
  const subtasks = await SubTask.find({ company_id: req.auth.companyId, task_id: req.params.taskId })
    .sort({ status: 1, position: 1, createdAt: 1 });
  res.json({ subtasks });
}));

router.post('/:taskId/subtasks', requireEditor, asyncHandler(async (req, res) => {
  const task = await loadTask(req);
  const last = await SubTask.findOne({ company_id: req.auth.companyId, task_id: task._id })
    .sort({ position: -1 }).select('position');
  const subtask = await SubTask.create({
    company_id: req.auth.companyId,
    task_id: task._id,
    title: requireString(req.body.title, 'Le titre de la sous-tâche', { max: 200 }),
    status: 'TODO',
    position: last ? last.position + 1 : 0,
    created_by: req.auth.userId,
  });
  res.status(201).json({ subtask });
}));

router.patch('/:taskId/subtasks/:subId', requireEditor, asyncHandler(async (req, res) => {
  await loadTask(req);
  if (!isId(req.params.subId)) throw httpError(404, 'Sous-tâche introuvable.');
  const subtask = await SubTask.findOne({
    _id: req.params.subId, company_id: req.auth.companyId, task_id: req.params.taskId,
  });
  if (!subtask) throw httpError(404, 'Sous-tâche introuvable.');

  if (req.body.title !== undefined) subtask.title = requireString(req.body.title, 'Le titre de la sous-tâche', { max: 200 });
  if (req.body.status !== undefined) {
    if (!SubTask.STATUSES.includes(req.body.status)) throw httpError(400, 'Statut de sous-tâche invalide.');
    subtask.status = req.body.status;
  }
  if (req.body.position !== undefined) {
    if (typeof req.body.position !== 'number' || !Number.isFinite(req.body.position)) throw httpError(400, 'Position invalide.');
    subtask.position = req.body.position;
  }
  await subtask.save();
  res.json({ subtask });
}));

router.delete('/:taskId/subtasks/:subId', requireEditor, asyncHandler(async (req, res) => {
  await loadTask(req);
  if (!isId(req.params.subId)) throw httpError(404, 'Sous-tâche introuvable.');
  const subtask = await SubTask.findOne({
    _id: req.params.subId, company_id: req.auth.companyId, task_id: req.params.taskId,
  });
  if (!subtask) throw httpError(404, 'Sous-tâche introuvable.');
  if (req.auth.role !== 'ADMIN' && String(subtask.created_by) !== String(req.auth.userId)) {
    throw httpError(403, 'Seul un administrateur ou l’auteur peut supprimer cette sous-tâche.');
  }
  await subtask.deleteOne();
  res.json({ message: 'Sous-tâche supprimée.' });
}));

module.exports = router;
