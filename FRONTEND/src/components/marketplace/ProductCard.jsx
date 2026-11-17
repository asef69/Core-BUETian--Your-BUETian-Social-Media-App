import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { DEFAULT_PRODUCT_IMAGE } from '../../config';
import {
  conditionLabel, formatTaka, getProductId, getProductImage, statusOf, STATUS_LABELS,
} from './productUtils';

/**
 * Image-led listing card. The title link stretches over the card (one click target);
 * `actions` buttons sit above it.
 */
const ProductCard = ({ product, actions = null }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const productId = getProductId(product);
  const status = statusOf(product);
  const taken = status !== 'available';

  return (
    <article className={`product-card status-${status}`}>
      <div className="product-media">
        <img
          src={imageFailed ? DEFAULT_PRODUCT_IMAGE : getProductImage(product)}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
        {taken && <span className={`product-flag flag-${status}`}>{STATUS_LABELS[status] || status}</span>}
      </div>

      <div className="product-info">
        <p className="product-price">{formatTaka(product.price)}</p>
        <h3 className="product-title">
          <Link to={`/marketplace/${productId}`}>{product.title}</Link>
        </h3>
        <ul className="product-meta-row">
          {product.condition && <li className="condition-chip">{conditionLabel(product.condition)}</li>}
          {product.location && (
            <li className="product-location">
              <FaMapMarkerAlt aria-hidden="true" /> {product.location}
            </li>
          )}
        </ul>
        {product.buyer_name && taken && (
          <span className={`buyer-badge ${status === 'sold' ? 'sold' : 'reserved'}`}>
            {status === 'sold' ? 'Sold to' : 'Reserved for'} {product.buyer_name}
          </span>
        )}
      </div>

      {actions && <div className="product-actions">{actions}</div>}
    </article>
  );
};

export default ProductCard;
