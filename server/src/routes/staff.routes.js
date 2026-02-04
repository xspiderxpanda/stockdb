const router = require("express").Router();
const Staff = require("../models/Staff");
const response = require("../helpers/response.helper");
const LogHelper = require("../helpers/log.helper");

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
// router.get("/", async (_req, res) => {
//   const docs = await Staff.find().sort({ updated_at: -1 });
//   res.json(docs);
// });
router.get("/", async (req, res) => {
  try {
    const { keyword } = req.query;

   let filter = { status: true };

    if (keyword && keyword.trim() !== "") {
      filter.$or = [
        { staff_firstname: { $regex: keyword, $options: "i" } },
        { staff_lastname: { $regex: keyword, $options: "i" } }
      ];
    }

    const docs = await Staff
      .find(filter)
      .sort({ updated_at: -1 });

    const result = docs.map(d => ({
      staff_code: Number(d.staff_code),
      staff_firstname: d.staff_firstname,
      staff_lastname: d.staff_lastname,
      status: d.status
    }));

    return response.success(res, result, "Get staff success.");
  } catch (error) {
    return response.badRequest(res, "Get staff fail.");
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

router.get("/detail", async (req, res) => {
  const { staff_code } = req.query;

  // --- init logger ---
  const logger = new LogHelper({
    function_endpoint: "staff/detail",
    function_controller: "Staff",
    function_name: "GetStaffDetail",
    function_method: "GET",
    query_collection: "staff",
    query_type: "query",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: req.user?.username || "system"
  });

  try {
    /* ---------------------------
     * validate
     * --------------------------- */
    if (!staff_code || String(staff_code).trim() === "") {
      logger.fail(400, "staff_code is required");
      await logger.save();

      return response.badRequest(res, "staff_code is required");
    }

    /* ---------------------------
     * query staff
     * --------------------------- */
    const staff = await Staff.findOne(
      { staff_code: Number(staff_code) },
      {
        _id: 0,
        staff_code: 1,
        staff_firstname: 1,
        staff_lastname: 1,
        phone_no: 1,
        email: 1,
        address: 1,
        status: 1,
        created_at: 1,
        updated_at: 1
      }
    ).lean();

    if (!staff) {
      logger.setCount(0);
      logger.fail(404, "staff not found");
      await logger.save();

      return response.badRequest(res, "Staff not found");
    }

    /* ---------------------------
     * success log
     * --------------------------- */
    logger.setCount(1);
    logger.success(200, "success");
    await logger.save();

    staff.phone_no = String(staff.phone_no)
    return response.success(
      res,
      staff,
      "Get staff detail success."
    );

  } catch (error) {
    console.error("GET STAFF DETAIL ERROR:", error);

    logger.fail(500, "server error");
    await logger.save();

    return response.serverError(res, "Get staff detail fail.");
  }
});

router.put("/update", async (req, res) => {
  const {
    staff_code,
    staff_firstname,
    staff_lastname,
    phone_no,
    email,
    address
  } = req.body;

  // --- init logger ---
  const logger = new LogHelper({
    function_endpoint: "staff/update",
    function_controller: "Staff",
    function_name: "UpdateStaff",
    function_method: "PUT",
    query_collection: "staff",
    query_type: "update",
    user_id: req.user?.id || "",
    role: req.user?.role || "",
    created_by: req.user?.username || "system"
  });

  try {
    /* ---------------------------
     * validate
     * --------------------------- */
    if (!staff_code || isNaN(Number(staff_code))) {
      logger.fail(400, "staff_code invalid");
      await logger.save();

      return response.badRequest(res, "staff_code is required and must be number");
    }

    /* ---------------------------
     * check existing staff
     * --------------------------- */
    const staff = await Staff.findOne({
      staff_code: Number(staff_code)
    });

    if (!staff) {
      logger.setCount(0);
      logger.fail(404, "staff not found");
      await logger.save();

      return response.badRequest(res, "Staff not found");
    }

    /* ---------------------------
     * prepare update data
     * --------------------------- */
    const updateData = {};

    if (staff_firstname !== undefined) updateData.staff_firstname = staff_firstname;
    if (staff_lastname !== undefined) updateData.staff_lastname = staff_lastname;
    if (phone_no !== undefined) updateData.phone_no = phone_no;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;

    updateData.updated_by = req.user?.username || "system";
    updateData.updated_at = new Date();

    /* ---------------------------
     * update
     * --------------------------- */
    await Staff.updateOne(
      { staff_code: Number(staff_code) },
      { $set: updateData }
    );

    /* ---------------------------
     * success log
     * --------------------------- */
    logger.setCount(1);
    logger.success(200, "success");
    await logger.save();

    return response.success(
      res,
      updateData,
      "Update staff success."
    );

  } catch (error) {
    console.error("UPDATE STAFF ERROR:", error);

    logger.fail(500, "server error");
    await logger.save();

    return response.serverError(res, "Update staff fail.");
  }
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

module.exports = router;
