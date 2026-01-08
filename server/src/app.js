require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./db");

const productRoutes = require("./routes/product.routes");
const importRoutes = require("./routes/import.routes");

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/api/search_product_service", productRoutes);
app.use("/api/insert_product_service", importRoutes);

const PORT = process.env.PORT || 3000;

async function main() {
  await connectDB(process.env.MONGODB_URI);
  app.listen(PORT, () => console.log(`✅ API running at http://localhost:${PORT}`));
}

main().catch((e) => {
  console.error("❌ Failed to start:", e);
  process.exit(1);
});
