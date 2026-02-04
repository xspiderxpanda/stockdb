const router = require("express").Router();
const Product = require("../models/Product");

// CREATE
router.post("/", async (req, res) => {
  try {
    const doc = await Product.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// READ list (ค้นหาด้วย q) + summary ว่าดึงครบไหม
router.get("/", async (req, res) => {
  try {
    const { q, category_code, brand_code, supplier_code } = req.query;

    const filter = {};
    if (category_code) filter.category_code = category_code;
    if (brand_code) filter.brand_code = brand_code;
    if (supplier_code) filter.supplier_code = supplier_code;
    if (q) filter.$text = { $search: q };

    const limit = 100;

    // นับจำนวนทั้งหมด + ดึงมาแค่ limit
    const [total, docs] = await Promise.all([
      Product.countDocuments(filter),
      Product.find(filter).sort({ updated_at: -1 }).limit(limit),
    ]);

    const gotThis = docs.length;
    const missing = Math.max(total - gotThis, 0);
    const gotAll = missing === 0;

    res.json({
      docs,
      fetch_summary: {
        got_all: gotAll,        // true = ครบทั้งหมด (total <= 100)
        got: gotThis,           // ได้มาจริง
        total,                  // มีทั้งหมดกี่รายการตาม filter
        missing,                // ขาดอีกกี่รายการ (ถ้ามากกว่า 0 แปลว่าไม่ครบ)
        limit,                  // limit ที่ระบบตัดไว้
      },
      query: {
        q: q || "",
        category_code: category_code || "",
        brand_code: brand_code || "",
        supplier_code: supplier_code || "",
      },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
