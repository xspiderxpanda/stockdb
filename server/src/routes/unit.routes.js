const router = require("express").Router();
const Unit = require("../models/Unit");
const response = require("../helpers/response.helper");

const multer = require("multer");
const upload = multer({ dest: "/tmp/" });
const fs = require("fs");  
const csv = require("csv-parser");

// READ list
router.get("/", async (req, res) => {
  try {
    const { keyword } = req.query;

    let filter = {};

    if (keyword && keyword.trim() !== "") {
      filter = {
        name: { $regex: keyword, $options: "i" }
      };
    }

    const docs = await Unit
      .find(filter);

    const result = docs.map(d => ({
      unit_code: d.unit_code,
      name: d.name,
      status: d.status
    }));

    return response.success(res, result, "Get unit success.");
  } catch (error) {
    return response.badRequest(res, "Get unit fail.");
  }
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
          unit_code: Number(row.unit_code),
          name: row.name,
        });
      })
      .on("end", async () => {
        // insert แบบข้ามตัวซ้ำ
        await Unit.insertMany(results, { ordered: false });

        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return response.success(res, results, "Import unit success.");
      });

  } catch (error) {
    console.error(error);
    return response.badRequest(res, "Import unit fail.");
  }
});

module.exports = router;