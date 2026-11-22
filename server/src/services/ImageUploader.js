const AppError = require('../utils/AppError');

/** Adapter around Cloudinary so services never import the SDK directly. */
class ImageUploader {
  constructor({ cloudinary, isConfigured, folder }) {
    this.cloudinary = cloudinary;
    this.isConfigured = isConfigured;
    this.folder = folder;
  }

  upload(buffer) {
    if (!this.isConfigured) throw AppError.badRequest('Image upload is not configured (CLOUDINARY_URL missing)');
    return new Promise((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        { folder: this.folder, resource_type: 'image', transformation: [{ width: 1600, height: 900, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] },
        (err, result) => (err ? reject(err) : resolve({ url: result.secure_url, publicId: result.public_id })),
      );
      stream.end(buffer);
    });
  }

  remove(publicId) {
    if (!this.isConfigured || !publicId) return Promise.resolve();
    return this.cloudinary.uploader.destroy(publicId);
  }
}

module.exports = ImageUploader;
