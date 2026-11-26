const mongoose = require('mongoose');

// Message d'une discussion associée à une tâche. company_id est dupliqué pour l'isolation
// et la clé de sharding, mais le commentaire appartient bien à sa tâche (task_id).
const commentSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    task_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Task', required: true },
    author_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Copie du nom : la discussion reste lisible même si le compte est supprimé.
    author_name: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
  },
  { timestamps: true }
);

commentSchema.index({ company_id: 1, task_id: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
