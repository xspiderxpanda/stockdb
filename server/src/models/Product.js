const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true, index: true },
    product_name: { type: String, required: true, index: true },
    category: { type: String, default: "" },
    brand: { type: String, default: "" },
  },
  { timestamps: true, collection: "product_master" }
);

// ทำ text search (ค้นด้วย keyword)
ProductSchema.index({ product_name: "text", category: "text", brand: "text" });

module.exports = mongoose.model("Product", ProductSchema);
