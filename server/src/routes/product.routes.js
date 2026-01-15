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

// READ list (ค้นหาด้วย q)
router.get("/", async (req, res) => {
  const { q, category_code, brand_code, supplier_code } = req.query;
  const filter = {};
  if (category_code) filter.category_code = category_code;
  if (brand_code) filter.brand_code = brand_code;
  if (supplier_code) filter.supplier_code = supplier_code;
  if (q) filter.$text = { $search: q };

  const docs = await Product.find(filter).sort({ updated_at: -1 }).limit(100);
  res.json(docs);
});

// READ by barcode
router.get("/:barcode", async (req, res) => {
  const doc = await Product.findOne({ barcode: req.params.barcode });
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

// UPDATE
router.put("/:barcode", async (req, res) => {
  try {
    const doc = await Product.findOneAndUpdate(
      { barcode: req.params.barcode },
      req.body,
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: "not found" });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// DELETE (soft delete แนะนำ)
router.delete("/:barcode", async (req, res) => {
  const doc = await Product.findOneAndUpdate(
    { barcode: req.params.barcode },
    { status: "inactive" },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

module.exports = router;
