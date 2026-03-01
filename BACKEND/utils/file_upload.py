import os
import uuid
from django.conf import settings
from django.core.files.storage import FileSystemStorage

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
                raise ValueError("Image size exceeds 5MB limit")
        elif file_type == 'video':
            if ext not in FileUploadHandler.ALLOWED_VIDEO_EXTENSIONS:
                raise ValueError(f"Invalid video format. Allowed: {', '.join(FileUploadHandler.ALLOWED_VIDEO_EXTENSIONS)}")
            if file.size > FileUploadHandler.MAX_VIDEO_SIZE:
                raise ValueError("Video size exceeds 50MB limit")
        
        return True
    
    @staticmethod
    def upload_file(file, folder='uploads'):
        """
        Upload file to media storage with UUID-based filename.
        
        Args:
            file: Django UploadedFile object from request.FILES
            folder (str): Subdirectory within MEDIA_ROOT (default: 'uploads')
                Common folders:
                - 'profile_pictures': User avatars
                - 'chat_images': Chat message images
                - 'post_images': Post images
                - 'post_videos': Post videos
        
        Returns:
            str: Relative URL path to uploaded file
                Format: "media/<folder>/<uuid>.<ext>"
                Example: "media/profile_pictures/abc123def456.jpg"
        
        Process:
            1. Extract file extension from original filename
            2. Generate unique filename using UUID4
            3. Create folder if it doesn't exist
            4. Save file using Django's FileSystemStorage
            5. Return URL path (not absolute filesystem path)
        
        Storage Location:
            Filesystem: MEDIA_ROOT/<folder>/<uuid>.<ext>
            URL: MEDIA_URL/<folder>/<uuid>.<ext>
        
        Example:
            file = request.FILES['profile_picture']
            url = FileUploadHandler.upload_file(file, folder='profile_pictures')
            # url = "media/profile_pictures/abc123.jpg"
            
            # Save to database
            user.profile_picture = url
            
            # Access via browser
            # http://localhost:8000/media/profile_pictures/abc123.jpg
        
        Note:
            - Does not validate file (call validate_file first)
            - Creates folder automatically if missing
            - Files are stored with random names to prevent conflicts
            - Original filename is not preserved
        """
        ext = file.name.split('.')[-1]
        filename = f"{uuid.uuid4().hex}.{ext}"
        
        folder_path = os.path.join(settings.MEDIA_ROOT, folder)
        os.makedirs(folder_path, exist_ok=True)
        
        fs = FileSystemStorage(location=folder_path)
        saved_filename = fs.save(filename, file)

        media_base = settings.MEDIA_URL if str(settings.MEDIA_URL).startswith('/') else f"/{settings.MEDIA_URL}"
        return f"{media_base.rstrip('/')}/{folder}/{saved_filename}"
