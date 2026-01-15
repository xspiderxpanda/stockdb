const mongoose = require("mongoose");

const SkuUnitSchema = new mongoose.Schema(
  {
    sku_code: { type: String, required: true, index: true },
    barcode: String,
    unit: { type: String, required: true },
    factor: { type: Number, default: 1 },
    price: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SkuUnitSchema.index({ sku_code: 1, unit: 1 }, { unique: true });

module.exports = mongoose.model("sku_unit", SkuUnitSchema);
