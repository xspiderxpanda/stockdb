const router = require("express").Router();
const { randomUUID } = require("crypto");
const Product = require("../models/Product");
const ProductStock = require("../models/ProductStock");

const TransactionLog = require("../models/TransactionLog");

function buildDeleteResponse({
  httpCode = 200,
  statusMessage = "delete",
  message = "",
  deleteCount = 0,
  skipped = [],
  finalMassage = "",
  requestId,
  command,
  target,
  filter,
  askedLimit,
  matched,
  hint,
}) {
  return {
    status_code: httpCode,
    status_message: statusMessage,
    message,
    result: {
      delete: deleteCount,
      skipped,
      finalMassage,
      request_id: requestId,
      command: command ?? "",
      target: target ?? "product_master",
      filter: filter ?? undefined,
      asked_limit: askedLimit ?? undefined,
      matched: matched ?? undefined,
      hint: hint ?? "",
    },
  };
}






/**
 * =========================
 * DELETE /api/product_del/del/by?sku=...&name=...&unit=...&barcode=...
 * - ลบตามเงื่อนไข (ต้องมีอย่างน้อย 1 เงื่อนไข)
 * =========================
 */
router.delete("/del/by", async (req, res) => {
  const requestId = randomUUID();
  const startTime = new Date();

  const sku = (req.query.sku ?? "").toString().trim();
  const name = (req.query.name ?? "").toString().trim();
  const unit = (req.query.unit ?? "").toString().trim();
  const barcode = (req.query.barcode ?? "").toString().trim();

  if (!sku && !name && !unit && !barcode) {
    return res.status(400).json(
      buildDeleteResponse({
        httpCode: 400,
        statusMessage: "validate_error",
        message: "ต้องระบุอย่างน้อย 1 เงื่อนไข เช่น sku หรือ name หรือ unit หรือ barcode",
        deleteCount: 0,
        skipped: [],
        finalMassage: "",
        requestId,
        command: "Product.deleteMany(filter)",
        target: "product_master",
        filter: {},
        matched: 0,
        hint: "เพิ่ม query เช่น ?sku=ABC หรือ ?barcode=885xxxx หรือผสมหลายเงื่อนไขได้",
      })
    );
  }

  const filter = {};
  if (sku) filter.sku = sku;
  if (name) filter.name = name;
  if (unit) filter.unit = unit;
  if (barcode) filter.barcode = barcode;

  const log = await TransactionLog.create({
    request_id: requestId,
    function_endpoint: "/api/products/del/by",
    function_controller: "product_del_by",
    function_method: "DELETE",
    function_name: "DELETE_PRODUCT_MASTER_BY_FIELDS",
    query_collection: "product_master",
    query_type: "DELETE_MANY",
    start_time: startTime,
    status_message: `starting del by fields: ${JSON.stringify(filter)}`,
  });

  try {
    const foundCount = await Product.countDocuments(filter);

    if (!foundCount) {
      const endTime = new Date();
      await TransactionLog.findByIdAndUpdate(log._id, {
        end_time: endTime,
        duration_ms: endTime - startTime,
        count_data: 0,
        status_code: 404,
        status_message: `not found to delete: ${JSON.stringify(filter)}`,
      });

      return res.status(404).json(
        buildDeleteResponse({
          httpCode: 404,
          statusMessage: "not_found",
          message: "ไม่พบรายการที่จะลบ",
          deleteCount: 0,
          skipped: [],
          finalMassage: "",
          requestId,
          command: "Product.countDocuments(filter) -> Product.deleteMany(filter)",
          target: "product_master",
          filter,
          matched: 0,
          hint: "ลองตรวจสอบค่าที่ส่งมาให้ตรงกับข้อมูลจริง หรือเพิ่ม/เปลี่ยนเงื่อนไข",
        })
      );
    }

    const result = await Product.deleteMany(filter);

    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: result.deletedCount || 0,
      status_code: 200,
      status_message: `deleted=${result.deletedCount || 0} by ${JSON.stringify(filter)}`,
    });

    return res.status(200).json(
      buildDeleteResponse({
        httpCode: 200,
        statusMessage: "delete",
        message: "delete success.",
        deleteCount: result.deletedCount || 0,
        skipped: [],
        finalMassage: "",
        requestId,
        command: "Product.deleteMany(filter)",
        target: "product_master",
        filter,
        matched: foundCount,
        hint:
          "ลบตามเงื่อนไขสำเร็จ (/del ไม่ใช่ลบหมด ถ้าต้องการลบทั้งหมดให้ใช้ /api/product_del/delall?confirm=true)",
      })
    );
  } catch (e) {
    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: 0,
      status_code: 500,
      status_message: e.message,
    });

    return res.status(500).json(
      buildDeleteResponse({
        httpCode: 500,
        statusMessage: "error",
        message: e.message,
        deleteCount: 0,
        skipped: [],
        finalMassage: "",
        requestId,
        command: "Product.deleteMany(filter)",
        target: "product_master",
        filter,
        matched: 0,
        hint: "ตรวจสอบ error message / การเชื่อมต่อฐานข้อมูล / model Product",
      })
    );
  }
});

