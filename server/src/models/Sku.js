const mongoose = require("mongoose");

const SkuSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, index: true },
    product_id: { type: String, required: true, index: true },
    price: { type: Number, default: 0 },
    stock_qty: { type: Number, default: 0 },
    warehouse: { type: String, default: "" },
    unit: { type: String, default: "" },
    factor: { type: Number, default: 1 },
    barcode: { type: String, default: "", index: true }, // เผื่อเก็บซ้ำ
    },
  { timestamps: true, collection: "sku_master" }
);

// index ช่วยให้ search/filter เร็ว
SkuSchema.index({ product_id: 1 });
SkuSchema.index({ warehouse: 1 });

module.exports = mongoose.model("Sku", SkuSchema);
