import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { blogAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import moment from 'moment';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import '../../styles/Blogs.css';

const BlogDetail = () => {
  const { blogId } = useParams();
  const location = useLocation();
  const [blog, setBlog] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);
  const [replyingComments, setReplyingComments] = useState({});
  const [replyContent, setReplyContent] = useState({});

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
      setLoading(true);
      if (!location.state?.viewTracked) {
        await blogAPI.trackView(blogId);
      }
      const [blogRes, commentsRes] = await Promise.all([
        blogAPI.getBlogDetail(blogId),
        blogAPI.getComments(blogId),
      ]);
      const blogData = blogRes.data || null;
      setBlog(blogData);
      setLiked(Boolean(blogData?.is_liked));
      const rawComments = Array.isArray(commentsRes.data) ? commentsRes.data : commentsRes.data?.results || [];
      setComments(rawComments.map(normalizeComment));
    } catch (error) {
      toast.error('Failed to load blog post');
      setBlog(null);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlog();
  }, [blogId, location.state]);

  const handleLike = async () => {
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
      toast.error('Failed to update like');
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
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return aTime - bTime;
      });
    });
    return grouped;
  }, [comments, commentMap]);

  const renderCommentNode = (comment, depth = 0, visited = new Set()) => {
    const commentId = Number(comment.comment_id);
    if (!commentId || visited.has(commentId)) return null;

    const branchVisited = new Set(visited);
    branchVisited.add(commentId);
    const children = repliesByParent.get(commentId) || [];

    return (
      <div key={commentId} className="comment-thread" style={{ marginLeft: depth > 0 ? `${Math.min(depth, 4) * 18}px` : 0 }}>
        <div className="comment">
          <img
            src={comment.user_picture || '/default-avatar.png'}
            alt={comment.user_name || 'User'}
            className="comment-avatar"
          />
          <div className="comment-content">
            <div className="comment-header">
              <div className="comment-meta">
                <strong className="comment-author">{comment.user_name || 'User'}</strong>
                <span className="comment-time">{moment.utc(comment.created_at).local().fromNow()}</span>
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

  if (loading) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="loading">Loading blog...</div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="error">Blog post not found</div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container blog-detail-layout">
          <article className="blog-article">
            {blog.cover_image && <img src={blog.cover_image} alt={blog.title} className="blog-detail-cover" />}
            <h1>{blog.title}</h1>
            <div className="blog-meta-row">
              <span>{blog.author_name || 'Unknown Author'}</span>
              <span>{blog.category || 'General'}</span>
              <span>{moment(blog.created_at || blog.published_at).format('MMM D, YYYY')}</span>
            </div>
            {Array.isArray(blog.tags) && blog.tags.length > 0 && (
              <div className="blog-tags">
                {blog.tags.map((tag, index) => (
                  <span key={`${tag}-${index}`} className="blog-tag">#{tag}</span>
                ))}
              </div>
            )}
            <div className="blog-actions-row">
              <button className="btn btn-primary" onClick={handleLike}>
                {liked ? 'Unlike' : 'Like'} ({blog.likes_count || 0})
              </button>
              <span>{blog.views_count || 0} views</span>
              <span>{blog.comments_count || comments.length || 0} comments</span>
            </div>
            <div className="blog-content-block">
              {String(blog.content || '').split('\n').map((line, idx) => (
                <p key={`line-${idx}`}>{line}</p>
              ))}
            </div>
          </article>

          <section className="blog-comments-panel">
            <h3>Comments</h3>
            <form onSubmit={handleComment} className="comment-form">
              <input
                type="text"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
              />
              <button className="btn btn-primary" type="submit">Post</button>
            </form>

            <div className="comments-list">
              {comments.length === 0 ? (
                <p className="text-muted">No comments yet.</p>
              ) : (
                (repliesByParent.get(null) || []).map((comment) => renderCommentNode(comment))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BlogDetail;
