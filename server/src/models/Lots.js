const mongoose = require("mongoose");

const LotsSchema = new mongoose.Schema(
  {
    lots_no : { type: String, required: true, unique: true, trim: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

module.exports = mongoose.model("lots_masters", LotsSchema);