const router = require("express").Router();
const Category = require("../models/Category");

router.post("/", async (req, res) => {
  try {
    const doc = await Category.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

router.get("/", async (_req, res) => {
  const docs = await Category.find().sort({ updated_at: -1 });
  res.json(docs);
});

router.get("/", (req, res) => {
  res.json({ ok: true });
});

module.exports = router;

