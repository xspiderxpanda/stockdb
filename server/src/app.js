const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });


const express = require("express");
const morgan = require("morgan");
const connectDB = require("./config/db");
const swaggerUi = require("swagger-ui-express");
const swaggerSpecV1 = require("./swagger");     // v1
const swaggerSpecV2 = require("./swaggerv2");   // v2
const swaggerSpecV3 = require("./swaggermobile");   // v2


const app = express();
const PORT = process.env.PORT || 3000;
const cors = require('cors') 

// Performance optimizations
app.disable('x-powered-by');
app.set('trust proxy', 1);



app.get("/health", (_, res) => res.status(200).send("OK"));
app.use(express.json());
app.use(morgan("dev"));
app.use(cors())


// routes
app.use("/api/categories", require("./routes/category.routes"));
app.use("/api/suppliers", require("./routes/supplier.routes"));
app.use("/api/brands", require("./routes/brand.routes"));
app.use("/api/staff", require("./routes/staff.routes"));
app.use("/api/products", require("./routes/product.routes"));
app.use("/api/product_del", require("./routes/product_del.routes"));
app.use("/api/search_product_service", require("./routes/search_product_service.routes"));
app.use("/api/insert_product_service", require("./routes/insert_product_service.routes"));
app.use("/api/stocks", require("./routes/stock.routes"));
app.use("/api/test", require("./routes/test.routes"));
app.use("/api/sku-units", require("./routes/sku_unit.routes"));
app.use("/api/unit", require("./routes/unit.routes"));
app.use("/api/v2/products", require("./routes/product_v2.routes"));
app.use("/api/product-stocks", require("./routes/product_stocks.routes"));
app.use("/api/transaction_logs", require("./routes/transaction_log.routes"));
app.use("/api/transaction-logs", require("./routes/transaction_log.routes"));
app.get("/health", (_, res) => res.status(200).send("OK"));


// routes mobile
app.use("/api/mobile/products", require("./routes/product_v2.routes"));
app.use("/api/mobile/staff", require("./routes/staff.routes"));
app.use("/api/mobile/categories", require("./routes/category.routes"));
app.use("/api/mobile/unit", require("./routes/unit.routes"));
app.use("/api/mobile/transaction_log", require("./routes/transaction_log.routes"));
app.use("/api/mobile/brands", require("./routes/brand.routes"));
app.use("/api/mobile/suppliers", require("./routes/supplier.routes"));
app.use("/api/mobile/product-stocks", require("./routes/product_stocks.routes"));
app.use("/api/mobile/product_del", require("./routes/product_del.routes"));


// API DOCS 2 Version
app.get("/api-docs", (req, res) => res.redirect("/api-docs/v1"));
// v1 docs
app.use(
  "/api-docs/v1",
  swaggerUi.serveFiles(swaggerSpecV1),
  swaggerUi.setup(swaggerSpecV1)
);
// v2 docs
app.use(
  "/api-docs/v2",
  swaggerUi.serveFiles(swaggerSpecV2),
  swaggerUi.setup(swaggerSpecV2)
);
// V.mobile
app.use(
  "/api-docs/mobile",
  swaggerUi.serveFiles(swaggerSpecV3),
  swaggerUi.setup(swaggerSpecV3)
);


connectDB()
  .then(() => {
    app.listen(process.env.PORT || 3000, () =>
      console.log(`✅ API running at http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ Failed to start:", err);
    process.exit(1);
  });
