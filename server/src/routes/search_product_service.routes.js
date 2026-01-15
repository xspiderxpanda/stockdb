const router = require("express").Router();
const Product = require("../models/Product");   // product_master
const SkuUnit = require("../models/SkuUnit");   // sku_unit

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
  try {
    const keyword = String(req.query.keyword || "").trim();
    const unitFilter = String(req.query.unit || "").trim();

    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "10", 10), 1), 100);
    const skip = (page - 1) * limit;

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
            stock_qty: u.factor ? Math.floor((p.balance_qty || 0) / u.factor) : (p.balance_qty || 0),
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

      return {
        product_name: p.product_name,
        skus,
      };
    });

    const totalPages = Math.max(Math.ceil(total / limit), 1);
    res.json({ items, page, totalPages, total });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ------------------------
// POST /api/search_product_service
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

    // 1) upsert product_master
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

    // 2) upsert sku_unit (sku_code + unit)
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

module.exports = router;
