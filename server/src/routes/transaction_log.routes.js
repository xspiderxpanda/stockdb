const router = require("express").Router();
const TransactionLog = require("../models/TransactionLog");

// GET /api/transaction_logs?page=1&limit=20&function_name=SEARCH_PRODUCT&request_id=...
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);
    const skip = (page - 1) * limit;

    const function_name = String(req.query.function_name || "").trim();
    const request_id = String(req.query.request_id || "").trim();
    const status_code = String(req.query.status_code || "").trim();

    const filter = {};
    if (function_name) filter.function_name = function_name;
    if (request_id) filter.request_id = request_id;
    if (status_code) filter.status_code = Number(status_code);

    const [total, items] = await Promise.all([
      TransactionLog.countDocuments(filter),
      TransactionLog.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const totalPages = Math.max(Math.ceil(total / limit), 1);

    res.json({ items, page, totalPages, total });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
