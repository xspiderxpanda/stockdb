const router = require("express").Router();
const Product = require("../models/Product")
const Category = require("../models/Category");
const Brand = require("../models/Brand");
const Supplier = require("../models/Supplier");
const Unit = require("../models/Unit");
const ProductStock = require("../models/ProductStock")
const response = require("../helpers/response.helper");
const LogHelper = require("../helpers/log.helper");
const Warehouses = require("../models/Warehouses");
const Lots = require("../models/Lots");

const multer = require("multer");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB
  }
});
const XLSX = require("xlsx");

router.get("/", async (req, res) => {

  const logger = new LogHelper({
    function_endpoint: "v2/products?",
    function_controller: "product_v2",
    function_name: "GetProduct",
    function_method: "GET",
    query_collection: "product_master",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: "admin"
  });

  try {
    const {
      keyword,
      sku_code,
      category_code,
    } = req.query;

    let page  = parseInt(req.query.page)  || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (page <= 0 || limit <= 0) {
      return response.badRequest(res, "page or limit invalid");
    }

    // if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    /* ---------------------------
     * product_masters filter
     * --------------------------- */
    let productMatch = {};

    if (keyword && keyword.trim() !== "") {
      productMatch.$or = [
        { barcode: { $regex: keyword, $options: "i" } },
        { product_name: { $regex: keyword, $options: "i" } }
      ];
    }

    if (sku_code) {
      productMatch.sku_code = sku_code;
    }

    if (category_code) {
      productMatch.category_code = Number(category_code);
    }

    /* ---------------------------
     * base pipeline
     * --------------------------- */
    const basePipeline = [
      { $match: productMatch },

      /* ---------------------------
       * facet: count + data
       * --------------------------- */
      {
        $facet: {
          metadata: [{ $count: "total_data" }],
          data: [
            { $sort: { updated_at: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,

                barcode: 1,
                sku_code: 1,
                product_name: 1,
                product_description: 1,

                category_code: 1,
                category_name_th: "" ,
                category_name_en: "" ,

                brand_code: 1,
                brand_name: "" ,

                supplier_code: 1,
                supplier_name: "" ,

                unit: {
                  $cond: {
                    if: { $eq: [{ $type: "$unit" }, "string"] },
                    then: "",  // หากไม่ใช่ตัวเลขให้เป็นค่าว่าง
                    else: "$unit"  // ถ้าเป็นตัวเลขให้เก็บค่าเดิม
                  }
                },
                unit_name: "" ,

                balance_qty: 1,
                receive_qty: "" ,
                selling_qty: "" ,

                bin: "" ,
                lot_no: "" ,
                stock_type: "" ,
                mfg: "" ,
                exp: "" ,

                warehouse_name: "" ,
                warehouse_zone: "" ,

                cost_price: 1,
                status: 1,

                created_at: 1,
                created_by: 1,
                updated_at: 1,
                updated_by: 1
              }
            }
          ]
        }
      }
    ];

    const result = await Product.aggregate(basePipeline);

    const totalData  = result[0].metadata[0]?.total_data || 0;
    const totalPages = Math.ceil(totalData / limit);

    // 1️⃣ สร้าง list จากข้อมูลที่ได้
    const category_code_list = result[0].data.map(r => r.category_code);
    const supplier_code_list = result[0].data.map(r => r.supplier_code);
    const brand_code_list = result[0].data.map(r => r.brand_code);
    const unit_code_list = result[0].data.map(r => r.unit);
    const barcode_list = result[0].data.map(r => r.barcode);

    /* ---------------------------
     * 2️⃣ Query data จาก table อื่นๆ ด้วย list
     * --------------------------- */
    const [categories, brands, suppliers, units] = await Promise.all([
      Category.find(
        { category_code: { $in: category_code_list }, status: true },
        { _id: 0, category_code: 1, category_name_th: 1, category_name_en: 1 }
      ).lean(),

      Brand.find(
        { brand_code: { $in: brand_code_list }, status: true },
        { _id: 0, brand_code: 1, brand_name: 1 }
      ).lean(),

      Supplier.find(
        { supplier_code: { $in: supplier_code_list }, status: true },
        { _id: 0, supplier_code: 1, supplier_name: 1 }
      ).lean(),

      Unit.find(
        { unit_code: { $in: unit_code_list }, status: true },
        { _id: 0, unit_code: 1, name: 1 }
      ).lean()
    ]);

    const ProductStocks = await ProductStock.find(
      { barcode: { $in: barcode_list } },  // ฟิลเตอร์ด้วย barcode_list
      { 
        _id: 0,  // ไม่ให้แสดง _id
        barcode: 1,
        lots_no: 1, 
        warehouses_name: 1, 
        warehouses_zone: 1, 
        bin: 1, 
        stock_type: 1, 
        receive_qty: 1, 
        selling_qty: 1, 
        balance_qty: 1, 
        mfg: 1, 
        exp: 1
      }
    ).lean(); 

    // 2️⃣ ค่อยสร้าง Map หลังจากได้ข้อมูลแล้ว
    const categoryMap = new Map(
      categories.map(c => [
        c.category_code,
        {
          category_name_th: c.category_name_th,
          category_name_en: c.category_name_en
        }
      ])
    );

    const brandMap = new Map(
      brands.map(b => [b.brand_code, b.brand_name])
    );

    const supplierMap = new Map(
      suppliers.map(s => [s.supplier_code, s.supplier_name])
    );

    const unitMap = new Map(
      units.map(u => [u.unit_code, u.name])
    );

    const data = result[0].data.map(p => ({
        ...p,

        unit_name: unitMap.get(p.unit) || "",

        category_name_th: categoryMap.get(p.category_code)?.category_name_th || "",
        category_name_en: categoryMap.get(p.category_code)?.category_name_en || "",
        brand_name: brandMap.get(p.brand_code) || "",
        supplier_name: supplierMap.get(p.supplier_code) || "",

        status: p.status, 
      }));        

      if (Array.isArray(ProductStocks)) {
        for (let i = 0; i < ProductStocks.length; i++) {
          for (let j = 0; j < data.length; j++) {
            if (ProductStocks[i].barcode == data[j].barcode) {
              data[j].warehouse_name = ProductStocks[i].warehouses_name;
              data[j].warehouse_zone = ProductStocks[i].warehouses_zone;
              data[j].lot_no = ProductStocks[i].lots_no;
              data[j].bin = ProductStocks[i].bin;
              data[j].receive_qty = ProductStocks[i].receive_qty;
              data[j].selling_qty = ProductStocks[i].selling_qty;
              data[j].stock_type = ProductStocks[i].stock_type;
              data[j].mfg = ProductStocks[i].mfg;
              data[j].exp = ProductStocks[i].exp;
              break;
            }
          }
        }
      }

    logger.setCount(data.length);
    logger.success(200, "success");
    await logger.save();

    return response.success(
      res,
      {
        total_data: totalData,
        total_pages: totalPages,
        data
      },
      "Get product success."
    );

  } catch (error) {
    logger.fail(400, "fail");
    await logger.save();

    console.error(error);
    return response.badRequest(res, "Get product fail.");
  }
});

