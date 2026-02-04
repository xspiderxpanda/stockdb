const mongoose = require("mongoose");

const Privilege_monthlySchema = new mongoose.Schema(
  {
    monthly_code: { type: Number, required: true, unique: true, trim: true },
    monthly_name: { type: String, required: true, trim: true },
    privilege_code: { type: Array, required: true, trim: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: { start_date: "start_date", end_date: "end_date", createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("privilege_monthly", Privilege_monthlySchema);