const mongoose = require('mongoose');

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE'];
const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'];

const taskSchema = new mongoose.Schema(
  {
    // company_id est dupliqué dans la tâche pour filtrer sans jointure
    // et pour servir de clé de sharding dans la partie II.
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 10000, default: '' },
    status: { type: String, enum: TASK_STATUSES, default: 'TODO', required: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: 'MEDIUM', required: true },
    assigned_to: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    due_date: { type: Date, default: null },
    tags: {
      type: [{ type: String, trim: true, maxlength: 30 }],
      validate: [(tags) => tags.length <= 10, 'Une tâche ne peut pas avoir plus de 10 étiquettes.'],
      default: [],
    },
    // Ordre d'affichage dans la colonne du Kanban.
    position: { type: Number, default: 0 },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

taskSchema.index({ company_id: 1, project_id: 1, status: 1, position: 1 });
taskSchema.index({ company_id: 1, assigned_to: 1 });

taskSchema.statics.STATUSES = TASK_STATUSES;
taskSchema.statics.PRIORITIES = TASK_PRIORITIES;

module.exports = mongoose.model('Task', taskSchema);
