export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg'];
export const MAX_IMAGES_PER_POST = 5;

export const validateImageFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only images are allowed.' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'File size exceeds 5MB limit.' };
  }

  return { valid: true };
};

export const validateVideoFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid file type. Only videos are allowed.' };
  }

  if (file.size > MAX_FILE_SIZE * 4) { // 20MB for videos
    return { valid: false, error: 'File size exceeds 20MB limit.' };
  }

  return { valid: true };
};

export const validateMediaFiles = (files) => {
  if (!files || files.length === 0) {
    return { valid: false, error: 'No files provided' };
  }

  if (files.length > MAX_IMAGES_PER_POST) {
    return { valid: false, error: `Maximum ${MAX_IMAGES_PER_POST} files allowed` };
  }

  for (let file of files) {
    if (file.type.startsWith('image/')) {
      const result = validateImageFile(file);
      if (!result.valid) return result;
    } else if (file.type.startsWith('video/')) {
      const result = validateVideoFile(file);
      if (!result.valid) return result;
    } else {
      return { valid: false, error: 'Invalid file type' };
    }
  }

  return { valid: true };
};
