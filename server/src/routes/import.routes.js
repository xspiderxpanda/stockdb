const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const Product = require("../models/Product");
const Sku = require("../models/Sku");

const router = express.Router();

// เก็บไฟล์ใน memory (ไม่ต้องเขียนลง disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB (ปรับได้)
});

// helper: แปลง key ให้เป็นรูปแบบมาตรฐาน
function normalizeKey(k = "") {
  return String(k).trim().toLowerCase();
}

/**
 * POST /api/import/excel
 * mapping:
 * - sku = BarCode
 * - product_name = Name
 * - sku = SkuCode
 * - unit = Unit
 * - factor = Factor
 * - price = Price
 */
router.post("/excel", upload.single("file"), async (req, res) => {
  // --- speed ---
  const startTime = Date.now();
  const startAt = new Date(startTime).toISOString();
  console.log("Import started at : ", startAt);

  try {
    if (!req.file) return res.status(400).json({ message: "Missing file" });

    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];

    // แปลงเป็น array of objects (หัวคอลัมน์แถวแรก)
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
    if (!rows.length) return res.status(400).json({ message: "Empty sheet" });

    // map header แบบยืดหยุ่น
    const keyMap = {
      product_id: ["product_id", "productid", "pid", "product code", "product_code"],
      product_name: ["name", "product_name"],
      sku: ["skucode", "sku_code", "sku"],
      unit: ["unit"],
      factor: ["factor"],
      price: ["price"],
      stock_qty: ["stock_qty", "qty", "stock", "stockqty", "stock qty"],
      warehouse: ["warehouse", "wh", "location"],
      category: ["category", "cat"],
      brand: ["brand"],
    };

    // ฟังก์ชันช่วยดึงค่า จาก row โดยหา key ที่ match
    function pick(row, standardKey) {
      const candidates = keyMap[standardKey] || [standardKey];
      const rowKeys = Object.keys(row);
      for (const c of candidates) {
        const found = rowKeys.find(
          (rk) => normalizeKey(rk) === normalizeKey(c)
        );
        if (found) return row[found];
      }
      return "";
    }

    // สะสม ops สำหรับ bulkWrite
    const productOps = [];
    const skuOps = [];
    const seenProductIds = new Set();

    let skipped = 0;

    for (const r of rows) {
      const product_name = String(pick(r, "product_name")).trim();
      const sku = String(pick(r, "sku")).trim();
      if (!sku) continue;

      const product_id = sku; 
      const unit = String(pick(r, "unit")).trim();
      const factor = Number(pick(r, "factor")) || 1;
      const price = Number(pick(r, "price")) || 0;

      // sku_master
      if (!sku) {
        skipped++;
        continue;
      }

      const category = String(pick(r, "category")).trim();
      const brand = String(pick(r, "brand")).trim();

      if (!seenProductIds.has(sku)) {
        seenProductIds.add(sku);

        productOps.push({
          updateOne: {
            filter: { sku },
            update: {
              $set: {
                sku,
                product_name: product_name || sku, // กันว่าง
                category,
                brand,
              },
            },
            upsert: true,
          },
        });
      }

      const qtyRaw = pick(r, "stock_qty");
      const warehouse = String(pick(r, "warehouse")).trim();
      const stock_qty = Number(qtyRaw) || 0;

      skuOps.push({
        updateOne: {
          filter: { sku },
          update: {
            $set: {
              sku,
              product_id: sku,
              barcode: sku, // เก็บซ้ำให้ค้น/อ้างอิงง่าย
              unit,
              factor,
              price,
              stock_qty,
              warehouse,
            },
          },
          upsert: true,
        },
      });
    }

    async function bulkInChunks(model, ops, chunkSize = 2000, label = "") {
      let processed = 0;
      for (let i = 0; i < ops.length; i += chunkSize) {
        const chunk = ops.slice(i, i + chunkSize);
        await model.bulkWrite(chunk, { ordered: false });
        processed += chunk.length;
        if (label) {
          console.log(`📦 ${label} processed: ${processed}/${ops.length}`);
        }
      }
      return processed;
    }

    const productsProcessed = await bulkInChunks(Product, productOps, 2000, "products");
    const skusProcessed = await bulkInChunks(Sku, skuOps, 2000, "skus");

    // --- timing end ---
    const endTime = Date.now();
    const endAt = new Date(endTime).toISOString();
    const durationMs = endTime - startTime;
    const durationSec = Number((durationMs / 1000).toFixed(2));

    console.log("✅ Import finished at:", endAt);
    console.log(`⏱ Duration: ${durationSec} seconds`);

    return res.json({
      message: "import successfully",
      timing: {
        startAt,
        endAt,
        durationMs,
        durationSec,
      },
      sheet: sheetName,
      totalRows: rows.length,
      productsUpsertedOps: productsProcessed,
      skusUpsertedOps: skusProcessed,
      skippedRows: skipped,
    });
  } catch (err) {
    const endTime = Date.now();
    const endAt = new Date(endTime).toISOString();
    const durationMs = endTime - startTime;
    const durationSec = Number((durationMs / 1000).toFixed(2));

    console.error("❌ Import failed at:", endAt);
    console.error(`⏱ Duration before fail: ${durationSec} seconds`);
    console.error("Error:", err);

    return res.status(500).json({
      message: err.message,
      timing: { startAt, endAt, durationMs, durationSec },
    });
  }
});

module.exports = router;
