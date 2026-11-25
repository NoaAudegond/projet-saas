const mongoose = require('mongoose');

const USER_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'];

const userSchema = new mongoose.Schema(
  {
    company_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    password_hash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, default: 'MEMBER', required: true },
    job_title: { type: String, trim: true, maxlength: 120, default: '' },
  },
  { timestamps: true }
);

// Un même email peut exister dans deux entreprises différentes, mais pas deux fois dans la même.
// Cet index sert aussi pour la connexion (company_id + email).
userSchema.index({ company_id: 1, email: 1 }, { unique: true });

userSchema.statics.ROLES = USER_ROLES;

userSchema.methods.toPublic = function toPublic() {
  return {
    _id: this._id,
    company_id: this.company_id,
    name: this.name,
    email: this.email,
    role: this.role,
    job_title: this.job_title,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
