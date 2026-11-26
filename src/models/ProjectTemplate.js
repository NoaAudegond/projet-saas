const mongoose = require('mongoose');
const Project = require('./Project');
const Task = require('./Task');

// Structure d'un projet réutilisable : champs du projet + tâches initiales.
const templateTaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 10000, default: '' },
    status: { type: String, enum: Task.STATUSES, default: 'TODO' },
    priority: { type: String, enum: Task.PRIORITIES, default: 'MEDIUM' },
    tags: { type: [{ type: String, trim: true, maxlength: 30 }], default: [] },
  },
  { _id: false }
);

const projectTemplateSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    color: { type: String, enum: Project.COLORS, default: Project.COLORS[0] },
    tasks: { type: [templateTaskSchema], default: [] },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

projectTemplateSchema.index({ company_id: 1, createdAt: -1 });

module.exports = mongoose.model('ProjectTemplate', projectTemplateSchema);
