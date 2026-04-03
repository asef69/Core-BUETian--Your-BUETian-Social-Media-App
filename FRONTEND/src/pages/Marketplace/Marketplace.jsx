import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { marketplaceAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaPlus, FaMapMarkerAlt, FaTag, FaBox, FaChartLine } from 'react-icons/fa';
import '../../styles/Marketplace.css';

const HARD_CODED_CATEGORIES = [
  'Electronics',
  'Books',
  'Academic Notes',
  'Lab Equipment',
  'Hostel Essentials',
  'Furniture',
  'Bikes & Cycles',
  'Fashion',
  'Sports',
  'Others',
];

const Marketplace = () => {
  const [products, setProducts] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [myStats, setMyStats] = useState({});
  const [priceRanges, setPriceRanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');
  const [browseStatusFilter, setBrowseStatusFilter] = useState('all');
  const [myStatusFilter, setMyStatusFilter] = useState('all');
  const [createData, setCreateData] = useState({
    title: '',
    description: '',
    price: '',
    category: HARD_CODED_CATEGORIES[0],
    condition: 'good',
    location: '',
  });
  const [categoryMode, setCategoryMode] = useState('existing');
  const [customCategory, setCustomCategory] = useState('');
  const [imageFiles, setImageFiles] = useState([]);

  useEffect(() => {
    loadProducts(browseStatusFilter);
    loadSellerData();
  }, []);

  const getProductId = (product) =>
    product?.product_id || product?.id || product?.pk;

  const getProductImage = (product) => {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images[0];
    }
    return product?.image || '/default-product.png';
  };

  const loadProducts = async (status = browseStatusFilter) => {
    try {
      const response = await marketplaceAPI.getProducts(1, status);
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSellerData = async (status = myStatusFilter) => {
    try {
      const [myProductsRes, myStatsRes, priceRangesRes] = await Promise.all([
        status === 'all' ? marketplaceAPI.getMyProducts() : marketplaceAPI.getMyProductsByStatus(status),
        marketplaceAPI.getMyStats(),
        marketplaceAPI.getPriceRanges(),
      ]);

      setMyProducts(myProductsRes.data.products || myProductsRes.data.results || myProductsRes.data || []);
      setMyStats(myStatsRes.data || {});
      setPriceRanges(Array.isArray(priceRangesRes.data) ? priceRangesRes.data : priceRangesRes.data?.results || []);
    } catch (error) {
      setMyProducts([]);
      setMyStats({});
      setPriceRanges([]);
    }
  };

  const handleMarkSold = async (productId) => {
    try {
      await marketplaceAPI.markSold(productId);
      toast.success('Marked as sold');
      loadProducts(browseStatusFilter);
      loadSellerData();
    } catch (error) {
      toast.error('Failed to mark sold');
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();

    const finalCategory = categoryMode === 'new'
      ? customCategory.trim()
      : createData.category;

    if (!finalCategory) {
      toast.error('Please select or add a category');
      return;
    }

    const payload = {
      ...createData,
      category: finalCategory,
    };

    const formData = new FormData();
    Object.keys(payload).forEach(key => {
      formData.append(key, payload[key]);
    });
    imageFiles.forEach((file) => {
      formData.append('images', file);
    });

    try {
      await marketplaceAPI.createProduct(formData);
      toast.success('Product listed successfully!');
      setShowCreateModal(false);
      setCreateData({
        title: '',
        description: '',
        price: '',
        category: HARD_CODED_CATEGORIES[0],
        condition: 'good',
        location: '',
      });
      setCategoryMode('existing');
      setCustomCategory('');
      setImageFiles([]);
      loadProducts(browseStatusFilter);
      loadSellerData();
    } catch (error) {
      toast.error('Failed to create product');
    }
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="marketplace-header">
            <h1>Marketplace</h1>
            <div className="marketplace-actions">
              <button
                className={`btn ${activeTab === 'browse' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveTab('browse')}
              >
                Browse
              </button>
              <button
                className={`btn ${activeTab === 'seller' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setActiveTab('seller');
                  loadSellerData();
                }}
              >
                Seller Dashboard
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                <FaPlus /> List Product
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading products...</div>
          ) : (
            <>
              {activeTab === 'browse' && (
                <>
                  <div className="marketplace-status-filters">
                    {['all', 'available', 'reserved', 'sold'].map((status) => (
                      <button
                        key={`browse-${status}`}
                        className={`btn ${browseStatusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setBrowseStatusFilter(status);
                          loadProducts(status);
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <div className="products-grid">
                    {products.length === 0 ? (
                      <p>No products found for this status</p>
                    ) : (
                      products.map((product) => {
                        const productId = getProductId(product);
                        if (!productId) return null;

                        return (
                        <Link to={`/marketplace/${productId}`} key={productId} className="product-card">
                          <img
                            src={getProductImage(product)}
                            alt={product.title}
                            className="product-image"
                          />
                          <div className="product-info">
                            <h3>{product.title}</h3>
                            <p className="product-price">
                              <FaTag size={14} /> BDT {product.price}
                            </p>
                            <p className="product-condition">
                              <FaBox size={12} /> {product.condition}
                            </p>
                            <p className="product-location">
                              <FaMapMarkerAlt size={12} /> {product.location}
                            </p>
                            <p className={`market-status status-${(product.status || 'available').toLowerCase()}`}>
                              {(product.status || 'available').toUpperCase()}
                            </p>
                          </div>
                        </Link>
                      );
                      })
                    )}
                  </div>
                </>
              )}

              {activeTab === 'seller' && (
                <div>
                  <div className="products-grid marketplace-stats-grid">
                    <div className="product-card marketplace-stat-card">
                      <h3>Total Listings</h3>
                      <p className="product-price">{myStats.total_products || 0}</p>
                    </div>
                    <div className="product-card marketplace-stat-card">
                      <h3>Available</h3>
                      <p className="product-price">{myStats.available_products || 0}</p>
                    </div>
                    <div className="product-card marketplace-stat-card">
                      <h3>Sold</h3>
                      <p className="product-price">{myStats.sold_products || 0}</p>
                    </div>
                    <div className="product-card marketplace-stat-card">
                      <h3>Revenue</h3>
                      <p className="product-price">BDT {myStats.total_revenue || 0}</p>
                    </div>
                  </div>

                  <div className="marketplace-status-filters">
                    {['all', 'available', 'reserved', 'sold'].map((status) => (
                      <button
                        key={status}
                        className={`btn ${myStatusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setMyStatusFilter(status);
                          loadSellerData(status);
                        }}
                      >
                        {status}
                      </button>
                    ))}
                  </div>

                  <div className="products-grid">
                    {myProducts.length === 0 ? (
                      <p>No listings found</p>
                    ) : (
                      myProducts.map((product) => {
                        const productId = getProductId(product);
                        if (!productId) return null;
                        return (
                          <div key={productId} className="product-card">
                            <img
                              src={getProductImage(product)}
                              alt={product.title}
                              className="product-image"
                            />
                            <div className="product-info">
                              <h3>{product.title}</h3>
                              <p className="product-price">BDT {product.price}</p>
                              <p className="product-condition">Status: {product.status || 'available'}</p>
                              <div className="product-actions">
                                <Link to={`/marketplace/${productId}`} className="btn btn-secondary">Open</Link>
                                {(product.status || '').toLowerCase() !== 'sold' && (
                                  <button className="btn btn-primary" onClick={() => handleMarkSold(productId)}>
                                    Mark Sold
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {priceRanges.length > 0 && (
                    <div className="marketplace-price-insights">
                      <h3 className="marketplace-price-insights-title">Market Price Range Insights</h3>
                      <div className="products-grid marketplace-price-insights-grid">
                        {priceRanges.slice(0, 4).map((item, index) => (
                          <div key={`range-${index}`} className="product-card marketplace-insight-card">
                            <h3>{item.price_range || 'Range'}</h3>
                            <p className="product-condition">Products: {item.product_count || 0}</p>
                            <p className="product-condition">Avg: BDT {item.avg_price || 0}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>List New Product</h2>
            <form onSubmit={handleCreateProduct}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={createData.title}
                  onChange={(e) => setCreateData({ ...createData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={createData.description}
                  onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price</label>
                  <input
                    type="number"
                    step="0.01"
                    value={createData.price}
                    onChange={(e) => setCreateData({ ...createData, price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Condition</label>
                  <select
                    value={createData.condition}
                    onChange={(e) => setCreateData({ ...createData, condition: e.target.value })}
                  >
                    <option value="new">New</option>
                    <option value="like_new">Like New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Category</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <button
                    type="button"
                    className={`btn ${categoryMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setCategoryMode('existing');
                      setCreateData({ ...createData, category: createData.category || HARD_CODED_CATEGORIES[0] });
                    }}
                  >
                    Choose Existing
                  </button>
                  <button
                    type="button"
                    className={`btn ${categoryMode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCategoryMode('new')}
                  >
                    Add New Category
                  </button>
                </div>

                {categoryMode === 'existing' ? (
                  <select
                    value={createData.category}
                    onChange={(e) => setCreateData({ ...createData, category: e.target.value })}
                  >
                    {HARD_CODED_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Type new category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                  />
                )}
              </div>
              <div className="form-group">
                <label>Location</label>
                <input
                  type="text"
                  value={createData.location}
                  onChange={(e) => setCreateData({ ...createData, location: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Images</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setImageFiles(Array.from(e.target.files))}
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">List Product</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Marketplace;
