const router = require("express").Router();
const Brand = require("../models/Brand");
const response = require("../helpers/response.helper");
const multer = require("multer");
const upload = multer({ dest: "/tmp/" });
const fs = require("fs");  
const csv = require("csv-parser");

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
router.get("/", async (req, res) => {
  try {
    const { keyword } = req.query;

    let filter = {};

    if (keyword && keyword.trim() !== "") {
      filter = {
        brand_name: { $regex: keyword, $options: "i" }
      };
    }

    const docs = await Brand
      .find(filter)
      .sort({ updated_at: -1 });

    const result = docs.map(d => ({
      brand_code: d.brand_code,
      brand_name: d.brand_name,
      status: d.status
    }));

    return response.success(res, result, "Get brand success.");
  } catch (error) {
    return response.badRequest(res, "Get brand fail.");
  }
});
// router.get("/", async (_req, res) => {
//   const docs = await Brand.find().sort({ updated_at: -1 });
//   res.json(docs);
// });

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

router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return response.badRequest(res, "CSV file is required");
    }

    const results = [];

    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on("data", (row) => {
        results.push({
          brand_code: Number(row.brand_code),
          brand_name: row.brand_name,
          created_by: row.created_by,
          updated_by: row.updated_by,
        });
      })
      .on("end", async () => {
        // insert แบบข้ามตัวซ้ำ
        await Brand.insertMany(results, { ordered: false });

        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return response.success(res, results, "Import brand success.");
      });

  } catch (error) {
    console.error(error);
    return response.badRequest(res, "Import brand fail.");
  }
});

module.exports = router;
