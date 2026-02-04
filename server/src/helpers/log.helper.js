// helpers/log.helper.js
const TransactionLog = require("../models/TransactionLog.js");
const { v4: uuidv4 } = require("uuid");

class LogHelper {
  constructor(meta = {}) {
    this.log = {
      request_id: meta.request_id || uuidv4(),

      function_endpoint: meta.function_endpoint || "",
      function_controller: meta.function_controller || "",
      function_name: meta.function_name || "",
      function_method: meta.function_method || "",

      environment: process.env.NODE_ENV || "local",

      query_collection: meta.query_collection || "",
      query_type: meta.query_type || "",

      start_time: new Date(),
      end_time: null,
      duration_ms: null,

      count_data: 0,

      status_code: null,
      status_message: null,

      user_id: meta.user_id || "",
      role: meta.role || "",

      created_by: meta.created_by || ""
    };
  }

  setCount(count) {
    this.log.count_data = count;
  }

  success(statusCode = 200, message = "success") {
    this.log.status_code = statusCode;
    this.log.status_message = message;
  }

  fail(statusCode = 500, message = "fail") {
    this.log.status_code = statusCode;
    this.log.status_message = message;
  }

  async save() {
    this.log.end_time = new Date();
    this.log.duration_ms =
      this.log.end_time.getTime() - this.log.start_time.getTime();

    try {
      await TransactionLog.create(this.log);
    } catch (err) {
      // ❗ log ห้ามทำให้ระบบพัง
      console.error("LOG SAVE ERROR:", err.message);
    }
  }
}

module.exports = LogHelper;