/**
 * =========================
 * DELETE /api/products/del?limit=
 * - ลบแบบจำกัดจำนวนเท่านั้น
 * - ถ้าต้องการลบหมดให้ใช้ /delall เท่านั้น
 * =========================
 */
router.delete("/del", async (req, res) => {
  const requestId = randomUUID();
  const startTime = new Date();

  const MAX_LIMIT = 200000;

  let limit = parseInt(req.query.limit || "1000", 10);
  if (Number.isNaN(limit) || limit < 1) limit = 1000;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  const log = await TransactionLog.create({
    request_id: requestId,
    function_endpoint: "/api/products/del",
    function_controller: "product_del",
    function_method: "DELETE",
    function_name: "DELETE_PRODUCT_MASTER_LIMIT",
    query_collection: "product_master",
    query_type: "DELETE_MANY",
    start_time: startTime,
    status_message: `starting del limit=${limit}`,
  });

  try {
    const docs = await Product.find({})
      .sort({ createdAt: 1, _id: 1 })
      .select({ _id: 1, barcode: 1 })
      .limit(limit)
      .lean();

    if (!docs.length) {
      const endTime = new Date();
      await TransactionLog.findByIdAndUpdate(log._id, {
        end_time: endTime,
        duration_ms: endTime - startTime,
        count_data: 0,
        status_code: 200,
        status_message: "no data to delete",
      });

      return res.status(200).json(
        buildDeleteResponse({
          httpCode: 200,
          statusMessage: "delete",
          message: "no data to delete.",
          deleteCount: 0,
          skipped: [],
          finalMassage: "",
          requestId,
          command:
            "Product.find({}).sort({createdAt:1,_id:1}).limit(limit) -> Product.deleteMany({_id:{$in:ids}})",
          target: "product_master",
          askedLimit: limit,
          matched: 0,
          hint:
            "endpoint /del ลบแบบจำกัดจำนวนเท่านั้น หากต้องการลบทั้งหมดให้ใช้ /api/product_del/delall",
        })
      );
    }

    const ids = docs.map((d) => d._id);
    const result = await Product.deleteMany({ _id: { $in: ids } });

    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: result.deletedCount || 0,
      status_code: 200,
      status_message: `deleted=${result.deletedCount || 0} limit=${limit}`,
    });

    return res.status(200).json(
      buildDeleteResponse({
        httpCode: 200,
        statusMessage: "delete",
        message: "delete success (partial delete).",
        deleteCount: result.deletedCount || 0,
        skipped: [],
        finalMassage: "",
        requestId,
        command: "Product.deleteMany({_id:{$in:ids}})",
        target: "product_master",
        askedLimit: limit,
        matched: ids.length,
        hint:
          "endpoint /del ลบแบบจำกัดจำนวนเท่านั้น หากต้องการลบทั้งหมดให้ใช้ /api/product_del/delall",
      })
    );
  } catch (e) {
    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: 0,
      status_code: 500,
      status_message: e.message,
    });

    return res.status(500).json(
      buildDeleteResponse({
        httpCode: 500,
        statusMessage: "error",
        message: e.message,
        deleteCount: 0,
        skipped: [],
        finalMassage: "",
        requestId,
        command: "Product.deleteMany({_id:{$in:ids}})",
        target: "product_master",
        askedLimit: limit,
        matched: 0,
        hint: "ตรวจสอบ error message / การเชื่อมต่อฐานข้อมูล / model Product",
      })
    );
  }
});

