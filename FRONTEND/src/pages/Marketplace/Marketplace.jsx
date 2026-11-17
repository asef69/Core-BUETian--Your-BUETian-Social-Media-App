import React, { useState, useEffect, useMemo } from 'react';
import { marketplaceAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import BuyerPickerModal from '../../components/BuyerPickerModal';
import { toast } from 'react-toastify';
import { FaPlus, FaSearch, FaStore, FaExclamationCircle } from 'react-icons/fa';
import ProductCard from '../../components/marketplace/ProductCard';
import {
  PRODUCT_CATEGORIES, CONDITION_LABELS, STATUS_LABELS, formatTaka, getProductId, statusOf,
} from '../../components/marketplace/productUtils';
import '../../styles/Marketplace.css';

const Marketplace = () => {
  const [products, setProducts] = useState([]);
  const [myProducts, setMyProducts] = useState([]);
  const [myStats, setMyStats] = useState({});
  const [priceRanges, setPriceRanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState('browse');
  const [browseStatusFilter, setBrowseStatusFilter] = useState('all');
  const [myStatusFilter, setMyStatusFilter] = useState('all');
  const [createData, setCreateData] = useState({
    title: '',
    description: '',
    price: '',
    category: PRODUCT_CATEGORIES[0],
    condition: 'good',
    location: '',
  });
  const [categoryMode, setCategoryMode] = useState('existing');
  const [customCategory, setCustomCategory] = useState('');
  const [imageFiles, setImageFiles] = useState([]);
  const [buyerPickerState, setBuyerPickerState] = useState({ open: false, productId: null, action: null });

  useEffect(() => {
    loadProducts(browseStatusFilter);
    loadSellerData();
  }, []);

  const loadProducts = async (status = browseStatusFilter) => {
    try {
      setLoadError(false);
      const response = await marketplaceAPI.getProducts(1, status);
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading products:', error);
      setLoadError(true);
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

  const handleMarkSold = async (productId, buyerId = null) => {
    try {
      await marketplaceAPI.markSold(productId, buyerId ? { buyer_id: buyerId } : {});
      toast.success('Marked as sold');
      loadProducts(browseStatusFilter);
      loadSellerData();
    } catch (error) {
      toast.error('Failed to mark sold');
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    if (creating) return;

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

    setCreating(true);
    try {
      await marketplaceAPI.createProduct(formData);
      toast.success('Product listed successfully!');
      setShowCreateModal(false);
      setCreateData({
        title: '',
        description: '',
        price: '',
        category: PRODUCT_CATEGORIES[0],
        condition: 'good',
        location: '',
      });
      setCategoryMode('existing');
      setCustomCategory('');
      setImageFiles([]);
      loadProducts(browseStatusFilter);
      loadSellerData();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to create product');
    } finally {
      setCreating(false);
    }
  };

  const closeCreateModal = () => setShowCreateModal(false);

  // Preview URLs are created once per selection and released afterwards.
  const imagePreviews = useMemo(() => imageFiles.map((file) => URL.createObjectURL(file)), [imageFiles]);
  useEffect(() => () => imagePreviews.forEach((url) => URL.revokeObjectURL(url)), [imagePreviews]);

  useEffect(() => {
    if (!showCreateModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setShowCreateModal(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showCreateModal]);

  const handleBuyerPicked = async (buyer) => {
    const { productId, action } = buyerPickerState;
    const buyerId = buyer?.id;

    setBuyerPickerState({ open: false, productId: null, action: null });

    if (!productId || !buyerId) {
      toast.error('Buyer selection is invalid');
      return;
    }

    try {
      if (action === 'sold') {
        await marketplaceAPI.markSold(productId, { buyer_id: buyerId });
        toast.success(`Marked as sold to ${buyer.name}`);
      } else if (action === 'reserve') {
        await marketplaceAPI.reserveProduct(productId, { buyer_id: buyerId });
        toast.success(`Reserved for ${buyer.name}`);
      }
      loadProducts(browseStatusFilter);
      loadSellerData();
    } catch (error) {
      const fallbackMessage = action === 'reserve' ? 'Failed to reserve product' : 'Failed to mark sold';
      toast.error(error?.response?.data?.error || fallbackMessage);
    }
  };

  const query = search.trim().toLowerCase();
  const categoriesInUse = Array.from(
    new Set(products.map((product) => product.category).filter(Boolean)),
  ).sort();

  const visibleProducts = products
    .filter((product) => {
      const matchesQuery =
        !query ||
        String(product.title || '').toLowerCase().includes(query) ||
        String(product.description || '').toLowerCase().includes(query);
      const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;
      return matchesQuery && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return Number(a.price) - Number(b.price);
      if (sortBy === 'price_desc') return Number(b.price) - Number(a.price);
      return 0; // keep the order the API returned (newest first)
    });

  const hasActiveFilters = Boolean(query) || categoryFilter !== 'all' || sortBy !== 'newest';
  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setSortBy('newest');
  };

  const renderSkeletons = () => (
    <div className="products-grid" aria-busy="true" aria-label="Loading products">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div className="product-card" key={i} aria-hidden="true">
          <span className="skel product-skel-media" />
          <div className="product-info">
            <span className="skel product-skel-line" style={{ width: '35%', height: 16 }} />
            <span className="skel product-skel-line" style={{ width: '80%' }} />
            <span className="skel product-skel-line" style={{ width: '55%' }} />
          </div>
        </div>
      ))}
    </div>
  );

  const statusFilters = (current, onChange) => (
    <div className="status-filters" role="group" aria-label="Filter by status">
      {['all', 'available', 'reserved', 'sold'].map((status) => (
        <button
          key={status}
          type="button"
          aria-pressed={current === status}
          className={`filter-chip ${current === status ? 'active' : ''}`}
          onClick={() => onChange(status)}
        >
          {status === 'all' ? 'All' : STATUS_LABELS[status]}
        </button>
      ))}
    </div>
  );

  return (
    <div className="app-layout">
      <Navbar />
      <BuyerPickerModal
        open={buyerPickerState.open}
        title={buyerPickerState.action === 'reserve' ? 'Reserve Product For Buyer' : 'Mark Product Sold To Buyer'}
        description="Search for the buyer to attach to this product status."
        initialBuyer={''}
        onClose={() => setBuyerPickerState({ open: false, productId: null, action: null })}
        onSelect={handleBuyerPicked}
      />
      <div className="main-content">
        <div className="container marketplace-page">
          <div className="marketplace-header">
            <div>
              <h1>Marketplace</h1>
              <p className="page-subtitle">Buy and sell books, gear and hostel essentials within BUET.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <FaPlus aria-hidden="true" /> List a product
            </button>
          </div>

          <div className="market-tabs" role="tablist" aria-label="Marketplace sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'browse'}
              className={`tab ${activeTab === 'browse' ? 'active' : ''}`}
              onClick={() => setActiveTab('browse')}
            >
              Browse
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'seller'}
              className={`tab ${activeTab === 'seller' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('seller');
                loadSellerData();
              }}
            >
              My listings
            </button>
          </div>

          {activeTab === 'browse' && (
            <>
              <div className="market-toolbar">
                <div className="market-search">
                  <FaSearch aria-hidden="true" />
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search listings"
                    aria-label="Search listings"
                  />
                </div>
                <select
                  className="market-select"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Category"
                >
                  <option value="all">All categories</option>
                  {categoriesInUse.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select
                  className="market-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  aria-label="Sort"
                >
                  <option value="newest">Newest</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                </select>
              </div>

              {statusFilters(browseStatusFilter, (status) => {
                setBrowseStatusFilter(status);
                setLoading(true);
                loadProducts(status);
              })}

              {loading ? (
                renderSkeletons()
              ) : loadError ? (
                <div className="state-card" role="alert">
                  <FaExclamationCircle aria-hidden="true" />
                  <strong>Couldn't load listings</strong>
                  <p>Check your connection and try again.</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setLoading(true);
                      loadProducts(browseStatusFilter);
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : visibleProducts.length === 0 ? (
                <div className="state-card">
                  <FaStore aria-hidden="true" />
                  <strong>{hasActiveFilters ? 'No listings match' : 'Nothing listed here yet'}</strong>
                  <p>
                    {hasActiveFilters
                      ? 'Try a different search or clear the filters.'
                      : 'Be the first to list something for the community.'}
                  </p>
                  {hasActiveFilters && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="results-count" aria-live="polite">
                    {visibleProducts.length} {visibleProducts.length === 1 ? 'listing' : 'listings'}
                  </p>
                  <div className="products-grid">
                    {visibleProducts.map((product) => {
                      const productId = getProductId(product);
                      if (!productId) return null;
                      return <ProductCard key={productId} product={product} />;
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {activeTab === 'seller' && (
            <div className="seller-dashboard">
              <dl className="seller-stats">
                {[
                  ['Listings', myStats.total_products || 0],
                  ['Available', myStats.available_products || 0],
                  ['Sold', myStats.sold_products || 0],
                  ['Earned', formatTaka(myStats.total_revenue || 0)],
                ].map(([label, value]) => (
                  <div className="seller-stat" key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>

              {statusFilters(myStatusFilter, (status) => {
                setMyStatusFilter(status);
                loadSellerData(status);
              })}

              {myProducts.length === 0 ? (
                <div className="state-card">
                  <FaStore aria-hidden="true" />
                  <strong>No listings found</strong>
                  <p>List something and it will show up here with its status.</p>
                </div>
              ) : (
                <div className="products-grid">
                  {myProducts.map((product) => {
                    const productId = getProductId(product);
                    if (!productId) return null;
                    const status = statusOf(product);
                    return (
                      <ProductCard
                        key={productId}
                        product={product}
                        actions={
                          <>
                            {status !== 'sold' && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => setBuyerPickerState({ open: true, productId, action: 'sold' })}
                              >
                                Mark sold
                              </button>
                            )}
                            {status === 'available' && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setBuyerPickerState({ open: true, productId, action: 'reserve' })}
                              >
                                Reserve
                              </button>
                            )}
                          </>
                        }
                      />
                    );
                  })}
                </div>
              )}

              {priceRanges.length > 0 && (
                <section className="side-card price-insights" aria-labelledby="price-insights-title">
                  <h2 className="side-title" id="price-insights-title">Price ranges on the market</h2>
                  <ul className="insight-list">
                    {priceRanges.slice(0, 4).map((item, index) => (
                      <li key={`range-${index}`}>
                        <span className="insight-range">{item.price_range || 'Range'}</span>
                        <span className="insight-meta">
                          {item.product_count || 0} listings · avg {formatTaka(item.avg_price || 0)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={closeCreateModal}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="list-product-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="list-product-title">List a product</h2>
            <form onSubmit={handleCreateProduct}>
              <div className="form-group">
                <label htmlFor="product-title">Title</label>
                <input
                  id="product-title"
                  type="text"
                  value={createData.title}
                  onChange={(e) => setCreateData({ ...createData, title: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="product-description">Description</label>
                <textarea
                  id="product-description"
                  value={createData.description}
                  onChange={(e) => setCreateData({ ...createData, description: e.target.value })}
                  rows="3"
                  placeholder="Condition, age, what's included"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="product-price">Price (৳)</label>
                  <input
                    id="product-price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={createData.price}
                    onChange={(e) => setCreateData({ ...createData, price: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="product-condition">Condition</label>
                  <select
                    id="product-condition"
                    value={createData.condition}
                    onChange={(e) => setCreateData({ ...createData, condition: e.target.value })}
                  >
                    {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="product-category">Category</label>
                <div className="segmented" role="group" aria-label="Category source">
                  <button
                    type="button"
                    aria-pressed={categoryMode === 'existing'}
                    className={categoryMode === 'existing' ? 'active' : ''}
                    onClick={() => {
                      setCategoryMode('existing');
                      setCreateData({ ...createData, category: createData.category || PRODUCT_CATEGORIES[0] });
                    }}
                  >
                    Choose one
                  </button>
                  <button
                    type="button"
                    aria-pressed={categoryMode === 'new'}
                    className={categoryMode === 'new' ? 'active' : ''}
                    onClick={() => setCategoryMode('new')}
                  >
                    Add new
                  </button>
                </div>
                {categoryMode === 'existing' ? (
                  <select
                    id="product-category"
                    value={createData.category}
                    onChange={(e) => setCreateData({ ...createData, category: e.target.value })}
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="product-category"
                    type="text"
                    placeholder="Type a new category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                  />
                )}
              </div>

              <div className="form-group">
                <label htmlFor="product-location">Location</label>
                <input
                  id="product-location"
                  type="text"
                  value={createData.location}
                  onChange={(e) => setCreateData({ ...createData, location: e.target.value })}
                  placeholder="e.g. Sher-e-Bangla Hall"
                />
              </div>

              <div className="form-group">
                <label htmlFor="product-images">Photos</label>
                <input
                  id="product-images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setImageFiles(Array.from(e.target.files))}
                />
                {imagePreviews.length > 0 && (
                  <ul className="image-previews">
                    {imagePreviews.map((url, index) => (
                      <li key={url}>
                        <img src={url} alt={`Selected photo ${index + 1}`} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={closeCreateModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Listing...' : 'List product'}
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
