import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { marketplaceAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { FaDollarSign, FaMapMarkerAlt, FaUser } from 'react-icons/fa';

const ProductDetail = () => {
  const { productId } = useParams();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});

  const isOwnProduct =
    !!user &&
    !!product &&
    Number(user.id) === Number(product.seller_id);

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const response = await marketplaceAPI.getProduct(productId);
      setProduct(response.data);
      setEditData({
        title: response.data.title || '',
        description: response.data.description || '',
        price: response.data.price || '',
        category: response.data.category || '',
        condition: response.data.condition || 'good',
        location: response.data.location || '',
        status: response.data.status || 'available',
      });
    } catch (error) {
      toast.error('Failed to load product');
    } finally {
      setLoading(false);
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

  const handleDelete = async () => {
    if (!window.confirm('Delete this product?')) return;
    try {
      await marketplaceAPI.deleteProduct(productId);
      toast.success('Product deleted');
      window.location.href = '/marketplace';
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to delete product');
    }
  };

  const handleUpdate = async () => {
    try {
      await marketplaceAPI.updateProduct(productId, editData);
      toast.success('Product updated');
      setEditing(false);
      loadProduct();
    } catch (error) {
      toast.error(error?.response?.data?.error || 'Failed to update product');
    }
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
                <FaDollarSign /> {product.price}
              </div>
              <div className="product-meta">
                <span className="condition-badge">{product.condition}</span>
                <span className="status-badge">{product.status}</span>
              </div>

              <div className="product-info-section">
                <h3>Description</h3>
                {editing ? (
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows="4"
                  />
                ) : (
                  <p>{product.description}</p>
                )}
              </div>

              <div className="product-info-section">
                <h3>Details</h3>
                {editing ? (
                  <>
                    <input
                      type="text"
                      value={editData.title}
                      onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                      placeholder="Title"
                    />
                    <input
                      type="number"
                      value={editData.price}
                      onChange={(e) => setEditData({ ...editData, price: e.target.value })}
                      placeholder="Price"
                    />
                    <input
                      type="text"
                      value={editData.location}
                      onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                      placeholder="Location"
                    />
                    <input
                      type="text"
                      value={editData.category}
                      onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                      placeholder="Category"
                    />
                    <select
                      value={editData.condition}
                      onChange={(e) => setEditData({ ...editData, condition: e.target.value })}
                    >
                      <option value="new">New</option>
                      <option value="like_new">Like New</option>
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </>
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

              {product.status === 'available' && !isOwnProduct && (
                <div className="product-actions">
                  <button className="btn btn-primary" onClick={handleReserve}>
                    Reserve Product
                  </button>
                  <Link to="/chat" className="btn btn-secondary">
                    Contact Seller
                  </Link>
                </div>
              )}

              {isOwnProduct && (
                <div className="product-actions">
                  {editing ? (
                    <>
                      <button className="btn btn-primary" onClick={handleUpdate}>
                        Save Changes
                      </button>
                      <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
