const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminUserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  permissions: [{
    type: String,
    enum: ['read', 'write', 'delete', 'manage-users', 'manage-settings']
  }],
});

// Virtual for full name
adminUserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

const AdminUser = mongoose.model('admin', adminUserSchema);

module.exports = AdminUser;