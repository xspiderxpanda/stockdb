const mongoose = require("mongoose");

const BranchSchema = new mongoose.Schema(
  {
    branch_code: { type: Number, required: true, unique: true, trim: true },
    branch_name: { type: String, required: true, trim: true },
    phone_no: { type: String, trim: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("branch", BranchSchema);
