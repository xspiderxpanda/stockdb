const router = require("express").Router();
const Product = require("../models/Product")
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Supplier = require("../models/Supplier");
const Unit = require("../models/Unit");
const ProductStock = require("../models/ProductStock")
const response = require("../helpers/response.helper");
const LogHelper = require("../helpers/log.helper");

const multer = require("multer");
const XLSX = require("xlsx");

const CHUNK_SIZE = 1000;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

/**
 * POST /excel
 * - รับไฟล์ Excel
 * - ตอบกลับทันที (background)
 * - ทำ insert/update ทีละ 1000 แถว
 * - รูปแบบข้อมูลเหมือน /import-excel ที่ใช้งานได้
 */
router.post("/excel", upload.single("file"), async (req, res) => {
  const logger = new LogHelper({
    function_endpoint: "/api/insert_product_service/excel",
    function_controller: "insert_product_service",
    function_name: "Import Excel (Background)",
    function_method: "POST",
    query_collection: "product_master",
    query_type: "insert/update",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: req.user?.username || "system"
  });

  try {
    if (!req.file || !req.file.buffer) {
      logger.fail(400, "File is required");
      await logger.save();
      return response.badRequest(res, "File is required");
    }

    // ✅ ตอบกลับทันที (เหมือน job)
    response.success(
      res,
      {
        message: "File accepted, processing in background",
        file_name: req.file.originalname,
        chunk_size: CHUNK_SIZE
      },
      "Accepted"
    );

    // 🔥 background (ไม่ await)
    process.nextTick(() =>
      processExcelInBackground({
        buffer: req.file.buffer,
        logger,
        user: req.user
      }).catch(async (err) => {
        // ถ้า background ล้มจริง ๆ ให้บันทึกลง log
        try {
          logger.fail(500, err.message || "background error");
          await logger.save();
        } catch (_) {}
      })
    );
  } catch (error) {
    logger.fail(400, error.message || "fail");
    await logger.save();
    return response.badRequest(res, "Import product fail.");
  }
});

module.exports = router;

/* ============================================================
   BACKGROUND WORKER
============================================================ */

