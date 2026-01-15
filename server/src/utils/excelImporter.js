const XLSX = require("xlsx");
const Product = require("../models/Product");
const SkuUnit = require("../models/SkuUnit");

async function importExcel(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  let inserted = 0;

  for (const r of rows) {
    const barcode = String(r.BarCode).trim();
    const sku = String(r.SkuCode).trim();

    await Product.findOneAndUpdate(
      { barcode },
      {
        barcode,
        sku_code: sku,
        product_name: r.Name,
        unit: r.Unit,
      },
      { upsert: true }
    );

    await SkuUnit.findOneAndUpdate(
      { sku_code: sku, unit: r.Unit },
      {
        sku_code: sku,
        barcode,
        unit: r.Unit,
        factor: Number(r.Factor),
        price: Number(r.Price),
      },
      { upsert: true }
    );

    inserted++;
  }

  return { total: rows.length, inserted };
}

module.exports = importExcel;
