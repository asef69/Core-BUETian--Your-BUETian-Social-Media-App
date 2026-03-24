import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { forumAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaTint, FaBook, FaPlus } from 'react-icons/fa';
import moment from 'moment';
import '../../styles/Forums.css';
import { useAuth } from '../../context/AuthContext';

const Forums = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('blood');
  const [bloodRequests, setBloodRequests] = useState([]);
  const [tuitionPosts, setTuitionPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBloodModal, setShowBloodModal] = useState(false);
  const [showTuitionModal, setShowTuitionModal] = useState(false);
  const [editingBloodId, setEditingBloodId] = useState(null);
  const [editingTuitionId, setEditingTuitionId] = useState(null);
  const [bloodData, setBloodData] = useState({
    blood_group: '',
    patient_name: '',
    hospital_name: '',
    hospital_address: '',
    contact_number: '',
    needed_date: '',
    urgency: 'moderate',
    description: '',
  });
  const [tuitionData, setTuitionData] = useState({
    post_type: 'seeking_tutor',
    class_level: '',
    location: '',
    salary_min: '',
    salary_max: '',
    days_per_week: '',
    duration_hours: '',
    requirements: '',
    contact_number: '',
    preferred_gender: 'any',
  });

  useEffect(() => {
    loadForums();
  }, []);

  const loadForums = async () => {
    try {
      const [bloodRes, tuitionRes] = await Promise.all([
        forumAPI.getBloodRequests(),
        forumAPI.getTuitionPosts(),
      ]);
      setBloodRequests(bloodRes.data.results || bloodRes.data);
      setTuitionPosts(tuitionRes.data.results || tuitionRes.data);
    } catch (error) {
      console.error('Error loading forums:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBloodRequest = async (e) => {
    e.preventDefault();
    try {
      if (editingBloodId) {
        await forumAPI.updateBloodRequest(editingBloodId, bloodData);
        toast.success('Blood request updated!');
      } else {
        await forumAPI.createBloodRequest(bloodData);
        toast.success('Blood request posted!');
      }
      setShowBloodModal(false);
      setEditingBloodId(null);
      setBloodData({
        blood_group: '',
        patient_name: '',
        hospital_name: '',
        hospital_address: '',
        contact_number: '',
        needed_date: '',
        urgency: 'moderate',
        description: '',
      });
      loadForums();
    } catch (error) {
      toast.error('Failed to save blood request');
    }
  };

  const handleCreateTuitionPost = async (e) => {
    e.preventDefault();
    try {
      if (editingTuitionId) {
        await forumAPI.updateTuitionPost(editingTuitionId, tuitionData);
        toast.success('Tuition post updated!');
      } else {
        await forumAPI.createTuitionPost(tuitionData);
        toast.success('Tuition post created!');
      }
      setShowTuitionModal(false);
      setEditingTuitionId(null);
      setTuitionData({
        post_type: 'seeking_tutor',
        class_level: '',
        location: '',
        salary_min: '',
        salary_max: '',
        days_per_week: '',
        duration_hours: '',
        requirements: '',
        contact_number: '',
        preferred_gender: 'any',
      });
      loadForums();
    } catch (error) {
      toast.error('Failed to save tuition post');
    }
  };

  const handleEditBlood = (request) => {
    setEditingBloodId(request.id || request.request_id);
    setBloodData({
      blood_group: request.blood_group || '',
      patient_name: request.patient_name || '',
      hospital_name: request.hospital_name || '',
      hospital_address: request.hospital_address || '',
      contact_number: request.contact_number || '',
      needed_date: request.needed_date || '',
      urgency: request.urgency || 'moderate',
      description: request.description || '',
    });
    setShowBloodModal(true);
  };

  const handleDeleteBlood = async (requestId) => {
    if (!window.confirm('Delete this blood request?')) return;
    try {
      await forumAPI.deleteBloodRequest(requestId);
      toast.success('Blood request deleted');
      loadForums();
    } catch (error) {
      toast.error('Failed to delete blood request');
    }
  };

  const handleEditTuition = (post) => {
    setEditingTuitionId(post.id || post.tuition_id);
    setTuitionData({
      post_type: post.post_type || 'seeking_tutor',
      class_level: post.class_level || '',
      location: post.location || '',
      salary_min: post.salary_min || '',
      salary_max: post.salary_max || '',
      days_per_week: post.days_per_week || '',
      duration_hours: post.duration_hours || '',
      requirements: post.requirements || '',
      contact_number: post.contact_number || '',
      preferred_gender: post.preferred_gender || 'any',
    });
    setShowTuitionModal(true);
  };

  const handleDeleteTuition = async (postId) => {
    if (!window.confirm('Delete this tuition post?')) return;
    try {
      await forumAPI.deleteTuitionPost(postId);
      toast.success('Tuition post deleted');
      loadForums();
    } catch (error) {
      toast.error('Failed to delete tuition post');
    }
  };

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container">
          <div className="forums-header">
            <h1>Forums</h1>
          </div>

          <div className="forums-tabs">
            <button
              className={`tab ${activeTab === 'blood' ? 'active' : ''}`}
              onClick={() => setActiveTab('blood')}
            >
              <FaTint /> Blood Donation
            </button>
            <button
              className={`tab ${activeTab === 'tuition' ? 'active' : ''}`}
              onClick={() => setActiveTab('tuition')}
            >
              <FaBook /> Tuition
            </button>
          </div>

          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              {activeTab === 'blood' && (
                <div className="forum-section">
                  <div className="section-header">
                    <h2>Blood Donation Requests</h2>
                    <button className="btn btn-primary" onClick={() => setShowBloodModal(true)}>
                      <FaPlus /> Create Request
                    </button>
                  </div>
                  <div className="forum-posts">
                    {bloodRequests.length === 0 ? (
                      <p>No blood requests at the moment</p>
                    ) : (
                      bloodRequests.map((request) => (
                        <div key={request.id || request.request_id} className="forum-post blood-request">
                          <div className="post-header">
                            <div className="blood-group-badge">{request.blood_group}</div>
                            <div className={`urgency-badge urgency-${request.urgency}`}>
                              {request.urgency}
                            </div>
                          </div>
                          <h3>{request.patient_name}</h3>
                          <p><strong>Hospital:</strong> {request.hospital_name}</p>
                          <p><strong>Address:</strong> {request.hospital_address}</p>
                          <p><strong>Needed Date:</strong> {moment(request.needed_date).format('MMM DD, YYYY')}</p>
                          <p><strong>Contact:</strong> {request.contact_number}</p>
                          {request.description && <p>{request.description}</p>}
                          <div className="post-meta">
                            <span>Posted {moment.utc(request.created_at).local().fromNow()}</span>
                            <span className="status-badge">{request.status}</span>
                          </div>
                          {currentUser?.id && Number(currentUser.id) === Number(request.requester_id) && (
                            <div className="post-meta">
                              <button className="btn btn-secondary" onClick={() => handleEditBlood(request)}>
                                Edit
                              </button>
                              <button className="btn btn-danger" onClick={() => handleDeleteBlood(request.id || request.request_id)}>
                                Delete
                              </button>
                            </div>
                          )}
                          {currentUser?.id && Number(currentUser.id) !== Number(request.requester_id) && request.requester_id && (
                            <div className="post-meta">
                              <Link
                                to={`/chat/${request.requester_id}?message=${encodeURIComponent(`Hi, I saw your blood request for ${request.blood_group} at ${request.hospital_name}. I want to help.`)}`}
                                className="btn btn-primary"
                              >
                                Message Requester
                              </Link>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'tuition' && (
                <div className="forum-section">
                  <div className="section-header">
                    <h2>Tuition Posts</h2>
                    <button className="btn btn-primary" onClick={() => setShowTuitionModal(true)}>
                      <FaPlus /> Create Post
                    </button>
                  </div>
                  <div className="forum-posts">
                    {tuitionPosts.length === 0 ? (
                      <p>No tuition posts available</p>
                    ) : (
                      tuitionPosts.map((post) => (
                        <div key={post.id || post.tuition_id} className="forum-post tuition-post">
                          {(() => {
                            const posterId = Number(post.poster_id || post.user_id || post.poster?.id || 0);
                            const messageText = `Hi, I am interested in your tuition post for ${post.class_level} at ${post.location}.`;
                            return (
                              <>
                          <div className="post-type-badge">
                            {post.post_type === 'seeking_tutor' ? 'Seeking Tutor' : 'Offering Tuition'}
                          </div>
                          <h3>{post.class_level}</h3>
                          <p><strong>Location:</strong> {post.location}</p>
                          <p><strong>Salary Range:</strong> ${post.salary_min} - ${post.salary_max}</p>
                          <p><strong>Days per Week:</strong> {post.days_per_week}</p>
                          <p><strong>Duration:</strong> {post.duration_hours} hours</p>
                          <p><strong>Preferred Gender:</strong> {post.preferred_gender}</p>
                          {post.requirements && <p><strong>Requirements:</strong> {post.requirements}</p>}
                          <p><strong>Contact:</strong> {post.contact_number}</p>
                          <div className="post-meta">
                            <span>Posted {moment.utc(post.created_at).local().fromNow()}</span>
                            <span className="status-badge">{post.status}</span>
                          </div>
                          {currentUser?.id && Number(currentUser.id) === posterId && (
                            <div className="post-meta">
                              <button className="btn btn-secondary" onClick={() => handleEditTuition(post)}>
                                Edit
                              </button>
                              <button className="btn btn-danger" onClick={() => handleDeleteTuition(post.id || post.tuition_id)}>
                                Delete
                              </button>
                            </div>
                          )}
                          {currentUser?.id && Number(currentUser.id) !== posterId && posterId > 0 && (
                            <div className="post-meta">
                              <Link
                                to={`/chat/${posterId}?message=${encodeURIComponent(messageText)}`}
                                className="btn btn-primary"
                              >
                                Message Poster
                              </Link>
                            </div>
                          )}
                              </>
                            );
                          })()}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </div>

      {/* Blood Request Modal */}
      {showBloodModal && (
        <div className="modal-overlay" onClick={() => setShowBloodModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h2>Create Blood Donation Request</h2>
            <form onSubmit={handleCreateBloodRequest}>
              <div className="form-row">
                <div className="form-group">
                  <label>Blood Group *</label>
                  <select
                    value={bloodData.blood_group}
                    onChange={(e) => setBloodData({ ...bloodData, blood_group: e.target.value })}
                    required
                  >
                    <option value="">Select</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Urgency</label>
                  <select
                    value={bloodData.urgency}
                    onChange={(e) => setBloodData({ ...bloodData, urgency: e.target.value })}
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Patient Name *</label>
                <input
                  type="text"
                  value={bloodData.patient_name}
                  onChange={(e) => setBloodData({ ...bloodData, patient_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Hospital Name *</label>
                <input
                  type="text"
                  value={bloodData.hospital_name}
                  onChange={(e) => setBloodData({ ...bloodData, hospital_name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Hospital Address</label>
                <textarea
                  value={bloodData.hospital_address}
                  onChange={(e) => setBloodData({ ...bloodData, hospital_address: e.target.value })}
                  rows="2"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Contact Number *</label>
                  <input
                    type="tel"
                    value={bloodData.contact_number}
                    onChange={(e) => setBloodData({ ...bloodData, contact_number: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Needed Date</label>
                  <input
                    type="date"
                    value={bloodData.needed_date}
                    onChange={(e) => setBloodData({ ...bloodData, needed_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={bloodData.description}
                  onChange={(e) => setBloodData({ ...bloodData, description: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  {editingBloodId ? 'Update Request' : 'Create Request'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBloodModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tuition Post Modal */}
      {showTuitionModal && (
        <div className="modal-overlay" onClick={() => setShowTuitionModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h2>Create Tuition Post</h2>
            <form onSubmit={handleCreateTuitionPost}>
              <div className="form-group">
                <label>Post Type</label>
                <select
                  value={tuitionData.post_type}
                  onChange={(e) => setTuitionData({ ...tuitionData, post_type: e.target.value })}
                >
                  <option value="seeking_tutor">Seeking Tutor</option>
                  <option value="offering_tuition">Offering Tuition</option>
                </select>
              </div>
              <div className="form-group">
                <label>Class Level *</label>
                <input
                  type="text"
                  value={tuitionData.class_level}
                  onChange={(e) => setTuitionData({ ...tuitionData, class_level: e.target.value })}
                  placeholder="e.g., Grade 10, SSC, HSC"
                  required
                />
              </div>
              <div className="form-group">
                <label>Location *</label>
                <input
                  type="text"
                  value={tuitionData.location}
                  onChange={(e) => setTuitionData({ ...tuitionData, location: e.target.value })}
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Min Salary</label>
                  <input
                    type="number"
                    min="1000"
                    value={tuitionData.salary_min}
                    onChange={(e) => setTuitionData({ ...tuitionData, salary_min: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Max Salary</label>
                  <input
                    type="number"
                    value={tuitionData.salary_max}
                    onChange={(e) => setTuitionData({ ...tuitionData, salary_max: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Days per Week</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    step="1"
                    value={tuitionData.days_per_week}
                    onChange={(e) => setTuitionData({ ...tuitionData, days_per_week: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Duration (hours)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={tuitionData.duration_hours}
                    onChange={(e) => setTuitionData({ ...tuitionData, duration_hours: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Preferred Gender</label>
                <select
                  value={tuitionData.preferred_gender}
                  onChange={(e) => setTuitionData({ ...tuitionData, preferred_gender: e.target.value })}
                >
                  <option value="any">Any</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="form-group">
                <label>Contact Number *</label>
                <input
                  type="tel"
                  value={tuitionData.contact_number}
                  onChange={(e) => setTuitionData({ ...tuitionData, contact_number: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Requirements</label>
                <textarea
                  value={tuitionData.requirements}
                  onChange={(e) => setTuitionData({ ...tuitionData, requirements: e.target.value })}
                  rows="3"
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  {editingTuitionId ? 'Update Post' : 'Create Post'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowTuitionModal(false)}>
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

export default Forums;