router.get("/v1", async (req, res) => {

  const logger = new LogHelper({
    function_endpoint: "v2/products?",
    function_controller: "product_v2",
    function_name: "GetProduct",
    function_method: "GET",
    query_collection: "product_master",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: "admin"
  });

  try {
    const {
      keyword,
      sku_code,
      category_code,
    } = req.query;

    let page  = parseInt(req.query.page)  || 1;
    let limit = parseInt(req.query.limit) || 10;

    if (page <= 0 || limit <= 0) {
      return response.badRequest(res, "page or limit invalid");
    }

    if (limit > 100) limit = 100;

    const skip = (page - 1) * limit;

    /* ---------------------------
     * product_masters filter
     * --------------------------- */
    let productMatch = {};

    if (keyword && keyword.trim() !== "") {
      productMatch.$or = [
        { barcode: { $regex: keyword, $options: "i" } },
        { product_name: { $regex: keyword, $options: "i" } }
      ];
    }

    if (sku_code) {
      productMatch.sku_code = sku_code;
    }

    if (category_code) {
      productMatch.category_code = Number(category_code);
    }

    /* ---------------------------
     * base pipeline
     * --------------------------- */
    const basePipeline = [
      { $match: productMatch },

      /* ---------------------------
       * facet: count + data
       * --------------------------- */
      {
        $facet: {
          metadata: [{ $count: "total_data" }],
          data: [
            { $sort: { updated_at: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 0,

                barcode: 1,
                sku_code: 1,
                product_name: 1,
                product_description: 1,

                category_code: 1,
                category_name_th: { $ifNull: ["$category.category_name_th", ""] },
                category_name_en: { $ifNull: ["$category.category_name_en", ""] },

                brand_code: 1,
                brand_name: { $ifNull: ["$brand.brand_name", ""] },

                supplier_code: 1,
                supplier_name: { $ifNull: ["$supplier.supplier_name", ""] },

                unit: 1,
                unit_name: { $ifNull: ["$units.unit_name", ""] },

                balance_qty: { $ifNull: ["$stock.balance_qty", 0] },
                bin: { $ifNull: ["$stock.bin", ""] },
                lot_no: { $ifNull: ["$stock.lots_no", ""] },
                stock_type: { $ifNull: ["$stock.stock_type", ""] },
                mfg: "$stock.mfg",
                exp: "$stock.exp",

                warehouse_name: { $ifNull: ["$stock.warehouses_name", ""] },
                warehouse_zone: { $ifNull: ["$stock.warehouses_zone", ""] },

                cost_price: 1,
                status: 1,

                created_at: 1,
                created_by: 1,
                updated_at: 1,
                updated_by: 1
              }
            }
          ]
        }
      }
    ];

    const result = await Product.aggregate(basePipeline);

    const totalData  = result[0].metadata[0]?.total_data || 0;
    const totalPages = Math.ceil(totalData / limit);

    // 1️⃣ สร้าง list จากข้อมูลที่ได้
    const category_code_list = result[0].data.map(r => r.category_code);
    const supplier_code_list = result[0].data.map(r => r.supplier_code);
    const brand_code_list = result[0].data.map(r => r.brand_code);
    const unit_code_list = result[0].data.map(r => r.unit);

    /* ---------------------------
     * 2️⃣ Query data จาก table อื่นๆ ด้วย list
     * --------------------------- */
    const [categories, brands, suppliers, units] = await Promise.all([
      Category.find(
        { category_code: { $in: category_code_list }, status: true },
        { _id: 0, category_code: 1, category_name_th: 1, category_name_en: 1 }
      ).lean(),

      Brand.find(
        { brand_code: { $in: brand_code_list }, status: true },
        { _id: 0, brand_code: 1, brand_name: 1 }
      ).lean(),

      Supplier.find(
        { supplier_code: { $in: supplier_code_list }, status: true },
        { _id: 0, supplier_code: 1, supplier_name: 1 }
      ).lean(),

      Unit.find(
        { unit_code: { $in: unit_code_list }, status: true },
        { _id: 0, unit_code: 1, name: 1 }
      ).lean()
    ]);

    // 2️⃣ ค่อยสร้าง Map หลังจากได้ข้อมูลแล้ว
    const categoryMap = new Map(
      categories.map(c => [
        c.category_code,
        {
          category_name_th: c.category_name_th,
          category_name_en: c.category_name_en
        }
      ])
    );

    const brandMap = new Map(
      brands.map(b => [b.brand_code, b.brand_name])
    );

    const supplierMap = new Map(
      suppliers.map(s => [s.supplier_code, s.supplier_name])
    );

    const unitMap = new Map(
      units.map(u => [u.unit_code, u.name])
    );

    const data = result[0].data.map(p => ({
      ...p,

      unit_name: unitMap.get(p.unit) || "",

      category_name_th: categoryMap.get(p.category_code)?.category_name_th || "",
      category_name_en: categoryMap.get(p.category_code)?.category_name_en || "",
      brand_name: brandMap.get(p.brand_code) || "",
      supplier_name: supplierMap.get(p.supplier_code) || "",

      status: p.status 
    }));

    logger.setCount(data.length);
    logger.success(200, "success");
    await logger.save();

    return response.success(
      res,
      {
        total_data: totalData,
        total_pages: totalPages,
        data
      },
      "Get product success."
    );

  } catch (error) {
    logger.fail(400, "fail");
    await logger.save();

    console.error(error);
    return response.badRequest(res, "Get product fail.");
  }
});

router.get("/all-not-join", async (req, res) => {

  const logger = new LogHelper({
    function_endpoint: "v2/products/all-not-join?",
    function_controller: "product_v2",
    function_name: "GetAllNotJoinProduct",
    function_method: "GET",
    query_collection: "product_master",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: "admin"
  });

  try {

    let limit = parseInt(req.query.limit) || 0;

    let docs = [];
    if (limit > 0) {
      docs = await Product.find({})
        .sort({ updated_at: -1 }) 
        .limit(limit);  
    } else {
      docs = await Product.find().sort({ updated_at: -1 });
    }

    console.log("Limit : " + limit )

    const category = await Category.find({}, { category_code: 1, category_name_th: 1, category_name_en: 1 });
    const brand = await Brand.find({}, { brand_code: 1, brand_name: 1 });
    const supplier = await Supplier.find({}, { supplier_code: 1, supplier_name: 1 });
    const unit = await Unit.find({}, { unit_code: 1, name: 1 });

    logger.setCount(docs.length);
    logger.success(200, "success");
    await logger.save();

    return response.success(
      res,
      {
        total_data: docs.length,
        docs
      },
      "Get all product not join success."
    );

  } catch (error) {
    logger.fail(400, "fail");
    await logger.save();

    console.error(error);
    return response.badRequest(res, "Get all product not join fail.");
  }
});

