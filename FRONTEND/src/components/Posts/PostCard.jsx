import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { postAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import { FaHeart, FaRegHeart, FaRegComment, FaEllipsisH, FaShareAlt, FaTimes, FaGlobeAmericas, FaUserFriends, FaLock } from 'react-icons/fa';
import Avatar from '../common/Avatar';
import ShareModal from '../common/ShareModal';
import CommentSection from './CommentSection';
import { useAuth } from '../../context/AuthContext';
import { confirmDialog } from '../../utils/confirmDialog';
import { toAbsoluteMediaUrl, MEDIA_BASE_URL } from '../../config';
import { timeAgo, formatDateTime } from '../../utils/time';

const LONG_TEXT_CHARS = 320;
const VISIBILITY_META = {
  public: { label: 'Public', Icon: FaGlobeAmericas },
  followers: { label: 'Followers', Icon: FaUserFriends },
  private: { label: 'Only me', Icon: FaLock },
};

const PostCard = ({ post, onLike, onDelete, readOnly = false }) => {
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
  const [textExpanded, setTextExpanded] = useState(false);
  const [likePop, setLikePop] = useState(false);
  const likingRef = useRef(false);
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (postMenuRef.current && !postMenuRef.current.contains(event.target)) {
        setShowPostMenu(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setShowPostMenu(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
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
    if (readOnly || likingRef.current) return;

    if (!postId) {
      toast.error('Cannot like post: Post ID is missing');
      return;
    }

    // Update the UI immediately; roll back if the server rejects it.
    const previousLiked = liked;
    const previousCount = likesCount;
    const optimisticLiked = !previousLiked;
    likingRef.current = true;
    setLiked(optimisticLiked);
    setLikesCount(optimisticLiked ? previousCount + 1 : Math.max(0, previousCount - 1));
    if (optimisticLiked) setLikePop(true);

    try {
      const response = await postAPI.likePost(postId);
      const nextLiked = response?.data?.liked ?? optimisticLiked;
      const nextLikesCount =
        typeof response?.data?.likes_count === 'number'
          ? response.data.likes_count
          : (nextLiked ? previousCount + 1 : Math.max(0, previousCount - 1));

      setLiked(Boolean(nextLiked));
      setLikesCount(Number(nextLikesCount) || 0);
      if (onLike) {
        onLike(postId, Boolean(nextLiked), Number(nextLikesCount) || 0);
      }
    } catch (error) {
      setLiked(previousLiked);
      setLikesCount(previousCount);

      if (error.response?.status === 404) {
        toast.error('Post not found. The post may have been deleted.');
      } else if (error.response?.status === 401) {
        toast.error('Please login to like posts');
      } else {
        toast.error(error.response?.data?.message || 'Failed to like post');
      }
    } finally {
      likingRef.current = false;
    }
  };

  const [showShare, setShowShare] = useState(false);
  const closeShare = useCallback(() => setShowShare(false), []);
  const handleShare = () => {
    if (postId) setShowShare(true);
  };

  const toAbsoluteUrl = toAbsoluteMediaUrl;

  // Convert a displayed URL back to the value stored in the database.
  // Only files served by our own API (legacy /media/... uploads) are stored as
  // paths; external URLs such as Cloudinary must be kept exactly as they are.
  const toMediaPath = (url) => {
    if (!url) return url;
    if (url.startsWith(MEDIA_BASE_URL)) {
      return url.slice(MEDIA_BASE_URL.length) || '/';
    }
    if (/^(https?:)?\/\//i.test(url)) return url;
    return url.startsWith('/') ? url : `/${url}`;
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
    setCommentsCount(Math.max(0, commentsCount - 1));
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
          if (onDelete) {
            onDelete(postId);
          } else {
            window.location.reload();
          }
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

      const refreshResponse = await postAPI.getPost(postId);
      const refreshedPost = refreshResponse?.data || {};
      const updatedMedia = normalizeMediaItems(refreshedPost);

      setDisplayMediaItems(updatedMedia);

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
  const canOpenProfile = Boolean(post.user_id);
  const isLongText = displayContent.length > LONG_TEXT_CHARS || (displayContent.match(/\n/g) || []).length > 5;

  return (
    <div className={`post-card ${readOnly ? 'read-only' : ''}`}>
      <div className="post-header">
        {(() => {
          const visibilityMeta = VISIBILITY_META[(displayVisibility || 'public').toLowerCase()] || VISIBILITY_META.public;
          const VisibilityIcon = visibilityMeta.Icon;
          const wrap = (children) =>
            canOpenProfile ? (
              <Link to={`/profile/${post.user_id}`} className="post-author">{children}</Link>
            ) : (
              <span className="post-author">{children}</span>
            );
          return (
            <div className="post-author-block">
              {wrap(<Avatar src={post.profile_picture || post.author_picture || post.owner_picture} name={authorName} size={44} decorative />)}
              <div className="author-info">
                {wrap(<h4>{authorName}</h4>)}
              <p className="post-time">
                {postId ? (
                  <Link to={`/posts/${postId}`} className="post-time-link" title={formatDateTime(post.created_at)}>
                    {timeAgo(post.created_at)}
                  </Link>
                ) : (
                  <span title={formatDateTime(post.created_at)}>{timeAgo(post.created_at)}</span>
                )}
                <span aria-hidden="true"> · </span>
                <span className="post-visibility" title={`Visible to: ${visibilityMeta.label}`}>
                  <VisibilityIcon aria-hidden="true" />
                  <span className="sr-only">Visible to </span>
                  {visibilityMeta.label}
                </span>
              </p>
              </div>
            </div>
          );
        })()}

        {isOwner && !editing && (
          <div className="post-menu" ref={postMenuRef}>
            <button
              className="post-menu-trigger"
              type="button"
              aria-label="Post actions"
              aria-haspopup="menu"
              aria-expanded={showPostMenu}
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
              <option value="private">Only me</option>
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
                        aria-label="Remove photo"
                        onClick={() => {
                          setEditMediaToDelete((prev) => [...prev, media.url]);
                        }}
                      >
                        <FaTimes aria-hidden="true" />
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
                          aria-label="Remove file"
                        >
                          <FaTimes aria-hidden="true" />
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
          displayContent && (
            <>
              <p className={`post-text ${isLongText && !textExpanded ? 'clamped' : ''}`}>
                {renderContentWithHashtags(displayContent)}
              </p>
              {isLongText && (
                <button type="button" className="post-more" onClick={() => setTextExpanded((open) => !open)}>
                  {textExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </>
          )
        )}
        
        {displayMediaItems.length > 0 && (
          <div className={`post-media ${displayMediaItems.length > 1 ? 'media-grid' : ''} media-count-${Math.min(displayMediaItems.length, 4)}`}>
            {displayMediaItems.map((media, index) => (
              <div key={index} className="media-item">
                {media.type === 'video' ? (
                  <video src={media.url} controls preload="metadata" />
                ) : (
                  <img src={media.url} alt={`Photo ${index + 1} by ${authorName}`} loading="lazy" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="post-actions">
        <button
          type="button"
          className={`action-btn ${liked ? 'liked' : ''}`}
          onClick={handleLike}
          disabled={readOnly}
          aria-pressed={liked}
          aria-label={`${liked ? 'Unlike' : 'Like'}, ${likesCount} likes`}
        >
          <span className={`like-icon ${likePop ? 'pop' : ''}`} onAnimationEnd={() => setLikePop(false)}>
            {liked ? <FaHeart aria-hidden="true" /> : <FaRegHeart aria-hidden="true" />}
          </span>
          <span>{likesCount > 0 ? likesCount : 'Like'}</span>
        </button>
        <button
          type="button"
          className={`action-btn ${showComments ? 'active' : ''}`}
          onClick={() => setShowComments(!showComments)}
          aria-expanded={showComments}
          aria-label={`Comments, ${commentsCount}`}
        >
          <FaRegComment aria-hidden="true" />
          <span>{commentsCount > 0 ? commentsCount : 'Comment'}</span>
        </button>
        <button type="button" className="action-btn" onClick={handleShare} aria-haspopup="dialog" aria-label="Share post">
          <FaShareAlt aria-hidden="true" />
          <span>Share</span>
        </button>
      </div>

      {showShare && (
        <ShareModal url={`${window.location.origin}/posts/${postId}`} title="Share post" onClose={closeShare} />
      )}

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
