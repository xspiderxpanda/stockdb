const router = require("express").Router();
const Stock = require("../models/ProductStock");

// CREATE
router.post("/", async (req, res) => {
  try {
    // สามารถคำนวณ balance_qty เองได้: receive - selling
    const payload = { ...req.body };
    if (payload.receive_qty != null || payload.selling_qty != null) {
      const r = Number(payload.receive_qty || 0);
      const s = Number(payload.selling_qty || 0);
      payload.balance_qty = Math.max(0, r - s);
    }

    const doc = await Stock.create(payload);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// READ by barcode
router.get("/by-barcode/:barcode", async (req, res) => {
  const docs = await Stock.find({ barcode: req.params.barcode })
    .sort({ updated_at: -1 });
  res.json(docs);
});

module.exports = router;
