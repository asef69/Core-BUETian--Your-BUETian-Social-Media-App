import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { marketplaceAPI, chatAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import ReviewForm from '../../components/ReviewForm';
import ReviewsList from '../../components/ReviewsList';
import ReviewRequirements from '../../components/ReviewRequirements';
import BuyerPickerModal from '../../components/BuyerPickerModal';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { FaMapMarkerAlt, FaComments, FaArrowLeft, FaExclamationCircle } from 'react-icons/fa';
import Avatar from '../../components/common/Avatar';
import ProductCard from '../../components/marketplace/ProductCard';
import {
  PRODUCT_CATEGORIES, CONDITION_LABELS, STATUS_LABELS, conditionLabel, formatTaka, getProductId,
  getProductImages, statusOf,
} from '../../components/marketplace/productUtils';
import '../../styles/Marketplace.css';
import { confirmDialog } from '../../utils/confirmDialog';

const ProductDetail = () => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [editCategoryMode, setEditCategoryMode] = useState('existing');
  const [customEditCategory, setCustomEditCategory] = useState('');
  const [similarProducts, setSimilarProducts] = useState([]);
  const [reviewRefreshToken, setReviewRefreshToken] = useState(0);
  const [buyerPickerState, setBuyerPickerState] = useState({ open: false, action: null });

  const isOwnProduct =
    !!user &&
    !!product &&
    Number(user.id) === Number(product.seller_id);

  const isRecordedBuyer =
    !!user &&
    !!product &&
    !!product.buyer_id &&
    Number(user.id) === Number(product.buyer_id);

  useEffect(() => {
    setLoading(true);
    setSelectedImage(0);
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const [response, similarRes] = await Promise.all([
        marketplaceAPI.getProduct(productId),
        marketplaceAPI.getSimilarProducts(productId, 4).catch(() => ({ data: [] })),
      ]);
      setProduct(response.data);
      setSimilarProducts(Array.isArray(similarRes.data) ? similarRes.data : similarRes.data?.results || []);
      setEditData({
        title: response.data.title || '',
        description: response.data.description || '',
        price: response.data.price || '',
        category: response.data.category || '',
        condition: response.data.condition || 'good',
        location: response.data.location || '',
        status: response.data.status || 'available',
      });

      const loadedCategory = response.data.category || '';
      if (PRODUCT_CATEGORIES.includes(loadedCategory)) {
        setEditCategoryMode('existing');
        setCustomEditCategory('');
      } else {
        setEditCategoryMode('new');
        setCustomEditCategory(loadedCategory);
      }
    } catch (error) {
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleContactSeller = async () => {
    try {
      const response = await chatAPI.contactSeller({
        product_id: productId,
        message: `Hi! I'm interested in your product: ${product.title}`,
      });
      toast.success('Message sent to seller!');
      navigate(`/chat/${response.data.seller_id}?product_id=${productId}`);
    } catch (error) {
      const message = error?.response?.data?.error || 'Failed to contact seller';
      toast.error(message);
    }
  };

  const handleReserve = async () => {
    if (!isOwnProduct) {
      toast.info('Contact seller to reserve the product for you');
      return;
    }

    setBuyerPickerState({ open: true, action: 'reserve' });
  };

  const handleBuyerSelected = async (buyer) => {
    const buyerId = buyer?.id;
    if (!buyerId) {
      toast.error('Buyer selection is invalid');
      return;
    }

    const action = buyerPickerState.action;
    setBuyerPickerState({ open: false, action: null });

    try {
      if (action === 'reserve') {
        await marketplaceAPI.reserveProduct(productId, { buyer_id: buyerId });
        toast.success(`Product reserved for ${buyer.name}`);
      } else {
        await marketplaceAPI.markSold(productId, { buyer_id: buyerId });
        toast.success(`Product marked as sold to ${buyer.name}`);
      }
      loadProduct();
    } catch (error) {
      toast.error(action === 'reserve' ? 'Failed to reserve product' : 'Failed to mark sold');
    }
  };

  const handleMarkSold = async () => {
    setBuyerPickerState({ open: true, action: 'sold' });
  };

  const handleDelete = async () => {
    await confirmDialog({
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product?',
      confirmText: 'Delete',
      confirmLoadingText: 'Deleting...',
      danger: true,
      onConfirmAction: async () => {
        try {
          await marketplaceAPI.deleteProduct(productId);
          toast.success('Product deleted');
          navigate('/marketplace');
        } catch (error) {
          toast.error(error?.response?.data?.error || 'Failed to delete product');
          throw error;
        }
      },
    });
  };

  const handleUpdate = async () => {
    try {
      const finalCategory = editCategoryMode === 'new'
        ? customEditCategory.trim()
        : editData.category;

      if (!finalCategory) {
        toast.error('Please select or add a category');
        return;
      }

      await marketplaceAPI.updateProduct(productId, {
        ...editData,
        category: finalCategory,
      });
      toast.success('Product updated');
      setEditing(false);
      loadProduct();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update product');
    }
  };

  const handleReviewSubmitted = async () => {
    await loadProduct();
    setReviewRefreshToken((prev) => prev + 1);
  };

  const shell = (children) => (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container product-page">{children}</div>
      </div>
    </div>
  );

  if (loading) {
    return shell(
      <div className="product-detail" aria-busy="true" aria-label="Loading product">
        <span className="skel product-skel-gallery" />
        <div className="product-details">
          <span className="skel product-skel-line" style={{ width: '60%', height: 28 }} />
          <span className="skel product-skel-line" style={{ width: '25%', height: 22 }} />
          <span className="skel product-skel-line" style={{ width: '90%' }} />
          <span className="skel product-skel-line" style={{ width: '75%' }} />
        </div>
      </div>,
    );
  }

  if (!product) {
    return shell(
      <div className="state-card" role="alert">
        <FaExclamationCircle aria-hidden="true" />
        <strong>We couldn't find this product</strong>
        <p>It may have been removed, or the connection dropped.</p>
        <div className="state-card-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setLoading(true); loadProduct(); }}>
            Try again
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/marketplace')}>
            Back to marketplace
          </button>
        </div>
      </div>,
    );
  }

  const images = getProductImages(product);
  const status = statusOf(product);
  const taken = status !== 'available';

  return shell(
    <>
      <BuyerPickerModal
        open={buyerPickerState.open}
        title={buyerPickerState.action === 'reserve' ? 'Reserve For Buyer' : 'Mark As Sold To Buyer'}
        description={buyerPickerState.action === 'reserve'
          ? 'Search for the buyer who should be linked to this reservation.'
          : 'Search for the buyer who should be linked to the sale.'}
        initialBuyer={product?.buyer_id || ''}
        onClose={() => setBuyerPickerState({ open: false, action: null })}
        onSelect={handleBuyerSelected}
      />

      <button type="button" className="back-link" onClick={() => navigate('/marketplace')}>
        <FaArrowLeft aria-hidden="true" /> Marketplace
      </button>

      <div className="product-detail">
        <div className="product-gallery">
          <div className="main-image">
            <img src={images[selectedImage] || images[0]} alt={product.title} />
            {taken && <span className={`product-flag flag-${status}`}>{STATUS_LABELS[status] || status}</span>}
          </div>
          {images.length > 1 && (
            <ul className="image-thumbnails" aria-label="Product photos">
              {images.map((image, index) => (
                <li key={image + index}>
                  <button
                    type="button"
                    className={selectedImage === index ? 'active' : ''}
                    aria-label={`Show photo ${index + 1} of ${images.length}`}
                    aria-current={selectedImage === index}
                    onClick={() => setSelectedImage(index)}
                  >
                    <img src={image} alt="" loading="lazy" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="product-details">
          <div className="product-head">
            <h1>{product.title}</h1>
            <p className="product-price product-price-lg">{formatTaka(product.price)}</p>
            <div className="product-meta">
              {product.condition && <span className="condition-chip">{conditionLabel(product.condition)}</span>}
              <span className={`status-badge status-${status}`}>{STATUS_LABELS[status] || status}</span>
              {product.buyer_name && taken && (
                <span className="status-badge">
                  {status === 'sold' ? 'Sold to' : 'Reserved for'} {product.buyer_name}
                </span>
              )}
            </div>
          </div>

          {!isOwnProduct && (
            <div className="product-actions product-actions-main">
              <button type="button" className="btn btn-primary" onClick={handleContactSeller}>
                <FaComments aria-hidden="true" /> Contact seller
              </button>
            </div>
          )}

          {isOwnProduct && (
            <div className="product-actions product-actions-main">
              {editing ? (
                <>
                  <button type="button" className="btn btn-primary" onClick={handleUpdate}>
                    Save changes
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {status !== 'sold' && (
                    <button type="button" className="btn btn-primary" onClick={handleMarkSold}>
                      Mark as sold
                    </button>
                  )}
                  {status === 'available' && (
                    <button type="button" className="btn btn-secondary" onClick={handleReserve}>
                      Reserve for buyer
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-secondary btn-quiet-danger" onClick={handleDelete}>
                    Delete
                  </button>
                </>
              )}
            </div>
          )}

          <Link to={`/profile/${product.seller_id}`} className="seller-card">
            <Avatar src={product.seller_picture || product.seller_profile_picture} name={product.seller_name} size={44} decorative />
            <span className="seller-card-text">
              <span className="seller-label">Seller</span>
              <strong>{product.seller_name}</strong>
            </span>
          </Link>

          {editing ? (
            <div className="product-edit-form">
              <div className="form-group">
                <label htmlFor="edit-title">Title</label>
                <input
                  id="edit-title"
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="edit-price">Price (৳)</label>
                  <input
                    id="edit-price"
                    type="number"
                    value={editData.price}
                    onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="edit-condition">Condition</label>
                  <select
                    id="edit-condition"
                    value={editData.condition}
                    onChange={(e) => setEditData({ ...editData, condition: e.target.value })}
                  >
                    {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="edit-location">Location</label>
                <input
                  id="edit-location"
                  type="text"
                  value={editData.location}
                  onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-category">Category</label>
                <div className="segmented" role="group" aria-label="Category source">
                  <button
                    type="button"
                    aria-pressed={editCategoryMode === 'existing'}
                    className={editCategoryMode === 'existing' ? 'active' : ''}
                    onClick={() => {
                      setEditCategoryMode('existing');
                      setEditData({
                        ...editData,
                        category: PRODUCT_CATEGORIES.includes(editData.category)
                          ? editData.category
                          : PRODUCT_CATEGORIES[0],
                      });
                    }}
                  >
                    Choose one
                  </button>
                  <button
                    type="button"
                    aria-pressed={editCategoryMode === 'new'}
                    className={editCategoryMode === 'new' ? 'active' : ''}
                    onClick={() => setEditCategoryMode('new')}
                  >
                    Add new
                  </button>
                </div>
                {editCategoryMode === 'existing' ? (
                  <select
                    id="edit-category"
                    value={editData.category}
                    onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="edit-category"
                    type="text"
                    value={customEditCategory}
                    onChange={(e) => setCustomEditCategory(e.target.value)}
                    placeholder="Type a new category"
                  />
                )}
              </div>
              <div className="form-group">
                <label htmlFor="edit-description">Description</label>
                <textarea
                  id="edit-description"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  rows="4"
                  placeholder="Describe the product clearly"
                />
              </div>
            </div>
          ) : (
            <>
              {product.description && (
                <section className="product-section">
                  <h2>Description</h2>
                  <p className="product-description">{product.description}</p>
                </section>
              )}
              <section className="product-section">
                <h2>Details</h2>
                <dl className="detail-list">
                  {product.category && (
                    <div><dt>Category</dt><dd>{product.category}</dd></div>
                  )}
                  {product.condition && (
                    <div><dt>Condition</dt><dd>{conditionLabel(product.condition)}</dd></div>
                  )}
                  {product.location && (
                    <div>
                      <dt>Location</dt>
                      <dd><FaMapMarkerAlt aria-hidden="true" /> {product.location}</dd>
                    </div>
                  )}
                </dl>
              </section>
            </>
          )}
        </div>
      </div>

      {similarProducts.length > 0 && (
        <section className="similar-section" aria-labelledby="similar-title">
          <h2 className="section-title" id="similar-title">Similar products</h2>
          <div className="products-grid">
            {similarProducts.map((item, index) => {
              const similarId = getProductId(item);
              if (!similarId) return null;
              return <ProductCard key={`${similarId}-${index}`} product={item} />;
            })}
          </div>
        </section>
      )}

      {product.seller_id && (
        <section className="product-reviews">
          <ReviewsList
            sellerId={product.seller_id}
            sellerName={product.seller_name}
            productId={productId}
            refreshToken={reviewRefreshToken}
          />

          {!isOwnProduct && (
            <>
              <ReviewRequirements product={product} user={user} isOwnProduct={isOwnProduct} />

              {product.status === 'sold' && isRecordedBuyer && (
                <ReviewForm
                  productId={productId}
                  sellerId={product.seller_id}
                  onReviewSubmitted={handleReviewSubmitted}
                />
              )}
            </>
          )}
        </section>
      )}
    </>,
  );
};

export default ProductDetail;
