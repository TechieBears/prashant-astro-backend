// Cloudinary Configuration
module.exports = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  
  // Optional configurations
  upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET,
  folder: process.env.CLOUDINARY_DEFAULT_FOLDER || 'soulplan',
  
  // Image transformation defaults
  transformations: {
    thumbnail: {
      width: 150,
      height: 150,
      crop: 'fill',
      quality: 'auto:good'
    },
    medium: {
      width: 400,
      height: 400,
      crop: 'limit',
      quality: 'auto:good'
    },
    large: {
      width: 800,
      height: 800,
      crop: 'limit',
      quality: 'auto:good'
    }
  },
  
  // Upload options
  upload_options: {
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    max_file_size: 5 * 1024 * 1024, // 5MB
    transformation: [
      { width: 1000, height: 1000, crop: 'limit' },
      { quality: 'auto:good' },
      { fetch_format: 'auto' }
    ]
  }
};
