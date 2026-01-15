const router = require("express").Router();
const SkuUnit = require("../models/SkuUnit");

// CREATE
router.post("/", async (req, res) => {
  try {
    const doc = await SkuUnit.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// READ: list by sku_code (เช่น /api/sku-units?sku_code=001020)
router.get("/", async (req, res) => {
  const filter = {};
  if (req.query.sku_code) filter.sku_code = req.query.sku_code;
  if (req.query.status) filter.status = req.query.status;

  const docs = await SkuUnit.find(filter).sort({ updated_at: -1 });
  res.json(docs);
});

// READ: one by id
router.get("/:id", async (req, res) => {
  const doc = await SkuUnit.findById(req.params.id);
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

// UPDATE
router.put("/:id", async (req, res) => {
  try {
    const doc = await SkuUnit.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!doc) return res.status(404).json({ message: "not found" });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// SOFT DELETE
router.delete("/:id", async (req, res) => {
  const doc = await SkuUnit.findByIdAndUpdate(
    req.params.id,
    { status: "inactive" },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

module.exports = router;
