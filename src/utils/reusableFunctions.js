function generateImageName(filename) {
  // filename: "profile.jpg"
  const lastDotIndex = filename.lastIndexOf(".");

  const name = filename.substring(0, lastDotIndex);      // profile
  const ext = filename.substring(lastDotIndex + 1);       // jpg

  return `${name}_${Date.now()}.${ext}`;
}

module.exports = {
  generateImageName,
};