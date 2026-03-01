import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { userAPI } from '../../services/apiService';
import { toast } from 'react-toastify';

const SuggestedUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSuggestions();
  }, []);

  const loadSuggestions = async () => {
    try {
      const response = await userAPI.getSuggestions();
      setUsers(response.data.results || response.data);
    } catch (error) {
      console.error('Error loading suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId) => {
    try {
      await userAPI.followUser(userId);
      setUsers(users.filter(user => user.id !== userId));
      toast.success('Follow request sent!');
    } catch (error) {
      toast.error('Failed to follow user');
    }
  };

  if (loading) {
    return <div className="sidebar-card">Loading suggestions...</div>;
  }

  return (
    <div className="sidebar-card">
      <h3>Suggested for You</h3>
      <div className="suggested-users">
        {users.length === 0 ? (
          <p>No suggestions available</p>
        ) : (
          users.slice(0, 5).map((user) => (
            <div key={user.id} className="suggested-user">
              <Link to={`/profile/${user.id}`} className="user-info">
                <img
                  src={user.profile_picture || '/default-avatar.png'}
                  alt={user.name}
                  className="avatar-small"
                />
                <div>
                  <h5>{user.name}</h5>
                  <p className="text-muted">{user.department_name}</p>
                </div>
              </Link>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => handleFollow(user.id)}
              >
                Follow
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SuggestedUsers;
