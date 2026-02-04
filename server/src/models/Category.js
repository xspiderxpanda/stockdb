const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    category_code: { type: Number, required: true, unique: true, trim: true },
    category_name_th: { type: String, required: true, trim: true },
    category_name_en: { type: String, required: true, trim: true },
    status: { type: Boolean, default: true },
    // created_by: { type: String },
    // updated_by: { type: String },
  },
  // { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("category_masters", CategorySchema);
