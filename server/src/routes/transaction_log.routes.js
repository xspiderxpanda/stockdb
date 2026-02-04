const router = require("express").Router();
const response = require("../helpers/response.helper");
const LogHelper = require("../helpers/log.helper");
const TransactionLog = require("../models/TransactionLog");

const XLSX = require("xlsx");

// GET /api/transaction_logs?page=1&limit=20&function_name=SEARCH_PRODUCT&request_id=...
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);
    const skip = (page - 1) * limit;

    const function_name = String(req.query.function_name || "").trim();
    const request_id = String(req.query.request_id || "").trim();
    const status_code = String(req.query.status_code || "").trim();

    const filter = {};
    if (function_name) filter.function_name = function_name;
    if (request_id) filter.request_id = request_id;
    if (status_code) filter.status_code = Number(status_code);

    const [total, items] = await Promise.all([
      TransactionLog.countDocuments(filter),
      TransactionLog.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    res.json({ items, page, totalPages, total });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/get-log", async (req, res) => {

  const logger = new LogHelper({
    function_endpoint: "transaction-logs/get-log",
    function_controller: "transaction_log",
    function_name: "GetTransactionLog",
    function_method: "GET",
    query_collection: "transaction_log",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: "admin"
  });

  try {
    let page  = parseInt(req.query.page)  || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (page <= 0 || limit <= 0) {
      return response.badRequest(res, "page or limit invalid");
    }

    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    /* ---------------------------
     * query
     * --------------------------- */
    const [totalData, docs] = await Promise.all([
      TransactionLog.countDocuments(),
      TransactionLog.find()
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ]);

    const totalPages = Math.ceil(totalData / limit);

    /* ---------------------------
     * response data mapping
     * --------------------------- */
    const data = docs.map(d => ({
      request_id: d.request_id || "",
      function_name: d.function_name,
      function_method: d.function_method,
      query_collection: d.query_collection,
      query_type: d.query_type,
      count_data: d.count_data,
      duration_ms: d.duration_ms ? (d.duration_ms / 1000).toFixed(2) : "0",
      status_code: d.status_code,
      status_message: d.status_message,
      user_id: d.user_id || "",
      created_by: d.created_by,
      start_time: d.start_time
    }));

    logger.setCount(data.length);
    logger.success(200, "success");
    await logger.save();

    return response.success(
      res,
      {
        total_data: totalData,
        total_pages: totalPages,
        data
      },
      "Get transaction log success."
    );

  } catch (error) {
    logger.fail(400, "fail");
    await logger.save();

    console.error(error);
    return response.badRequest(res, "Get transaction log fail.");
  }
});

router.get("/export", async (req, res) => {
  const logger = new LogHelper({
    function_endpoint: "transaction-logs/export",
    function_controller: "transaction_log",
    function_name: "ExportTransactionLog",
    function_method: "GET",
    query_collection: "transaction_log",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: "admin"
  });

  try {

    let docs = [];
    let limit = parseInt(req.query.limit) || 0;

    if (limit > 0) {
      docs = await TransactionLog.find()
      .sort({ created_at: -1 })  // เรียงข้อมูลจากล่าสุดไปเก่า
      .skip(0)  // ข้ามข้อมูลตามจำนวนที่คำนวณจาก page
      .limit(limit)  // จำกัดจำนวนข้อมูลตาม limit
      .lean();  // ใช้ lean() เพื่อให้ได้ผลลัพธ์เป็น plain JavaScript object
    } else {
      /* query (ไม่มี limit)
      * --------------------------- */
      docs = await TransactionLog.find()
        .sort({ created_at: -1 })
        .lean(); // ดึงข้อมูลทั้งหมด
    }

    /* ---------------------------
     * response data mapping
     * --------------------------- */
     const data = docs.map(d => ({
      request_id: d.request_id || "",
      function_name: d.function_name,
      function_method: d.function_method,
      query_collection: d.query_collection,
      query_type: d.query_type,
      count_data: d.count_data,
      duration_ms: d.duration_ms ? (d.duration_ms / 1000).toFixed(2) : "0",
      start_time: d.start_time ? d.start_time.toISOString() : "",
      end_time: d.end_time ? d.end_time.toISOString() : "" ,   
      status_code: d.status_code,
      status_message: d.status_message,
      created_by: d.created_by,
      user_id: d.user_id || ""
    }));

    // 1️⃣ สร้าง worksheet จากข้อมูล
    const ws = XLSX.utils.json_to_sheet(data);

    // 2️⃣ สร้าง workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaction Logs");

    // 3️⃣ สร้างไฟล์ Excel ในหน่วยความจำ
    const fileBuffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    // 4️⃣ แปลงไฟล์เป็น base64
    const base64File = fileBuffer.toString("base64");

    // 5️⃣ สร้างชื่อไฟล์สำหรับการส่งใน response
    // const exportName = `transaction_log_export_${new Date().toISOString().replace(/[-:.]/g, "")}.xlsx`;
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = (`0${date.getMonth() + 1}`).slice(-2); // เพิ่ม 1 เพราะเดือนใน JavaScript เริ่มต้นที่ 0
      const day = (`0${date.getDate()}`).slice(-2);
      const hours = (`0${date.getHours()}`).slice(-2);
      const minutes = (`0${date.getMinutes()}`).slice(-2);
      const seconds = (`0${date.getSeconds()}`).slice(-2);

      return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    };

    const exportName = `transaction_log_export_${formatDate(new Date())}.xlsx`;

    // 6️⃣ ส่ง response ที่มี base64 string และชื่อไฟล์
    logger.setCount(data.length);
    logger.success(200, "success");
    await logger.save();

    return response.success(
      res,
      {
        base64_file: base64File,
        export_name: exportName
      },
      "Export transaction log success."
    );

  } catch (error) {
    logger.fail(400, "fail");
    await logger.save();

    console.error(error);
    return response.badRequest(res, "Export transaction log fail.");
  }
});

module.exports = router;
