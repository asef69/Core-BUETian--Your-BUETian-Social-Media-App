import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { userAPI } from '../../services/apiService';
import Avatar from '../common/Avatar';

const SuggestedUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pendingId, setPendingId] = useState(null);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await userAPI.getSuggestions();
      setUsers(response.data.results || response.data);
    } catch (err) {
      console.error('Error loading suggestions:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId) => {
    setPendingId(userId);
    try {
      await userAPI.followUser(userId);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      toast.success('Follow request sent!');
    } catch (err) {
      toast.error('Failed to follow user');
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="sidebar-card">
      <h3>Suggested for you</h3>

      {loading ? (
        <div className="suggested-users" aria-busy="true" aria-label="Loading suggestions">
          {[0, 1, 2].map((i) => (
            <div className="suggested-user" key={i}>
              <span className="skel suggested-skel-avatar" />
              <span className="skel suggested-skel-line" />
            </div>
          ))}
        </div>
      ) : error ? (
        <p className="text-muted">
          Couldn't load suggestions.{' '}
          <button type="button" className="inline-link-btn" onClick={loadSuggestions}>
            Try again
          </button>
        </p>
      ) : users.length === 0 ? (
        <p className="text-muted">No suggestions right now. Check back later.</p>
      ) : (
        <div className="suggested-users">
          {users.slice(0, 5).map((user) => (
            <div key={user.id} className="suggested-user">
              <Link to={`/profile/${user.id}`} className="user-info">
                <Avatar src={user.profile_picture} name={user.name} size={40} decorative />
                <div>
                  <h5>{user.name}</h5>
                  <p className="text-muted">{user.department_name}</p>
                </div>
              </Link>
              <button
                type="button"
                className="btn btn-sm btn-primary"
                onClick={() => handleFollow(user.id)}
                disabled={pendingId === user.id}
                aria-label={`Follow ${user.name}`}
              >
                Follow
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SuggestedUsers;
