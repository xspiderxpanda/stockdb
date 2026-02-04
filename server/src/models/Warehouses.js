const mongoose = require("mongoose");

const WarehousesSchema = new mongoose.Schema(
  {
    warehouses_code: { type: Number },
    warehouses_name: { type: String, required: true, trim: true },
    warehouses_zone: { type: String, trim: true },
    bin : { type: String, trim: true },
    warehouses_key: { type: String, required: true, unique: true, trim: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

module.exports = mongoose.model("warehouses_masters", WarehousesSchema);