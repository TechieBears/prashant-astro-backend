const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Helpers
const ensureDirectory = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const getExtensionFromMime = (mimeType) => {
  const map = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif'
  };
  return map[mimeType] || 'jpg';
};

// Create storage engine for multer (disk storage)
const createStorage = (folder, allowedFormats = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif']) => {
  const destinationRoot = path.join(__dirname, '../../public/uploads', folder);

  const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await ensureDirectory(destinationRoot);
        cb(null, destinationRoot);
      } catch (err) {
        cb(err);
      }
    },
    filename: (req, file, cb) => {
      const extension = getExtensionFromMime(file.mimetype);
      const filename = `${uuidv4()}.${extension}`;
      cb(null, filename);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    const ext = getExtensionFromMime(file.mimetype);
    if (!allowedFormats.includes(ext)) {
      return cb(new Error('Unsupported image format'));
    }
    cb(null, true);
  };

  return { storage, fileFilter };
};

// Multer upload middleware (single field)
const uploadImage = (folder, fieldName = 'image') => {
  const { storage, fileFilter } = createStorage(folder);
  return multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter
  }).single(fieldName);
};

// Derivative generators
const buildPaths = (folder, filename) => {
  const uploadsBaseFs = path.join(__dirname, '../../public/uploads');
  const uploadsBaseUrl = '/uploads';
  const ext = path.extname(filename); // .jpg
  const name = path.basename(filename, ext); // uuid
  const originalFsPath = path.join(uploadsBaseFs, folder, filename);
  const originalUrl = `${uploadsBaseUrl}/${folder}/${filename}`;
  const thumbFilename = `${name}_thumb${ext}`;
  const thumbFsPath = path.join(uploadsBaseFs, folder, thumbFilename);
  const thumbUrl = `${uploadsBaseUrl}/${folder}/${thumbFilename}`;
  const responsiveSizes = [320, 640, 768, 1024, 1200];
  const responsive = responsiveSizes.map((size) => ({
    size,
    fsPath: path.join(uploadsBaseFs, folder, `${name}_${size}${ext}`),
    url: `${uploadsBaseUrl}/${folder}/${name}_${size}${ext}`
  }));
  const imageId = `${folder}/${name}${ext}`; // keep extension to simplify deletes/derivatives
  return { originalFsPath, originalUrl, thumbFsPath, thumbUrl, responsive, imageId, ext, name };
};

const generateDerivatives = async (originalFsPath, thumbFsPath, responsive, metadata) => {
  // Thumbnail 150x150 cover
  await sharp(originalFsPath)
    .resize(150, 150, { fit: 'cover' })
    .toFile(thumbFsPath);

  // Responsive widths while preserving aspect ratio
  await Promise.all(responsive.map(({ size, fsPath }) => sharp(originalFsPath).resize(size).toFile(fsPath)));

  // Return metadata
  return metadata;
};

// Upload image to local storage (keeps function name to avoid changing controllers)
const uploadImageToCloudinary = async (file, folder, options = {}) => {
  try {
    const actualFile = file && file.path ? file : null;
    if (!actualFile) throw new Error('Invalid file');

    const filename = path.basename(file.path);
    const { originalFsPath, originalUrl, thumbFsPath, responsive, imageId } = buildPaths(folder, filename);

    // Read original metadata and size
    const meta = await sharp(originalFsPath).metadata();
    const stat = await fs.promises.stat(originalFsPath);

    // Generate derivatives
    await generateDerivatives(originalFsPath, thumbFsPath, responsive, meta);

    return {
      imageId,
      imageUrl: originalUrl,
      width: meta.width || null,
      height: meta.height || null,
      format: meta.format || path.extname(originalFsPath).slice(1),
      size: stat.size
    };
  } catch (error) {
    throw new Error(`Image upload failed: ${error.message}`);
  }
};