/**
 * =========================
 * DELETE /api/products/delall?confirm=true
 * - ลบทั้งหมด “เท่านั้น” ผ่าน endpoint นี้
 * - บังคับ confirm=true กันพลาด
 * =========================
 */
router.delete("/delall", async (req, res) => {
  const requestId = randomUUID();
  const startTime = new Date();

  const log = await TransactionLog.create({
    request_id: requestId,
    function_endpoint: "/api/products/delall",
    function_controller: "product_del_all",
    function_method: "DELETE",
    function_name: "DELETE_PRODUCT_MASTER_ALL",
    query_collection: "product_master, product_stock",
    query_type: "DELETE_MANY",
    start_time: startTime,
    status_message: "starting delall (Product + ProductStock)",
  });

  try {
    if (req.query.confirm !== "true") {
      const endTime = new Date();
      await TransactionLog.findByIdAndUpdate(log._id, {
        end_time: endTime,
        duration_ms: endTime - startTime,
        count_data: 0,
        status_code: 400,
        status_message: "delall requires confirm=true",
      });

      return res.status(400).json(
        buildDeleteResponse({
          httpCode: 400,
          statusMessage: "validate_error",
          message: "การลบทั้งหมดต้องยืนยัน confirm=true",
          deleteCount: 0,
          skipped: [],
          finalMassage: "",
          requestId,
          command: "Product.deleteMany({}) + ProductStock.deleteMany({})",
          target: "product_master, product_stock",
          hint: "ถ้าตั้งใจลบทั้งหมดจริง ให้เรียก /api/product_del/delall?confirm=true",
        })
      );
    }

    // ลบพร้อมกันทั้ง 2 collection
    const [productRes, stockRes] = await Promise.all([
      Product.deleteMany({}),
      ProductStock.deleteMany({}),
    ]);

    const deletedProduct = productRes?.deletedCount || 0;
    const deletedStock = stockRes?.deletedCount || 0;
    const deletedTotal = deletedProduct + deletedStock;

    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: deletedTotal,
      status_code: 200,
      status_message: `deleted_all product=${deletedProduct} product_stock=${deletedStock}`,
    });

    return res.status(200).json(
      buildDeleteResponse({
        httpCode: 200,
        statusMessage: "delete_all",
        message: "delete all success.",
        deleteCount: deletedTotal, // ยอดรวมตามฟิลด์ delete เดียว
        skipped: [
          { collection: "product_master", deleted: deletedProduct },
          { collection: "product_stock", deleted: deletedStock },
        ],
        finalMassage: "",
        requestId,
        command: "Product.deleteMany({}) + ProductStock.deleteMany({})",
        target: "product_master, product_stock",
        matched: deletedTotal,
        hint: "ลบข้อมูลทั้งหมดเรียบร้อยแล้ว (Product + ProductStock)",
      })
    );
  } catch (e) {
    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: 0,
      status_code: 500,
      status_message: e.message,
    });

    return res.status(500).json(
      buildDeleteResponse({
        httpCode: 500,
        statusMessage: "error",
        message: e.message,
        deleteCount: 0,
        skipped: [],
        finalMassage: "",
        requestId,
        command: "Product.deleteMany({}) + ProductStock.deleteMany({})",
        target: "product_master, product_stock",
        hint: "ตรวจสอบ error message / การเชื่อมต่อฐานข้อมูล / model Product และ ProductStock",
      })
    );
  }
});

module.exports = router;
