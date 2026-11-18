import os
import uuid
from django.conf import settings
from django.core.files.storage import FileSystemStorage


class MediaUploadError(ValueError):
    """Raised when a file cannot be stored (subclasses ValueError so existing
    ``except ValueError`` handlers in the views turn it into a 400 response)."""


class FileUploadHandler:
    """
    Utility class for handling file uploads with validation.
    
    Provides static methods for:
    - Validating uploaded files (type and size)
    - Uploading files to media storage with unique names
    
    Supported File Types:
        Images: jpg, jpeg, png, gif, webp (max 5MB)
        Videos: mp4, avi, mov, wmv (max 50MB)
    
    File Naming:
        - Uses UUID4 for unique filenames
        - Preserves original file extension
        - Example: abc123def456789.jpg
    
    
    
    Usage Example:
        file = request.FILES['image']
        FileUploadHandler.validate_file(file, file_type='image')
        url = FileUploadHandler.upload_file(file, folder='profile_pictures')
        # Returns: "media/profile_pictures/abc123.jpg"
    """
    ALLOWED_IMAGE_EXTENSIONS=['jpg','jpeg','png','gif','webp']
    ALLOWED_VIDEO_EXTENSIONS=['mp4','avi','mov','wmv']

    MAX_IMAGE_SIZE=5*1024*1024  # 5MB in bytes
    MAX_VIDEO_SIZE=50*1024*1024  # 50MB in bytes

    # Vercel rejects request bodies over 4.5MB before Django ever sees them, so
    # advertise (and enforce) a limit that can actually succeed there.
    if os.environ.get('VERCEL'):
        MAX_IMAGE_SIZE = 4 * 1024 * 1024
        MAX_VIDEO_SIZE = 4 * 1024 * 1024

    @staticmethod
    def _matches_signature(file, ext):
        """Check the file's leading bytes against its claimed type.

        The extension alone is trivial to fake, so confirm the content really is
        an image / video container before it is stored.
        """
        try:
            file.seek(0)
            head = file.read(16)
            file.seek(0)
        except Exception:
            return False
        if ext in ('jpg', 'jpeg'):
            return head.startswith(b'\xff\xd8\xff')
        if ext == 'png':
            return head.startswith(b'\x89PNG\r\n\x1a\n')
        if ext == 'gif':
            return head.startswith((b'GIF87a', b'GIF89a'))
        if ext == 'webp':
            return head[:4] == b'RIFF' and head[8:12] == b'WEBP'
        if ext in ('mp4', 'mov'):
            return head[4:8] in (b'ftyp', b'moov', b'mdat', b'wide', b'free', b'skip')
        if ext == 'avi':
            return head[:4] == b'RIFF' and head[8:12] == b'AVI '
        if ext == 'wmv':
            return head.startswith(b'\x30\x26\xb2\x75\x8e\x66\xcf\x11')
        return False

    @staticmethod
    def validate_file(file,file_type='image'):
        """
        Validate uploaded file type and size.
        
        Args:
            file: Django UploadedFile object from request.FILES
            file_type (str): Type of file - 'image' or 'video'
        
        Returns:
            bool: True if validation passes
        
        Raises:
            ValueError: If file type is invalid or size exceeds limit
                - "Invalid image format. Allowed: jpg, jpeg, png, gif, webp"
                - "Image size exceeds 5MB limit"
                - "Invalid video format. Allowed: mp4, avi, mov, wmv"
                - "Video size exceeds 50MB limit"
        
        Validation Checks:
            - File extension matches allowed types (case-insensitive)
            - File size is within limits
        
        Example:
            try:
                FileUploadHandler.validate_file(file, file_type='image')
                # File is valid, proceed with upload
            except ValueError as e:
                return Response({'error': str(e)}, status=400)
        """
        ext = file.name.split('.')[-1].lower()
        
        if file_type == 'image':
            if ext not in FileUploadHandler.ALLOWED_IMAGE_EXTENSIONS:
                raise ValueError(f"Invalid image format. Allowed: {', '.join(FileUploadHandler.ALLOWED_IMAGE_EXTENSIONS)}")
            if file.size > FileUploadHandler.MAX_IMAGE_SIZE:
                raise ValueError(f"Image size exceeds {FileUploadHandler.MAX_IMAGE_SIZE // (1024 * 1024)}MB limit")
        elif file_type == 'video':
            if ext not in FileUploadHandler.ALLOWED_VIDEO_EXTENSIONS:
                raise ValueError(f"Invalid video format. Allowed: {', '.join(FileUploadHandler.ALLOWED_VIDEO_EXTENSIONS)}")
            if file.size > FileUploadHandler.MAX_VIDEO_SIZE:
                raise ValueError(f"Video size exceeds {FileUploadHandler.MAX_VIDEO_SIZE // (1024 * 1024)}MB limit")
        else:
            raise ValueError("Unsupported file type")

        # The extension is trivial to fake, so also confirm the content matches it.
        if not FileUploadHandler._matches_signature(file, ext):
            raise ValueError(f"The file content does not look like a valid .{ext} file")

        return True
    
    @staticmethod
    def upload_file(file, folder='uploads'):
        """
        Store an uploaded file and return the URL to save in the database.

        Storage backend:
            - Cloudinary when configured (CLOUDINARY_URL or the three
              CLOUDINARY_CLOUD_NAME / _API_KEY / _API_SECRET variables).
              Returns the absolute ``https://res.cloudinary.com/...`` URL.
            - Local disk (MEDIA_ROOT) otherwise, for development only.
              Returns a relative ``/media/<folder>/<uuid>.<ext>`` path.

        Args:
            file: Django UploadedFile object from request.FILES
            folder (str): Logical folder, e.g. 'profile_pictures',
                'post_images', 'post_videos', 'chat_images', 'chat_videos',
                'marketplace_images', 'group_covers'.

        Raises:
            MediaUploadError (a ValueError): storage is not configured or the
                upload failed.

        Note:
            Does not validate the file (call validate_file first).
        """
        if getattr(settings, 'CLOUDINARY_ENABLED', False):
            return FileUploadHandler._upload_to_cloudinary(file, folder)

        if os.environ.get('VERCEL'):
            # Serverless filesystems are read-only/ephemeral: refuse rather
            # than silently losing the file.
            raise MediaUploadError(
                'Media storage is not configured. Set the CLOUDINARY_* '
                'environment variables.'
            )

        return FileUploadHandler._upload_to_disk(file, folder)

    @staticmethod
    def _upload_to_cloudinary(file, folder):
        import cloudinary
        import cloudinary.uploader

        if settings.CLOUDINARY_CLOUD_NAME:
            cloudinary.config(
                cloud_name=settings.CLOUDINARY_CLOUD_NAME,
                api_key=settings.CLOUDINARY_API_KEY,
                api_secret=settings.CLOUDINARY_API_SECRET,
                secure=True,
            )

        try:
            if hasattr(file, 'seek'):
                file.seek(0)
            result = cloudinary.uploader.upload(
                file,
                folder=f"{settings.CLOUDINARY_FOLDER}/{folder}",
                public_id=uuid.uuid4().hex,
                # 'auto' lets Cloudinary detect image vs. video.
                resource_type='auto',
                overwrite=False,
            )
        except Exception as exc:  # cloudinary.exceptions.Error, network errors
            raise MediaUploadError(f'Failed to upload file to cloud storage: {exc}') from exc

        url = result.get('secure_url') or result.get('url')
        if not url:
            raise MediaUploadError('Cloud storage did not return a file URL')
        return url

    @staticmethod
    def _upload_to_disk(file, folder):
        ext = file.name.split('.')[-1]
        filename = f"{uuid.uuid4().hex}.{ext}"

        folder_path = os.path.join(settings.MEDIA_ROOT, folder)
        os.makedirs(folder_path, exist_ok=True)

        fs = FileSystemStorage(location=folder_path)
        saved_filename = fs.save(filename, file)

        media_base = settings.MEDIA_URL if str(settings.MEDIA_URL).startswith('/') else f"/{settings.MEDIA_URL}"
        return f"{media_base.rstrip('/')}/{folder}/{saved_filename}"
