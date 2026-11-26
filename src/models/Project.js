const mongoose = require('mongoose');

const PROJECT_STATUSES = ['ACTIVE', 'ON_HOLD', 'ARCHIVED'];
const PROJECT_COLORS = ['#ef5b3c', '#f59e0b', '#16a34a', '#0ea5e9', '#6366f1', '#d946ef', '#64748b'];

const projectSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 5000, default: '' },
    status: { type: String, enum: PROJECT_STATUSES, default: 'ACTIVE', required: true },
    color: { type: String, enum: PROJECT_COLORS, default: PROJECT_COLORS[0] },
    // Utilisateurs assignés au projet (références vers users). Tableau borné :
    // une équipe projet reste petite, l'embarquer évite une collection de liaison.
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Sous-équipe de l'entreprise responsable du projet (facultative).
    team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team', default: null },
    due_date: { type: Date, default: null },
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

projectSchema.index({ company_id: 1, createdAt: -1 });
projectSchema.index({ company_id: 1, members: 1 });
projectSchema.index({ company_id: 1, team_id: 1 });

projectSchema.statics.STATUSES = PROJECT_STATUSES;
projectSchema.statics.COLORS = PROJECT_COLORS;

module.exports = mongoose.model('Project', projectSchema);
