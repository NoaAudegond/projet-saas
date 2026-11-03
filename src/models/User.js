const mongoose = require('mongoose');

const USER_ROLES = ['ADMIN', 'MEMBER', 'VIEWER'];

const userSchema = new mongoose.Schema(
  {
    company_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    password_hash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: 'MEMBER',
      required: true,
    },
  },
  { timestamps: true }
);

// Un même email peut exister dans des entreprises différentes, mais pas deux fois dans la même.
userSchema.index({ company_id: 1, email: 1 }, { unique: true });

userSchema.statics.ROLES = USER_ROLES;

module.exports = mongoose.model('User', userSchema);
