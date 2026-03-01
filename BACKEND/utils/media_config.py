"""

Directory Structure:
-------------------
media/
├── profile_pictures/     # User profile avatars
├── post_images/          # Images in posts
├── post_videos/          # Videos in posts
├── chat_images/          # Chat message images
├── chat_videos/          # Chat message videos
├── marketplace_images/   # Marketplace product images
├── group_covers/         # Group cover images
└── documents/            # Documents and files

File Upload Endpoints:
---------------------

1. Profile Pictures:
   POST /api/users/profile/upload-picture/
   - Field name: profile_picture
   - Max size: 5MB
   - Types: JPG, PNG, GIF, WEBP
   - Storage: media/profile_pictures/

2. Post Media:
   POST /api/posts/upload-media/
   - Field name: media (multiple files)
   - Max size: 5MB (images), 50MB (videos)
   - Types: Images (JPG, PNG, GIF, WEBP), Videos (MP4, AVI, MOV, WMV)
   - Storage: media/post_images/ or media/post_videos/

3. Chat Images:
   POST /api/chat/upload-image/
   - Field name: image
   - Max size: 5MB
   - Types: JPG, PNG, GIF, WEBP
   - Storage: media/chat_images/

4. Marketplace Images:
   POST /api/marketplace/upload-image/
   - Field name: image
   - Max size: 5MB
   - Types: JPG, PNG, GIF, WEBP
   - Storage: media/marketplace_images/

5. Group Cover Images:
   POST /api/groups/upload-cover/
   - Field name: cover_image
   - Max size: 5MB
   - Types: JPG, PNG, GIF, WEBP
   - Storage: media/group_covers/


File Naming:
-----------
All files are renamed with UUID v4 to ensure uniqueness:
Format: {uuid}.{original_extension}
Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg

This prevents:
- Filename conflicts
- Path traversal attacks
- Exposure of original filenames
- Special character issues



Example Upload Flow (Post with Image):
--------------------------------------
Step 1: Upload image
POST /api/posts/upload-media/
Content-Type: multipart/form-data

Request:
{
  media: [file1.jpg, file2.jpg],
  media_type: "image"
}

Response:
{
  "message": "2 file(s) uploaded successfully",
  "uploaded_files": [
    {
      "url": "media/post_images/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
      "type": "image"
    },
    {
      "url": "media/post_images/b2c3d4e5-f6g7-8901-bcde-fg2345678901.jpg",
      "type": "image"
    }
  ]
}

Step 2: Create post with uploaded images
POST /api/posts/create-with-media/

Request:
{
  "content": "Check out these photos!",
  "media_type": "image",
  "visibility": "public",
  "media_urls": [
    {
      "url": "media/post_images/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg",
      "type": "image"
    },
    {
      "url": "media/post_images/b2c3d4e5-f6g7-8901-bcde-fg2345678901.jpg",
      "type": "image"
    }
  ]
}

Response:
{
  "message": "Post created successfully",
  "post_id": 123
}

Security Considerations:
-----------------------
1. File Type Validation:
   - Extension checking
   - MIME type validation
   - Magic number verification (future enhancement)

2. File Size Limits:
   - Enforced at application level
   - Prevents DOS attacks
   - Configurable per file type

3. Storage:
   - Files stored outside web root in production
   - Direct execution prevented
   - Served through application layer

4. Access Control:
   - Public files: Served directly
   - Private files: Access control via views
   - Temporary URLs for sensitive content (future)

5. Cleanup:
   - Orphaned files should be cleaned periodically
   - Soft delete for user content
   - Retention policies

Production Deployment:
---------------------
1. Use CDN or object storage (AWS S3, Azure Blob, etc.)
2. Serve media through web server (nginx/apache)
3. Enable CORS for cross-origin uploads
4. Implement rate limiting
5. Add virus scanning
6. Enable image optimization/thumbnails
7. Set up backup/replication

Django Settings:
---------------
MEDIA_URL = 'media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

URL Configuration:
-----------------
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

FileUploadHandler Usage:
------------------------
from utils.file_upload import FileUploadHandler

# Validate file
try:
    FileUploadHandler.validate_file(file, file_type='image')
except ValueError as e:
    return Response({'error': str(e)}, status=400)

# Upload file
file_url = FileUploadHandler.upload_file(file, folder='post_images')

# file_url will be: "media/post_images/{uuid}.{ext}"

Monitoring & Maintenance:
-------------------------
1. Monitor disk usage
2. Set up alerts for quota limits
3. Regular cleanup of unused files
4. Audit file access logs
5. Performance metrics for uploads
6. Error rate tracking

Troubleshooting:
---------------
1. Upload fails:
   - Check file size limits
   - Verify file type
   - Check disk space
   - Review permissions

2. Files not accessible:
   - Verify MEDIA_URL in settings
   - Check URL configuration
   - Review file permissions
   - Check web server config

3. Slow uploads:
   - Check network bandwidth
   - Review file size limits
   - Consider chunked uploads
   - Use CDN for large files

Future Enhancements:
-------------------
1. Image thumbnails generation
2. Video transcoding
3. Chunked uploads for large files
4. Direct S3/Azure uploads
5. Image compression
6. Duplicate detection
7. Content moderation
8. Watermarking
9. EXIF data stripping
10. Temporary file links
"""

# Media folder paths
MEDIA_FOLDERS = {
    'profile': 'profile_pictures',
    'post_image': 'post_images',
    'post_video': 'post_videos',
    'chat_image': 'chat_images',
    'chat_video': 'chat_videos',
    'marketplace': 'marketplace_images',
    'group_cover': 'group_covers',
    'document': 'documents',
}

# File size limits (in bytes)
FILE_SIZE_LIMITS = {
    'image': 5 * 1024 * 1024,      # 5MB
    'video': 50 * 1024 * 1024,     # 50MB
    'document': 10 * 1024 * 1024,  # 10MB
}

# Allowed file extensions
ALLOWED_EXTENSIONS = {
    'image': ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    'video': ['mp4', 'avi', 'mov', 'wmv'],
    'document': ['pdf', 'doc', 'docx', 'txt'],
}

def get_media_path(folder_key):
    """
    Get full media path for a folder key.
    
    Args:
        folder_key (str): Key from MEDIA_FOLDERS dict
        
    Returns:
        str: Full path to media folder
    """
    return MEDIA_FOLDERS.get(folder_key, 'uploads')

def get_file_size_limit(file_type):
    """
    Get file size limit for a file type.
    
    Args:
        file_type (str): 'image', 'video', or 'document'
        
    Returns:
        int: Size limit in bytes
    """
    return FILE_SIZE_LIMITS.get(file_type, 5 * 1024 * 1024)

def get_allowed_extensions(file_type):
    """
    Get allowed extensions for a file type.
    
    Args:
        file_type (str): 'image', 'video', or 'document'
        
    Returns:
        list: List of allowed extensions
    """
    return ALLOWED_EXTENSIONS.get(file_type, [])
