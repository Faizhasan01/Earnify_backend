// import mongoose from 'mongoose';

// const connectDB = async () => {
//     try {
//         const MONGO_URI = process.env.MONGO_URI;
//         const conn = await mongoose.connect(MONGO_URI);
//         console.log(`MongoDB Connected Successfully`);
//     } catch (error) {
//         console.error(`Error connecting to MongoDB: ${error.message}`);
//         process.exit(1);
//     }
// };

import mongoose from "mongoose";
import "dotenv/config"

const connectDB = async () => {
  try {
    console.log(process.env.MONGO_URI);

    mongoose.set("runValidators", true);

    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.error("Full error:", error);
    process.exit(1);
  }
};

export default connectDB;


// export default connectDB;
