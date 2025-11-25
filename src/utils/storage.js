const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Create storage configuration
const createStorage = (folder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(process.env.MEDIA_FILE_PATH, folder);
      
      // Create directory if it doesn't exist
      fs.mkdir(uploadPath, { recursive: true }, (err) => {
        if (err) return cb(err);
        cb(null, uploadPath);
      });
    },
    filename: (req, file, cb) => {
      const sanitizeFilename = (name) => 
        name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9.-]/g, '');
      
      const originalNameWithoutExt = file.originalname.replace(/\.[^/.]+$/, "");
      const ext = path.extname(file.originalname).toLowerCase();
      
      cb(null, `${Date.now()}-${sanitizeFilename(originalNameWithoutExt)}${ext}`);
    }
  });
};

module.exports = { createStorage };