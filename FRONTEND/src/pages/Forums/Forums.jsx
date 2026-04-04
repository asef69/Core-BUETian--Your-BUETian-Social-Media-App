import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { forumAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaTint, FaBook, FaPlus } from 'react-icons/fa';
import moment from 'moment';
import '../../styles/Forums.css';
import { useAuth } from '../../context/AuthContext';
import { confirmDialog } from '../../utils/confirmDialog';

const Forums = () => {
  const { user: currentUser } = useAuth();
  const initialTuitionData = {
    post_type: 'seeking_tutor',
    subjects: [],
    class_level: '',
    location: '',
    salary_min: '',
    salary_max: '',
    days_per_week: '',
    duration_hours: '',
    requirements: '',
    contact_number: '',
    preferred_gender: 'any',
  };

  const [activeTab, setActiveTab] = useState('blood');
  const [bloodRequests, setBloodRequests] = useState([]);
  const [tuitionPosts, setTuitionPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBloodModal, setShowBloodModal] = useState(false);
  const [showSeekTuitionModal, setShowSeekTuitionModal] = useState(false);
  const [showOfferTuitionModal, setShowOfferTuitionModal] = useState(false);
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
  const [tuitionData, setTuitionData] = useState(initialTuitionData);
  const [subjectInput, setSubjectInput] = useState("");
  const [tuitionFilters, setTuitionFilters] = useState({
    postType: '',
    subject: '',
    location: '',
    minSalary: '',
    preferredGender: '',
  });
  const [bloodFilters, setBloodFilters] = useState({
    bloodGroup: '',
    urgency: '',
    sortByDate: true,
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
      const cleanData = (data) => {
        return Object.fromEntries(
          Object.entries(data).map(([key, value]) => [
            key,
            value === '' ? null : value,
          ])
        );
      };

      if (editingBloodId) {
        await forumAPI.updateBloodRequest(editingBloodId, cleanData(bloodData));
        toast.success('Blood request updated!');
      } else {
        await forumAPI.createBloodRequest(cleanData(bloodData));
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
      // Ensure correct data types and required fields
      const cleanData = (data) => {
        const cleaned = { ...data };
        // Required fields
        if (!cleaned.post_type) throw new Error('Post type is required');
        if (!cleaned.contact_number) throw new Error('Contact number is required');
        // Subjects must be an array
        if (!Array.isArray(cleaned.subjects)) cleaned.subjects = [];
        // Convert empty strings to null for optional fields
        [
          'class_level',
          'location',
          'salary_min',
          'salary_max',
          'days_per_week',
          'duration_hours',
          'requirements',
          'preferred_gender',
        ].forEach((key) => {
          if (cleaned[key] === '') cleaned[key] = null;
        });
        // Convert numeric fields to numbers or null
        ['salary_min', 'salary_max', 'days_per_week', 'duration_hours'].forEach((key) => {
          if (cleaned[key] !== null && cleaned[key] !== undefined && cleaned[key] !== '') {
            const num = Number(cleaned[key]);
            cleaned[key] = isNaN(num) ? null : num;
          }
        });
        // Gender default
        if (!cleaned.preferred_gender) cleaned.preferred_gender = 'any';
        return cleaned;
      };

      const payload = cleanData(tuitionData);

      if (editingTuitionId) {
        await forumAPI.updateTuitionPost(editingTuitionId, payload);
        toast.success('Tuition post updated!');
      } else {
        await forumAPI.createTuitionPost(payload);
        toast.success('Tuition post created!');
      }

      setShowSeekTuitionModal(false);
      setShowOfferTuitionModal(false);
      setEditingTuitionId(null);
      setTuitionData(initialTuitionData);
      loadForums();
    } catch (error) {
      toast.error(error.message || 'Failed to save tuition post');
    }
  };

  const openSeekTuitionModal = () => {
    setEditingTuitionId(null);
    setTuitionData({ ...initialTuitionData, post_type: 'seeking_tutor' });
    setShowOfferTuitionModal(false);
    setShowSeekTuitionModal(true);
  };

  const openOfferTuitionModal = () => {
    setEditingTuitionId(null);
    setTuitionData({ ...initialTuitionData, post_type: 'offering_tuition' });
    setShowSeekTuitionModal(false);
    setShowOfferTuitionModal(true);
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
    await confirmDialog({
      title: 'Delete Blood Request',
      message: 'Are you sure you want to delete this blood request?',
      confirmText: 'Delete',
      confirmLoadingText: 'Deleting...',
      danger: true,
      onConfirmAction: async () => {
        try {
          await forumAPI.deleteBloodRequest(requestId);
          toast.success('Blood request deleted');
          loadForums();
        } catch (error) {
          toast.error('Failed to delete blood request');
          throw error;
        }
      },
    });
  };

  const handleEditTuition = (post) => {
    const postType = post.post_type || 'seeking_tutor';
    setEditingTuitionId(post.id || post.tuition_id);
    setTuitionData({
      post_type: postType,
      subjects: Array.isArray(post.subjects) ? post.subjects : [],
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

    if (postType === 'offering_tuition') {
      setShowSeekTuitionModal(false);
      setShowOfferTuitionModal(true);
    } else {
      setShowOfferTuitionModal(false);
      setShowSeekTuitionModal(true);
    }
  };

  const handleDeleteTuition = async (postId) => {
    await confirmDialog({
      title: 'Delete Tuition Post',
      message: 'Are you sure you want to delete this tuition post?',
      confirmText: 'Delete',
      confirmLoadingText: 'Deleting...',
      danger: true,
      onConfirmAction: async () => {
        try {
          await forumAPI.deleteTuitionPost(postId);
          toast.success('Tuition post deleted');
          loadForums();
        } catch (error) {
          toast.error('Failed to delete tuition post');
          throw error;
        }
      },
    });
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
                  <div className="forum-layout">
                    <div className="forum-posts forum-posts-main">
                      {(() => {
                        let filteredRequests = bloodRequests.filter((request) => {
                          const bloodGroupMatch =
                            bloodFilters.bloodGroup === '' || request.blood_group === bloodFilters.bloodGroup;
                          const urgencyMatch =
                            bloodFilters.urgency === '' || request.urgency === bloodFilters.urgency;
                          return bloodGroupMatch && urgencyMatch;
                        });

                        if (bloodFilters.sortByDate) {
                          filteredRequests = filteredRequests.sort((a, b) => {
                            const dateA = new Date(a.needed_date).getTime();
                            const dateB = new Date(b.needed_date).getTime();

                            if (dateA !== dateB) {
                              return dateA - dateB;
                            }

                            const createdA = new Date(a.created_at).getTime();
                            const createdB = new Date(b.created_at).getTime();
                            return createdA - createdB;
                          });
                        }

                        return filteredRequests.length === 0 ? (
                          <p>No blood requests matching filters</p>
                        ) : (
                          filteredRequests.map((request) => (
                            <div key={request.id || request.request_id} className="forum-post blood-request">
                              <div className="post-header">
                                <div className="blood-group-badge">{request.blood_group}</div>
                                <div className={`urgency-badge urgency-${request.urgency}`}>
                                  {request.urgency}
                                </div>
                              </div>
                              <h3>{request.patient_name}</h3>
                              <p>
                                <strong>Hospital:</strong> {request.hospital_name}
                              </p>
                              <p>
                                <strong>Address:</strong> {request.hospital_address}
                              </p>
                              <p>
                                <strong>Needed Date:</strong>{' '}
                                {moment(request.needed_date).format('MMM DD, YYYY')}
                              </p>
                              <p>
                                <strong>Contact:</strong> {request.contact_number}
                              </p>
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
                                  <button
                                    className="btn btn-danger"
                                    onClick={() => handleDeleteBlood(request.id || request.request_id)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                              {currentUser?.id &&
                                Number(currentUser.id) !== Number(request.requester_id) &&
                                request.requester_id && (
                                  <div className="post-meta">
                                    <Link
                                      to={`/chat/${request.requester_id}?message=${encodeURIComponent(
                                        `Hi, I saw your blood request for ${request.blood_group} at ${request.hospital_name}. I want to help.`
                                      )}`}
                                      className="btn btn-primary"
                                    >
                                      Message Requester
                                    </Link>
                                  </div>
                                )}
                            </div>
                          ))
                        );
                      })()}
                    </div>
                    <div className="tuition-filter-panel">
                      <h3>Filters</h3>
                      <div className="filter-input-group">
                        <label>Blood Group (Optional)</label>
                        <select
                          value={bloodFilters.bloodGroup}
                          onChange={(e) => setBloodFilters({ ...bloodFilters, bloodGroup: e.target.value })}
                        >
                          <option value="">All</option>
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
                      <div className="filter-input-group">
                        <label>Urgency (Optional)</label>
                        <select
                          value={bloodFilters.urgency}
                          onChange={(e) => setBloodFilters({ ...bloodFilters, urgency: e.target.value })}
                        >
                          <option value="">All</option>
                          <option value="low">Low</option>
                          <option value="moderate">Moderate</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>
                      <div className="filter-input-group">
                        <label className="filter-checkbox-label">
                          <input
                            type="checkbox"
                            checked={bloodFilters.sortByDate}
                            onChange={(e) =>
                              setBloodFilters({ ...bloodFilters, sortByDate: e.target.checked })
                            }
                            style={{ marginRight: '8px' }}
                          />
                          Sort by Needed Date (Urgent First)
                        </label>
                      </div>
                      <button
                        onClick={() => setBloodFilters({ bloodGroup: '', urgency: '', sortByDate: true })}
                        className="filter-clear-btn"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'tuition' && (
                <div className="forum-section">
                  <div className="section-header">
                    <h2>Tuition Posts</h2>
                    <div className="section-actions">
                      <button className="btn btn-primary" onClick={openSeekTuitionModal}>
                        <FaPlus />Seek Tutor
                      </button>
                      <button className="btn btn-primary" onClick={openOfferTuitionModal}>
                        <FaPlus />Offer Tuition
                      </button>
                    </div>
                  </div>
                  <div className="forum-layout">
                    <div className="forum-posts forum-posts-main">
                      {(() => {
                        const filteredPosts = tuitionPosts.filter((post) => {
                          const typeMatch =
                            tuitionFilters.postType === '' || post.post_type === tuitionFilters.postType;
                          const subjectMatch =
                            tuitionFilters.subject === '' ||
                            (Array.isArray(post.subjects) &&
                              post.subjects.some((s) =>
                                s.toLowerCase().includes(tuitionFilters.subject.toLowerCase())
                              ));
                          const locationMatch =
                            tuitionFilters.location === '' ||
                            post.location.toLowerCase().includes(tuitionFilters.location.toLowerCase());
                          const salaryMatch =
                            tuitionFilters.minSalary === '' ||
                            (post.salary_min && Number(post.salary_min) >= Number(tuitionFilters.minSalary));
                          const genderMatch =
                            tuitionFilters.preferredGender === '' ||
                            (post.preferred_gender && post.preferred_gender.toLowerCase() === tuitionFilters.preferredGender.toLowerCase());
                          return typeMatch && subjectMatch && locationMatch && salaryMatch && genderMatch;
                        });

                        return filteredPosts.length === 0 ? (
                          <p>No tuition posts available</p>
                        ) : (
                          filteredPosts.map((post) => (
                            <div key={post.id || post.tuition_id} className="forum-post tuition-post">
                              {(() => {
                                const posterId = Number(post.poster_id || post.user_id || post.poster?.id || 0);
                                const messageText = `Hi, I am interested in your tuition post for ${post.class_level} at ${post.location}.`;
                                return (
                                  <>
                                    <div className="post-type-badge">
                                      {post.post_type === 'seeking_tutor'
                                        ? 'Seeking Tutor'
                                        : 'Offering Tuition'}
                                    </div>
                                    <h3>Grade : {post.class_level}</h3>
                                    <p>
                                      <strong>Subject(s):</strong>{' '}
                                      {Array.isArray(post.subjects) && post.subjects.length > 0
                                        ? post.subjects.join(', ')
                                        : 'N/A'}
                                    </p>
                                    <p>
                                      <strong>Location:</strong> {post.location}
                                    </p>
                                    <p>
                                      <strong>Salary Range:</strong> ৳{post.salary_min} 
                                    </p>
                                    <p>
                                      <strong>Days per Week:</strong> {post.days_per_week}
                                    </p>
                                    <p>
                                      <strong>Duration:</strong> {post.duration_hours} hours
                                    </p>
                                    <p>
                                      <strong>{post.post_type === 'offering_tuition' ? 'Student Preferred Gender' : 'Tutor Preferred Gender'}:</strong> {post.preferred_gender}
                                    </p>
                                    {post.requirements && (
                                      <p>
                                        <strong>Requirements:</strong> {post.requirements}
                                      </p>
                                    )}
                                    <p>
                                      <strong>Contact:</strong> {post.contact_number}
                                    </p>
                                    <div className="post-meta">
                                      <span>Posted {moment.utc(post.created_at).local().fromNow()}</span>
                                      <span className="status-badge">{post.status}</span>
                                    </div>
                                    {currentUser?.id && Number(currentUser.id) === posterId && (
                                      <div className="post-meta">
                                        <button className="btn btn-secondary" onClick={() => handleEditTuition(post)}>
                                          Edit
                                        </button>
                                        <button
                                          className="btn btn-danger"
                                          onClick={() => handleDeleteTuition(post.id || post.tuition_id)}
                                        >
                                          Delete/Booked
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
                        );
                      })()}
                    </div>
                    <div className="tuition-filter-panel">
                      <h3>Filters</h3>
                      <div className="filter-type-buttons">
                        <button
                          onClick={() => setTuitionFilters({ ...tuitionFilters, postType: '' })}
                          className={`filter-type-btn ${
                            tuitionFilters.postType === '' ? 'active-all' : ''
                          }`}
                        >
                          All
                        </button>
                        <button
                          onClick={() =>
                            setTuitionFilters({ ...tuitionFilters, postType: 'seeking_tutor' })
                          }
                          className={`filter-type-btn ${
                            tuitionFilters.postType === 'seeking_tutor' ? 'active-seek' : ''
                          }`}
                        >
                          Seek
                        </button>
                        <button
                          onClick={() =>
                            setTuitionFilters({ ...tuitionFilters, postType: 'offering_tuition' })
                          }
                          className={`filter-type-btn ${
                            tuitionFilters.postType === 'offering_tuition' ? 'active-offer' : ''
                          }`}
                        >
                          Offer
                        </button>
                      </div>
                      <div className="filter-input-group">
                        <label>Subject (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g., Math, Physics"
                          value={tuitionFilters.subject}
                          onChange={(e) => setTuitionFilters({ ...tuitionFilters, subject: e.target.value })}
                        />
                      </div>
                      <div className="filter-input-group">
                        <label>Location (Optional)</label>
                        <input
                          type="text"
                          placeholder="e.g., Dhaka, Gulshan"
                          value={tuitionFilters.location}
                          onChange={(e) => setTuitionFilters({ ...tuitionFilters, location: e.target.value })}
                        />
                      </div>
                      <div className="filter-input-group">
                        <label>Min Salary (Optional)</label>
                        <input
                          type="number"
                          placeholder="e.g., 5000"
                          value={tuitionFilters.minSalary}
                          onChange={(e) =>
                            setTuitionFilters({ ...tuitionFilters, minSalary: e.target.value })
                          }
                        />
                      </div>
                      <div className="filter-input-group">
                        <label>Preferred Gender (Optional)</label>
                        <select
                          value={tuitionFilters.preferredGender}
                          onChange={(e) => setTuitionFilters({ ...tuitionFilters, preferredGender: e.target.value })}
                        >
                          <option value="">All</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                      <button
                        onClick={() =>
                          setTuitionFilters({ postType: '', subject: '', location: '', minSalary: '', preferredGender: '' })
                        }
                        className="filter-clear-btn"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

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
                  <label>Needed Date *</label>
                  <input
                    type="date"
                    value={bloodData.needed_date}
                    onChange={(e) => setBloodData({ ...bloodData, needed_date: e.target.value })}
                    required
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

      {showSeekTuitionModal && (
        <div className="modal-overlay" onClick={() => setShowSeekTuitionModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingTuitionId ? 'Update Seek Tutor Post' : 'Create Seek Tutor Post'}</h2>
            <form onSubmit={handleCreateTuitionPost}>
              <div className="form-group">
                <label>Subject(s) *</label>
                <input
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  list="general-subjects"
                  placeholder="Add subject and press Enter"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = subjectInput.trim();
                      if (val && !tuitionData.subjects.includes(val)) {
                        setTuitionData({
                          ...tuitionData,
                          subjects: [...tuitionData.subjects, val],
                        });
                        setSubjectInput("");
                      }
                    }
                  }}
                />
                <datalist id="general-subjects">
                  <option value="Mathematics" />
                  <option value="Physics" />
                  <option value="Chemistry" />
                  <option value="Biology" />
                  <option value="English" />
                  <option value="Bangla" />
                  <option value="ICT" />
                  <option value="General Science" />
                  <option value="Social Science" />
                  <option value="Economics" />
                  <option value="Accounting" />
                  <option value="Business Studies" />
                  <option value="Higher Math" />
                  <option value="Islamic Studies" />
                  <option value="Geography" />
                  <option value="Civics" />
                </datalist>
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tuitionData.subjects && tuitionData.subjects.map((subj) => (
                    <span key={subj} className="subject-chip">
                      {subj}
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => setTuitionData({ ...tuitionData, subjects: tuitionData.subjects.filter(s => s !== subj) })}
                      >&times;</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Class Level *</label>
                <select
                  value={tuitionData.class_level}
                  onChange={(e) => setTuitionData({ ...tuitionData, class_level: e.target.value })}
                  required
                >
                  <option value="">Select class</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i+1} value={`Class ${i+1}`}>{`Class ${i+1}`}</option>
                  ))}
                  <option value="SSC">SSC</option>
                  <option value="HSC">HSC</option>
                  <option value="University">University</option>
                </select>
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
                <label>Tutor Preferred Gender</label>
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
                <label>Tutor Requirements</label>
                <textarea
                  value={tuitionData.requirements}
                  onChange={(e) => setTuitionData({ ...tuitionData, requirements: e.target.value })}
                  rows="3"
                  placeholder="Preferred background, subjects, or teaching expectations"
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  {editingTuitionId ? 'Update Post' : 'Create Post'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowSeekTuitionModal(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showOfferTuitionModal && (
        <div className="modal-overlay" onClick={() => setShowOfferTuitionModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <h2>{editingTuitionId ? 'Update Offer Tuition Post' : 'Create Offer Tuition Post'}</h2>
            <form onSubmit={handleCreateTuitionPost}>
              <div className="form-group">
                <label>Subject(s) *</label>
                <input
                  value={subjectInput}
                  onChange={(e) => setSubjectInput(e.target.value)}
                  list="general-subjects"
                  placeholder="Add subject and press Enter"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = subjectInput.trim();
                      if (val && !tuitionData.subjects.includes(val)) {
                        setTuitionData({
                          ...tuitionData,
                          subjects: [...tuitionData.subjects, val],
                        });
                        setSubjectInput("");
                      }
                    }
                  }}
                />
                <datalist id="general-subjects">
                  <option value="Mathematics" />
                  <option value="Physics" />
                  <option value="Chemistry" />
                  <option value="Biology" />
                  <option value="English" />
                  <option value="Bangla" />
                  <option value="ICT" />
                  <option value="General Science" />
                  <option value="Social Science" />
                  <option value="Economics" />
                  <option value="Accounting" />
                  <option value="Business Studies" />
                  <option value="Higher Math" />
                  <option value="Islamic Studies" />
                  <option value="Geography" />
                  <option value="Civics" />
                </datalist>
                <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {tuitionData.subjects && tuitionData.subjects.map((subj) => (
                    <span key={subj} className="subject-chip">
                      {subj}
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => setTuitionData({ ...tuitionData, subjects: tuitionData.subjects.filter(s => s !== subj) })}
                      >&times;</button>
                    </span>
                  ))}
                </div>
              </div>
              <div className="form-group">
                <label>Student Preferred Gender</label>
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
                <label>Class Level *</label>
                <select
                  value={tuitionData.class_level}
                  onChange={(e) => setTuitionData({ ...tuitionData, class_level: e.target.value })}
                  required
                >
                  <option value="">Select class</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i+1} value={`Class ${i+1}`}>{`Class ${i+1}`}</option>
                  ))}
                  <option value="SSC">SSC</option>
                  <option value="HSC">HSC</option>
                  <option value="University">University</option>
                </select>
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
                  <label>Min Salary *</label>
                  <input
                    type="number"
                    min="1000"
                    value={tuitionData.salary_min}
                    onChange={(e) => setTuitionData({ ...tuitionData, salary_min: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Days per Week *</label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    step="1"
                    value={tuitionData.days_per_week}
                    onChange={(e) => setTuitionData({ ...tuitionData, days_per_week: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Duration (hours) *</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="24"
                    value={tuitionData.duration_hours}
                    onChange={(e) => setTuitionData({ ...tuitionData, duration_hours: e.target.value })}
                    required
                  />
                </div>
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
                <label>Qualifications / Experience</label>
                <textarea
                  value={tuitionData.requirements}
                  onChange={(e) => setTuitionData({ ...tuitionData, requirements: e.target.value })}
                  rows="3"
                  placeholder="Mention subjects, academic background, and teaching experience"
                />
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  {editingTuitionId ? 'Update Post' : 'Create Post'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowOfferTuitionModal(false)}
                >
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
