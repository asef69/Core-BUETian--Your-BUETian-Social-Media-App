import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { marketplaceAPI, chatAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import ReviewForm from '../../components/ReviewForm';
import ReviewsList from '../../components/ReviewsList';
import ReviewRequirements from '../../components/ReviewRequirements';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { FaMapMarkerAlt, FaUser, FaStar } from 'react-icons/fa';
import { confirmDialog } from '../../utils/confirmDialog';

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

  const isOwnProduct =
    !!user &&
    !!product &&
    Number(user.id) === Number(product.seller_id);

  useEffect(() => {
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
      if (HARD_CODED_CATEGORIES.includes(loadedCategory)) {
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
    try {
      await marketplaceAPI.reserveProduct(productId);
      toast.success('Product reserved!');
      loadProduct();
    } catch (error) {
      toast.error('Failed to reserve product');
    }
  };

  const handleMarkSold = async () => {
    try {
      await marketplaceAPI.markSold(productId);
      toast.success('Product marked as sold');
      loadProduct();
    } catch (error) {
      toast.error('Failed to mark sold');
    }
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
          window.location.href = '/marketplace';
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

  if (loading) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="loading">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="app-layout">
        <Navbar />
        <div className="error">Product not found</div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="product-detail">
            <div className="product-images">
              <div className="main-image">
                <img
                  src={product.images?.[selectedImage] || '/default-product.png'}
                  alt={product.title}
                />
              </div>
              {product.images && product.images.length > 1 && (
                <div className="image-thumbnails">
                  {product.images.map((image, index) => (
                    <img
                      key={index}
                      src={image}
                      alt={`${product.title} ${index + 1}`}
                      className={selectedImage === index ? 'active' : ''}
                      onClick={() => setSelectedImage(index)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="product-details">
              <h1>{product.title}</h1>
              <div className="product-price">
                BDT {product.price}
              </div>
              <div className="product-meta">
                <span className="condition-badge">{product.condition}</span>
                <span className="status-badge">{product.status}</span>
              </div>

              <div className="product-info-section">
                <h3>Description</h3>
                {editing ? (
                  <textarea
                    className="product-edit-input product-edit-textarea"
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows="4"
                    placeholder="Describe the product clearly"
                  />
                ) : (
                  <p>{product.description}</p>
                )}
              </div>

              <div className="product-info-section">
                <h3>Details</h3>
                {editing ? (
                  <div className="product-edit-form">
                    <div className="product-edit-grid">
                      <div className="product-edit-field">
                        <label>Title</label>
                        <input
                          className="product-edit-input"
                          type="text"
                          value={editData.title}
                          onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                          placeholder="Product title"
                        />
                      </div>
                      <div className="product-edit-field">
                        <label>Price (BDT)</label>
                        <input
                          className="product-edit-input"
                          type="number"
                          value={editData.price}
                          onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                          placeholder="Price"
                        />
                      </div>
                    </div>

                    <div className="product-edit-field">
                      <label>Location</label>
                      <input
                        className="product-edit-input"
                        type="text"
                        value={editData.location}
                        onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                        placeholder="Location"
                      />
                    </div>

                    <div className="product-edit-field">
                      <label>Category</label>
                      <div className="product-edit-segmented">
                      <button
                        type="button"
                        className={`btn ${editCategoryMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => {
                          setEditCategoryMode('existing');
                          setEditData({
                            ...editData,
                            category: HARD_CODED_CATEGORIES.includes(editData.category)
                              ? editData.category
                              : HARD_CODED_CATEGORIES[0],
                          });
                        }}
                      >
                        Choose Existing
                      </button>
                      <button
                        type="button"
                        className={`btn ${editCategoryMode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setEditCategoryMode('new')}
                      >
                        Add New Category
                      </button>
                    </div>

                    {editCategoryMode === 'existing' ? (
                      <select
                        className="product-edit-input"
                        value={editData.category}
                        onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                      >
                        {HARD_CODED_CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="product-edit-input"
                        type="text"
                        value={customEditCategory}
                        onChange={(e) => setCustomEditCategory(e.target.value)}
                        placeholder="Type new category"
                      />
                    )}
                    </div>

                    <div className="product-edit-field">
                      <label>Condition</label>
                    <select
                      className="product-edit-input"
                      value={editData.condition}
                      onChange={(e) => setEditData({ ...editData, condition: e.target.value })}
                    >
                      <option value="new">New</option>
                      <option value="like_new">Like New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="info-item">
                      <FaMapMarkerAlt />
                      <span>{product.location}</span>
                    </div>
                    <div className="info-item">
                      <span>Category: {product.category}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="product-info-section">
                <h3>Seller</h3>
                <Link to={`/profile/${product.seller_id}`} className="seller-info">
                  <FaUser />
                  <span>{product.seller_name}</span>
                </Link>
              </div>

              {!isOwnProduct && (
                <div className="product-actions">
                  {product.status === 'available' && (
                    <button className="btn btn-primary" onClick={handleReserve}>
                      Reserve Product
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={handleContactSeller}>
                    Contact Seller
                  </button>
                </div>
              )}

              {isOwnProduct && (
                <div className={`product-actions ${editing ? 'product-edit-actions' : ''}`}>
                  {editing ? (
                    <>
                      <button className="btn btn-primary product-edit-save-btn" onClick={handleUpdate}>
                        Save Changes
                      </button>
                      <button className="btn btn-secondary product-edit-cancel-btn" onClick={() => setEditing(false)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      {product.status !== 'sold' && (
                        <button className="btn btn-primary" onClick={handleMarkSold}>
                          Mark as Sold
                        </button>
                      )}
                      <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                        Edit Product
                      </button>
                      <button className="btn btn-danger" onClick={handleDelete}>
                        Delete Product
                      </button>
                    </>
                  )}
                </div>
              )}

              {similarProducts.length > 0 && (
                <div className="product-info-section">
                  <h3>Similar Products</h3>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {similarProducts.map((item, index) => {
                      const similarId = item.product_id || item.id;
                      if (!similarId) return null;
                      return (
                        <Link key={`${similarId}-${index}`} to={`/marketplace/${similarId}`} className="seller-info">
                          {item.title} - BDT {item.price}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Reviews and Ratings Section */}
              {product.seller_id && (
                <>
                  <ReviewsList 
                    sellerId={product.seller_id} 
                    sellerName={product.seller_name}
                    productId={productId}
                    refreshToken={reviewRefreshToken}
                  />
                  
                  {!isOwnProduct && (
                    <>
                      <ReviewRequirements 
                        product={product} 
                        user={user} 
                        isOwnProduct={isOwnProduct}
                      />
                      
                      {product.status === 'sold' && !isOwnProduct && (
                        <ReviewForm 
                          productId={productId} 
                          sellerId={product.seller_id}
                          onReviewSubmitted={handleReviewSubmitted}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
