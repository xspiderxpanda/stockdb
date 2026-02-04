const router = require("express").Router();
const Supplier = require("../models/Supplier");
const response = require("../helpers/response.helper");

const multer = require("multer");
const upload = multer({ dest: "/tmp/" });
const fs = require("fs");  
const csv = require("csv-parser");

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
router.get("/", async (req, res) => {
  try {
    const { keyword } = req.query;

    let filter = {};

    if (keyword && keyword.trim() !== "") {
      filter = {
        supplier_name: { $regex: keyword, $options: "i" }
      };
    }

    const docs = await Supplier
      .find(filter)
      .sort({ updated_at: -1 });

    const result = docs.map(d => ({
      supplier_code: d.supplier_code,
      supplier_name: d.supplier_name,
      status: d.status
    }));

    return response.success(res, result, "Get supplier success.");
  } catch (error) {
    return response.badRequest(res, "Get supplier fail.");
  }
});
// router.get("/", async (_req, res) => {
//   const docs = await Supplier.find().sort({ updated_at: -1 });
//   res.json(docs);
// });

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
          supplier_code: Number(row.supplier_code),
          supplier_name: row.supplier_name,
          created_by: row.created_by,
          updated_by: row.updated_by,
        });
      })
      .on("end", async () => {
        // insert แบบข้ามตัวซ้ำ
        await Supplier.insertMany(results, { ordered: false });

        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return response.success(res, results, "Import supplier success.");
      });

  } catch (error) {
    console.error(error);
    return response.badRequest(res, "Import supplier fail.");
  }
});

module.exports = router;
