require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  if (process.env.ALLOW_RESET !== "true") {
    console.error("❌ Refused: set ALLOW_RESET=true to run clear.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const db = mongoose.connection.db;

  const collections = [
    "product_masters",
    "sku_units",
    "transaction_logs",
  ];

  for (const name of collections) {
    const exists = await db.listCollections({ name }).hasNext();
    if (!exists) {
      console.log("Skip (not found):", name);
      continue;
    }
    console.log("Clearing:", name);
    await db.collection(name).deleteMany({});
  }

  console.log("✅ Done.");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error("❌ Error:", e);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
