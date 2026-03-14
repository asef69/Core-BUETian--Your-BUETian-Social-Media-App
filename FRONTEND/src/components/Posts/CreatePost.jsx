import React, { useState } from 'react';
import { postAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import { FaImage, FaVideo } from 'react-icons/fa';

const CreatePost = ({ onPostCreated }) => {
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaType, setMediaType] = useState('text');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState([]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 5) {
      toast.error('Maximum 5 files allowed');
      return;
    }

    setMediaFiles(files);
    
    
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setPreviews(newPreviews);

    
    if (files[0]) {
      if (files[0].type.startsWith('image/')) {
        setMediaType('image');
      } else if (files[0].type.startsWith('video/')) {
        setMediaType('video');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() && mediaFiles.length === 0) {
      toast.error('Please add some content or media');
      return;
    }

    setLoading(true);
    try {
      let response;
      
      if (mediaFiles.length > 0) {
        const formData = new FormData();
        formData.append('content', content);
        formData.append('media_type', mediaType);
        formData.append('visibility', visibility);
        mediaFiles.forEach((file) => {
          formData.append('media_files', file);
        });
        console.log(' Creating post with media:', { mediaType, fileCount: mediaFiles.length });
        response = await postAPI.createPost(formData);
      } else {
        console.log(' Creating text post:', { content });
        response = await postAPI.createPost({
          content,
          media_type: 'text',
          visibility,
        });
      }

      console.log('✅ Post created successfully:', response.data);
      toast.success('Post created successfully!');
      setContent('');
      setMediaFiles([]);
      setPreviews([]);
      setMediaType('text');
      setVisibility('public');
      if (onPostCreated) {
        onPostCreated(response.data);
      }
    } catch (error) {
      console.error('❌ Error creating post:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        data: error.response?.data
      });
      toast.error(error.response?.data?.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const removePreview = (index) => {
    const newFiles = [...mediaFiles];
    newFiles.splice(index, 1);
    setMediaFiles(newFiles);

    const newPreviews = [...previews];
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);

    if (newFiles.length === 0) {
      setMediaType('text');
    }
  };

  return (
    <div className="create-post-card">
      <form onSubmit={handleSubmit}>
        <textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows="3"
        />

        {previews.length > 0 && (
          <div className="media-preview">
            {previews.map((preview, index) => (
              <div key={index} className="preview-item">
                {mediaType === 'image' ? (
                  <img src={preview} alt={`Preview ${index + 1}`} />
                ) : (
                  <video src={preview} controls />
                )}
                <button
                  type="button"
                  className="remove-preview"
                  onClick={() => removePreview(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="post-actions">
          <div className="media-buttons">
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="media-btn"
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </select>
            <label className="media-btn">
              <FaImage />
              <span>Photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
            <label className="media-btn">
              <FaVideo />
              <span>Video</span>
              <input
                type="file"
                accept="video/*"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;
