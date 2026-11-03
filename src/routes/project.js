const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');

const router = express.Router();

function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Authentification requise.' });
  try {
    if (!process.env.JWT_SECRET) return res.status(500).json({ error: 'La variable JWT_SECRET est obligatoire.' });
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (_error) { return res.status(401).json({ error: 'Jeton invalide ou expiré.' }); }
}

function requireAdmin(req, res, next) {
  if (req.auth.role !== 'ADMIN') return res.status(403).json({ error: 'Action réservée aux administrateurs.' });
  return next();
}

function requireEditor(req, res, next) {
  if (!['ADMIN', 'MEMBER'].includes(req.auth.role)) return res.status(403).json({ error: 'Les viewers ont un accès en lecture seule.' });
  return next();
}

function validId(id) { return mongoose.isValidObjectId(id); }

async function getCompanyProject(companyId, projectId) {
  if (!validId(projectId)) return null;
  return Project.findOne({ _id: projectId, company_id: companyId });
}

router.use(requireAuth);

// Tout compte de l’entreprise peut consulter ses projets.
router.get('/', async (req, res, next) => {
  try {
    const projects = await Project.find({ company_id: req.auth.company_id }).sort({ createdAt: -1 }).lean();
    const projectIds = projects.map((project) => project._id);
    const counts = await Task.aggregate([
      { $match: { company_id: new mongoose.Types.ObjectId(req.auth.company_id), project_id: { $in: projectIds } } },
      { $group: { _id: '$project_id', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((item) => [item._id.toString(), item.count]));
    return res.json({ projects: projects.map((project) => ({ ...project, task_count: countMap.get(project._id.toString()) || 0 })) });
  } catch (error) { return next(error); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { name, description = '' } = req.body;
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Le nom du projet est obligatoire.' });
    const project = await Project.create({ company_id: req.auth.company_id, name: name.trim(), description, created_by: req.auth.sub });
    return res.status(201).json({ project });
  } catch (error) { return next(error); }
});

router.put('/:projectId', requireAdmin, async (req, res, next) => {
  try {
    const project = await getCompanyProject(req.auth.company_id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
    if (typeof req.body.name === 'string' && req.body.name.trim()) project.name = req.body.name.trim();
    if (typeof req.body.description === 'string') project.description = req.body.description;
    await project.save();
    return res.json({ project });
  } catch (error) { return next(error); }
});

router.delete('/:projectId', requireAdmin, async (req, res, next) => {
  try {
    const project = await getCompanyProject(req.auth.company_id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
    await Task.deleteMany({ company_id: req.auth.company_id, project_id: project._id });
    await project.deleteOne();
    return res.json({ message: 'Projet et tâches supprimés.' });
  } catch (error) { return next(error); }
});

router.get('/:projectId/tasks', async (req, res, next) => {
  try {
    const project = await getCompanyProject(req.auth.company_id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
    const tasks = await Task.find({ company_id: req.auth.company_id, project_id: project._id })
      .populate('assigned_to', 'name email role').sort({ createdAt: -1 });
    return res.json({ tasks });
  } catch (error) { return next(error); }
});

router.post('/:projectId/tasks', requireEditor, async (req, res, next) => {
  try {
    const project = await getCompanyProject(req.auth.company_id, req.params.projectId);
    if (!project) return res.status(404).json({ error: 'Projet introuvable.' });
    const { title, description = '', status = 'TODO', priority = 'MEDIUM', assigned_to = null, due_date = null } = req.body;
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Le titre est obligatoire.' });
    if (!Task.STATUSES.includes(status) || !Task.PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Statut ou priorité invalide.' });
    if (assigned_to) {
      const member = await User.findOne({ _id: assigned_to, company_id: req.auth.company_id });
      if (!member) return res.status(400).json({ error: 'Le compte assigné doit appartenir à votre entreprise.' });
    }
    const task = await Task.create({ company_id: req.auth.company_id, project_id: project._id, title: title.trim(), description, status, priority, assigned_to, due_date, created_by: req.auth.sub });
    return res.status(201).json({ task });
  } catch (error) { return next(error); }
});

router.patch('/:projectId/tasks/:taskId', requireEditor, async (req, res, next) => {
  try {
    const project = await getCompanyProject(req.auth.company_id, req.params.projectId);
    if (!project || !validId(req.params.taskId)) return res.status(404).json({ error: 'Tâche introuvable.' });
    const task = await Task.findOne({ _id: req.params.taskId, company_id: req.auth.company_id, project_id: project._id });
    if (!task) return res.status(404).json({ error: 'Tâche introuvable.' });
    const { title, description, status, priority, assigned_to, due_date } = req.body;
    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'Le titre ne peut pas être vide.' });
      task.title = title.trim();
    }
    if (description !== undefined) task.description = description;
    if (status !== undefined) {
      if (!Task.STATUSES.includes(status)) return res.status(400).json({ error: 'Statut invalide.' });
      task.status = status;
    }
    if (priority !== undefined) {
      if (!Task.PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Priorité invalide.' });
      task.priority = priority;
    }
    if (assigned_to !== undefined) {
      if (assigned_to && !await User.exists({ _id: assigned_to, company_id: req.auth.company_id })) return res.status(400).json({ error: 'Le compte assigné doit appartenir à votre entreprise.' });
      task.assigned_to = assigned_to || null;
    }
    if (due_date !== undefined) task.due_date = due_date || null;
    await task.save();
    return res.json({ task });
  } catch (error) { return next(error); }
});

router.delete('/:projectId/tasks/:taskId', requireAdmin, async (req, res, next) => {
  try {
    const project = await getCompanyProject(req.auth.company_id, req.params.projectId);
    if (!project || !validId(req.params.taskId)) return res.status(404).json({ error: 'Tâche introuvable.' });
    const result = await Task.deleteOne({ _id: req.params.taskId, company_id: req.auth.company_id, project_id: project._id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Tâche introuvable.' });
    return res.json({ message: 'Tâche supprimée.' });
  } catch (error) { return next(error); }
});

module.exports = router;
