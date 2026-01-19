const router = require("express").Router();
const { randomUUID } = require("crypto");
const Product = require("../models/Product");
const SkuUnit = require("../models/SkuUnit");
const TransactionLog = require("../models/TransactionLog");

router.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "search_product_service",
    endpoints: {
      search: "GET /api/search_product_service/search?keyword=&page=&limit=&unit=",
      addOne: "POST /api/search_product_service",
    },
  });
});

router.get("/search", async (req, res) => {
  const requestId = randomUUID();
  const startTime = new Date();
  const keyword = String(req.query.keyword || "").trim();
  const unitFilter = String(req.query.unit || "").trim();
  const page = Math.max(parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 100);
  const skip = (page - 1) * limit;

  // ทำ Logs รอ
  const log = await TransactionLog.create({
    request_id: requestId,
    function_endpoint: "/api/search_product_service/search",
    function_controller: "search_product_service",
    function_method: "GET",
    function_name: "SEARCH_PRODUCT",
    query_collection: "product_master, sku_unit",
    query_type: "FIND",
    start_time: startTime,
  });

  try {
    const filter = {};
    if (keyword) {
      filter.$or = [
        { barcode: { $regex: keyword, $options: "i" } },
        { sku_code: { $regex: keyword, $options: "i" } },
        { product_name: { $regex: keyword, $options: "i" } },
      ];
    }

    const [total, products] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const skuCodes = [...new Set(products.map((p) => p.sku_code).filter(Boolean))];

    const unitQuery = { sku_code: { $in: skuCodes } };
    if (unitFilter) unitQuery.unit = unitFilter;

    const skuUnits = await SkuUnit.find(unitQuery).sort({ unit: 1 }).lean();

    const mapUnits = new Map();
    for (const u of skuUnits) {
      if (!mapUnits.has(u.sku_code)) mapUnits.set(u.sku_code, []);
      mapUnits.get(u.sku_code).push(u);
    }

    const items = products.map((p) => {
      const list = mapUnits.get(p.sku_code) || [];

      const skus = list.length
        ? list.map((u) => ({
            sku: p.sku_code,
            unit: u.unit,
            factor: Number(u.factor || 1),
            price: Number(u.price || 0),
            stock_qty: u.factor
              ? Math.floor((p.balance_qty || 0) / u.factor)
              : (p.balance_qty || 0),
            barcode: u.barcode || p.barcode,
          }))
        : [
            {
              sku: p.sku_code,
              unit: p.unit || "",
              factor: 1,
              price: 0,
              stock_qty: p.balance_qty || 0,
              barcode: p.barcode,
            },
          ];

      return { product_name: p.product_name, skus };
    });

   
    
const totalPages = Math.max(Math.ceil(total / limit), 1);

const endTime = new Date();
const durationMs = endTime - startTime;

await TransactionLog.findByIdAndUpdate(log._id, {
  end_time: endTime,
  duration_ms: durationMs,
  count_data: items.length,
  status_code: 200,
  status_message: `ok keyword="${keyword}" unit="${unitFilter}" page=${page} limit=${limit} returned=${items.length} total=${total}`,
});

res.json({
  items,
  page,
  totalPages,
  total,
  request_id: requestId,
  timing: {
    startAt: startTime,
    endAt: endTime,
    durationMs,
  },
});







  } catch (e) {
    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: 0,
      status_code: 500,
      status_message: e.message,
    });

    res.status(500).json({ message: e.message, request_id: requestId });
  }
});

router.get("/bucket", async (req, res) => {
  const requestId = randomUUID();
  const startTime = new Date();

  const type = String(req.query.type || "").toLowerCase();

  const log = await TransactionLog.create({
    request_id: requestId,
    function_endpoint: "/api/search_product_service/bucket",
    function_controller: "search_product_service",
    function_method: "GET",
    function_name: "SEARCH_BUCKET",
    query_collection: "product_master, sku_unit",
    query_type: "AGGREGATE",
    start_time: startTime,
  });

  try {
    let buckets = [];

    // ------------------
    // BUCKET BY UNIT
    // ------------------
    if (type === "unit") {
      buckets = await SkuUnit.aggregate([
        { $group: { _id: "$unit", count: { $sum: 1 } } },
        { $project: { _id: 0, key: "$_id", count: 1 } },
        { $sort: { count: -1 } },
      ]);
    }

    // ------------------
    // BUCKET BY SKU
    // ------------------
    else if (type === "sku") {
      buckets = await Product.aggregate([
        { $group: { _id: "$sku_code", count: { $sum: 1 } } },
        { $project: { _id: 0, key: "$_id", count: 1 } },
        { $sort: { count: -1 } },
      ]);
    }

    // ------------------
    // BUCKET BY PRICE RANGE
    // ------------------
    else if (type === "price") {
      buckets = await SkuUnit.aggregate([
        {
          $bucket: {
            groupBy: "$price",
            boundaries: [0, 20, 50, 100, 200, 500, 1000],
            default: "1000+",
            output: { count: { $sum: 1 } },
          },
        },
        {
          $project: {
            _id: 0,
            key: {
              $cond: [
                { $eq: ["$_id", "1000+"] },
                "1000+",
                { $concat: [{ $toString: "$_id" }, " -"] },
              ],
            },
            count: 1,
          },
        },
      ]);
    } else {
      throw new Error("invalid bucket type (unit | sku | price)");
    }

    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: buckets.length,
      status_code: 200,
      status_message: `bucket type=${type}`,
    });

    res.json({
      bucket_type: type,
      buckets,
      request_id: requestId,
    });
  } catch (e) {
    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: 0,
      status_code: 500,
      status_message: e.message,
    });

    res.status(500).json({
      message: e.message,
      request_id: requestId,
    });
  }
});

