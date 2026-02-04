const mongoose = require("mongoose");

const StaffSchema = new mongoose.Schema(
  {
    staff_code: { type: Number, required: true, unique: true, trim: true },
    staff_firstname: { type: String, required: true, trim: true },
    staff_lastname: { type: String, required: true, trim: true },
    phone_no: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String },
    status: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

module.exports = mongoose.model("staff", StaffSchema);
