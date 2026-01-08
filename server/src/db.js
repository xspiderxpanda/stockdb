const mongoose = require("mongoose");

async function connectDB(uri) {
  mongoose.set("strictQuery", true);

  await mongoose.connect(uri, {
    autoIndex: true, // dev: ให้สร้าง index ได้สะดวก
  });

  console.log("✅ MongoDB connected");
}

module.exports = { connectDB };
