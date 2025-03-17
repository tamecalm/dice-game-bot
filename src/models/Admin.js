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

const adminSchema = new mongoose.Schema(
  {
    telegramId: { type: String, required: true, unique: true }, // Unique ID for the admin
    username: { type: String, required: true }, // Username of the admin
    createdAt: { type: Date, default: Date.now }, // Date when the admin was registered
    role: { type: String, default: "Admin" }, // Admin role (Admin, Moderator, etc.)
    status: { type: String, default: "Active" }, // Admin status (Active, Suspended, etc.)
    lastActive: { type: Date, default: Date.now }, // Last time the admin interacted with the bot
    email: { type: String, default: "" }, // Optional email address for admins
    permissions: {
      type: [String], // Array of permissions (e.g., ['view_users', 'update_balance'])
      default: ["view_users", "send_announcement"],
    }, // Permissions array to track specific permissions the admin has
    totalActions: { type: Number, default: 0 }, // Counter for actions performed by the admin
  },
  { collection: "Dice" } // 👈 Explicitly setting collection name to "Admins"
);

// Indexing telegramId for optimized lookups
adminSchema.index({ telegramId: 1 });

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;


// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
