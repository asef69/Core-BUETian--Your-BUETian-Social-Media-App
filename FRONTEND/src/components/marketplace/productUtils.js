import { toAbsoluteMediaUrl, DEFAULT_PRODUCT_IMAGE } from '../../config';

export const PRODUCT_CATEGORIES = [
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

export const CONDITION_LABELS = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

export const getProductId = (product) => product?.product_id || product?.id || product?.pk;

/** All images for a product as absolute URLs (falls back to the placeholder). */
export const getProductImages = (product) => {
  const list = Array.isArray(product?.images) ? product.images.filter(Boolean) : [];
  const urls = list.length > 0 ? list : [product?.image].filter(Boolean);
  return urls.length > 0 ? urls.map(toAbsoluteMediaUrl) : [DEFAULT_PRODUCT_IMAGE];
};

export const getProductImage = (product) => getProductImages(product)[0];

/** "৳1,200" */
export const formatTaka = (value) => {
  const number = Number(value);
  if (value === null || value === undefined || value === '' || Number.isNaN(number)) return '';
  return `৳${number.toLocaleString('en-US')}`;
};

export const conditionLabel = (value) =>
  CONDITION_LABELS[value] || String(value || '').replace(/_/g, ' ');

export const statusOf = (product) => String(product?.status || 'available').toLowerCase();

export const STATUS_LABELS = { available: 'Available', reserved: 'Reserved', sold: 'Sold' };
