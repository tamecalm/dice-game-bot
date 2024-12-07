const mongoose = require('mongoose');

// Define the Admin schema with additional relevant fields
const adminSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true }, // Unique ID for the admin
  username: { type: String, required: true }, // Username of the admin
  createdAt: { type: Date, default: Date.now }, // Date when the admin was registered
  role: { type: String, default: 'Admin' }, // Admin role (Admin, Moderator, etc.)
  status: { type: String, default: 'Active' }, // Admin status (Active, Suspended, etc.)
  lastActive: { type: Date, default: Date.now }, // Last time the admin interacted with the bot
  email: { type: String, default: '' }, // Optional email address for admins
  permissions: { 
    type: [String], // Array of permissions (e.g., ['view_users', 'update_balance'])
    default: ['view_users', 'send_announcement'] 
  }, // Permissions array to track specific permissions the admin has
  totalActions: { type: Number, default: 0 } // Counter for actions performed by the admin
});

// Export the Admin model
module.exports = mongoose.model('Admin', adminSchema);
