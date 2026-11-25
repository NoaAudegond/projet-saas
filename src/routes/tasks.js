const express = require('express');
const Project = require('../models/Project');
const Task = require('../models/Task');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../utils/http');

const router = express.Router();
router.use(requireAuth);

// Tâches assignées au compte connecté, tous projets confondus (vue « Mes tâches »).
router.get('/mine', asyncHandler(async (req, res) => {
  const projectFilter = { company_id: req.auth.companyId };
  if (req.auth.role !== 'ADMIN') projectFilter.members = req.auth.userId;
  const projectIds = await Project.find(projectFilter).distinct('_id');

  const tasks = await Task.find({
    company_id: req.auth.companyId,
    project_id: { $in: projectIds },
    assigned_to: req.auth.userId,
  })
    .populate('project_id', 'name color')
    .sort({ due_date: 1, createdAt: -1 })
    .limit(100);

  res.json({ tasks });
}));

module.exports = router;
