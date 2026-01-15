const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });


const express = require("express");
const morgan = require("morgan");
const connectDB = require("./config/db");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());
app.use(morgan("dev"));


// routes
app.use("/api/categories", require("./routes/category.routes"));
app.use("/api/suppliers", require("./routes/supplier.routes"));
app.use("/api/brands", require("./routes/brand.routes"));
app.use("/api/staff", require("./routes/staff.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/stocks", require("./routes/stock.routes"));
app.use("/api/test", require("./routes/test.routes"));
app.use("/api/sku-units", require("./routes/sku_unit.routes"));
app.use("/api/search_product_service", require("./routes/search_product_service.routes"));
app.use("/api/insert_product_service", require("./routes/insert_product_service.routes"));
// http://localhost:3000/api/search_product_service

app.get("/", (_, res) => res.json({ ok: true }));

connectDB()
  .then(() => {
   app.listen(PORT, () => 
    console.log(`✅ API running at http://localhost:${PORT}`)
  );

  })
  .catch((err) => {
    console.error("❌ Failed to start:", e);
    console.error(err);
    process.exit(1);
  });
