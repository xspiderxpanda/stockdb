const router = require("express").Router();
const Supplier = require("../models/Supplier");

// CREATE
router.post("/", async (req, res) => {
  try {
    const doc = await Supplier.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// READ list
router.get("/", async (_req, res) => {
  const docs = await Supplier.find().sort({ updated_at: -1 });
  res.json(docs);
});

// READ by code
router.get("/:supplier_code", async (req, res) => {
  const doc = await Supplier.findOne({ supplier_code: req.params.supplier_code });
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

// UPDATE by code
router.put("/:supplier_code", async (req, res) => {
  try {
    const doc = await Supplier.findOneAndUpdate(
      { supplier_code: req.params.supplier_code },
      req.body,
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ message: "not found" });
    res.json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// SOFT DELETE
router.delete("/:supplier_code", async (req, res) => {
  const doc = await Supplier.findOneAndUpdate(
    { supplier_code: req.params.supplier_code },
    { status: "inactive" },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

module.exports = router;
