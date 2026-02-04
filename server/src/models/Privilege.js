const mongoose = require("mongoose");

const PrivilegeSchema = new mongoose.Schema(
  {
    privilege_code: { type: Number, required: true, unique: true, trim: true },
    privilege_name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    description:{ type: String, trim: false },
    status: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("privilege", PrivilegeSchema);
