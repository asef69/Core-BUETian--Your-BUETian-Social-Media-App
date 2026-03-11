import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaBookOpen, FaComments, FaHome, FaStore, FaUsers } from 'react-icons/fa';
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

  useEffect(() => {
    loadFeed();
  }, []);

  const normalizePost = (post) => {
    const userFromObject = post.user || post.author || {};

    return {
      ...post,
      user_id: post.user_id || post.author_id || userFromObject.id,
      user_name: post.user_name || post.author_name || userFromObject.name,
      profile_picture:
        post.profile_picture ||
        post.user_picture ||
        post.author_picture ||
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

  const loadFeed = async () => {
    try {
      setLoading(true);
      const response = await postAPI.getFeed(page);
      const { items, next } = extractPosts(response.data);
      const normalizedPosts = items.map(normalizePost);
      setPosts(normalizedPosts);
      setHasMore(!!next);
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
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
      const response = await postAPI.getFeed(page + 1);
      const { items, next } = extractPosts(response.data);
      const normalizedPosts = items.map(normalizePost);
      setPosts([...posts, ...normalizedPosts]);
      setPage(page + 1);
      setHasMore(!!next);
    } catch (error) {
      console.error('Error loading more posts:', error);
    }
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
                      {hasMore && (
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
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
