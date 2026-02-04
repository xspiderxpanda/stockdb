const { json } = require("express");
const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema(
  {
    uuid: { type: Number, required: true, unique: true, trim: true },
    prefix: { type: String, required: true, trim: true },
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    phone_no: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    point: { type: Number, required: true, trim: true },
    status: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("customer", CustomerSchema);
