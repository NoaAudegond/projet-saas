const express = require('express');
const Company = require('../models/Company');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Comment = require('../models/Comment');
const SubTask = require('../models/SubTask');
const Team = require('../models/Team');
const ProjectTemplate = require('../models/ProjectTemplate');
const { requireAuth, requireRole } = require('../middleware/auth');
const {
  asyncHandler, httpError, requireString, optionalString,
} = require('../utils/http');

const router = express.Router();
router.use(requireAuth);

// L'entreprise courante est toujours celle du compte connecté : aucun identifiant n'est lu dans l'URL.
router.get('/', asyncHandler(async (req, res) => {
  const companyId = req.auth.companyId;
  const [company, users, projects, tasks] = await Promise.all([
    Company.findById(companyId),
    User.countDocuments({ company_id: companyId }),
    Project.countDocuments({ company_id: companyId }),
    Task.countDocuments({ company_id: companyId }),
  ]);
  if (!company) throw httpError(404, 'Entreprise introuvable.');
  res.json({ company, stats: { users, projects, tasks } });
}));

router.put('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const company = await Company.findById(req.auth.companyId);
  if (!company) throw httpError(404, 'Entreprise introuvable.');
  if (req.body.name !== undefined) company.name = requireString(req.body.name, 'Le nom de l’entreprise', { max: 120 });
  const description = optionalString(req.body.description, 'La description', 1000);
  if (description !== undefined) company.description = description;
  await company.save();
  res.json({ company });
}));

// Suppression définitive : l'admin doit retaper le nom de l'entreprise pour confirmer.
router.delete('/', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const companyId = req.auth.companyId;
  const company = await Company.findById(companyId);
  if (!company) throw httpError(404, 'Entreprise introuvable.');
  if (req.body.confirm !== company.name) {
    throw httpError(400, 'Pour confirmer, saisissez exactement le nom de l’entreprise.');
  }
  // Ordre : enfants d'abord pour ne jamais laisser de documents orphelins visibles.
  await Comment.deleteMany({ company_id: companyId });
  await SubTask.deleteMany({ company_id: companyId });
  await Task.deleteMany({ company_id: companyId });
  await Project.deleteMany({ company_id: companyId });
  await Team.deleteMany({ company_id: companyId });
  await ProjectTemplate.deleteMany({ company_id: companyId });
  await User.deleteMany({ company_id: companyId });
  await Company.deleteOne({ _id: companyId });
  res.json({ message: 'Entreprise et données associées supprimées.' });
}));

module.exports = router;
