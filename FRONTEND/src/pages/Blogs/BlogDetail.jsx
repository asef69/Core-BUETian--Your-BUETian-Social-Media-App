import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { blogAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import { FaHeart, FaRegHeart, FaEdit, FaArrowLeft, FaExclamationCircle } from 'react-icons/fa';
import Avatar from '../../components/common/Avatar';
import { useAuth } from '../../context/AuthContext';
import '../../styles/Blogs.css';
import { timeAgo, formatDate, toTimestamp, parseServerDate } from '../../utils/time';

const BlogDetail = () => {
  const { blogId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [blog, setBlog] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);
  const [replyingComments, setReplyingComments] = useState({});
  const [replyContent, setReplyContent] = useState({});

  const currentUserId = user?.id;
  const isAuthor = String(blog?.author_id || '') === String(currentUserId || '');
  const canEdit = Boolean(blog?.can_edit ?? isAuthor);
  const isDraftOrScheduled = useMemo(() => {
    if (!blog) return false;

    if (!blog.is_published) return true;

    if (blog.scheduled_publish_at) {
      const scheduledAt = parseServerDate(blog.scheduled_publish_at) || new Date(NaN);
      if (Number.isNaN(scheduledAt.getTime()) || scheduledAt > new Date()) {
        return true;
      }
    }

    return false;
  }, [blog]);

  const normalizeComment = (comment) => ({
    ...comment,
    id: comment.id || comment.comment_id,
    comment_id: comment.comment_id || comment.id,
    parent_comment_id: comment.parent_comment_id || null,
    likes_count: Number(comment.likes_count) || 0,
    liked: Boolean(comment.liked ?? comment.is_liked ?? false),
  });

  const loadComments = async () => {
    const commentsRes = await blogAPI.getComments(blogId);
    const raw = Array.isArray(commentsRes.data)
      ? commentsRes.data
      : commentsRes.data?.results || [];
    setComments(raw.map(normalizeComment));
  };

  const loadBlog = async () => {
    try {
      const [blogRes, commentsRes] = await Promise.all([
        blogAPI.getBlogDetail(blogId),
        blogAPI.getComments(blogId),
      ]);
      const blogData = blogRes.data || null;
      setBlog(blogData);
      setLiked(Boolean(blogData?.is_liked));
      const rawComments = Array.isArray(commentsRes.data) ? commentsRes.data : commentsRes.data?.results || [];
      setComments(rawComments.map(normalizeComment));

      const scheduledAt = blogData?.scheduled_publish_at ? parseServerDate(blogData.scheduled_publish_at) : null;
      const isFutureScheduled = Boolean(
        blogData?.scheduled_publish_at && (!scheduledAt || scheduledAt > new Date()),
      );
      const canTrackView = Boolean(blogData?.is_published) && !isFutureScheduled;

      if (canTrackView && !location.state?.viewTracked) {
        try {
          const trackRes = await blogAPI.trackView(blogId);
          const nextViews = trackRes?.data?.views_count;
          if (typeof nextViews === 'number') {
            setBlog((prev) => (prev ? { ...prev, views_count: nextViews } : prev));
          }
        } catch (error) {
          // Keep page usable even if view tracking fails.
        }
      }
    } catch (error) {
      toast.error('Failed to load blog post');
      setBlog(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    loadBlog();
  }, [blogId, location.state]);

  const handleLike = async () => {
    if (isDraftOrScheduled) {
      toast.info('You have no access to like in draft mode');
      return;
    }

    try {
      const response = await blogAPI.toggleLike(blogId);
      const nextLiked = response?.data?.liked ?? !liked;
      const nextLikesCount =
        typeof response?.data?.likes_count === 'number'
          ? response.data.likes_count
          : (nextLiked ? (Number(blog?.likes_count) || 0) + 1 : Math.max(0, (Number(blog?.likes_count) || 0) - 1));

      setLiked(Boolean(nextLiked));
      setBlog((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          likes_count: nextLikesCount,
          is_liked: Boolean(nextLiked),
        };
      });
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update like');
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    try {
      await blogAPI.addComment(blogId, { content: commentText.trim() });
      setCommentText('');
      await loadComments();
      setBlog((prev) => ({
        ...prev,
        comments_count: (Number(prev?.comments_count) || 0) + 1,
      }));
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const toggleReply = (commentId) => {
    setReplyingComments((prev) => ({
      ...prev,
      [commentId]: !prev[commentId],
    }));
  };

  const handleReplySubmit = async (e, parentCommentId) => {
    e.preventDefault();
    const content = replyContent[parentCommentId]?.trim();
    if (!content) return;

    try {
      await blogAPI.addComment(blogId, { content, parent_comment_id: parentCommentId });
      setReplyContent((prev) => ({ ...prev, [parentCommentId]: '' }));
      setReplyingComments((prev) => ({ ...prev, [parentCommentId]: false }));
      await loadComments();
      setBlog((prev) => ({
        ...prev,
        comments_count: (Number(prev?.comments_count) || 0) + 1,
      }));
    } catch (error) {
      toast.error('Failed to add reply');
    }
  };

  const handleCommentLove = async (commentId) => {
    try {
      const response = await blogAPI.likeComment(commentId);
      setComments((prev) =>
        prev.map((comment) =>
          comment.comment_id === commentId
            ? {
                ...comment,
                liked: response?.data?.liked ?? !comment.liked,
                likes_count:
                  typeof response?.data?.likes_count === 'number'
                    ? response.data.likes_count
                    : comment.liked
                      ? Math.max(0, comment.likes_count - 1)
                      : comment.likes_count + 1,
              }
            : comment,
        ),
      );
    } catch (error) {
      toast.error('Failed to update comment love');
    }
  };

  const commentMap = useMemo(() => {
    const map = new Map();
    comments.forEach((comment) => map.set(Number(comment.comment_id), comment));
    return map;
  }, [comments]);

  const repliesByParent = useMemo(() => {
    const grouped = new Map();
    comments.forEach((comment) => {
      const parentIdRaw = comment.parent_comment_id;
      const parentId = parentIdRaw == null ? null : Number(parentIdRaw);
      const key = parentId && commentMap.has(parentId) ? parentId : null;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(comment);
    });
    grouped.forEach((arr) => {
      arr.sort((a, b) => {
        const aTime = toTimestamp(a.created_at);
        const bTime = toTimestamp(b.created_at);
        return aTime - bTime;
      });
    });
    return grouped;
  }, [comments, commentMap]);

  const renderContentWithHashtags = (text, lineKeyPrefix = 'line') => {
    const raw = String(text || '');
    const parts = raw.split(/(#[A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)*)/g);
    return parts.map((part, index) => {
      if (/^#[A-Za-z0-9_]+(?:\/[A-Za-z0-9_]+)*$/.test(part)) {
        const tag = part.slice(1);
        return (
          <Link
            key={`${lineKeyPrefix}-tag-${tag}-${index}`}
            to={`/blogs?tag=${encodeURIComponent(tag)}`}
            className="blog-inline-hashtag"
          >
            {part}
          </Link>
        );
      }
      return <React.Fragment key={`${lineKeyPrefix}-text-${index}`}>{part}</React.Fragment>;
    });
  };

  const renderCommentNode = (comment, depth = 0, visited = new Set()) => {
    const commentId = Number(comment.comment_id);
    if (!commentId || visited.has(commentId)) return null;

    const branchVisited = new Set(visited);
    branchVisited.add(commentId);
    const children = repliesByParent.get(commentId) || [];

    return (
      <div key={commentId} className="comment-thread" style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 18}px` : 0 }}>
        <div className="comment">
          <Avatar src={comment.user_picture} name={comment.user_name} size={36} className="comment-avatar" decorative />
          <div className="comment-content">
            <div className="comment-header">
              <div className="comment-meta">
                <strong className="comment-author">{comment.user_name || 'User'}</strong>
                <span className="comment-time">{timeAgo(comment.created_at)}</span>
              </div>
            </div>
            <p>{comment.content}</p>
            <div className="comment-actions-row">
              <button
                className={`comment-like-btn ${comment.liked ? 'liked' : ''}`}
                type="button"
                onClick={() => handleCommentLove(comment.comment_id)}
              >
                {comment.liked ? <FaHeart /> : <FaRegHeart />}
                <span className="comment-action-label">Love</span>
                {comment.likes_count > 0 ? <span className="count-pill">{comment.likes_count}</span> : null}
              </button>
              <button className="btn-reply" type="button" onClick={() => toggleReply(comment.comment_id)}>
                {replyingComments[comment.comment_id] ? 'Hide' : 'Reply'}
              </button>
            </div>

            {replyingComments[comment.comment_id] && (
              <form className="edit-comment-form reply-box" onSubmit={(e) => handleReplySubmit(e, comment.comment_id)}>
                <textarea
                  value={replyContent[comment.comment_id] || ''}
                  onChange={(e) => setReplyContent((prev) => ({ ...prev, [comment.comment_id]: e.target.value }))}
                  rows="2"
                  placeholder="Write a reply..."
                />
                <div className="edit-actions reply-actions">
                  <button type="submit" className="save-btn reply-submit-btn">Post</button>
                  <button type="button" className="cancel-btn reply-cancel-btn" onClick={() => toggleReply(comment.comment_id)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>

        {children.length > 0 && (
          <div className="comment-children">
            {children.map((child) => renderCommentNode(child, depth + 1, branchVisited))}
          </div>
        )}
      </div>
    );
  };

  const handleEditFromDetail = () => {
    if (!blog) return;

    const blogForEdit = {
      ...blog,
      blog_id: blog.blog_id || blog.id || Number(blogId),
    };

    navigate('/blogs', {
      state: { editBlog: blogForEdit },
    });
  };

  const shell = (children) => (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container blog-detail-layout">{children}</div>
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="blog-article" aria-busy="true" aria-label="Loading blog post">
        <span className="skel blog-skel-hero" />
        <div className="blog-article-header">
          <span className="skel blog-skel-line" style={{ width: '70%', height: 32 }} />
          <span className="skel blog-skel-line" style={{ width: '35%' }} />
        </div>
      </div>,
    );
  }

  if (!blog) {
    return shell(
      <div className="state-card" role="alert">
        <FaExclamationCircle aria-hidden="true" />
        <strong>We couldn't find this post</strong>
        <p>It may have been removed, or the connection dropped.</p>
        <div className="state-card-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadBlog()}>
            Try again
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/blogs')}>
            Back to blogs
          </button>
        </div>
      </div>,
    );
  }

  const words = String(blog.content || '').trim().split(/\s+/).filter(Boolean).length;
  const readingMinutes = Math.max(1, Math.round(words / 200));
  const commentTotal = blog.comments_count || comments.length || 0;

  return shell(
    <>
      <button type="button" className="back-link" onClick={() => navigate('/blogs')}>
        <FaArrowLeft aria-hidden="true" /> All blogs
      </button>

      <article className="blog-article">
        {blog.cover_image && <img src={blog.cover_image} alt="" className="blog-detail-cover" />}

        <div className="blog-article-header">
          {blog.category && <span className="blog-category-chip">{blog.category}</span>}
          <h1>{blog.title}</h1>
          <div className="blog-byline">
            <Avatar src={blog.author_picture || blog.author_profile_picture} name={blog.author_name} size={40} decorative />
            <div>
              <strong>{blog.author_name || 'Unknown author'}</strong>
              <span>
                {formatDate(blog.published_at || blog.created_at)} · {readingMinutes} min read
              </span>
            </div>
          </div>
        </div>

        <div className="blog-content-block">
          {String(blog.content || '').split('\n').map((line, idx) =>
            line.trim() ? <p key={`line-${idx}`}>{renderContentWithHashtags(line, `line-${idx}`)}</p> : null,
          )}
        </div>

        {Array.isArray(blog.tags) && blog.tags.length > 0 && (
          <div className="blog-tags">
            {blog.tags.map((tag, index) => {
              const normalizedTag = String(tag || '').replace(/^#/, '').trim();
              if (!normalizedTag) return null;
              return (
                <Link
                  key={`${normalizedTag}-${index}`}
                  to={`/blogs?tag=${encodeURIComponent(normalizedTag)}`}
                  className="blog-tag blog-tag-link"
                >
                  #{normalizedTag}
                </Link>
              );
            })}
          </div>
        )}

        <div className="blog-actions-row">
          <button
            type="button"
            className={`blog-like-btn ${liked ? 'liked' : ''}`}
            onClick={handleLike}
            disabled={isDraftOrScheduled}
            aria-pressed={liked}
          >
            {liked ? <FaHeart aria-hidden="true" /> : <FaRegHeart aria-hidden="true" />}
            {liked ? 'Liked' : 'Like'} <span>{blog.likes_count || 0}</span>
          </button>
          {canEdit && (
            <button className="btn btn-secondary btn-sm" type="button" onClick={handleEditFromDetail}>
              <FaEdit aria-hidden="true" /> Edit post
            </button>
          )}
          <span className="blog-stat">{blog.views_count || 0} views</span>
        </div>
      </article>

      <section className="blog-comments-panel" aria-labelledby="blog-comments-title">
        <h2 id="blog-comments-title">Comments <span>{commentTotal}</span></h2>
        <form onSubmit={handleComment} className="comment-form">
          <input
            type="text"
            placeholder="Write a comment"
            aria-label="Write a comment"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
          />
          <button type="submit" disabled={!commentText.trim()}>Post</button>
        </form>

        <div className="comments-list">
          {comments.length === 0 ? (
            <p className="comments-note">No comments yet. Start the conversation.</p>
          ) : (
            (repliesByParent.get(null) || []).map((comment) => renderCommentNode(comment))
          )}
        </div>
      </section>
    </>,
  );
};

export default BlogDetail;