router.get("/all-with-loop", async (req, res) => {

  const logger = new LogHelper({
    function_endpoint: "v2/products/all-with-loop?",
    function_controller: "product_v2",
    function_name: "GetAllWithLoopProduct",
    function_method: "GET",
    query_collection: "product_master",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: "admin"
  });

  try {

    let limit = parseInt(req.query.limit) || 0;

    let docs = [];
    if (limit > 0) {
      docs = await Product.find({})
        .sort({ updated_at: -1 })  
        .limit(limit);  
    } else {
      docs = await Product.find().sort({ updated_at: -1 });
    }

    console.log("Limit : " + limit )

    const category = await Category.find({}, { category_code: 1, category_name_th: 1, category_name_en: 1 });
    const brand = await Brand.find({}, { brand_code: 1, brand_name: 1 });
    const supplier = await Supplier.find({}, { supplier_code: 1, supplier_name: 1 });
    const unit = await Unit.find({}, { unit_code: 1, name: 1 });

    for (let i = 0; i < docs.length; i++) {

      const item = {
          barcode: docs[i].barcode,
          sku_code: docs[i].sku_code,
          product_name: docs[i].product_name,
          product_description: docs[i].product_description,

          category_code: docs[i].category_code,
          category_name_th: "" ,
          category_name_en: "" ,

          brand_code: docs[i].brand_code,
          brand_name: "" ,

          supplier_code: docs[i].supplier_code,
          supplier_name: "" ,

          unit: docs[i].unit,
          unit_name: "" ,

          balance_qty: docs[i].balance_qty,
          receive_qty: "" ,
          selling_qty: "" ,

          bin: "" ,
          lot_no: "" ,
          stock_type: "" ,
          mfg: "" ,
          exp: "" ,

          warehouse_name: "" ,
          warehouse_zone: "" ,

          cost_price: docs[i].cost_price,
          status: docs[i].status,

          created_at: docs[i].created_at,
          created_by: docs[i].created_by,
          updated_at: docs[i].updated_at,
          updated_by: docs[i].updated_by,
      }

      // เช็ค category
      for (let j = 0; j < category.length; j++) {
        if (item.category_code == category[j].category_code) {
          item.category_name_th = category[j].category_name_th;
          item.category_name_en = category[j].category_name_en;
          break;  // Stop after finding the first match
        }
      }

      // เช็ค brand
      for (let k = 0; k < brand.length; k++) {
          if (item.brand_code == brand[k].brand_code) {
            item.brand_name = brand[k].brand_name;
            break;  // Stop after finding the first match
          }
        }

      // เช็ค supplier
      for (let l = 0; l < supplier.length; l++) {
          if (item.supplier_code == supplier[l].supplier_code) {
            item.supplier_name = supplier[l].supplier_name;
            break;  // Stop after finding the first match
          }
      }

      // เช็ค unit
      for (let m = 0; m < unit.length; m++) {
        if (item.unit == unit[m].unit_code) {
          item.unit_name = unit[m].name;
          break;  // Stop after finding the first match
        }
      }
 
      docs[i] = item;
  }

    logger.setCount(docs.length);
    logger.success(200, "success");
    await logger.save();

    return response.success(
      res,
      {
        total_data: docs.length,
        docs
      },
      "Get all product with loop success."
    );

  } catch (error) {
    logger.fail(400, "fail");
    await logger.save();

    console.error(error);
    return response.badRequest(res, "Get all product with loop fail.");
  }
});