// ------------------------
// POST /api/search_product_service (Insert 1/1)
// ------------------------

router.post("/", async (req, res) => {
  try {
    const body = req.body || {};
    const product = body.product || {};
    const skus = Array.isArray(body.skus) ? body.skus : [];

    const sku_code = String(product.sku || "").trim();
    const product_name = String(product.product_name || "").trim();

    if (!sku_code || !product_name) {
      return res.status(400).json({ message: "ต้องมี sku และ name" });
    }
    if (skus.length === 0) {
      return res.status(400).json({ message: "ต้องมี skus อย่างน้อย 1 รายการ" });
    }

    const first = skus[0];
    const barcode = String(first.barcode || sku_code).trim();
    const unit = String(first.unit || "").trim();
    const factor = Number(first.factor || 1) || 1;
    const price = Number(first.price || 0) || 0;

    if (!barcode) return res.status(400).json({ message: "barcode จำเป็นต้องมี" });
    if (!unit) return res.status(400).json({ message: "unit จำเป็นต้องมี" });

    const prod = await Product.findOneAndUpdate(
      { barcode },
      {
        barcode,
        sku_code,
        product_name,
        unit,
        status: "active",
      },
      { upsert: true, new: true, runValidators: true }
    );

    const uom = await SkuUnit.findOneAndUpdate(
      { sku_code, unit },
      { sku_code, barcode, unit, factor, price },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json({
      message: "เพิ่มสินค้าเรียบร้อย",
      product: {
        barcode: prod.barcode,
        sku_code: prod.sku_code,
        product_name: prod.product_name,
      },
      sku_unit: {
        sku_code: uom.sku_code,
        unit: uom.unit,
        factor: uom.factor,
        price: uom.price,
      },
    });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});


router.get("/count", async (req, res) => {
  const requestId = randomUUID();
  const startTime = new Date();

  const keyword = String(req.query.keyword || "").trim();
  const useEstimated = String(req.query.estimated || "1") === "1";

  const log = await TransactionLog.create({
    request_id: requestId,
    function_endpoint: "/api/search_product_service/count",
    function_controller: "search_product_service",
    function_method: "GET",
    function_name: "COUNT_PRODUCT",
    query_collection: "product_master",
    query_type: useEstimated ? "ESTIMATED_COUNT" : "COUNT",
    start_time: startTime,
  });

  try {
    const filter = {};
    if (keyword) {
      filter.$or = [
        { barcode: { $regex: keyword, $options: "i" } },
        { sku_code: { $regex: keyword, $options: "i" } },
        { product_name: { $regex: keyword, $options: "i" } },
      ];
    }

    const total = keyword
      ? await Product.countDocuments(filter)                // ชัวร์ (มี filter)
      : useEstimated
      ? await Product.estimatedDocumentCount()              // เร็วมาก
      : await Product.countDocuments({});                   // ชัวร์ (ทั้งก้อน)

    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: total,
      status_code: 200,
      status_message: `ok keyword="${keyword}" estimated=${useEstimated}`,
    });

    res.json({
      total,
      request_id: requestId,
      timing: { startAt: startTime, endAt: endTime, durationMs: endTime - startTime },
    });
  } catch (e) {
    const endTime = new Date();
    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: 0,
      status_code: 500,
      status_message: e.message,
    });
    res.status(500).json({ message: e.message, request_id: requestId });
  }
});



