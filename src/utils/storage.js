const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Create storage configuration
const createStorage = (folder) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      // Use MEDIA_FILE_PATH as base, then add MEDIA_FILE and folder
      const uploadPath = path.join(
        process.env.MEDIA_FILE_PATH, 
        process.env.MEDIA_FILE, 
        folder
      );
      
      console.log('Upload path:', uploadPath); // Debug log
      
      // Create directory if it doesn't exist
      fs.mkdir(uploadPath, { recursive: true }, (err) => {
        if (err) {
          console.error('Error creating directory:', err);
          return cb(err);
        }
        console.log('Directory created/verified:', uploadPath);
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

const deleteFile = (fileUrl) => {
  try {
    if (!fileUrl) {
      console.log('No file URL provided for deletion');
      return;
    }
    
    // Remove BACKEND_URL and MEDIA_FILE from the URL
    const mediaPrefix = `${process.env.BACKEND_URL}/public/${process.env.MEDIA_FILE}/`;
    console.log("mediaPrefix: ", mediaPrefix);

    const relativeFilePath = fileUrl.replace(mediaPrefix, '');
    console.log("relativeFilePath: ", relativeFilePath);
    
    // Construct full path: MEDIA_FILE_PATH + MEDIA_FILE + relativeFilePath
    const fullPath = path.join(
      process.env.MEDIA_FILE_PATH,
      process.env.MEDIA_FILE,
      relativeFilePath
    );
    
    console.log("fullPath: ", fullPath);

    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      console.log('✅ Successfully deleted file:', fullPath);
    } else {
      console.log('⚠️ File not found, skipping deletion:', fullPath);
    }
  } catch (err) {
    console.error('❌ Error deleting file:', err.message);
    // Don't throw error, just log it so product update continues
  }
};

module.exports = { createStorage, deleteFile };