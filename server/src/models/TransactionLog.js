const mongoose = require("mongoose");

const TransactionLogSchema = new mongoose.Schema(
  {
    request_id: { type: String, required: true, index: true },

    function_endpoint: { type: String },
    function_controller: { type: String },
    function_method: { type: String },
    function_name: { type: String },

    query_collection: { type: String },
    query_type: { type: String },

    start_time: { type: Date },
    end_time: { type: Date },
    duration_ms: { type: Number, default: 0, min: 0 },

    count_data: { type: Number, default: 0, min: 0 },

    status_code: { type: Number },
    status_message: { type: String },

    staff_code: { type: String, index: true },
    created_by: { type: String },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

module.exports = mongoose.model("transaction_log", TransactionLogSchema);
