import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';

let configured = false;

function configureCloudinary() {
  if (configured) return;
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  configured = true;
}

export async function uploadImage(buffer: Buffer, folder: string) {
  configureCloudinary();
  return new Promise<{ public_id: string; secure_url: string; width: number; height: number }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image', transformation: [{ width: 2000, crop: 'limit' }] },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Image upload failed'));
          return;
        }
        resolve({ public_id: result.public_id, secure_url: result.secure_url, width: result.width, height: result.height });
      },
    );
    stream.end(buffer);
  });
}
