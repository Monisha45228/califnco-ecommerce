const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface CloudinaryUploadResponse {
  secure_url?: string;
  error?: { message?: string };
}

export async function uploadCloudinaryImage(file: File, folder: string): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();
  if (!cloudName || !uploadPreset) {
    throw new Error('Configure VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to upload images.');
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Choose a JPG, PNG, or WebP image.');
  }
  if (file.size === 0 || file.size > MAX_IMAGE_SIZE) {
    throw new Error('Image files must be 10 MB or smaller.');
  }

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', uploadPreset);
  body.append('folder', `califnco/${folder}`);

  let response: Response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
      method: 'POST',
      body
    });
  } catch {
    throw new Error('Cloudinary could not be reached. Check your network and try again.');
  }

  const result = await response.json().catch(() => ({})) as CloudinaryUploadResponse;
  if (!response.ok || !result.secure_url) {
    throw new Error(result.error?.message || `Cloudinary image upload failed (HTTP ${response.status}).`);
  }
  return result.secure_url;
}
