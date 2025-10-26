import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGO_URI;
  const dbName = process.env.MONGODB_DBNAME || "ZenithMind";

  if (!uri) {
    console.error("❌ MONGO_URI missing from .env");
    process.exit(1);
  }

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(uri, {
      dbName,
      // sensible timeouts
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      // keep indexes in dev; consider disabling autoIndex in prod
      autoIndex: true,
    });

    const { host, name } = mongoose.connection;
    console.log(`✅ MongoDB connected: ${host} / DB: ${name}`);

    mongoose.connection.on("error", (err) =>
      console.error("❌ MongoDB error:", err.message)
    );
    mongoose.connection.on("disconnected", () =>
      console.warn("⚠️ MongoDB disconnected")
    );

    // graceful shutdown
    const close = async (signal) => {
      try {
        console.log(`\n${signal} received. Closing MongoDB connection...`);
        await mongoose.connection.close();
        console.log("👋 MongoDB connection closed.");
        process.exit(0);
      } catch (e) {
        console.error("Error during MongoDB shutdown:", e);
        process.exit(1);
      }
    };
    ["SIGINT", "SIGTERM"].forEach((sig) => process.on(sig, () => close(sig)));
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  }
}
