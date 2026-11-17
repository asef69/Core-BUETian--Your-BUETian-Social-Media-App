import React, { useState, useEffect } from 'react';
import { marketplaceAPI } from '../services/apiService';
import { FaStar, FaUser } from 'react-icons/fa';
import '../styles/ReviewsList.css';
import { formatDate } from '../utils/time';
import Avatar from './common/Avatar';

const ReviewsList = ({ sellerId, sellerName, productId = null, refreshToken = 0 }) => {
  const [reviews, setReviews] = useState([]);
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadData();
  }, [sellerId, page, refreshToken]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [repRes, revRes] = await Promise.all([
        marketplaceAPI.getSellerReputation(sellerId),
        marketplaceAPI.getSellerReviews(sellerId, page, productId),
      ]);
      setReputation(repRes.data);
      setReviews(revRes.data?.reviews || []);
    } catch (error) {
      console.error('Failed to load seller reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="star-display" role="img" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <FaStar key={star} className={star <= rating ? 'filled' : 'empty'} />
        ))}
      </div>
    );
  };

  if (loading && !reputation) {
    return <div className="loading">Loading seller information...</div>;
  }

  return (
    <div className="reviews-container">
      {reputation && (
        <div className="seller-reputation">
          <div className="reputation-header">
            <h3>{sellerName}'s reputation</h3>
          </div>
          <div className="reputation-stats">
            <div className="stat">
              <div className="stat-label">Average Rating</div>
              <div className="stat-value">
                <span className="rating-number">
                  {reputation.average_rating || 0}
                </span>
                <span className="rating-unit">/5</span>
              </div>
              {reputation.average_rating > 0 && (
                renderStars(Math.round(reputation.average_rating))
              )}
            </div>
            <div className="stat">
              <div className="stat-label">Total Reviews</div>
              <div className="stat-value">
                {reputation.total_reviews || 0}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Products Sold</div>
              <div className="stat-value">
                {reputation.total_products_sold || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="reviews-section">
        <h3>Reviews</h3>
        {reviews && reviews.length > 0 ? (
          <div className="reviews-list">
            {reviews.map((review) => (
              <div key={review.id} className="review-item">
                <div className="review-header">
                  <div className="reviewer-info">
                    <Avatar
                      src={review.buyer_picture}
                      name={review.buyer_name}
                      size={40}
                      className="reviewer-avatar"
                      decorative
                    />
                    <div className="reviewer-details">
                      <div className="reviewer-name">
                        {review.buyer_name}
                      </div>
                      <div className="review-product">
                        {review.product_title}
                      </div>
                    </div>
                  </div>
                  <div className="review-rating">
                    {renderStars(review.rating)}
                  </div>
                </div>
                {review.review_text && (
                  <div className="review-text">
                    {review.review_text}
                  </div>
                )}
                <div className="review-date">
                  {formatDate(review.created_at)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-reviews">
            No reviews yet.
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewsList;
