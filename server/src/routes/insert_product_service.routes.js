const router = require("express").Router();
const multer = require("multer");
const XLSX = require("xlsx");
const { randomUUID } = require("crypto");

const Product = require("../models/Product");
const SkuUnit = require("../models/SkuUnit");
const TransactionLog = require("../models/TransactionLog");

const upload = multer({ storage: multer.memoryStorage() });

router.post("/excel", upload.single("file"), async (req, res) => {
  const requestId = randomUUID();
  const startTime = new Date();

  const log = await TransactionLog.create({
    request_id: requestId,
    function_endpoint: "/api/insert_product_service/excel",
    function_controller: "insert_product_service",
    function_method: "POST",
    function_name: "IMPORT_EXCEL_PRODUCT",
    query_collection: "product_master, sku_unit",
    query_type: "UPSERT",
    start_time: startTime,
    staff_code: req.headers["x-staff-code"],
    created_by: req.headers["x-staff-code"],
  });

  try {
    if (!req.file) {
      throw new Error("ไม่พบไฟล์ .xlsx");
    }

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    let count = 0;

    for (const r of rows) {
      const barcode = String(r.BarCode || "").trim();
      const sku = String(r.SkuCode || "").trim();
      const name = String(r.Name || "").trim();
      const unit = String(r.Unit || "").trim();
      const factor = Number(r.Factor || 1) || 1;
      const price = Number(r.Price || 0) || 0;

      if (!sku || !name) continue;

      const useBarcode = barcode || sku;

      // product_master
      await Product.findOneAndUpdate(
        { barcode: useBarcode },
        {
          barcode: useBarcode,
          sku_code: sku,
          product_name: name,
          unit,
          status: "active",
        },
        { upsert: true }
      );

      // sku_unit
      if (unit) {
        await SkuUnit.findOneAndUpdate(
          { sku_code: sku, unit },
          {
            sku_code: sku,
            barcode: useBarcode,
            unit,
            factor,
            price,
          },
          { upsert: true }
        );
      }

      count++;
    }

    // ---------- ปิด log ----------
    const endTime = new Date();
    const durationMs = endTime - startTime;

    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: durationMs,
      count_data: count,
      status_code: 200,
      status_message: "Import success",
    });

    // ---------- response ----------
    res.json({
      message: "Import success",
      request_id: requestId,
      timing: {
        startAt: startTime,
        endAt: endTime,
        durationSec: Math.round(durationMs / 1000),
      },
      summary: {
        total_rows: rows.length,
        imported_rows: count,
      },
    });

  } catch (err) {
    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      status_code: 400,
      status_message: err.message,
    });

    res.status(400).json({
      message: err.message,
      request_id: requestId,
    });
  }
});

module.exports = router;
