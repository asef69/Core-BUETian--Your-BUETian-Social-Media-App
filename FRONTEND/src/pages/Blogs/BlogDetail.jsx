import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { blogAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import moment from 'moment';
import '../../styles/Blogs.css';

const BlogDetail = () => {
  const { blogId } = useParams();
  const location = useLocation();
  const [blog, setBlog] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [liked, setLiked] = useState(false);

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
      setBlog(blogRes.data || null);
      setComments(Array.isArray(commentsRes.data) ? commentsRes.data : commentsRes.data?.results || []);
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
      await blogAPI.toggleLike(blogId);
      setLiked((prev) => !prev);
      setBlog((prev) => {
        if (!prev) return prev;
        const current = Number(prev.likes_count) || 0;
        return {
          ...prev,
          likes_count: liked ? Math.max(0, current - 1) : current + 1,
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
      const refreshed = await blogAPI.getComments(blogId);
      setComments(Array.isArray(refreshed.data) ? refreshed.data : refreshed.data?.results || []);
      setBlog((prev) => ({
        ...prev,
        comments_count: (Number(prev?.comments_count) || 0) + 1,
      }));
    } catch (error) {
      toast.error('Failed to add comment');
    }
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
                comments.map((comment) => (
                  <div key={comment.id} className="comment">
                    <img
                      src={comment.user_picture || '/default-avatar.png'}
                      alt={comment.user_name || 'User'}
                      className="comment-avatar"
                    />
                    <div className="comment-content">
                      <div className="comment-header">
                        <strong>{comment.user_name || 'User'}</strong>
                        <span className="comment-time">{moment.utc(comment.created_at).local().fromNow()}</span>
                      </div>
                      <p>{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default BlogDetail;