router.get("/export", async (req, res) => {

  const logger = new LogHelper({
    function_endpoint: "v2/products/export?",
    function_controller: "product_v2",
    function_name: "GetAllProduct",
    function_method: "GET",
    query_collection: "product_master",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: "admin"
  });

  try {
    const {
      keyword,
      sku_code,
      category_code,
    } = req.query;

    let limit = parseInt(req.query.limit) || 10000;

    if (limit > 30000) limit = 30000;

    /* ---------------------------
     * product_masters filter
     * --------------------------- */
    let productMatch = {};

    if (keyword && keyword.trim() !== "") {
      productMatch.$or = [
        { barcode: { $regex: keyword, $options: "i" } },
        { product_name: { $regex: keyword, $options: "i" } }
      ];
    }

    if (sku_code) {
      productMatch.sku_code = sku_code;
    }

    if (category_code) {
      productMatch.category_code = Number(category_code);
    }

    /* ---------------------------
     * base pipeline
     * --------------------------- */
    const basePipeline = [
      { $match: productMatch },

      /* ---------------------------
       * facet: count + data
       * --------------------------- */
      {
        $facet: {
          data: [
            { $sort: { updated_at: -1 } },
            { $limit: limit },
            {
              $project: {
                _id: 0,

                barcode: 1,
                sku_code: 1,
                product_name: 1,
                product_description: 1,

                category_code: 1,
                category_name_th: "" ,
                category_name_en: "" ,

                brand_code: 1,
                brand_name: "" ,

                supplier_code: 1,
                supplier_name: "" ,

                unit: {
                  $cond: {
                    if: { $eq: [{ $type: "$unit" }, "string"] },
                    then: "",  // หากไม่ใช่ตัวเลขให้เป็นค่าว่าง
                    else: "$unit"  // ถ้าเป็นตัวเลขให้เก็บค่าเดิม
                  }
                },
                unit_name: "" ,

                balance_qty: 1,
                receive_qty: "" ,
                selling_qty: "" ,

                bin: "" ,
                lot_no: "" ,
                stock_type: "" ,
                mfg: "" ,
                exp: "" ,

                warehouse_name: "" ,
                warehouse_zone: "" ,

                cost_price: 1,
                status: 1,

                created_at: 1,
                created_by: 1,
                updated_at: 1,
                updated_by: 1
              }
            }
          ]
        }
      }
    ];

    const result = await Product.aggregate(basePipeline);

    // 1️⃣ สร้าง list จากข้อมูลที่ได้
    const category_code_list = result[0].data.map(r => r.category_code);
    const supplier_code_list = result[0].data.map(r => r.supplier_code);
    const brand_code_list = result[0].data.map(r => r.brand_code);
    const unit_code_list = result[0].data.map(r => r.unit);
    const barcode_list = result[0].data.map(r => r.barcode);

    /* ---------------------------
     * 2️⃣ Query data จาก table อื่นๆ ด้วย list
     * --------------------------- */
    const [categories, brands, suppliers, units] = await Promise.all([
      Category.find(
        { category_code: { $in: category_code_list }, status: true },
        { _id: 0, category_code: 1, category_name_th: 1, category_name_en: 1 }
      ).lean(),

      Brand.find(
        { brand_code: { $in: brand_code_list }, status: true },
        { _id: 0, brand_code: 1, brand_name: 1 }
      ).lean(),

      Supplier.find(
        { supplier_code: { $in: supplier_code_list }, status: true },
        { _id: 0, supplier_code: 1, supplier_name: 1 }
      ).lean(),

      Unit.find(
        { unit_code: { $in: unit_code_list }, status: true },
        { _id: 0, unit_code: 1, name: 1 }
      ).lean()
    ]);

    const ProductStocks = await ProductStock.find(
      { barcode: { $in: barcode_list } },  // ฟิลเตอร์ด้วย barcode_list
      { 
        _id: 0,  // ไม่ให้แสดง _id
        barcode: 1,
        lots_no: 1, 
        warehouses_name: 1, 
        warehouses_zone: 1, 
        bin: 1, 
        stock_type: 1, 
        receive_qty: 1, 
        selling_qty: 1, 
        mfg: 1, 
        exp: 1
      }
    ).lean(); 

    // 2️⃣ ค่อยสร้าง Map หลังจากได้ข้อมูลแล้ว
    const categoryMap = new Map(
      categories.map(c => [
        c.category_code,
        {
          category_name_th: c.category_name_th,
          category_name_en: c.category_name_en
        }
      ])
    );

    const brandMap = new Map(
      brands.map(b => [b.brand_code, b.brand_name])
    );

    const supplierMap = new Map(
      suppliers.map(s => [s.supplier_code, s.supplier_name])
    );

    const unitMap = new Map(
      units.map(u => [u.unit_code, u.name])
    );

    const data = result[0].data.map(p => ({

        barcode: p.barcode,
        sku_code: p.sku_code,
        product_name: p.product_name,
        product_description: p.product_description,
        cost_price: p.cost_price,
        category_code: p.category_code,
        category_name_th: categoryMap.get(p.category_code)?.category_name_th || "",
        category_name_en: categoryMap.get(p.category_code)?.category_name_en || "",
        brand_code: p.brand_code,
        brand_name: brandMap.get(p.brand_code) || "",
        supplier_code: p.supplier_code,
        supplier_name: supplierMap.get(p.supplier_code) || "",
        unit: p.unit,
        unit_name: unitMap.get(p.unit) || "",
        warehouse_name: p.warehouse_name,
        warehouse_zone: p.warehouse_zone,
        lot_no: p.lots_no,
        bin: p.bin,
        stock_type: p.stock_type,
        balance_qty: p.balance_qty,
        receive_qty: p.receive_qty,
        selling_qty: p.selling_qty,
        mfg: p.mfg,
        exp: p.exp,
        status: p.status,
        created_at: p.created_at,
        created_by: p.created_by,
        updated_at: p.updated_at,
        updated_by: p.updated_by
    }));        

    if (Array.isArray(ProductStocks)) {
        for (let i = 0; i < ProductStocks.length; i++) {
          for (let j = 0; j < data.length; j++) {
            if (ProductStocks[i].barcode == data[j].barcode) {
              data[j].warehouse_name = ProductStocks[i].warehouses_name;
              data[j].warehouse_zone = ProductStocks[i].warehouses_zone;
              data[j].lot_no = ProductStocks[i].lots_no;
              data[j].bin = ProductStocks[i].bin;
              data[j].receive_qty = ProductStocks[i].receive_qty;
              data[j].selling_qty = ProductStocks[i].selling_qty;
              data[j].stock_type = ProductStocks[i].stock_type;
              data[j].mfg = ProductStocks[i].mfg;
              data[j].exp = ProductStocks[i].exp;
              break;
            }
          }
        }
    }

    // data = result[0].data.map(p => ({
    //     // เรียงลำดับคอลัมน์ตามต้องการ
    //     barcode: p.barcode,
    //     sku_code: p.sku_code,
    //     product_name: p.product_name,
    //     product_description: p.product_description,
    //     cost_price: p.cost_price,
    //     category_code: p.category_code,
    //     category_name_th: p.category_code,
    //     category_name_en: p.category_code,
    //     brand_code: p.brand_code,
    //     brand_name: p.brand_name,
    //     supplier_code: p.supplier_code,
    //     supplier_name: p.supplier_name,
    //     unit: p.unit,
    //     unit_name: p.unit_name,
    //     warehouse_name: p.warehouse_name,
    //     warehouse_zone: p.warehouse_zone,
    //     lot_no: p.lot_no,
    //     bin: p.bin,
    //     stock_type: p.stock_type,
    //     balance_qty: p.balance_qty,
    //     receive_qty: p.receive_qty,
    //     selling_qty: p.selling_qty,
    //     mfg: p.mfg,
    //     exp: p.exp,
    //     status: p.status,
    //     created_at: p.created_at,
    //     created_by: p.created_by,
    //     updated_at: p.updated_at,
    //     updated_by: p.updated_by
    //   }));


  // 3️⃣ สร้างไฟล์ Excel จากข้อมูล
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Products");

    // สร้างไฟล์ Excel เป็น buffer
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    // แปลงเป็น base64
    const base64File = buffer.toString("base64");

    // const exportName = `products_${new Date().toISOString()}.xlsx`;
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = (`0${date.getMonth() + 1}`).slice(-2); // เพิ่ม 1 เพราะเดือนใน JavaScript เริ่มต้นที่ 0
      const day = (`0${date.getDate()}`).slice(-2);
      const hours = (`0${date.getHours()}`).slice(-2);
      const minutes = (`0${date.getMinutes()}`).slice(-2);
      const seconds = (`0${date.getSeconds()}`).slice(-2);

      return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    };

    const exportName = `products_${formatDate(new Date())}.xlsx`;

    logger.setCount(data.length);
    logger.success(200, "success");
    await logger.save();

    // ส่งข้อมูล base64 กลับไป
    return response.success(
      res,
      {
          base64_file: base64File,
          export_name: exportName
      },
      "Export product success."
    );                    
  } catch (error) {
    logger.fail(400, "fail");
    await logger.save();

    console.error(error);
    return response.badRequest(res, "Export product fail.");
  }
});

