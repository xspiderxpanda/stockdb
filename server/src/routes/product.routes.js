const express = require("express");
const Product = require("../models/Product");
const Sku = require("../models/Sku");

const router = express.Router();

/**
 * POST /api/products
 * เพิ่มสินค้าแบบทีละรายการ
 */
router.post("/", async (req, res) => {
  try {
    const { product, skus } = req.body;

    if (!product?.sku || !product?.product_name) {
      return res.status(400).json({
        message: "SKU and Product Name are required",
      });
    }

    await Product.updateOne(
      { sku: product.sku },
      { $set: product },
      { upsert: true }
    );

    if (Array.isArray(skus) && skus.length > 0) {
      const ops = skus
        .map((s) => {
          if (!s?.sku) return null;

          return {
            updateOne: {
              filter: { sku: String(s.sku).trim() },
              update: {
                $set: {
                  sku: String(s.sku).trim(),
                  barcode: s.barcode ?? product.sku,
                  unit: s.unit ?? "",
                  factor: Number(s.factor) || 1,
                  price: Number(s.price) || 0,
                  stock_qty: Number(s.stock_qty) || 0,
                  warehouse: s.warehouse ?? "",
                },
              },
              upsert: true,
            },
          };
        })
        .filter(Boolean);

      await Sku.bulkWrite(ops, { ordered: false });
    }

    res.json({ message: "ok" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/products/search
 * ค้นหาจาก Product ID / Product Name / SKU
 */
router.get("/search", async (req, res) => {
  try {
    const keyword = (req.query.keyword || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(parseInt(req.query.limit || "10", 10), 50);
    const skip = (page - 1) * limit;

    let matchStage = {};

    if (keyword) {
      matchStage = {
        $or: [
          { sku: { $regex: keyword, $options: "i" } },
          { product_name: { $regex: keyword, $options: "i" } },
          { "skus.sku": { $regex: keyword, $options: "i" } },
        ],
      };
    }

    const basePipeline = [
      {
        $lookup: {
          from: "sku_master",
          localField: "sku",
          foreignField: "sku",
          as: "skus",
        },
      },
      ...(keyword ? [{ $match: matchStage }] : []),
    ];

    // count total
    const totalAgg = await Product.aggregate([
      ...basePipeline,
      { $count: "count" },
    ]);
    const total = totalAgg[0]?.count || 0;

    // fetch data
    const items = await Product.aggregate([
      ...basePipeline,
      { $sort: { updatedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          sku: 1,
          product_name: 1,
          skus: {
            $map: {
              input: "$skus",
              as: "s",
              in: {
                sku: "$$s.sku",
                unit: "$$s.unit",
                price: "$$s.price",
                stock_qty: "$$s.stock_qty",
              },
            },
          },
        },
      },
    ]);

    res.json({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      items,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
