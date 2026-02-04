const mongoose = require("mongoose");

let cached = global.__mongoose_conn;
if (!cached) cached = global.__mongoose_conn = { conn: null, promise: null };

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is missing in .env");

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    mongoose.set("strictQuery", true);

    cached.promise = mongoose.connect(uri, {
      maxPoolSize: 50,              // เริ่มกลาง ๆ ก่อน
      minPoolSize: 0,               // ปกติไม่ต้องค้างขั้นต่ำ
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 10000,
    });

    // mongoose.set("strictQuery", true);

    // cached.promise = mongoose.connect(uri, {
    //   maxPoolSize: 60,                
    //   minPoolSize: 5,
    //   serverSelectionTimeoutMS: 5000,
    //   socketTimeoutMS: 45000,
    //   connectTimeoutMS: 90000,
    //   retryWrites: true
    // });

  }

  cached.conn = await cached.promise;
  console.log("MongoDB connected");
  return cached.conn;
}

module.exports = connectDB;
