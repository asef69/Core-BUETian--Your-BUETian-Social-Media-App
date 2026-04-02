import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { postAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import { FaHeart, FaRegHeart, FaComment, FaEllipsisH } from 'react-icons/fa';
import moment from 'moment';
import CommentSection from './CommentSection';
import { useAuth } from '../../context/AuthContext';
import { confirmDialog } from '../../utils/confirmDialog';

const PostCard = ({ post, onLike, readOnly = false }) => {
  const { user } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [liked, setLiked] = useState(
    Boolean(post.has_liked ?? post.is_liked ?? post.liked ?? false),
  );
  const [likesCount, setLikesCount] = useState(Number(post.likes_count) || 0);
  const [commentsCount, setCommentsCount] = useState(Number(post.comments_count) || 0);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content || '');
  const [editVisibility, setEditVisibility] = useState(post.visibility || 'public');
  const [displayContent, setDisplayContent] = useState(post.content || '');
  const [displayVisibility, setDisplayVisibility] = useState(post.visibility || 'public');
  const [editMediaFiles, setEditMediaFiles] = useState([]); 
  const [editMediaToDelete, setEditMediaToDelete] = useState([]); 
  const [editMediaPreviews, setEditMediaPreviews] = useState([]);
  const [showPostMenu, setShowPostMenu] = useState(false);
  const postMenuRef = useRef(null);
  const postId = post.id || post.post_id;

  const renderContentWithHashtags = (content) => {
    const text = content || '';
    const parts = text.split(/(#[A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)*)/g);
    return parts.map((part, index) => {
      if (/^#[A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)*$/.test(part)) {
        const hashtag = part.slice(1);
        return (
          <Link key={`${hashtag}-${index}`} to={`/search?q=${encodeURIComponent(hashtag)}`} className="hashtag-link">
            {part}
          </Link>
        );
      }
      return <React.Fragment key={`text-${index}`}>{part}</React.Fragment>;
    });
  };

  // Debug: Log post data structure
  React.useEffect(() => {
    if (!post.user_id || !post.user_name) {
      console.warn('⚠️ PostCard missing user data:', {
        user_id: post.user_id,
        user_name: post.user_name,
        profile_picture: post.profile_picture,
        author_id: post.author_id,
        author_name: post.author_name,
        author_picture: post.author_picture,
        postId: post.id,
        message: 'Backend is using author_* fields instead of user_* fields'
      });
    }
  }, [post]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (postMenuRef.current && !postMenuRef.current.contains(event.target)) {
        setShowPostMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    setLiked(Boolean(post.has_liked ?? post.is_liked ?? post.liked ?? false));
    setLikesCount(Number(post.likes_count) || 0);
    setCommentsCount(Number(post.comments_count) || 0);
  }, [post.has_liked, post.is_liked, post.liked, post.likes_count, post.comments_count]);

  useEffect(() => {
    setEditContent(post.content || '');
    setDisplayContent(post.content || '');
  }, [post.content]);

  useEffect(() => {
    const nextVisibility = post.visibility || 'public';
    setEditVisibility(nextVisibility);
    setDisplayVisibility(nextVisibility);
  }, [post.visibility]);

  useEffect(() => {
    const previewUrls = editMediaFiles.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type?.startsWith('video/') ? 'video' : 'image',
      name: file.name,
    }));

    setEditMediaPreviews(previewUrls);

    return () => {
      previewUrls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [editMediaFiles]);

  const handleLike = async () => {
    if (readOnly) {
      return;
    }

    try {
      console.log('🔄 Attempting to like post:', { postId: post.id, postIdType: typeof post.id });
      
      if (!postId) {
        console.error('❌ Post ID is missing:', post);
        toast.error('Cannot like post: Post ID is missing');
        return;
      }
      
      const response = await postAPI.likePost(postId);
      console.log('✅ Post liked successfully:', response?.data);

      const nextLiked =
        response?.data?.liked ?? !liked;
      const nextLikesCount =
        typeof response?.data?.likes_count === 'number'
          ? response.data.likes_count
          : (nextLiked ? likesCount + 1 : Math.max(0, likesCount - 1));

      setLiked(Boolean(nextLiked));
      setLikesCount(Number(nextLikesCount) || 0);
      if (onLike) {
        onLike(postId);
      }
    } catch (error) {
      console.error('❌ Failed to like post:', {
        postId: postId,
        status: error.response?.status,
        statusText: error.response?.statusText,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
        data: error.response?.data
      });
      
      if (error.response?.status === 404) {
        toast.error('Post not found. The post may have been deleted.');
      } else if (error.response?.status === 401) {
        toast.error('Please login to like posts');
      } else {
        toast.error(error.response?.data?.message || 'Failed to like post');
      }
    }
  };

  const MEDIA_BASE_URL = 'http://localhost:8000';

  const toAbsoluteUrl = (url) => {
    if (!url) return url;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('//')) return `${window.location.protocol}${url}`;
    const normalized = url.startsWith('/') ? url : `/${url}`;
    return `${MEDIA_BASE_URL}${normalized}`;
  };

  const toMediaPath = (url) => {
    if (!url) return url;
    try {
      const parsed = new URL(url, MEDIA_BASE_URL);
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    } catch {
      return url.startsWith('http://') || url.startsWith('https://')
        ? url.replace(MEDIA_BASE_URL, '')
        : (url.startsWith('/') ? url : `/${url}`);
    }
  };

  const inferMediaType = (url, fallbackType) => {
    if (fallbackType) return fallbackType;
    if (!url) return 'image';
    if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(url)) return 'video';
    return 'image';
  };

  const normalizeMediaUrlList = (mediaList) => {
    const list = Array.isArray(mediaList) ? mediaList : [];
    return list
      .map((item) => {
        if (!item) return null;
        if (typeof item === 'string') {
          return {
            url: toAbsoluteUrl(item),
            type: inferMediaType(item),
          };
        }
        const rawUrl = item.media_url || item.url || item.file || item.image || item.video;
        if (!rawUrl) return null;
        return {
          url: toAbsoluteUrl(rawUrl),
          type: inferMediaType(rawUrl, item.media_type || item.type),
        };
      })
      .filter(Boolean);
  };

  const normalizeMediaItems = (postData) => {
    const candidates =
      postData.media_urls ||
      postData.media_urls_list ||
      postData.media_files ||
      postData.media ||
      postData.images ||
      postData.videos ||
      [];

    const list = Array.isArray(candidates) ? candidates : [candidates];
    const mapped = list
      .map((item) => {
        if (!item) return null;

        if (typeof item === 'string') {
          return {
            url: toAbsoluteUrl(item),
            type: inferMediaType(item, postData.media_type),
          };
        }

        if (item.media_url) {
          return {
            url: toAbsoluteUrl(item.media_url),
            type: inferMediaType(item.media_url, item.media_type),
          };
        }

        const rawUrl = item.url || item.file || item.image || item.video;
        if (!rawUrl) return null;

        return {
          url: toAbsoluteUrl(rawUrl),
          type: inferMediaType(rawUrl, item.type),
        };
      })
      .filter(Boolean);

    if (mapped.length > 0) return mapped;

    const singleUrl = postData.media_url || postData.image || postData.video;
    if (!singleUrl) return [];
    return [
      {
        url: toAbsoluteUrl(singleUrl),
        type: inferMediaType(singleUrl, postData.media_type),
      },
    ];
  };

  const normalizeMediaResponse = (mediaList) => {
    const list = Array.isArray(mediaList) ? mediaList : [];
    return list
      .map((item) => {
        if (!item) return null;
        const rawUrl = item.media_url || item.url || item.file || item.image || item.video || item;
        if (!rawUrl) return null;
        return {
          url: toAbsoluteUrl(rawUrl),
          type: inferMediaType(rawUrl, item.media_type || item.type),
        };
      })
      .filter(Boolean);
  };

  const handleCommentAdded = () => {
    setCommentsCount(commentsCount + 1);
  };
  const handleCommentRemoved = () => {
    setCommentsCount(commentsCount - 1);
  }; 

  const isOwner = user && Number(user.id) === Number(post.user_id);

  const handleDelete = async () => {
    if (!postId) {
      toast.error('Cannot delete: Post ID is missing');
      return;
    }

    await confirmDialog({
      title: 'Delete Post',
      message: 'Are you sure you want to delete this post?',
      confirmText: 'Delete',
      confirmLoadingText: 'Deleting...',
      danger: true,
      onConfirmAction: async () => {
        try {
          await postAPI.deletePost(postId);
          toast.success('Post deleted');
          window.location.reload();
        } catch (error) {
          toast.error(error?.response?.data?.error || 'Failed to delete post');
          throw error;
        }
      },
    });
  };

  const handleUpdate = async () => {
    try {
      if (!postId) {
        toast.error('Cannot update: Post ID is missing');
        return;
      }
      
      const formData = new FormData();
      formData.append('content', editContent);
      formData.append('visibility', editVisibility);
      
      // Add new media files
      editMediaFiles.forEach(file => {
        formData.append('media_files', file);
      });
      
      // Add media URLs to delete
      if (editMediaToDelete.length > 0) {
        const deleteMediaPaths = editMediaToDelete.map((url) => toMediaPath(url));
        formData.append('delete_media_urls', JSON.stringify(deleteMediaPaths));
      }
      
      const response = await postAPI.updatePost(postId, formData);
      const mediaErrors = Array.isArray(response?.data?.media_errors) ? response.data.media_errors : [];

      const updatedMedia = normalizeMediaResponse(response?.data?.media_urls || []);

      if (updatedMedia.length > 0) {
        setDisplayMediaItems(updatedMedia);
      }

      setDisplayContent(editContent);
      setDisplayVisibility(editVisibility);

      if (mediaErrors.length > 0) {
        toast.warning(`Some media failed to save (${mediaErrors.length}).`);
      }

      toast.success('Post updated');
      setEditing(false);
      setEditMediaFiles([]);
      setEditMediaToDelete([]);
      setEditMediaPreviews([]);
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update post');
    }
  };

  const mediaItems = normalizeMediaItems(post);
  const [displayMediaItems, setDisplayMediaItems] = useState(mediaItems);
  useEffect(() => {
    setDisplayMediaItems(mediaItems);
  }, [post.media_urls, post.media_urls_list, post.media_url, post.image, post.video]);
  const visibleMediaItems = displayMediaItems.filter((media) => !editMediaToDelete.includes(media.url));
  const authorName = post.user_name || post.author_name || post.owner_name || post.created_by_name || 'Unknown User';
  const authorPicture = toAbsoluteUrl(post.profile_picture || post.author_picture || post.owner_picture) || '/default-avatar.png';
  const canOpenProfile = Boolean(post.user_id);

  return (
    <div className={`post-card ${readOnly ? 'read-only' : ''}`}>
      <div className="post-header">
        {canOpenProfile ? (
          <Link to={`/profile/${post.user_id}`} className="post-author">
            <img
              src={authorPicture}
              alt={authorName}
              className="avatar"
              onError={(e) => { e.target.src = '/default-avatar.png'; }}
            />
            <div className="author-info">
              <h4>{authorName}</h4>
              <p className="post-time">
                {moment.utc(post.created_at).local().fromNow()} · {(displayVisibility || 'public').toLowerCase()}
              </p>
            </div>
          </Link>
        ) : (
          <div className="post-author">
            <img
              src={authorPicture}
              alt={authorName}
              className="avatar"
              onError={(e) => { e.target.src = '/default-avatar.png'; }}
            />
            <div className="author-info">
              <h4>{authorName}</h4>
              <p className="post-time">
                {moment.utc(post.created_at).local().fromNow()} · {(displayVisibility || 'public').toLowerCase()}
              </p>
            </div>
          </div>
        )}

        {isOwner && !editing && (
          <div className="post-menu" ref={postMenuRef}>
            <button
              className="post-menu-trigger"
              type="button"
              aria-label="Post actions"
              onClick={() => setShowPostMenu((prev) => !prev)}
            >
              <FaEllipsisH />
            </button>

            {showPostMenu && (
              <div className="post-menu-dropdown" role="menu">
                <button
                  type="button"
                  className="post-menu-item"
                  onClick={() => {
                    setEditing(true);
                    setShowPostMenu(false);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="post-menu-item delete"
                  onClick={() => {
                    setShowPostMenu(false);
                    handleDelete();
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="post-content">
        {editing ? (
          <div className="create-post-form">
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows="3"
              placeholder="What's on your mind?"
            />
            <select
              className="post-edit-visibility"
              value={editVisibility}
              onChange={(e) => setEditVisibility(e.target.value)}
            >
              <option value="public">Public</option>
              <option value="followers">Followers</option>
              <option value="private">Private</option>
            </select>

            {/* Display current media with delete buttons */}
            {visibleMediaItems.length > 0 && (
              <div className="post-edit-section">
                <h5 className="post-edit-section-title">Current Media</h5>
                <div className={`post-media post-edit-media-grid ${visibleMediaItems.length > 1 ? 'media-grid' : ''}`}>
                  {visibleMediaItems.map((media, index) => (
                    <div key={index} className="media-item post-edit-media-item">
                      {media.type === 'video' ? (
                        <video src={media.url} controls className="post-edit-media-preview" />
                      ) : (
                        <img src={media.url} alt="Post media" className="post-edit-media-preview" />
                      )}
                      <button
                        type="button"
                        className="post-edit-media-remove"
                        onClick={() => {
                          setEditMediaToDelete((prev) => [...prev, media.url]);
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload new media */}
            <div className="post-edit-section">
              <label className="post-edit-label">
                Add Pictures or Videos
              </label>
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={(e) => {
                  const selectedFiles = Array.from(e.target.files || []);
                  setEditMediaFiles((prev) => [...prev, ...selectedFiles]);
                  e.target.value = '';
                }}
                className="post-edit-file-input"
              />
              {editMediaFiles.length > 0 && (
                <div className="post-edit-upload-info">
                  {editMediaFiles.length} file(s) selected to upload
                  <div className="post-edit-preview-grid">
                    {editMediaPreviews.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="post-edit-preview-item">
                        {item.type === 'video' ? (
                          <video src={item.url} controls className="post-edit-preview-media" />
                        ) : (
                          <img src={item.url} alt={item.name} className="post-edit-preview-media" />
                        )}
                        <button
                          type="button"
                          onClick={() => setEditMediaFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}
                          className="post-edit-preview-remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="post-actions post-edit-actions">
              <button className="action-btn post-edit-save" onClick={handleUpdate}>Save</button>
              <button className="action-btn post-edit-cancel" onClick={() => {
                setEditing(false);
                setEditMediaFiles([]);
                setEditMediaToDelete([]);
                setEditMediaPreviews([]);
              }}>Cancel</button>
            </div>
          </div>
        ) : (
          <p>{renderContentWithHashtags(displayContent)}</p>
        )}
        
        {mediaItems.length > 0 && (
          <div className={`post-media ${mediaItems.length > 1 ? 'media-grid' : ''}`}>
            {mediaItems.map((media, index) => (
              <div key={index} className="media-item">
                {media.type === 'video' ? (
                  <video src={media.url} controls />
                ) : (
                  <img src={media.url} alt="Post media" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="post-actions">
        <button
          className={`action-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
          disabled={readOnly}
        >
          {liked ? <FaHeart color="#e74c3c" /> : <FaRegHeart />}
          {readOnly ? (
            <span className="count-pill">{likesCount}</span>
          ) : likesCount > 0 ? (
            <span className="count-pill">{likesCount}</span>
          ) : (
            <span>Like</span>
          )}
        </button>
        <button
          className="action-btn"
          onClick={() => setShowComments(!showComments)}
        >
          <FaComment />
          {readOnly ? (
            <span className="count-pill">{commentsCount}</span>
          ) : commentsCount > 0 ? (
            <span className="count-pill">{commentsCount}</span>
          ) : (
            <span>Comment</span>
          )}
        </button>
      </div>

      {showComments && (
        <CommentSection
          postId={postId}
          onCommentAdded={handleCommentAdded}
          onCommentRemoved={handleCommentRemoved}
          readOnly={readOnly}
        />
      )}
    </div>
  );
};

export default PostCard;