async function processExcelInBackground({ buffer, logger, user }) {
  const startedAt = Date.now();

  /* ---------------------------
   * 1) Read Excel from memory
   * --------------------------- */
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const payload = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false
  });

  if (!Array.isArray(payload) || payload.length === 0) {
    logger.fail(400, "Excel file empty");
    await logger.save();
    return;
  }

  /* ---------------------------
   * 2) Preload barcodes
   * --------------------------- */
  const existing = await Product.find({}, { barcode: 1, _id: 0 }).lean();
  const barcodeSet = new Set(existing.map((p) => String(p.barcode)));

  /* ---------------------------
   * 3) Buffers & counters
   * --------------------------- */
  const productInsert = [];
  const productUpdate = [];
  const stockInsert = [];

  const skipped = [];
  let importedCount = 0;
  let processedRows = 0;
  let chunkIndex = 0;

  /* ---------------------------
   * 4) Loop rows
   * --------------------------- */
  for (let i = 0; i < payload.length; i++) {
    const row = payload[i];
    const excelRow = i + 2;

    const barcode = row.barcode ? String(row.barcode).trim() : "";
    const product_name = row.product_name ? String(row.product_name).trim() : "";

    // rule: barcode required
    if (!barcode) {
      skipped.push({ row: excelRow, barcode: row.barcode ?? null, reason: "barcode is empty" });
      continue;
    }

    // rule: product_name required
    if (!product_name) {
      skipped.push({ row: excelRow, barcode, reason: "product_name is empty" });
      continue;
    }

    // rule: stock required
    if (!row.lot_no || !row.warehouse_name) {
      skipped.push({ row: excelRow, barcode, reason: "lot_no or warehouse_name missing" });
      continue;
    }

    const isExist = barcodeSet.has(barcode);

    // ✅ unit ต้องเป็น Number (เหมือนไฟล์ /import-excel ของคุณ)
    const unitNum = Number(row.unit);

    /* ---------- product ---------- */
    if (isExist) {
      productUpdate.push({
        updateOne: {
          filter: { barcode },
          update: {
            $set: {
              sku_code: row.sku_code,
              product_name: row.product_name,
              product_description: row.product_description,
              category_code: Number(row.category_code),
              supplier_code: Number(row.supplier_code),
              brand_code: Number(row.brand_code),
              unit: unitNum, // ✅ number
              cost_price: Number(row.cost_price),
              status: row.status,
              updated_by: row.created_by
            }
          }
        }
      });
    } else {
      productInsert.push({
        barcode,
        sku_code: row.sku_code,
        product_name: row.product_name,
        product_description: row.product_description,
        category_code: Number(row.category_code),
        supplier_code: Number(row.supplier_code),
        brand_code: Number(row.brand_code),
        unit: unitNum, // ✅ number
        cost_price: Number(row.cost_price),
        status: row.status,
        created_by: row.created_by,
        updated_by: row.created_by
      });

      barcodeSet.add(barcode);
    }

    /* ---------- stock ---------- */
    stockInsert.push({
      barcode,
      lots_no: row.lot_no,
      warehouses_name: row.warehouse_name,
      warehouses_zone: row.warehouse_zone,
      bin: row.bin,
      stock_type: row.stock_type,
      receive_qty: Number(row.receive_qty) || 0,
      selling_qty: 0,
      balance_qty: Number(row.receive_qty) || 0,
      mfg: row.mfg ? new Date(row.mfg) : null,
      exp: row.exp ? new Date(row.exp) : null,
      status: row.status,
      created_by: row.created_by,
      updated_by: row.created_by
    });

    importedCount++;
    processedRows++;

    /* ---------- flush per chunk ---------- */
    if (processedRows % CHUNK_SIZE === 0) {
      chunkIndex++;
      await flushChunkLikeImportExcel({
        productInsert,
        productUpdate,
        stockInsert
      });

      // progress log
      logger.setCount(importedCount + skipped.length);
      logger.success(
        200,
        `chunk ${chunkIndex} done | imported=${importedCount} skipped=${skipped.length}`
      );
      await logger.save();

      await new Promise((r) => setImmediate(r));
    }
  }

  /* ---------------------------
   * 5) Flush remainder
   * --------------------------- */
  if (productInsert.length || productUpdate.length || stockInsert.length) {
    chunkIndex++;
    await flushChunkLikeImportExcel({
      productInsert,
      productUpdate,
      stockInsert
    });

    logger.setCount(importedCount + skipped.length);
    logger.success(
      200,
      `chunk ${chunkIndex} done | imported=${importedCount} skipped=${skipped.length}`
    );
    await logger.save();
  }

  /* ---------------------------
   * 6) Final log
   * --------------------------- */
  const ms = Date.now() - startedAt;

  // ถ้าอยากให้ "มี skipped แล้วถือว่า fail" เหมือนเดิม ก็ set fail ได้
  if (skipped.length > 0) {
    logger.setCount(importedCount + skipped.length);
    logger.fail(
      400,
      `completed with skipped | imported=${importedCount} skipped=${skipped.length} | ${ms}ms`
    );
    await logger.save();
  } else {
    logger.setCount(importedCount);
    logger.success(
      201,
      `completed | imported=${importedCount} | ${ms}ms`
    );
    await logger.save();
  }
}

async function flushChunkLikeImportExcel({ productInsert, productUpdate, stockInsert }) {
  if (productInsert.length) {
    await Product.insertMany(productInsert);
    productInsert.length = 0;
  }
  if (productUpdate.length) {
    await Product.bulkWrite(productUpdate);
    productUpdate.length = 0;
  }
  if (stockInsert.length) {
    await ProductStock.insertMany(stockInsert);
    stockInsert.length = 0;
  }
}


// const router = require("express").Router();
// const multer = require("multer");
// const XLSX = require("xlsx");
// const { randomUUID } = require("crypto");


// const Product = require("../models/Product");
// const SkuUnit = require("../models/SkuUnit");
// const TransactionLog = require("../models/TransactionLog");

// // ----------------------
// // CONFIG
// // ----------------------
// const CHUNK_SIZE = 10000;
// const upload = multer({ storage: multer.memoryStorage() });

// // ----------------------
// // POST /api/insert_product_service/excel
// // ----------------------
// router.post("/excel", upload.single("file"), async (req, res) => {
//   const requestId = randomUUID();
//   const startTime = new Date();

