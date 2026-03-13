import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { marketplaceAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaPlus } from 'react-icons/fa';
import '../../styles/Marketplace.css';

const Marketplace = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    condition: 'good',
    location: '',
  });
  const [imageFiles, setImageFiles] = useState([]);

  useEffect(() => {
    loadProducts();
  }, []);

  const getProductId = (product) =>
    product?.product_id || product?.id || product?.pk;

  const getProductImage = (product) => {
    if (Array.isArray(product?.images) && product.images.length > 0) {
      return product.images[0];
    }
    return product?.image || '/default-product.png';
  };

  const loadProducts = async () => {
    try {
      const response = await marketplaceAPI.getProducts();
      setProducts(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    Object.keys(createData).forEach(key => {
      formData.append(key, createData[key]);
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
        category: '',
        condition: 'good',
        location: '',
      });
      setImageFiles([]);
      loadProducts();
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
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <FaPlus /> List Product
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading products...</div>
          ) : (
            <div className="products-grid">
              {products.length === 0 ? (
                <p>No products available</p>
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
                        BDT {product.price}
                      </p>
                      <p className="product-condition">{product.condition}</p>
                      <p className="product-location">{product.location}</p>
                    </div>
                  </Link>
                );
                })
              )}
            </div>
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
                <input
                  type="text"
                  value={createData.category}
                  onChange={(e) => setCreateData({ ...createData, category: e.target.value })}
                />
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