router.get("/export-with-loop", async (req, res) => {

  const logger = new LogHelper({
    function_endpoint: "v2/products/export-with-loop",
    function_controller: "product_v2",
    function_name: "ExportWithLoopProduct",
    function_method: "GET",
    query_collection: "product_master",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: "admin"
  });

  try {

    const docs = await Product.find().sort({ updated_at: -1 });

    const category = await Category.find({}, { category_code: 1, category_name_th: 1, category_name_en: 1 });
    const brand = await Brand.find({}, { brand_code: 1, brand_name: 1 });
    const supplier = await Supplier.find({}, { supplier_code: 1, supplier_name: 1 });
    const unit = await Unit.find({}, { unit_code: 1, name: 1 });

    for (let i = 0; i < docs.length; i++) {

      const item = {
          barcode: docs[i].barcode,
          sku_code: docs[i].sku_code,
          product_name: docs[i].product_name,
          product_description: docs[i].product_description,

          category_code: docs[i].category_code,
          category_name_th: "" ,
          category_name_en: "" ,

          brand_code: docs[i].brand_code,
          brand_name: "" ,

          supplier_code: docs[i].supplier_code,
          supplier_name: "" ,

          unit: docs[i].unit,
          unit_name: "" ,

          balance_qty: docs[i].balance_qty,
          receive_qty: "" ,
          selling_qty: "" ,

          bin: "" ,
          lot_no: "" ,
          stock_type: "" ,
          mfg: "" ,
          exp: "" ,

          warehouse_name: "" ,
          warehouse_zone: "" ,

          cost_price: docs[i].cost_price,
          status: docs[i].status,

          created_at: docs[i].created_at,
          created_by: docs[i].created_by,
          updated_at: docs[i].updated_at,
          updated_by: docs[i].updated_by,
      }

      // เช็ค category
      for (let j = 0; j < category.length; j++) {
        if (item.category_code == category[j].category_code) {
          item.category_name_th = category[j].category_name_th;
          item.category_name_en = category[j].category_name_en;
          break;  // Stop after finding the first match
        }
      }

      // เช็ค brand
      for (let k = 0; k < brand.length; k++) {
          if (item.brand_code == brand[k].brand_code) {
            item.brand_name = brand[k].brand_name;
            break;  // Stop after finding the first match
          }
        }

      // เช็ค supplier
      for (let l = 0; l < supplier.length; l++) {
          if (item.supplier_code == supplier[l].supplier_code) {
            item.supplier_name = supplier[l].supplier_name;
            break;  // Stop after finding the first match
          }
      }

      // เช็ค unit
      for (let m = 0; m < unit.length; m++) {
        if (item.unit == unit[m].unit_code) {
          item.unit_name = unit[m].name;
          break;  // Stop after finding the first match
        }
      }
 
      docs[i] = item;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(docs);
  XLSX.utils.book_append_sheet(wb, ws, "Products");

  // สร้างไฟล์ Excel เป็น buffer
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

  // แปลงเป็น base64
  const base64File = buffer.toString("base64");

  const formatDate = (date) => {
    const year = date.getFullYear();
    const month = (`0${date.getMonth() + 1}`).slice(-2); // เพิ่ม 1 เพราะเดือนใน JavaScript เริ่มต้นที่ 0
    const day = (`0${date.getDate()}`).slice(-2);
    const hours = (`0${date.getHours()}`).slice(-2);
    const minutes = (`0${date.getMinutes()}`).slice(-2);
    const seconds = (`0${date.getSeconds()}`).slice(-2);

    return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
  };

  const exportName = `products_${formatDate(new Date())}.xlsx`;
  // const exportName = `products_${new Date().toISOString()}.xlsx`;

  logger.setCount(docs.length);
  logger.success(200, "success");
  await logger.save();

  // ส่งข้อมูล base64 กลับไป
  return response.success(
    res,
    {
      base64_file: base64File,
      export_name: exportName
    },
    "Export product success."
  );                   

  } catch (error) {
    logger.fail(400, "fail");
    await logger.save();

    console.error(error);
    return response.badRequest(res, "Export product fail.");
  }
});

router.post("/create", async (req, res) => {
  const logger = new LogHelper({
        function_endpoint: "v2/products/create",
        function_controller: "product_v2",
        function_name: "CreateProduct",
        function_method: "POST",
        query_collection: "product_master",
        query_type: "insert",
        user_id: req.user?.id || "",
        role: req.user?.role || "",
        created_by: "admin"
  });

  try {
    let payload = req.body;

    // รองรับ object / array
    if (!Array.isArray(payload)) {
      payload = [payload];
    }

    if (payload.length === 0) {
      return response.badRequest(res, "Payload must be array");
    }

    /* ---------------------------
     * 1) เตรียม barcode จาก payload
     * --------------------------- */
    const barcodes = payload
      .map(i => i.barcode)
      .filter(Boolean);

    /* ---------------------------
     * 1.2) เตรียม warehouses จาก payload
     * --------------------------- */
    const warehouses_key = payload
      .map(i => `${i.warehouse_name}_${i.warehouse_zone}_${i.bin}`)  // สร้าง warehouses_key จาก 3 ฟิลด์
      .filter(Boolean);  // กรองค่าที่เป็น null, undefined หรือ "" ออก

      /* ---------------------------
     * 1.3) เตรียม warehouses จาก payload
     * --------------------------- */
    const lots_no = payload
      .map(i => `${i.lot_no}`)  // สร้าง lots_no 
      .filter(Boolean);  // กรองค่าที่เป็น null, undefined หรือ "" ออก

    /* ---------------------------
     * 2) หา barcode ที่มีอยู่แล้ว
     * --------------------------- */
    const existing = await Product.find(
      { barcode: { $in: barcodes } },
      { barcode: 1, _id: 0 }
    ).lean();

    const existingSet = new Set(existing.map(e => e.barcode));

    /* ---------------------------
     * 2.2) หา stock ที่มีอยู่แล้ว
     * --------------------------- */
    const existingStock = await Warehouses.find(
      { warehouses_key: { $in: warehouses_key } },
      { warehouses_key: 1, _id: 0 }
    ).lean();

    const existingStockSet = new Set(existingStock.map(e => e.warehouses_key));

    /* ---------------------------
     * 2.2) หา lots_no ที่มีอยู่แล้ว
     * --------------------------- */
    const existingLotsNo = await Lots.find(
      { lots_no: { $in: lots_no } },
      { lots_no: 1, _id: 0 }
    ).lean();

    const existingLotsNoSet = new Set(existingLotsNo.map(e => e.lots_no));

    /* ---------------------------
     * 3) แยก valid / duplicate / invalid
     * --------------------------- */
    const products = [];
    const stocks = [];

    const duplicate = [];
    const invalid = [];
    const newStocks = [];
    const newLots = [];

    payload.forEach(item => {
      // ---- invalid ----
      if (!item.barcode || !item.product_name) {
        invalid.push({
          barcode: item.barcode || "",
          reason: "barcode or product_name missing"
        });
        return;
      }

      // ---- duplicate barcode ----
      if (existingSet.has(item.barcode)) {
        duplicate.push({
          barcode: item.barcode,
          reason: "duplicate barcode"
        });
        return; // ❗ ข้ามทั้ง product และ stock
      }

      // ---- valid stock ----
      if (!item.lot_no || !item.warehouse_name) {
        invalid.push({
          barcode: item.barcode,
          reason: "lot_no or warehouse_name missing"
        });
        return;
      }

      // ---- duplicate stock ----
      const warehouse_check = item.warehouse_name + "_" + item.warehouse_zone + "_" + item.bin
      if (!existingStockSet.has(warehouse_check) && !newStocks.find(row => row.warehouses_key === warehouse_check)) {
        newStocks.push({
          warehouses_name: item.barcode,
          warehouses_zone: item.warehouse_zone,
          bin: item.bin,
          warehouses_key: warehouse_check,
          status: true,
        });
      }

      // ---- duplicate lots_no ----
      if (!existingLotsNoSet.has(item.lot_no) && !newLots.find(row => row.lot_no  === item.lot_no)) {
        newLots.push({
          lots_no: item.lot_no,
          status: true,
        });
      }

      stocks.push({
        barcode: item.barcode,
        lots_no: item.lot_no,
        warehouses_name: item.warehouse_name,
        warehouses_zone: item.warehouse_zone,
        bin: item.bin,
        stock_type: item.stock_type,
        receive_qty: Number(item.receive_qty) || 0,
        selling_qty: 0,
        balance_qty: Number(item.receive_qty) || 0,
        mfg: item.mfg ? new Date(item.mfg) : null,
        exp: item.exp ? new Date(item.exp) : null,
        status: item.status,
        created_by: item.created_by,
        updated_by: item.created_by
      });

      // ---- valid product ----
      products.push({
        barcode: item.barcode,
        sku_code: item.sku_code,
        product_name: item.product_name,
        product_description: item.product_description,
        category_code: item.category_code,
        supplier_code: item.supplier_code,
        brand_code: item.brand_code,
        unit: Number(item.unit),
        cost_price: item.cost_price,
        status: item.status,
        created_by: item.created_by,
        updated_by: item.created_by
      });
    });

    /* ---------------------------
     * 4) insert (เฉพาะ barcode ใหม่)
     * --------------------------- */
    let productInserted = 0;
    let stockInserted = 0;

    if (products.length > 0) {
      const pResult = await Product.insertMany(products);
      productInserted = pResult.length;
    }

    if (stocks.length > 0) {
      const sResult = await ProductStock.insertMany(stocks);
      stockInserted = sResult.length;
    }

    if (newStocks.length > 0) {
      const nResult = await Warehouses.insertMany(newStocks);
    }

    if (newLots.length > 0) {
      const nResult = await Lots.insertMany(newLots);
    }

    /* ---------------------------
     * response
     * --------------------------- */
    if (productInserted == 0) {
       logger.fail(400, "fail");
       await logger.save();

       return response.badRequest(
        res,
        {
          product: {
            inserted: productInserted,
            duplicate,
            invalid
          }
        },
        "Create product fail."
      );
    } else {
      logger.setCount(payload.length);
      logger.success(200, "success");
      await logger.save();

      return response.success(
        res,
        {
          product: {
            inserted: productInserted,
            duplicate,
            invalid
          }
        },
        "Create product success."
      );
    }
    
  } catch (error) {
    logger.fail(400, "fail");
    await logger.save();

    console.error("CREATE PRODUCT ERROR:", error);
    return response.badRequest(res, error);
  }
});

router.post(
  "/import-excel",
  upload.single("file"),
  async (req, res) => {
     const logger = new LogHelper({
        function_endpoint: "v2/products/import-excel",
        function_controller: "product_v2",
        function_name: "ImportProduct",
        function_method: "POST",
        query_collection: "product_master",
        query_type: "insert",
        user_id: req.user?.id || "",
        role: req.user?.role || "",
        created_by: "admin"
      });

    try {
      if (!req.file || !req.file.buffer) {
        return response.badRequest(res, "File is required");
      }

      /* ---------------------------
       * 1) Read Excel from memory
       * --------------------------- */
      const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const payload = XLSX.utils.sheet_to_json(sheet, {
        defval: null,
        raw: false
      });

      if (!Array.isArray(payload) || payload.length === 0) {
        return response.badRequest(res, "Excel file empty");
      }

      /* ---------------------------
       * 2) Preload barcodes
       * --------------------------- */
      const existing = await Product.find(
        {},
        { barcode: 1, _id: 0 }
      ).lean();

      const barcodeSet = new Set(existing.map(p => p.barcode));

      /* ---------------------------
       * 2.2) Preload Stocks
       * --------------------------- */
      const existingStocks = await Warehouses.find(
        {},
        { warehouses_key: 1, _id: 0 }
      ).lean();

      const existingStockSet = new Set(existingStocks.map(e => e.warehouses_key));

      /* ---------------------------
       * 2.3) Preload Lots
       * --------------------------- */
      const existingLots = await Lots.find(
        {},
        { lots_no: 1, _id: 0 }
      ).lean();

      const existingLotsNoSet = new Set(existingLots.map(e => e.lots_no));

      /* ---------------------------
       * 3) Buffers & counters
       * --------------------------- */
      const productInsert = [];
      const productUpdate = [];
      const stockInsert = [];
      const warehousesInsert = [];
      const lotsInsert = [];

      const skipped = []; // เก็บแถวที่ข้าม + เหตุผล
      let importedCount = 0;

      /* ---------------------------
       * 4) Loop rows
       * --------------------------- */
      for (let i = 0; i < payload.length; i++) {

        const row = payload[i];
        const excelRow = i + 2; // header = แถว 1

        /* ---- rule: barcode ว่าง → skip ---- */
        if (!row.barcode || String(row.barcode).trim() === "") {
          skipped.push({
            row: excelRow,
            barcode: row.barcode || null,
            reason: "barcode is empty"
          });
          continue;
        }

        /* ---- rule: product_name ว่าง → skip ---- */
        if (!row.product_name || String(row.product_name).trim() === "") {
          skipped.push({
            row: excelRow,
            barcode: row.barcode,
            reason: "product_name is empty"
          });
          continue;
        }

        /* ---- rule: stock field จำเป็น → skip ---- */
        if (!row.lot_no || !row.warehouse_name) {
          skipped.push({
            row: excelRow,
            barcode: row.barcode,
            reason: "lot_no or warehouse_name missing"
          });
          continue;
        }

        const isExist = barcodeSet.has(row.barcode);

        // ---- duplicate stock ----
        const warehouse_check = row.warehouse_name + "_" + row.warehouse_zone + "_" + row.bin
        if (!existingStockSet.has(warehouse_check) && !warehousesInsert.find(item => item.warehouses_key === warehouse_check)) {
          warehousesInsert.push({
            warehouses_name: row.warehouse_name,
            warehouses_zone: row.warehouse_zone,
            bin: row.bin,
            warehouses_key: warehouse_check,
            status: true,
          });
        }

        // ---- duplicate lots_no ----
        if (!existingLotsNoSet.has(row.lot_no) && !lotsInsert.find(item => item.lot_no  === row.lot_no)) {
          lotsInsert.push({
            lots_no: row.lot_no,
            status: true,
          });
        }

        /* ---------- product ---------- */
        if (isExist) {
          productUpdate.push({
            updateOne: {
              filter: { barcode: row.barcode },
              update: {
                $set: {
                  sku_code: row.sku_code,
                  product_name: row.product_name,
                  product_description: row.product_description,
                  category_code: Number(row.category_code),
                  supplier_code: Number(row.supplier_code),
                  brand_code: Number(row.brand_code),
                  unit: row.unit,
                  cost_price: Number(row.cost_price),
                  status: row.status,
                  updated_by: row.created_by
                }
              }
            }
          });
        } else {
          productInsert.push({
            barcode: row.barcode,
            sku_code: row.sku_code,
            product_name: row.product_name,
            product_description: row.product_description,
            category_code: Number(row.category_code),
            supplier_code: Number(row.supplier_code),
            brand_code: Number(row.brand_code),
            unit: Number(row.unit),
            cost_price: Number(row.cost_price),
            status: row.status,
            created_by: row.created_by,
            updated_by: row.created_by
          });

        // กันซ้ำในไฟล์เดียวกัน
          barcodeSet.add(row.barcode);
        }

        /* ---------- stock ---------- */
        stockInsert.push({
          barcode: row.barcode,
          lots_no: row.lot_no,
          warehouses_name: row.warehouse_name,
          warehouses_zone: row.warehouse_zone,
          bin: row.bin,
          stock_type: row.stock_type,
          receive_qty: Number(row.receive_qty) || 0,
          selling_qty: 0,
          balance_qty: Number(row.receive_qty) || 0,
          mfg: row.mfg ? new Date(row.mfg) : null,
          exp: row.exp ? new Date(row.exp) : null,
          status: row.status,
          created_by: row.created_by,
          updated_by: row.created_by
        });

        importedCount++;

        /* ---------- batch 1000 ---------- */
        if (importedCount % 1000 === 0) {
          if (productInsert.length) {
            console.log("productInsert : " + productInsert.length);
            await Product.insertMany(productInsert);
            logger.setCount(productInsert.length);
            logger.success(201, "success");
            await logger.save();
            productInsert.length = 0;
          }
          if (productUpdate.length) {
            console.log("productUpdate : " + productUpdate.length);
            await Product.bulkWrite(productUpdate);
            logger.setCount(productUpdate.length);
            logger.success(201, "success");
            await logger.save();
            productUpdate.length = 0;
          }
          if (stockInsert.length) {
            console.log("stockInsert : " + stockInsert.length);
            await ProductStock.insertMany(stockInsert);
            logger.setCount(stockInsert.length);
            logger.success(201, "success");
            await logger.save();
            stockInsert.length = 0;
          }
        }
      }

      /* ---------------------------
       * 5) Flush remainder
       * --------------------------- */
      if (productInsert.length) {
        await Product.insertMany(productInsert);
        logger.setCount(productInsert.length);
        logger.success(201, "success");
      }
      if (productUpdate.length) {
        await Product.bulkWrite(productUpdate);
        logger.setCount(productUpdate.length);
        logger.success(201, "success");
      }
      if (stockInsert.length) {
        await ProductStock.insertMany(stockInsert);
        logger.setCount(stockInsert.length);
        logger.success(201, "success");
      }
      if (warehousesInsert.length) {
        await Warehouses.insertMany(warehousesInsert);
        logger.setCount(warehousesInsert.length);
        logger.success(201, "success");
      }
      if (lotsInsert.length) {
        await Lots.insertMany(lotsInsert);
        logger.setCount(lotsInsert.length);
        logger.success(201, "success");
      }

      logger.setCount(importedCount+skipped.length);
      logger.success(201, "success");

      await logger.save();

      /* ---------------------------
       * Response
       * --------------------------- */
      if (skipped.length > 0)
      {
        return res.status(400).json({
          status_code: 400,
          status_message: "bad request",
          message: "Import product fail.",
          result: {
            imported: importedCount,
            skipped, // แถวที่ข้าม + เหตุผล
            finalMassage: `เพิ่มข้อมูลสำเร็จ ${importedCount} ข้อมูล (ไม่สำเร็จ ${skipped.length} ข้อมูล)`
          }
        });
      } else {
        return res.status(201).json({
          status_code: 201,
          status_message: "created",
          message: "Import product success.",
          result: {
            imported: importedCount,
            skipped, // แถวที่ข้าม + เหตุผล
            finalMassage: `เพิ่มข้อมูลสำเร็จ ${importedCount} ข้อมูล (ไม่สำเร็จ ${skipped.length} ข้อมูล)`
          }
        });
      }

    } catch (error) {

      logger.fail(400, "fail");
      await logger.save();

      console.error("IMPORT EXCEL ERROR:", error);
      return response.badRequest(res, "Import product fail.");
    }
  }
);

router.get("/detail", async (req, res) => {
  const { barcode } = req.query;

  // --- init logger ---
  const logger = new LogHelper({
    function_endpoint: "product/detail",
    function_controller: "Product",
    function_name: "GetProductDetail",
    function_method: "GET",
    query_collection: "product_master",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: req.user?.username || "system"
  });

  try {
    if (!barcode || String(barcode).trim() === "") {
      logger.fail(400, "barcode is required");
      await logger.save();

      return response.badRequest(res, "barcode is required");
    }

    /* ---------------------------
     * aggregate pipeline
     * --------------------------- */
    const pipeline = [
      { $match: { barcode } },

      /* product_stock */
      {
        $lookup: {
          from: "product_stocks",
          localField: "barcode",
          foreignField: "barcode",
          as: "stocks"
        }
      },

      /* category */
      {
        $lookup: {
          from: "category_masters",
          localField: "category_code",
          foreignField: "category_code",
          as: "category"
        }
      },
      { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },

      /* brand */
      {
        $lookup: {
          from: "brand_masters",
          localField: "brand_code",
          foreignField: "brand_code",
          as: "brand"
        }
      },
      { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },

      /* supplier */
      {
        $lookup: {
          from: "supplier_masters",
          localField: "supplier_code",
          foreignField: "supplier_code",
          as: "supplier"
        }
      },
      { $unwind: { path: "$supplier", preserveNullAndEmptyArrays: true } },

      /* unit */
      {
        $lookup: {
          from: "unit",
          localField: "unit",
          foreignField: "unit_code",
          as: "units"
        }
      },
      { $unwind: { path: "$units", preserveNullAndEmptyArrays: true } },

      /* staff created_by */
      {
        $lookup: {
          from: "staffs",
          localField: "created_by",
          foreignField: "staff_code",
          as: "created_staff"
        }
      },
      { $unwind: { path: "$created_staff", preserveNullAndEmptyArrays: true } },

      /* staff updated_by */
      {
        $lookup: {
          from: "staffs",
          localField: "updated_by",
          foreignField: "staff_code",
          as: "updated_staff"
        }
      },
      { $unwind: { path: "$updated_staff", preserveNullAndEmptyArrays: true } },

      /* project */
      {
        $project: {
          _id: 0,

          barcode: 1,
          sku_code: 1,
          product_name: 1,
          product_description: 1,
          cost_price: 1,
          status: 1,

          category_code: "$category.category_code",
          category_name_th: "$category.category_name_th",
          category_name_en: "$category.category_name_en",

          brand_code: "$brand.brand_code",
          brand_name: "$brand.brand_name",
    
          supplier_code: "$supplier.supplier_code",
          supplier_name: "$supplier.supplier_name",
          
          unit_code: "$units.unit_code",
          unit_name: "$units.name",

          created_by: {
            staff_code: "$created_staff.staff_code",
            staff_firstname: "$created_staff.staff_firstname",
            staff_lastname: "$created_staff.staff_lastname"
          },

          updated_by: {
            staff_code: "$updated_staff.staff_code",
            staff_firstname: "$updated_staff.staff_firstname",
            staff_lastname: "$updated_staff.staff_lastname"
          },

          stocks: {
            $map: {
              input: "$stocks",
              as: "s",
              in: {
                lot_no: "$$s.lots_no",
                warehouse_name: "$$s.warehouses_name",
                warehouse_zone: "$$s.warehouses_zone",
                bin: "$$s.bin",
                stock_type: "$$s.stock_type",
                receive_qty: "$$s.receive_qty",
                selling_qty: "$$s.selling_qty",
                balance_qty: "$$s.balance_qty",
                mfg: "$$s.mfg",
                exp: "$$s.exp",
                status: "$$s.status"
              }
            }
          }
        }
      }
    ];

    const result = await Product.aggregate(pipeline);

    if (!result.length) {
      logger.setCount(0);
      logger.fail(404, "product not found");
      await logger.save();

      return response.badRequest(res, "Product not found");
    }

    /* ---------------------------
     * success log
     * --------------------------- */
    logger.setCount(1);
    logger.success(200, "success");
    await logger.save();

    return response.success(
      res,
      result[0],
      "Get product detail success."
    );

  } catch (error) {
    console.error("GET PRODUCT DETAIL ERROR:", error);

    logger.fail(500, "server error");
    await logger.save();

    return response.serverError(res, "Get product detail fail.");
  }
});

router.put("/update", async (req, res) => {
  const {
    barcode,
    sku_code,
    product_name,
    product_description,
    category_code,
    supplier_code,
    brand_code,
    unit,
    cost_price,
    lot_no,               // รับ lot_no จาก body
    warehouse_name,       // รับ warehouse_name จาก body
    warehouse_zone,       // รับ warehouse_zone จาก body
    bin,
    stock_type,
    receive_qty,
    mfg,
    exp,
    updated_by,
    status
  } = req.body;

  // --- init logger ---
  const logger = new LogHelper({
    function_endpoint: "product/update",
    function_controller: "Product",
    function_name: "UpdateProduct",
    function_method: "PUT",
    query_collection: "product_master",
    query_type: "update",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: req.user?.username || "system"
  });

  try {
    /* ---------------------------
     * 1) Validate barcode and check product exists
     * --------------------------- */
    if (!barcode || String(barcode).trim() === "") {
      logger.fail(400, "barcode is required");
      await logger.save();
      return response.badRequest(res, "barcode is required");
    }

    const product = await Product.findOne({ barcode });
    if (!product) {
      logger.setCount(0);
      logger.fail(404, "Product not found");
      await logger.save();
      return response.badRequest(res, "Product not found");
    }

    // /* ---------------------------
    //  * 2) Validate product_stock uniqueness
    //  * --------------------------- */
    // if (lot_no && warehouse_name && warehouse_zone && bin) {
    //   // Query all barcodes that match the given filter
    //   const existingStocks = await ProductStock.find({
    //     lots_no: lot_no,                // map lot_no to lots_no
    //     warehouses_name: warehouse_name, // map warehouse_name to warehouses_name
    //     warehouses_zone: warehouse_zone, // map warehouse_zone to warehouses_zone
    //     bin,
    //     barcode: { $ne: barcode }
    //   }).select("barcode"); // Select only barcode field

    //   if (existingStocks.length > 0) {
    //     for (let i = 0; i < existingStocks.length; i++) {
    //       // Debug: ตรวจสอบข้อมูลก่อนส่ง
    //       console.log("Logging data existingStocks:", existingStocks);
    //       console.log("Logging data existingStocks.barcode:", existingStocks[i].barcode);
    //       console.log("Logging data barcode:", barcode);

    //       if (String(existingStocks[i].barcode) != String(barcode)) {
            
    //         logger.fail(400, "Stock duplicate (warehouse / zone / lot / bin)");
    //         await logger.save();
            
    //         return response.badRequest(
    //           res,
    //           "Stock duplicate (warehouse / zone / lot / bin)"
    //         );
    //       }
    //     }
    //   }
    // }

    /* ---------------------------
     * 3) Prepare data to update product_master
     * --------------------------- */
    const productUpdate = {
      sku_code,
      product_name,
      product_description,
      category_code,
      supplier_code,
      brand_code,
      unit: unit,
      cost_price,
      status,
      updated_by,
      updated_at: new Date()
    };

    Object.keys(productUpdate).forEach(
      k => productUpdate[k] === undefined && delete productUpdate[k]
    );

    /* ---------------------------
     * 4) Update product_master
     * --------------------------- */
    await Product.updateOne(
      { barcode },
      { $set: productUpdate }
    );

    /* ---------------------------
     * 5) Prepare data to update product_stock
     * --------------------------- */
    const stockUpdate = {
      warehouses_name : warehouse_name,   // map to warehouses_name
      warehouses_zone : warehouse_zone,   // map to warehouses_zone
      lots_no: lot_no,   // map lot_no to lots_no
      bin,
      stock_type,
      receive_qty,
      mfg: mfg ? new Date(mfg) : null,
      exp: exp ? new Date(exp) : null,
      status,
      updated_by,
      updated_at: new Date()
    };

    Object.keys(stockUpdate).forEach(
      k => stockUpdate[k] === undefined && delete stockUpdate[k]
    );

    /* ---------------------------
     * 6) Update product_stock
     * --------------------------- */
    await ProductStock.updateOne(
      { barcode },
      { $set: stockUpdate }
    );

    /* ---------------------------
     * 7) Success Log
     * --------------------------- */
    logger.setCount(1);
    logger.success(200, "success");
    await logger.save();

    return response.success(res, req.body, "Update product success.");

  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);

    // --- Error Log ---
    logger.fail(500, "server error");
    await logger.save();

    return response.serverError(res, "Update product fail.");
  }
});

module.exports = router;
