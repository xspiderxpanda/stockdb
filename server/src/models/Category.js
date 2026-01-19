const mongoose = require("mongoose");

const CategorySchema = new mongoose.Schema(
  {
    category_code: { type: Number, required: true, unique: true, trim: true },
    category_name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    created_by: { type: String },
    updated_by: { type: String },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("category_master", CategorySchema);
