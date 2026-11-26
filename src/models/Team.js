const mongoose = require('mongoose');

const TEAM_COLORS = ['#ef5b3c', '#f59e0b', '#16a34a', '#0ea5e9', '#6366f1', '#d946ef'];

// Sous-équipe d'une entreprise (Dev, BD…). Les projets et les tâches peuvent y être rattachés.
const teamSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    color: { type: String, enum: TEAM_COLORS, default: TEAM_COLORS[0] },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    created_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

// Pas de doublon de nom dans une même entreprise (mais possible entre deux entreprises).
teamSchema.index({ company_id: 1, name: 1 }, { unique: true });

teamSchema.statics.COLORS = TEAM_COLORS;

module.exports = mongoose.model('Team', teamSchema);
