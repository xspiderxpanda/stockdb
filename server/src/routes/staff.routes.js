const router = require("express").Router();
const Staff = require("../models/Staff");

// CREATE
router.post("/", async (req, res) => {
  try {
    const doc = await Staff.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// READ list
router.get("/", async (_req, res) => {
  const docs = await Staff.find().sort({ updated_at: -1 });
  res.json(docs);
});

// READ by staff_code
router.get("/:staff_code", async (req, res) => {
  const doc = await Staff.findOne({ staff_code: req.params.staff_code });
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

// UPDATE by staff_code
router.put("/:staff_code", async (req, res) => {
  try {
    const doc = await Staff.findOneAndUpdate(
      { staff_code: req.params.staff_code },
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
router.delete("/:staff_code", async (req, res) => {
  const doc = await Staff.findOneAndUpdate(
    { staff_code: req.params.staff_code },
    { status: "inactive" },
    { new: true }
  );
  if (!doc) return res.status(404).json({ message: "not found" });
  res.json(doc);
});

module.exports = router;
