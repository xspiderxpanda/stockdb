const mongoose = require("mongoose");

const SupplierSchema = new mongoose.Schema(
  {
    supplier_code: { type: Number, required: true, unique: true, trim: true },
    supplier_name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    created_by: { type: String },
    updated_by: { type: String },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("supplier_master", SupplierSchema);
