const mongoose = require("mongoose");

const ProductStockSchema = new mongoose.Schema(
  {
    barcode: { type: String, required: true, index: true },
    sku_code: { type: String, trim: true, index: true },

    lots_no: { type: String, required: true, trim: true, index: true },
    warehouses_name: { type: String, required: true, trim: true },
    warehouses_zone: { type: String, trim: true },
    bin: { type: String, trim: true },

    stock_type: { type: String, trim: true }, // เช่น NORMAL / CONSIGN / RETURN
    receive_qty: { type: Number, default: 0, min: 0 },
    selling_qty: { type: Number, default: 0, min: 0 },
    balance_qty: { type: Number, default: 0, min: 0 },

    mfg: { type: Date },
    exp: { type: Date },

    status: { type: String, enum: ["active", "inactive"], default: "active" },
    created_by: { type: String },
    updated_by: { type: String },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

ProductStockSchema.index(
  { barcode: 1, lots_no: 1, warehouses_name: 1, warehouses_zone: 1, bin: 1 },
  { unique: true }
);

module.exports = mongoose.model("product_stock", ProductStockSchema);
