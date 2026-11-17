import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FaImage, FaVideo, FaTimes } from 'react-icons/fa';
import { postAPI } from '../../services/apiService';
import Avatar from '../common/Avatar';

const MAX_FILES = 5;
const MAX_TEXTAREA_PX = 240;

const CreatePost = ({ onPostCreated, currentUser = null }) => {
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState([]);
  const [mediaType, setMediaType] = useState('text');
  const [visibility, setVisibility] = useState('public');
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState([]);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef(null);

  const firstName = currentUser?.name ? String(currentUser.name).split(' ')[0] : '';
  const expanded = focused || content.length > 0 || mediaFiles.length > 0;

  // Grow with the text, up to a cap.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
    el.style.overflowY = el.scrollHeight > MAX_TEXTAREA_PX ? 'auto' : 'hidden';
  }, [content, expanded]);

  // Object URLs are revoked when replaced or removed, and on unmount.
  const previewsRef = useRef([]);
  previewsRef.current = previews;
  useEffect(() => () => previewsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (files.length === 0) return;
    if (files.length > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    previews.forEach((url) => URL.revokeObjectURL(url));
    setMediaFiles(files);
    setPreviews(files.map((file) => URL.createObjectURL(file)));

    if (files[0].type.startsWith('image/')) {
      setMediaType('image');
    } else if (files[0].type.startsWith('video/')) {
      setMediaType('video');
    }
  };

  const resetForm = () => {
    previews.forEach((url) => URL.revokeObjectURL(url));
    setContent('');
    setMediaFiles([]);
    setPreviews([]);
    setMediaType('text');
    setVisibility('public');
    setFocused(false);
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
        response = await postAPI.createPost(formData);
      } else {
        response = await postAPI.createPost({
          content,
          media_type: 'text',
          visibility,
        });
      }

      toast.success('Post created successfully!');
      resetForm();
      if (onPostCreated) {
        onPostCreated(response.data);
      }
    } catch (error) {
      console.error('Error creating post:', error.response?.data || error.message);
      toast.error(error.response?.data?.message || 'Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  const removePreview = (index) => {
    const newFiles = mediaFiles.filter((_, i) => i !== index);
    URL.revokeObjectURL(previews[index]);
    setMediaFiles(newFiles);
    setPreviews(previews.filter((_, i) => i !== index));
    if (newFiles.length === 0) {
      setMediaType('text');
    }
  };

  return (
    <div className={`create-post-card ${expanded ? 'expanded' : ''}`}>
      <form onSubmit={handleSubmit}>
        <div className="composer-row">
          <Avatar src={currentUser?.profile_picture} name={currentUser?.name} size={44} decorative />
          <textarea
            ref={textareaRef}
            placeholder={firstName ? `What's happening, ${firstName}?` : "What's happening?"}
            aria-label="Write a post"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            rows={1}
          />
        </div>

        {previews.length > 0 && (
          <div className="media-preview">
            {previews.map((preview, index) => (
              <div key={preview} className="preview-item">
                {mediaType === 'image' ? (
                  <img src={preview} alt={`Selected photo ${index + 1}`} />
                ) : (
                  <video src={preview} controls />
                )}
                <button
                  type="button"
                  className="remove-preview"
                  onClick={() => removePreview(index)}
                  aria-label={`Remove attachment ${index + 1}`}
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="post-actions composer-actions">
          <div className="media-buttons">
            <label className="media-btn">
              <FaImage aria-hidden="true" />
              <span>Photo</span>
              <input type="file" accept="image/*" multiple onChange={handleFileChange} hidden />
            </label>
            <label className="media-btn">
              <FaVideo aria-hidden="true" />
              <span>Video</span>
              <input type="file" accept="video/*" multiple onChange={handleFileChange} hidden />
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="media-btn visibility-select"
              aria-label="Who can see this post"
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Only me</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || (!content.trim() && mediaFiles.length === 0)}
          >
            {loading ? 'Posting…' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreatePost;
