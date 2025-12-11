const multer = require('multer');
const { createStorage } = require('../utils/storage');

// This function returns a multer parser for any folder you pass
const getUploader = (folder) => {
  const storage = createStorage(`${folder}`);
  
  return multer({
    storage,
    limits: {
      fileSize: 1024 * 1024 * 200 // 200MB
    },
    fileFilter: (req, file, cb) => {
      const allowedFormats = [
        'jpg', 'jpeg', 'png', 'webp',    // images
        'pdf', 'doc', 'docx',            // documents
        'mp3',                           // audio
        'mp4', 'mov', 'avi', 'mkv'       // video formats
      ];
      const ext = file.originalname.split('.').pop().toLowerCase();
      if (allowedFormats.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type: ${ext}`), false);
      }
    }
  });
};

module.exports = getUploader;