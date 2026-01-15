const router = require("express").Router();
const Brand = require("../models/Brand");

// CREATE
router.post("/", async (req, res) => {
  try {
    const doc = await Brand.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// READ list
router.get("/", async (_req, res) => {
  const docs = await Brand.find().sort({ updated_at: -1 });
  res.json(docs);
});

// READ by code
router.get("/:brand_code", async (req, res) => {
  const doc = await Brand.findOne({ brand_code: req.params.brand_code });
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

// UPDATE by code
router.put("/:brand_code", async (req, res) => {
  try {
    const doc = await Brand.findOneAndUpdate(
      { brand_code: req.params.brand_code },
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
router.delete("/:brand_code", async (req, res) => {
  const doc = await Brand.findOneAndUpdate(
    { brand_code: req.params.brand_code },
    { status: "inactive" },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

module.exports = router;
