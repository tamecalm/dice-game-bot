// ==========================================================================
// Dice Game Bot Project - Script Header
// ==========================================================================
//
// Project: Dice Game Bot
// Repository: https://github.com/tamecalm/dice-game-bot
// 
// Description: 
// A robust and extensible module designed for a multiplayer dice game bot. 
// Feel free to use, modify, or contribute to the project under the terms of the repository's license.
//
// Author: Engr John! 🧑‍💻
// Year: 2024
// 
// License: Licensed under the terms of the repository's license. Unauthorized duplication, 
// Modification, or distribution of this script outside the license terms is prohibited.
// ==========================================================================

import mongoose from "mongoose";
import settings from "../config/settings.js";

const connectDb = async () => {
  try {
    // Force the database name to "DiceLand"
    const dbUri = `${settings.dbUri}/DiceLand`;

    await mongoose.connect(dbUri, {});

    console.log("✅ Connected to MongoDB: DiceLand");

    // Ensure the database is created by inserting a dummy record into an 'init' collection
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    if (collections.length === 0) {
      await db.collection("init").insertOne({ createdAt: new Date() });
      console.log("📌 Database initialized with a dummy record.");
    }
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
};

export default connectDb;

// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
