const router = require("express").Router();
const ProductStock = require("../models/ProductStock");
const response = require("../helpers/response.helper");
const Warehouses = require("../models/Warehouses");
const Lots = require("../models/Lots");

const multer = require("multer");
const upload = multer({ dest: "/tmp/" });
const fs = require("fs");  
const csv = require("csv-parser");

// router.get("/search/lot", async (req, res) => {
//   try {
//     const { keyword } = req.query;

//     let match = {
//       // ตัด lot ว่าง / null ออก
//       lots_no: {
//         $ne: null,
//         $ne: ""
//       }
//     };

//     if (keyword && keyword.trim() !== "") {
//       match.lots_no = {
//         $regex: keyword,
//         $options: "i"
//       };
//     }

//     const result = await ProductStock.aggregate([
//       { $match: match },

//       // กันกรณีเป็นช่องว่างล้วน เช่น "   "
//       {
//         $match: {
//           $expr: {
//             $gt: [{ $strLenCP: { $trim: { input: "$lots_no" } } }, 0]
//           }
//         }
//       },

//       // group เอา lot ไม่ซ้ำ
//       {
//         $group: {
//           _id: "$lots_no"
//         }
//       },

//       { $sort: { _id: 1 } },

//       {
//         $project: {
//           _id: 0,
//           lots_no: "$_id"
//         }
//       }
//     ]);

//     return response.success(res, result, "Get lots_no success.");
//   } catch (error) {
//     console.error(error);
//     return response.badRequest(res, "Get lots_no fail.");
//   }
// });

router.get("/search/lot", async (req, res) => {
  try {
    const { keyword } = req.query;

    let match = {
      // ตัด lot ว่าง / null ออก
      lots_no: {
        $ne: null,
        $ne: ""
      }
    };

    if (keyword && keyword.trim() !== "") {
      match.lots_no = {
        $regex: keyword,
        $options: "i"
      };
    }

    const result = await Lots.aggregate([
      { $match: match },

      // กันกรณีเป็นช่องว่างล้วน เช่น "   "
      {
        $match: {
          $expr: {
            $gt: [{ $strLenCP: { $trim: { input: "$lots_no" } } }, 0]
          }
        }
      },

      // group เอา lot ไม่ซ้ำ
      {
        $group: {
          _id: "$lots_no"
        }
      },

      { $sort: { _id: 1 } },

      {
        $project: {
          _id: 0,
          lots_no: "$_id"
        }
      }
    ]);

    return response.success(res, result, "Get lots_no success.");
  } catch (error) {
    console.error(error);
    return response.badRequest(res, "Get lots_no fail.");
  }
});

router.get("/search/warehouse", async (req, res) => {
  try {
    const { keyword } = req.query;

    let match = {
      // บังคับ warehouses_name ต้องไม่ว่าง
      warehouses_name: { $ne: null, $ne: "" }
    };

    if (keyword && keyword.trim() !== "") {
      match.warehouses_name = {
        $regex: keyword,
        $options: "i"
      };
    }

    const result = await Warehouses.aggregate([
      { $match: match },

      // กันกรณี warehouses_name เป็นช่องว่างล้วน "   "
      {
        $match: {
          $expr: {
            $gt: [
              { $strLenCP: { $trim: { input: "$warehouses_name" } } },
              0
            ]
          }
        }
      },

      // group ตาม warehouse + zone (รองรับชื่อซ้ำหลาย zone)
      {
        $group: {
          _id: {
            warehouses_name: "$warehouses_name",
            warehouses_zone: "$warehouses_zone"
          }
        }
      },

      { $sort: { "_id.warehouses_name": 1, "_id.warehouses_zone": 1 } },

      {
        $project: {
          _id: 0,
          warehouses_name: "$_id.warehouses_name",
          warehouses_zone: "$_id.warehouses_zone"
        }
      }
    ]);

    return response.success(res, result, "Get warehouses success.");
  } catch (error) {
    console.error(error);
    return response.badRequest(res, "Get warehouses fail.");
  }
});

// router.get("/search/warehouse", async (req, res) => {
//   try {
//     const { keyword } = req.query;

//     let match = {
//       // บังคับ warehouses_name ต้องไม่ว่าง
//       warehouses_name: { $ne: null, $ne: "" }
//     };

//     if (keyword && keyword.trim() !== "") {
//       match.warehouses_name = {
//         $regex: keyword,
//         $options: "i"
//       };
//     }

//     const result = await ProductStock.aggregate([
//       { $match: match },

//       // กันกรณี warehouses_name เป็นช่องว่างล้วน "   "
//       {
//         $match: {
//           $expr: {
//             $gt: [
//               { $strLenCP: { $trim: { input: "$warehouses_name" } } },
//               0
//             ]
//           }
//         }
//       },

//       // group ตาม warehouse + zone (รองรับชื่อซ้ำหลาย zone)
//       {
//         $group: {
//           _id: {
//             warehouses_name: "$warehouses_name",
//             warehouses_zone: "$warehouses_zone"
//           }
//         }
//       },

//       { $sort: { "_id.warehouses_name": 1, "_id.warehouses_zone": 1 } },

//       {
//         $project: {
//           _id: 0,
//           warehouses_name: "$_id.warehouses_name",
//           warehouses_zone: "$_id.warehouses_zone"
//         }
//       }
//     ]);

//     return response.success(res, result, "Get warehouses success.");
//   } catch (error) {
//     console.error(error);
//     return response.badRequest(res, "Get warehouses fail.");
//   }
// });

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
          barcode : row.barcode,
          sku_code :row.sku_code,
          lots_no :row.lots_no,
          warehouses_name :row.warehouses_name,
          warehouses_zone :row.warehouses_zone,
         bin : row.bin,
          stock_type :row.stock_type,
          receive_qty :Number(row.receive_qty),
          balance_qty :Number(row.balance_qty),
          selling_qty :Number(row.selling_qty),
          mfg :row.mfg,
          exp :row.exp,
          status :row.status,
          created_by :row.created_by,
          updated_by :row.updated_by,
        });
      })
      .on("end", async () => {
        // insert แบบข้ามตัวซ้ำ
        await ProductStock.insertMany(results);

        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }

        return response.success(res, results, "Import product stock success.");
      });

  } catch (error) {
    console.error(error);
    return response.badRequest(res, "Import product stock fail.");
  }
});

module.exports = router;

