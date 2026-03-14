import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaBookOpen, FaComments, FaHome, FaPenFancy, FaStore, FaUsers } from 'react-icons/fa';
import { postAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import CreatePost from '../../components/Posts/CreatePost';
import PostCard from '../../components/Posts/PostCard';
import SuggestedUsers from '../../components/Users/SuggestedUsers';
import { useAuth } from '../../context/AuthContext';
import '../../styles/Home.css';

const Home = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [feedMode, setFeedMode] = useState('following');
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [activeHashtag, setActiveHashtag] = useState('');
  const [mediaFilter, setMediaFilter] = useState('all');

  useEffect(() => {
    loadFeed(1);
    loadTrendingHashtags();
  }, [feedMode, activeHashtag, mediaFilter]);

  const normalizePost = (post) => {
    const userFromObject = post.user || post.author || {};

    return {
      ...post,
      id: post.id || post.post_id,
      post_id: post.post_id || post.id,
      user_id:
        post.user_id ||
        post.author_id ||
        post.owner_id ||
        post.created_by ||
        post.created_by_id ||
        userFromObject.id,
      user_name:
        post.user_name ||
        post.author_name ||
        post.owner_name ||
        post.created_by_name ||
        post.username ||
        post.name ||
        userFromObject.name,
      profile_picture:
        post.profile_picture ||
        post.user_picture ||
        post.author_picture ||
        post.owner_picture ||
        post.created_by_picture ||
        userFromObject.profile_picture,
    };
  };

  const extractPosts = (data) => {
    if (Array.isArray(data)) {
      return { items: data, next: null };
    }

    if (Array.isArray(data?.results)) {
      return { items: data.results, next: data.next };
    }

    if (Array.isArray(data?.posts)) {
      return { items: data.posts, next: data.next };
    }

    return { items: [], next: null };
  };

  const loadFeed = async (requestedPage = 1) => {
    try {
      setLoading(true);
      let response;

      if (feedMode === 'trending') {
        response = await postAPI.getTrending();
      } else if (feedMode === 'hashtag' && activeHashtag) {
        response = await postAPI.getPostsByHashtag(activeHashtag);
      } else if (mediaFilter !== 'all') {
        response = await postAPI.getPostsByMediaType(mediaFilter, 30);
      } else {
        const [followingRes, publicRes] = await Promise.all([
          postAPI.getFeed(requestedPage),
          postAPI.getPublicPosts(30),
        ]);

        const followingItems = extractPosts(followingRes.data).items;
        const publicItems = extractPosts(publicRes.data).items;
        const mergedMap = new Map();

        [...followingItems, ...publicItems].forEach((item) => {
          const normalized = normalizePost(item);
          const key = normalized.id || normalized.post_id;
          if (key) {
            mergedMap.set(key, normalized);
          }
        });

        const mergedPosts = Array.from(mergedMap.values()).sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        });

        setPosts(mergedPosts);
        setHasMore(false);
        setPage(requestedPage);
        return;
      }

      const { items, next } = extractPosts(response.data);
      const normalizedPosts = items.map(normalizePost);
      setPosts(normalizedPosts);
      setHasMore(feedMode === 'following' && mediaFilter === 'all' ? !!next : false);
      setPage(requestedPage);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrendingHashtags = async () => {
    try {
      const response = await postAPI.getTrendingHashtags(10);
      const items = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
      setTrendingHashtags(items);
    } catch (error) {
      setTrendingHashtags([]);
    }
  };

  const handlePostCreated = (newPost) => {
    const normalizedPost = normalizePost(newPost);
    setPosts([normalizedPost, ...posts]);
  };

  const handlePostLike = (postId) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          has_liked: !post.has_liked,
          likes_count: post.has_liked ? post.likes_count - 1 : post.likes_count + 1
        };
      }
      return post;
    }));
  };

  const loadMore = async () => {
    try {
      const nextPage = page + 1;
      const response = await postAPI.getFeed(nextPage);
      const { items, next } = extractPosts(response.data);
      const normalizedPosts = items.map(normalizePost);
      setPosts([...posts, ...normalizedPosts]);
      setPage(nextPage);
      setHasMore(!!next);
    } catch (error) {
      console.error('Error loading more posts:', error);
    }
  };

  const switchMode = (mode) => {
    setFeedMode(mode);
    if (mode !== 'hashtag') {
      setActiveHashtag('');
    }
  };

  const applyHashtag = (tag) => {
    setActiveHashtag(tag);
    setFeedMode('hashtag');
    setMediaFilter('all');
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="home-layout">
            <aside className="left-rail">
              <div className="sidebar-card left-rail-card">
                <h3>{user?.name ? `${user.name}'s Space` : 'Your Space'}</h3>
                <p>Jump back into your favorite sections.</p>
                <div className="shortcut-list">
                  <Link to="/" className="shortcut-item">
                    <FaHome />
                    <span>News Feed</span>
                  </Link>
                  <Link to="/groups" className="shortcut-item">
                    <FaUsers />
                    <span>Groups</span>
                  </Link>
                  <Link to="/chat" className="shortcut-item">
                    <FaComments />
                    <span>Messages</span>
                  </Link>
                  <Link to="/marketplace" className="shortcut-item">
                    <FaStore />
                    <span>Marketplace</span>
                  </Link>
                  <Link to="/blogs" className="shortcut-item">
                    <FaPenFancy />
                    <span>Blogs</span>
                  </Link>
                  <Link to="/forums" className="shortcut-item">
                    <FaBookOpen />
                    <span>Forums</span>
                  </Link>
                </div>
              </div>
            </aside>

            <main className="feed-section">
              <div className="feed-headline">
                <h2>Home Feed</h2>
                <span>See what your network is sharing right now</span>
                <div className="feed-filters">
                  <button className={`filter-chip ${feedMode === 'following' ? 'active' : ''}`} onClick={() => switchMode('following')}>
                    Following
                  </button>
                  <button className={`filter-chip ${feedMode === 'trending' ? 'active' : ''}`} onClick={() => switchMode('trending')}>
                    Trending
                  </button>
                  {activeHashtag && (
                    <button className={`filter-chip ${feedMode === 'hashtag' ? 'active' : ''}`} onClick={() => switchMode('hashtag')}>
                      #{activeHashtag}
                    </button>
                  )}
                  <select
                    className="filter-chip filter-select"
                    value={mediaFilter}
                    onChange={(e) => {
                      setMediaFilter(e.target.value);
                      setFeedMode('following');
                    }}
                  >
                    <option value="all">All media</option>
                    <option value="image">Images</option>
                    <option value="video">Videos</option>
                    <option value="text">Text</option>
                  </select>
                </div>
              </div>

              <CreatePost onPostCreated={handlePostCreated} />

              {loading ? (
                <div className="loading">Loading feed...</div>
              ) : (
                <>
                  {posts.length === 0 ? (
                    <div className="no-posts">
                      <p>No posts yet. Be the first to share something!</p>
                    </div>
                  ) : (
                    <>
                      {posts.map((post) => (
                        <PostCard
                          key={post.id}
                          post={post}
                          onLike={handlePostLike}
                        />
                      ))}
                      {hasMore && feedMode === 'following' && mediaFilter === 'all' && (
                        <button onClick={loadMore} className="btn btn-secondary load-more">
                          Load More Stories
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </main>

            <aside className="sidebar">
              <div className="sidebar-label">People you may know</div>
              <SuggestedUsers />
              <div className="sidebar-card" style={{ marginTop: '12px' }}>
                <h3>Trending Hashtags</h3>
                {trendingHashtags.length === 0 ? (
                  <p className="text-muted">No hashtag trends yet</p>
                ) : (
                  <div className="hashtag-list">
                    {trendingHashtags.map((item, index) => {
                      const tag = item.hashtag || item.tag || item.name;
                      if (!tag) return null;
                      return (
                        <button
                          key={`${tag}-${index}`}
                          type="button"
                          className="hashtag-chip"
                          onClick={() => applyHashtag(tag)}
                        >
                          <span className="hashtag-chip-tag">#{tag}</span>
                          <span className="hashtag-chip-meta">
                            {item.post_count ?? 0} posts · {item.total_engagement ?? 0} 🔥
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
