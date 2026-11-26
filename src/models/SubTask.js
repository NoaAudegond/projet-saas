const mongoose = require('mongoose');

const SUBTASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'];

// Élément d'une tâche, avec son propre statut indépendant de la tâche parente.
const subTaskSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    status: { type: String, enum: SUBTASK_STATUSES, default: 'TODO', required: true },
    position: { type: Number, default: 0 },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

subTaskSchema.index({ company_id: 1, task_id: 1, status: 1, position: 1 });

subTaskSchema.statics.STATUSES = SUBTASK_STATUSES;

module.exports = mongoose.model('SubTask', subTaskSchema);
