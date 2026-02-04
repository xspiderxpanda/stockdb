const mongoose = require("mongoose");

const UnitSchema = new mongoose.Schema(
  {
    unit_code: { type: Number, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    status: { type: Boolean, default: true },
  },
  {
    collection: "unit" // ⭐ ตรงนี้สำคัญ
  }
);

module.exports = mongoose.model("unit", UnitSchema);