//   const log = await TransactionLog.create({
//     request_id: requestId,
//     function_endpoint: "/api/insert_product_service/excel",
//     function_controller: "insert_product_service",
//     function_method: "POST",
//     function_name: "IMPORT_EXCEL_PRODUCT",
//     query_collection: "product_master, sku_unit",
//     query_type: "UPSERT",
//     start_time: startTime,
//     status_message: "starting import",
//   });

//   try {
//     if (!req.file) {
//       throw new Error("ไม่พบไฟล์ .xlsx");
//     }

//     // ----------------------
//     // read excel
//     // ----------------------
//     const wb = XLSX.read(req.file.buffer, { type: "buffer" });
//     const sheet = wb.Sheets[wb.SheetNames[0]];
//     const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

//     const totalRows = rows.length;
//     let processed = 0;
//     let chunkIndex = 0;

//     if (totalRows === 0) {
//       throw new Error("ไฟล์ว่าง ไม่มีข้อมูล");
//     }

//     // ----------------------
//     // process by chunk
//     // ----------------------
//     for (let start = 0; start < totalRows; start += CHUNK_SIZE) {
//       const end = Math.min(start + CHUNK_SIZE, totalRows);
//       const chunk = rows.slice(start, end);
//       chunkIndex++;

//       const productOps = [];
//       const skuOps = [];

//       for (const r of chunk) {
//         const barcode = String(r.BarCode || "").trim();
//         const sku = String(r.SkuCode || "").trim();
//         const name = String(r.Name || "").trim();
//         const unit = String(r.Unit || "").trim();
//         const factor = Number(r.Factor || 1) || 1;
//         const price = Number(r.Price || 0) || 0;

//         if (!sku || !name) continue;

//         const useBarcode = barcode || sku;

//         productOps.push({
//           updateOne: {
//             filter: { barcode: useBarcode },
//             update: {
//               barcode: useBarcode,
//               sku_code: sku,
//               product_name: name,
//               unit,
//               status: "active",
//             },
//             upsert: true,
//           },
//         });

//         if (unit) {
//           skuOps.push({
//             updateOne: {
//               filter: { sku_code: sku, unit },
//               update: {
//                 sku_code: sku,
//                 barcode: useBarcode,
//                 unit,
//                 factor,
//                 price,
//               },
//               upsert: true,
//             },
//           });
//         }
//       }

//       // ----------------------
//       // write to DB (bulk)
//       // ----------------------
//       if (productOps.length) {
//         await Product.bulkWrite(productOps, { ordered: false });
//       }
//       if (skuOps.length) {
//         await SkuUnit.bulkWrite(skuOps, { ordered: false });
//       }

//       processed += chunk.length;

//       // ----------------------
//       // update progress log
//       // ----------------------
//       await TransactionLog.findByIdAndUpdate(log._id, {
//         count_data: processed,
//         status_message: `chunk ${chunkIndex} processed (${processed} / ${totalRows})`,
//       });

//       // give event-loop a break (important on cloud)
//       await new Promise((r) => setImmediate(r));
//     }

//     // ----------------------
//     // finish log
//     // ----------------------
//     const endTime = new Date();
//     const durationMs = endTime - startTime;

//     await TransactionLog.findByIdAndUpdate(log._id, {
//       end_time: endTime,
//       duration_ms: durationMs,
//       count_data: processed,
//       status_code: 200,
//       status_message: `completed ${processed} / ${totalRows} rows`,
//     });

//     // ----------------------
//     // response
//     // ----------------------
//     res.json({
//       message: "Import success",
//       request_id: requestId,
//       timing: {
//         startAt: startTime,
//         endAt: endTime,
//         durationSec: Math.round(durationMs / 1000),
//       },
//       summary: {
//         total_rows: totalRows,
//         imported_rows: processed,
//         chunk_size: CHUNK_SIZE,
//       },
//     });

//   } catch (err) {
//     const endTime = new Date();

//     await TransactionLog.findByIdAndUpdate(log._id, {
//       end_time: endTime,
//       duration_ms: endTime - startTime,
//       status_code: 400,
//       status_message: err.message,
//     });

//     res.status(400).json({
//       message: err.message,
//       request_id: requestId,
//     });
//   }
// });

// module.exports = router;
