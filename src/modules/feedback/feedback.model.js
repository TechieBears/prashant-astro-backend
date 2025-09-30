 const mongoose = require('mongoose');

 const feedbackSchema = new mongoose.Schema(
   {
     fullName: {
       type: String,
       required: [true, 'Full name is required'],
       trim: true,
       maxlength: [100, 'Full name cannot exceed 100 characters'],
     },
     mobileNumber: {
       type: String,
       required: [true, 'Mobile number is required'],
       trim: true,
       minlength: [7, 'Mobile number seems too short'],
       maxlength: [20, 'Mobile number seems too long'],
     },
     email: {
       type: String,
       required: [true, 'Email is required'],
       trim: true,
       lowercase: true,
       match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
     },
     subject: {
       type: String,
       required: [true, 'Subject is required'],
       trim: true,
       maxlength: [150, 'Subject cannot exceed 150 characters'],
     },
     message: {
       type: String,
       required: [true, 'Message is required'],
       trim: true,
       maxlength: [2000, 'Message cannot exceed 2000 characters'],
     },
     isRead: {
       type: Boolean,
       default: false,
     },
     // meta: potential source or page for analytics
     source: {
       type: String,
       trim: true,
       default: 'website',
     },
   },
   { timestamps: true }
 );

 feedbackSchema.index({ email: 1, createdAt: -1 });
 feedbackSchema.index({ isRead: 1, createdAt: -1 });

 module.exports = mongoose.model('Feedback', feedbackSchema);
