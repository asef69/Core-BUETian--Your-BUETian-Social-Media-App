import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { userAPI, postAPI, groupAPI, marketplaceAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import '../../styles/Search.css';

const Search = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (query) {
      performSearch();
    }
  }, [query]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const [usersRes, postsRes, groupsRes, productsRes] = await Promise.all([
        userAPI.searchUsers(query).catch(() => ({ data: { results: [] } })),
        postAPI.searchPosts(query).catch(() => ({ data: { results: [] } })),
        groupAPI.searchGroups(query).catch(() => ({ data: { results: [] } })),
        marketplaceAPI.searchProducts(query).catch(() => ({ data: { results: [] } })),
      ]);

      setUsers(usersRes.data.results || []);
      setPosts(postsRes.data.results || []);
      setGroups(groupsRes.data.results || []);
      setProducts(productsRes.data.results || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProductId = (product) =>
    product?.product_id || product?.id || product?.pk;

  const renderUsers = () => (
    <div className="search-results-section">
      <h3>Users ({users.length})</h3>
      {users.length === 0 ? (
        <p className="no-results">No users found</p>
      ) : (
        <div className="search-results-grid">
          {users.map(user => (
            <Link key={user.id} to={`/profile/${user.id}`} className="search-result-card user-card">
              <img
                src={user.profile_picture || '/default-avatar.png'}
                alt={user.name}
                className="result-avatar"
              />
              <h4>{user.name}</h4>
              <p className="text-muted">{user.department_name}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  const renderPosts = () => (
    <div className="search-results-section">
      <h3>Posts ({posts.length})</h3>
      {posts.length === 0 ? (
        <p className="no-results">No posts found</p>
      ) : (
        <div className="search-results-list">
          {posts.map(post => (
            <div key={post.id} className="search-result-post">
              <div className="post-header">
                <img
                  src={post.author_picture || '/default-avatar.png'}
                  alt={post.author_name}
                  className="result-avatar-sm"
                />
                <div>
                  <h5>{post.author_name}</h5>
                  <small className="text-muted">{new Date(post.created_at).toLocaleDateString()}</small>
                </div>
              </div>
              <p className="post-content">{post.content.substring(0, 150)}...</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderGroups = () => (
    <div className="search-results-section">
      <h3>Groups ({groups.length})</h3>
      {groups.length === 0 ? (
        <p className="no-results">No groups found</p>
      ) : (
        <div className="search-results-grid">
          {groups.map(group => (
            <Link key={group.group_id} to={`/groups/${group.group_id}`} className="search-result-card group-card">
              <div className="group-icon">📊</div>
              <h4>{group.name}</h4>
              <p className="text-muted">{group.members_count} members</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  const renderProducts = () => (
    <div className="search-results-section">
      <h3>Products ({products.length})</h3>
      {products.length === 0 ? (
        <p className="no-results">No products found</p>
      ) : (
        <div className="search-results-grid">
          {products.map(product => {
            const productId = getProductId(product);
            if (!productId) return null;

            return (
            <Link key={productId} to={`/marketplace/${productId}`} className="search-result-card product-card">
              {product.image && <img src={product.image} alt={product.title} className="product-image" />}
              <h4>{product.title}</h4>
              <p className="product-price">{product.price} Tk</p>
            </Link>
          );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="search-container">
          <div className="search-header">
            <h2>Search Results for "{query}"</h2>
            <div className="search-tabs">
              <button 
                className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                onClick={() => setActiveTab('all')}
              >
                All
              </button>
              <button 
                className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                onClick={() => setActiveTab('users')}
              >
                Users ({users.length})
              </button>
              <button 
                className={`tab-btn ${activeTab === 'posts' ? 'active' : ''}`}
                onClick={() => setActiveTab('posts')}
              >
                Posts ({posts.length})
              </button>
              <button 
                className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
                onClick={() => setActiveTab('groups')}
              >
                Groups ({groups.length})
              </button>
              <button 
                className={`tab-btn ${activeTab === 'products' ? 'active' : ''}`}
                onClick={() => setActiveTab('products')}
              >
                Products ({products.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading">Searching...</div>
          ) : (
            <div className="search-results">
              {activeTab === 'all' && (
                <>
                  {renderUsers()}
                  {renderPosts()}
                  {renderGroups()}
                  {renderProducts()}
                </>
              )}
              {activeTab === 'users' && renderUsers()}
              {activeTab === 'posts' && renderPosts()}
              {activeTab === 'groups' && renderGroups()}
              {activeTab === 'products' && renderProducts()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;
