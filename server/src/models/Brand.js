const mongoose = require("mongoose");

const BrandSchema = new mongoose.Schema(
  {
    brand_code: { type: Number, required: true, unique: true, trim: true },
    brand_name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    created_by: { type: String },
    updated_by: { type: String },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("brand_master", BrandSchema);
