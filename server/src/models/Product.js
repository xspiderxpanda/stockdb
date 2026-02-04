const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    barcode: { type: String, required: true, unique: true, trim: true },
    sku_code: { type: String, trim: true, index: true },
    product_name: { type: String, required: true, trim: true },
    product_description: { type: String },

    category_code: { type: Number, required: true, index: true },
    supplier_code: { type: Number, required: true, index: true },
    brand_code: { type: Number, required: true, index: true },

    balance_qty: { type: Number, default: 0, min: 0 },
    unit:{ type: Number, required: true},
    cost_price: { type: Number, default: 0, min: 0 },

    status: { type: Boolean, default: true },
    created_by: { type: Number },
    updated_by: { type: Number },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

// ช่วยค้นหาเร็ว
ProductSchema.index({ product_name: "text", sku_code: 1 });

module.exports = mongoose.model("product_master", ProductSchema);
