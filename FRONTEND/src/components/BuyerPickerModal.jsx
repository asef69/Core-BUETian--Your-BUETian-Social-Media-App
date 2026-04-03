import React, { useEffect, useState } from 'react';
import { userAPI } from '../services/apiService';
import { FaSearch, FaTimes, FaUser } from 'react-icons/fa';

const BuyerPickerModal = ({ open, title, description, initialBuyer = '', onClose, onSelect }) => {
  const [query, setQuery] = useState(initialBuyer ? String(initialBuyer) : '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setQuery(initialBuyer ? String(initialBuyer) : '');
      setResults([]);
      setError('');
    }
  }, [open, initialBuyer]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError('');
      return undefined;
    }

    let active = true;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError('');
      try {
        const response = await userAPI.searchUsers(trimmed);
        if (!active) return;
        setResults(response.data.results || []);
      } catch (err) {
        if (!active) return;
        setResults([]);
        setError(err?.response?.data?.error || 'Failed to search buyers');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [open, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="modal-overlay buyer-picker-overlay" onClick={onClose}>
      <div className="modal-content buyer-picker-modal" onClick={(event) => event.stopPropagation()}>
        <div className="buyer-picker-header">
          <div>
            <h2>{title || 'Select Buyer'}</h2>
            <p>{description || 'Search for the buyer who should be linked to this product.'}</p>
          </div>
          <button type="button" className="buyer-picker-close" onClick={onClose} aria-label="Close picker">
            <FaTimes />
          </button>
        </div>

        <label className="buyer-picker-search">
          <FaSearch />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or student ID"
            autoFocus
          />
        </label>

        {loading && <div className="buyer-picker-state">Searching buyers...</div>}
        {!loading && error && <div className="buyer-picker-state buyer-picker-error">{error}</div>}
        {!loading && !error && query.trim() && results.length === 0 && (
          <div className="buyer-picker-state">No matching users found.</div>
        )}

        <div className="buyer-picker-results">
          {results.map((buyer) => (
            <button
              key={buyer.id}
              type="button"
              className="buyer-picker-result"
              onClick={() => onSelect(buyer)}
            >
              <div className="buyer-picker-avatar">
                {buyer.profile_picture ? (
                  <img src={buyer.profile_picture} alt={buyer.name} />
                ) : (
                  <FaUser />
                )}
              </div>
              <div className="buyer-picker-details">
                <strong>{buyer.name}</strong>
                <span>ID: {buyer.student_id}</span>
                <span>
                  {[buyer.department_name, buyer.batch ? `Batch ${buyer.batch}` : null]
                    .filter(Boolean)
                    .join(' • ') || 'No department information'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BuyerPickerModal;