// Delete image and its derivatives from local storage
const deleteImageFromCloudinary = async (imageId) => {
  try {
    if (!imageId) return true;
    const uploadsBaseFs = path.join(__dirname, '../../public/uploads');

    // imageId format: folder/name.ext
    const relPath = imageId.replace(/^\/+/, '');
    const originalFsPath = path.join(uploadsBaseFs, relPath);
    const folder = path.dirname(relPath);
    const ext = path.extname(relPath);
    const name = path.basename(relPath, ext);

    const candidates = [
      originalFsPath,
      path.join(uploadsBaseFs, folder, `${name}_thumb${ext}`),
      path.join(uploadsBaseFs, folder, `${name}_320${ext}`),
      path.join(uploadsBaseFs, folder, `${name}_640${ext}`),
      path.join(uploadsBaseFs, folder, `${name}_768${ext}`),
      path.join(uploadsBaseFs, folder, `${name}_1024${ext}`),
      path.join(uploadsBaseFs, folder, `${name}_1200${ext}`),
    ];

    await Promise.all(candidates.map(async (p) => {
      try {
        await fs.promises.unlink(p);
      } catch (e) {
        // ignore if file missing
      }
    }));
    return true;
  } catch (error) {
    throw new Error(`Image deletion failed: ${error.message}`);
  }
};

// Update image locally (delete old, then upload new)
const updateImageInCloudinary = async (oldImageId, newFile, folder, options = {}) => {
  try {
    if (oldImageId) {
      try { await deleteImageFromCloudinary(oldImageId); } catch (e) {}
    }
    const newImage = await uploadImageToCloudinary(newFile, folder, options);
    return newImage;
  } catch (error) {
    throw new Error(`Image update failed: ${error.message}`);
  }
};

// For local files, optimized URL is just the original URL
const getOptimizedImageUrl = (imageId, options = {}) => {
  try {
    if (!imageId) return null;
    const relPath = imageId.replace(/^\/+/, '');
    return `/uploads/${relPath}`;
  } catch (error) {
    throw new Error(`Failed to generate optimized URL: ${error.message}`);
  }
};

// Thumbnail URL (pre-generated at 150x150)
const getThumbnailUrl = (imageId, width = 150, height = 150) => {
  try {
    if (!imageId) return null;
    const relPath = imageId.replace(/^\/+/, '');
    const ext = path.extname(relPath);
    const dir = path.dirname(relPath);
    const name = path.basename(relPath, ext);
    return `/uploads/${dir}/${name}_thumb${ext}`;
  } catch (error) {
    throw new Error(`Failed to generate thumbnail: ${error.message}`);
  }
};

// Responsive URLs map
const getResponsiveImageUrls = (imageId) => {
  try {
    if (!imageId) return {};
    const relPath = imageId.replace(/^\/+/, '');
    const ext = path.extname(relPath);
    const dir = path.dirname(relPath);
    const name = path.basename(relPath, ext);
    const sizes = [320, 640, 768, 1024, 1200];
    const urls = {};
    sizes.forEach((size) => {
      urls[size] = `/uploads/${dir}/${name}_${size}${ext}`;
    });
    return urls;
  } catch (error) {
    throw new Error(`Failed to generate responsive URLs: ${error.message}`);
  }
};

// Check if image exists on disk
const imageExists = async (imageId) => {
  try {
    if (!imageId) return false;
    const uploadsBaseFs = path.join(__dirname, '../../public/uploads');
    const relPath = imageId.replace(/^\/+/, '');
    const originalFsPath = path.join(uploadsBaseFs, relPath);
    await fs.promises.access(originalFsPath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
};

// Get local image info
const getImageInfo = async (imageId) => {
  try {
    if (!imageId) return null;
    const uploadsBaseFs = path.join(__dirname, '../../public/uploads');
    const relPath = imageId.replace(/^\/+/, '');
    const originalFsPath = path.join(uploadsBaseFs, relPath);
    const meta = await sharp(originalFsPath).metadata();
    const stat = await fs.promises.stat(originalFsPath);
    return {
      imageId,
      imageUrl: `/uploads/${relPath}`,
      width: meta.width || null,
      height: meta.height || null,
      format: meta.format || path.extname(originalFsPath).slice(1),
      size: stat.size,
      createdAt: stat.birthtime
    };
  } catch (error) {
    throw new Error(`Failed to get image info: ${error.message}`);
  }
};

module.exports = {
  uploadImage,
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  updateImageInCloudinary,
  getOptimizedImageUrl,
  getThumbnailUrl,
  getResponsiveImageUrls,
  imageExists,
  getImageInfo,
  createStorage
};