router.get("/scan", async (req, res) => {
  const requestId = randomUUID();
  const startTime = new Date();

  const keyword = String(req.query.keyword || "").trim();
  const max = Math.min(Math.max(parseInt(req.query.max || "100000", 10), 1), 5000000);
  const batch = Math.min(Math.max(parseInt(req.query.batch || "1000", 10), 1), 10000);

  const log = await TransactionLog.create({
    request_id: requestId,
    function_endpoint: "/api/search_product_service/scan",
    function_controller: "search_product_service",
    function_method: "GET",
    function_name: "SCAN_PRODUCT",
    query_collection: "product_master",
    query_type: "CURSOR_SCAN",
    start_time: startTime,
  });

  try {
    // filter (เหมือน search)
    const filter = {};
    if (keyword) {
      filter.$or = [
        { barcode: { $regex: keyword, $options: "i" } },
        { sku_code: { $regex: keyword, $options: "i" } },
        { product_name: { $regex: keyword, $options: "i" } },
      ];
    }

    // ใช้ cursor เพื่อลด memory
    const cursor = Product.find(filter)
      .sort({ _id: 1 })           // ไล่ตาม index ธรรมดา
      .select({ _id: 1 })         // ดึง field น้อยที่สุดเพื่อความเร็ว (ปรับได้)
      .lean()
      .batchSize(batch)
      .cursor();

    let scanned = 0;

    for await (const _doc of cursor) {
      scanned++;
      if (scanned >= max) break;
    }

    const endTime = new Date();
    const durationMs = endTime - startTime;

    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: durationMs,
      count_data: scanned,
      status_code: 200,
      status_message: `ok keyword="${keyword}" scanned=${scanned} max=${max} batch=${batch}`,
    });

    res.json({
      request_id: requestId,
      summary: {
        keyword,
        scanned,
        max,
        batch,
      },
      timing: {
        startAt: startTime,
        endAt: endTime,
        durationMs,
        scannedPerSec: durationMs > 0 ? Number((scanned / (durationMs / 1000)).toFixed(2)) : null,
      },
    });
  } catch (e) {
    const endTime = new Date();

    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: 0,
      status_code: 500,
      status_message: e.message,
    });

    res.status(500).json({ message: e.message, request_id: requestId });
  }
});

router.get("/scan_full", async (req, res) => {
  const requestId = randomUUID();
  const startTime = new Date();

  const keyword = String(req.query.keyword || "").trim();
  const max = Math.min(Math.max(parseInt(req.query.max || "100000", 10), 1), 2000000);
  const batch = Math.min(Math.max(parseInt(req.query.batch || "500", 10), 1), 5000);

  const log = await TransactionLog.create({
    request_id: requestId,
    function_endpoint: "/api/search_product_service/scan_full",
    function_controller: "search_product_service",
    function_method: "GET",
    function_name: "SCAN_PRODUCT_FULL",
    query_collection: "product_master, sku_unit",
    query_type: "AGGREGATE_LOOKUP",
    start_time: startTime,
  });

  try {
    const match = {};
    if (keyword) {
      match.$or = [
        { barcode: { $regex: keyword, $options: "i" } },
        { sku_code: { $regex: keyword, $options: "i" } },
        { product_name: { $regex: keyword, $options: "i" } },
      ];
    }

    const pipeline = [
      { $match: match },
      { $sort: { _id: 1 } },
      {
        $lookup: {
          from: "sku_units", // ถ้าคอลเลกชันคุณชื่อไม่ใช่นี้ ให้แก้ตาม show collections
          localField: "sku_code",
          foreignField: "sku_code",
          as: "uoms",
        },
      },
      {
        $project: {
          _id: 1,
          sku_code: 1,
          barcode: 1,
          product_name: 1,
          uoms: {
            $map: {
              input: "$uoms",
              as: "u",
              in: { unit: "$$u.unit", factor: "$$u.factor", price: "$$u.price" },
            },
          },
        },
      },
    ];

    // ✅ cursor stream (ไม่ใช้ exec)
    const cursor = Product.aggregate(pipeline).cursor({ batchSize: batch });

    let scanned = 0;
    let totalUoms = 0;

    await new Promise((resolve, reject) => {
      cursor
        .on("data", (doc) => {
          scanned++;
          if (Array.isArray(doc.uoms)) totalUoms += doc.uoms.length;

          if (scanned >= max) cursor.close();
        })
        .on("end", resolve)
        .on("close", resolve)
        .on("error", reject);
    });

    const endTime = new Date();
    const durationMs = endTime - startTime;

    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: durationMs,
      count_data: scanned,
      status_code: 200,
      status_message: `ok keyword="${keyword}" scanned=${scanned} max=${max} batch=${batch} totalUoms=${totalUoms}`,
    });

    res.json({
      request_id: requestId,
      summary: {
        keyword,
        scanned,
        max,
        batch,
        totalUoms,
        avgUomsPerProduct: scanned > 0 ? Number((totalUoms / scanned).toFixed(2)) : 0,
      },
      timing: {
        startAt: startTime,
        endAt: endTime,
        durationMs,
        scannedPerSec: durationMs > 0 ? Number((scanned / (durationMs / 1000)).toFixed(2)) : null,
      },
    });
  } catch (e) {
    const endTime = new Date();

    await TransactionLog.findByIdAndUpdate(log._id, {
      end_time: endTime,
      duration_ms: endTime - startTime,
      count_data: 0,
      status_code: 500,
      status_message: e.message,
    });

    res.status(500).json({ message: e.message, request_id: requestId });
  }
});


module.exports = router;
