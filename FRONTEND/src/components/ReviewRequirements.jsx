import React from 'react';
import { FaCheckCircle, FaExclamationCircle, FaClock } from 'react-icons/fa';
import '../styles/ReviewRequirements.css';

const ReviewRequirements = ({ product, user, isOwnProduct }) => {
  if (!product || !user) return null;

  // Check if product is sold
  const isSold = product.status === 'sold';
  const isBuyer = Boolean(product.buyer_id) && Number(user.id) === Number(product.buyer_id);

  // Determine status
  const canReview = isSold && isBuyer;

  return (
    <div className={`review-requirements ${canReview ? 'can-review' : 'cannot-review'}`}>
      <div className="requirements-header">
        <h4>Requirements to Leave a Review</h4>
      </div>

      <div className="requirements-list">
        {/* Product Status Requirement */}
        <div className={`requirement-item ${isSold ? 'met' : 'unmet'}`}>
          {isSold ? (
            <FaCheckCircle className="icon" />
          ) : (
            <FaExclamationCircle className="icon" />
          )}
          <div className="requirement-text">
            <span className="label">Product marked as sold</span>
            <span className="detail">
              {isSold 
                ? 'Seller has marked this product as sold' 
                : `Current status: "${product.status}" - Seller needs to mark as sold`}
            </span>
          </div>
        </div>

        {/* Buyer Requirement */}
        <div className={`requirement-item ${isBuyer ? 'met' : 'unmet'}`}>
          {isBuyer ? (
            <FaCheckCircle className="icon" />
          ) : (
            <FaExclamationCircle className="icon" />
          )}
          <div className="requirement-text">
            <span className="label">You must be the buyer</span>
            <span className="detail">
              {isBuyer 
                ? 'You are the recorded buyer for this product' 
                : product.buyer_id
                  ? 'Only the recorded buyer can review this product'
                  : 'A buyer must be recorded before a review can be left'}
            </span>
          </div>
        </div>
      </div>

      {canReview && (
        <div className="requirements-status ready">
          <FaCheckCircle /> You're ready to leave a review!
        </div>
      )}

      {!canReview && (
        <div className="requirements-status waiting">
          <FaClock /> 
          {!isSold && ' Waiting for seller to mark product as sold...'}
          {isSold && !isBuyer && ' Only the recorded buyer can leave reviews'}
        </div>
      )}
    </div>
  );
};

export default ReviewRequirements;
