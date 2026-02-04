const { json } = require("express");
const mongoose = require("mongoose");

const OrdersSchema = new mongoose.Schema(
  {
    orders_code: { type: Number, required: true, unique: true, trim: true },
    receipt_number : { type: String, required: true, unique: true, trim: true },
    customer_code:{ type: Number, required: true, trim: true },
    staff_code: { type: Number, required: true, trim: true },
    branch_code: { type: Number, required: true, trim: true },
    product_list: { type: Object, required: true, trim: true },
    privilege_code: { type: Number, trim: true },
    total_price: { type: Float16Array, required: true, trim: true },
    discount_price: { type: Float16Array, trim: true },
    net_price: { type: Float16Array, required: true, trim: true },
    payment_type: { type: String, required: true, trim: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("orders", OrdersSchema);
