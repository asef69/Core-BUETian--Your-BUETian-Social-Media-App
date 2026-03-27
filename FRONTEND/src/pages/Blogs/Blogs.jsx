import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import { blogAPI, postAPI } from '../../services/apiService';
import { toast } from 'react-toastify';
import { FaImage, FaPlus, FaSearch, FaTimes } from 'react-icons/fa';
import { validateImageFile } from '../../utils/validation';
import '../../styles/Blogs.css';

const BLOG_CATEGORIES = [
  'Technology',
  'Academics',
  'Campus Life',
  'Career & Internship',
  'Research',
  'Events',
  'Clubs & Societies',
  'Study Resources',
  'Personal Development',
  'Alumni Stories',
  'Entrepreneurship',
  'Announcements',
];


const Blogs = () => {
  const navigate = useNavigate();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [categoryMode, setCategoryMode] = useState('preset');
  const [customCategory, setCustomCategory] = useState('');
  const [coverImageFile, setCoverImageFile] = useState(null);
  const [coverImagePreview, setCoverImagePreview] = useState('');
  const [creating, setCreating] = useState(false);
  const [createData, setCreateData] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: BLOG_CATEGORIES[0],
    tags: '',
    is_published: true,
  });
  const [tab, setTab] = useState('all'); // 'all' or 'drafts'

  // Fetch blogs for the selected tab
  const loadBlogs = async (selectedTab = tab) => {
    try {
      setLoading(true);
      let response;
      if (selectedTab === 'drafts') {
        response = await blogAPI.getMyBlogs({ is_published: false });
      } else {
        response = await blogAPI.getPublishedBlogs();
      }
      const items = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
      setBlogs(items);
    } catch (error) {
      toast.error('Failed to load blogs');
      setBlogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBlogs(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const getBlogId = (blog) => blog?.blog_id || blog?.id || blog?.pk;

  const filteredBlogs = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return blogs;
    return blogs.filter((blog) => {
      const title = String(blog.title || '').toLowerCase();
      const excerpt = String(blog.excerpt || '').toLowerCase();
      const author = String(blog.author_name || '').toLowerCase();
      const category = String(blog.category || '').toLowerCase();
      return title.includes(query) || excerpt.includes(query) || author.includes(query) || category.includes(query);
    });
  }, [blogs, searchText]);

  const handleCreateBlog = async (e) => {
    e.preventDefault();
    setCreating(true);

    const normalizedCategory = categoryMode === 'custom'
      ? customCategory.trim()
      : createData.category;

    let uploadedCoverImage = null;

    if (coverImageFile) {
      const coverFormData = new FormData();
      coverFormData.append('media', coverImageFile);
      coverFormData.append('media_type', 'image');

      try {
        const uploadRes = await postAPI.uploadMedia(coverFormData);
        const uploadedFiles = Array.isArray(uploadRes.data?.uploaded_files)
          ? uploadRes.data.uploaded_files
          : [];

        uploadedCoverImage = uploadedFiles[0]?.url || null;
      } catch (error) {
        toast.error(error?.response?.data?.error || 'Failed to upload cover image');
        setCreating(false);
        return;
      }
    }

    const tags = createData.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      title: createData.title,
      excerpt: createData.excerpt || null,
      content: createData.content,
      category: normalizedCategory || null,
      cover_image: uploadedCoverImage,
      is_published: createData.is_published,
      tags,
    };

    try {
      await blogAPI.createBlog(payload);
      toast.success('Blog post created successfully');
      setShowCreateModal(false);
      setCreateData({
        title: '',
        excerpt: '',
        content: '',
        category: BLOG_CATEGORIES[0],
        tags: '',
        is_published: true,
      });
      setCategoryMode('preset');
      setCustomCategory('');
      setCoverImageFile(null);
      setCoverImagePreview('');
      loadBlogs();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to create blog post');
    } finally {
      setCreating(false);
    }
  };

  const handleCoverImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setCoverImageFile(file);
    setCoverImagePreview(URL.createObjectURL(file));
  };

  const handleBlogCardClick = async (event, blogId) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();

    setBlogs((currentBlogs) => currentBlogs.map((blog) => {
      if (getBlogId(blog) !== blogId) return blog;
      return {
        ...blog,
        views_count: (Number(blog.views_count) || 0) + 1,
      };
    }));

    try {
      await blogAPI.trackView(blogId);
      navigate(`/blogs/${blogId}`, { state: { viewTracked: true } });
    } catch (error) {
      navigate(`/blogs/${blogId}`);
    }
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="blogs-header">
            <div>
              <h1>Blogs</h1>
              <p>Write long-form posts, ideas, and tutorials for the community.</p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                setCategoryMode('preset');
                setCustomCategory('');
                setCoverImageFile(null);
                setCoverImagePreview('');
                setCreateData((prev) => ({
                  ...prev,
                  category: prev.category || BLOG_CATEGORIES[0],
                }));
                setShowCreateModal(true);
              }}
            >
              <FaPlus /> New Blog
            </button>
          </div>

          {/* Tab navigation */}
          <div className="blogs-tabs" style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
            <button
              className={tab === 'all' ? 'blogs-tab active' : 'blogs-tab'}
              onClick={() => setTab('all')}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: tab === 'all' ? 'var(--primary-color)' : 'var(--surface-soft)', color: tab === 'all' ? '#fff' : 'var(--muted-color)', fontWeight: 600, cursor: 'pointer' }}
            >
              All Blogs
            </button>
            <button
              className={tab === 'drafts' ? 'blogs-tab active' : 'blogs-tab'}
              onClick={() => setTab('drafts')}
              style={{ padding: '7px 18px', borderRadius: 8, border: 'none', background: tab === 'drafts' ? 'var(--primary-color)' : 'var(--surface-soft)', color: tab === 'drafts' ? '#fff' : 'var(--muted-color)', fontWeight: 600, cursor: 'pointer' }}
            >
              My Drafts
            </button>
          </div>

          <div className="blogs-search">
            <FaSearch />
            <input
              type="text"
              placeholder={tab === 'drafts' ? 'Search your drafts...' : 'Search by title, author, category...'}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading">Loading blogs...</div>
          ) : filteredBlogs.length === 0 ? (
            <div className="empty-state">{tab === 'drafts' ? 'No draft blogs found.' : 'No blog posts found.'}</div>
          ) : (
            <div className="blogs-grid">
              {filteredBlogs.map((blog) => {
                const blogId = getBlogId(blog);
                if (!blogId) return null;

                return (
                  <Link
                    key={blogId}
                    to={`/blogs/${blogId}`}
                    className="blog-card"
                    onClick={(event) => handleBlogCardClick(event, blogId)}
                  >
                    {blog.cover_image ? (
                      <div className="blog-cover-wrap">
                        <img src={blog.cover_image} alt={blog.title} className="blog-cover" />
                        {blog.category && <span className="blog-cover-badge">{blog.category}</span>}
                      </div>
                    ) : (
                      <div className="blog-cover-placeholder">
                        <span className="blog-cover-initial">{String(blog.title || '?')[0].toUpperCase()}</span>
                        {blog.category && <span className="blog-cover-badge">{blog.category}</span>}
                      </div>
                    )}
                    <div className="blog-card-content">
                      <h3>{blog.title}</h3>
                      <p className="blog-card-excerpt">{blog.excerpt || String(blog.content || '').slice(0, 120)}</p>
                      <div className="blog-card-footer">
                        <span className="blog-card-author">{blog.author_name || 'Unknown'}</span>
                        <span className="blog-card-stats">{blog.views_count || 0} views · {blog.likes_count || 0} likes</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content blog-modal" onClick={(e) => e.stopPropagation()}>
            <div className="blog-modal-header">
              <div className="blog-modal-header-flex">
                <div>
                  <h2 className="blog-modal-title">Create Blog Post</h2>
                  <p className="blog-modal-subtitle">Share your ideas with the BUET community</p>
                </div>
                <button type="button" className="modal-close-btn" aria-label="Close" onClick={() => setShowCreateModal(false)}>
                  <FaTimes />
                </button>
              </div>
              <form onSubmit={handleCreateBlog} className="blog-create-form animate-fade-in">
                <div className="form-group">
                  <label htmlFor="blog-title">Title</label>
                  <input
                    id="blog-title"
                    type="text"
                    className="input-lg"
                    value={createData.title}
                    onChange={(e) => setCreateData({ ...createData, title: e.target.value })}
                    required
                    maxLength={120}
                    placeholder="Enter a catchy title"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="blog-excerpt">Short Summary <span className="optional">(Optional)</span></label>
                  <textarea
                    id="blog-excerpt"
                    rows="2"
                    className="input-md"
                    value={createData.excerpt}
                    onChange={(e) => setCreateData({ ...createData, excerpt: e.target.value })}
                    placeholder="Write 1-2 lines that describe your blog. This will show on the blog card."
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="blog-content">Content</label>
                  <textarea
                    id="blog-content"
                    rows="8"
                    className="input-md"
                    value={createData.content}
                    onChange={(e) => setCreateData({ ...createData, content: e.target.value })}
                    required
                    placeholder="Write your blog post here..."
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Category</label>
                    <div className="blog-cat-toggle">
                      <button
                        type="button"
                        className={`blog-cat-option${categoryMode === 'preset' ? ' active' : ''}`}
                        onClick={() => setCategoryMode('preset')}
                        tabIndex={0}
                      >
                        Choose from list
                      </button>
                      <button
                        type="button"
                        className={`blog-cat-option${categoryMode === 'custom' ? ' active' : ''}`}
                        onClick={() => setCategoryMode('custom')}
                        tabIndex={0}
                      >
                        Custom
                      </button>
                    </div>
                    {categoryMode === 'preset' ? (
                      <select
                        className="input-md"
                        value={createData.category}
                        onChange={(e) => setCreateData({ ...createData, category: e.target.value })}
                      >
                        {BLOG_CATEGORIES.map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className="input-md"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="e.g. Open Source, Mental Health"
                        required
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Cover Image <span className="optional">(Optional)</span></label>
                    {coverImagePreview ? (
                      <div className="blog-upload-preview-wrap animate-fade-in">
                        <img src={coverImagePreview} alt="Cover preview" className="blog-cover-preview" />
                        <button
                          type="button"
                          className="blog-upload-remove"
                          onClick={() => { setCoverImageFile(null); setCoverImagePreview(''); }}
                        >
                          <FaTimes /> Remove
                        </button>
                      </div>
                    ) : (
                      <label className="blog-upload-zone">
                        <FaImage className="blog-upload-icon" />
                        <span>Click to upload a cover photo</span>
                        <span className="blog-upload-hint">JPG, PNG, GIF, WEBP &mdash; max 5 MB</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverImageChange}
                          style={{ display: 'none' }}
                        />
                      </label>
                    )}
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="blog-tags">Tags <span className="optional">(comma separated)</span></label>
                  <input
                    id="blog-tags"
                    type="text"
                    className="input-md"
                    value={createData.tags}
                    onChange={(e) => setCreateData({ ...createData, tags: e.target.value })}
                    placeholder="react, django, buet"
                  />
                </div>
                <div className="form-group form-checkbox">
                  <label htmlFor="blog-publish">
                    <input
                      id="blog-publish"
                      type="checkbox"
                      checked={createData.is_published}
                      onChange={(e) => setCreateData({ ...createData, is_published: e.target.checked })}
                    />{' '}
                    Publish immediately
                  </label>
                </div>
                <div className="modal-actions">
                  <button className="btn btn-primary btn-lg" type="submit" disabled={creating}>
                    {creating ? 'Publishing...' : 'Publish Blog'}
                  </button>
                  <button className="btn btn-secondary btn-lg" type="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
          </div>
        )}
    </div>
  );
};

export default Blogs;
