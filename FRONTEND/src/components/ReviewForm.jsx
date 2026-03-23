import React, { useState } from 'react';
import { marketplaceAPI } from '../services/apiService';
import { toast } from 'react-toastify';
import { FaStar } from 'react-icons/fa';
import '../styles/ReviewForm.css';

const ReviewForm = ({ productId, sellerId, onReviewSubmitted }) => {
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setIsSubmitting(true);
    try {
      await marketplaceAPI.createReview(productId, {
        rating,
        review_text: reviewText,
      });
      toast.success('Review submitted successfully!');
      setRating(0);
      setReviewText('');
      if (onReviewSubmitted) {
        onReviewSubmitted();
      }
    } catch (error) {
      const errorMsg = error?.response?.data?.error || 'Failed to submit review';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="review-form-container">
      <h3>Share Your Experience</h3>
      <form onSubmit={handleSubmit} className="review-form">
        <div className="rating-section">
          <label>Rating *</label>
          <div className="star-rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`star ${
                  star <= (hoveredRating || rating) ? 'active' : ''
                }`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
              >
                <FaStar />
              </button>
            ))}
          </div>
          <span className="rating-text">
            {rating > 0 && `${rating} out of 5 stars`}
          </span>
        </div>

        <div className="review-text-section">
          <label htmlFor="reviewText">Your Review (Optional)</label>
          <textarea
            id="reviewText"
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            placeholder="Share your thoughts about this product..."
            rows="4"
            maxLength="500"
          />
          <span className="char-count">
            {reviewText.length} / 500
          </span>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting || rating === 0}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Review'}
        </button>
      </form>
    </div>
  );
};

export default ReviewForm;
