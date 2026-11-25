const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Code court utilisé à la connexion (plus simple à retenir qu'un ObjectId).
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 60,
      match: /^[a-z0-9-]+$/,
    },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
  },
  { timestamps: true }
);

companySchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model('Company', companySchema);
