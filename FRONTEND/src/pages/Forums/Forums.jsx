import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { forumAPI } from '../../services/apiService';
import Navbar from '../../components/Navbar';
import { toast } from 'react-toastify';
import { FaTint, FaBook, FaPlus, FaFilter, FaExclamationCircle } from 'react-icons/fa';
import BloodRequestCard from '../../components/forums/BloodRequestCard';
import TuitionCard from '../../components/forums/TuitionCard';
import '../../styles/Forums.css';
import { useAuth } from '../../context/AuthContext';
import { confirmDialog } from '../../utils/confirmDialog';
import { toTimestamp, dhakaDayKey } from '../../utils/time';

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
  const [loadError, setLoadError] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  useEffect(() => {
    if (!showBloodModal && !showSeekTuitionModal && !showOfferTuitionModal) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setShowBloodModal(false);
      setShowSeekTuitionModal(false);
      setShowOfferTuitionModal(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showBloodModal, showSeekTuitionModal, showOfferTuitionModal]);

  const loadForums = async () => {
    try {
      setLoadError(false);
      const [bloodRes, tuitionRes] = await Promise.all([
        forumAPI.getBloodRequests(),
        forumAPI.getTuitionPosts(),
      ]);
      setBloodRequests(bloodRes.data.results || bloodRes.data);
      setTuitionPosts(tuitionRes.data.results || tuitionRes.data);
    } catch (error) {
      console.error('Error loading forums:', error);
      setLoadError(true);
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

  const isOwnerOf = (ownerId) =>
    Boolean(currentUser?.id) && Boolean(ownerId) && Number(currentUser.id) === Number(ownerId);

  const filteredRequests = bloodRequests
    .filter((request) => {
      const bloodGroupMatch = bloodFilters.bloodGroup === '' || request.blood_group === bloodFilters.bloodGroup;
      const urgencyMatch = bloodFilters.urgency === '' || request.urgency === bloodFilters.urgency;
      return bloodGroupMatch && urgencyMatch;
    })
    .sort((a, b) => {
      if (!bloodFilters.sortByDate) return 0;
      // Upcoming requests first (soonest on top); dates already past go to the end.
      const today = toTimestamp(dhakaDayKey(new Date()));
      const aPast = toTimestamp(a.needed_date) < today ? 1 : 0;
      const bPast = toTimestamp(b.needed_date) < today ? 1 : 0;
      if (aPast !== bPast) return aPast - bPast;
      const dateDiff = toTimestamp(a.needed_date) - toTimestamp(b.needed_date);
      return dateDiff !== 0 ? dateDiff : toTimestamp(a.created_at) - toTimestamp(b.created_at);
    });

  const filteredTuition = tuitionPosts.filter((post) => {
    const typeMatch = tuitionFilters.postType === '' || post.post_type === tuitionFilters.postType;
    const subjectMatch =
      tuitionFilters.subject === '' ||
      (Array.isArray(post.subjects) &&
        post.subjects.some((s) => s.toLowerCase().includes(tuitionFilters.subject.toLowerCase())));
    const locationMatch =
      tuitionFilters.location === '' ||
      String(post.location || '').toLowerCase().includes(tuitionFilters.location.toLowerCase());
    const salaryMatch =
      tuitionFilters.minSalary === '' ||
      (post.salary_min && Number(post.salary_min) >= Number(tuitionFilters.minSalary));
    const genderMatch =
      tuitionFilters.preferredGender === '' ||
      (post.preferred_gender && post.preferred_gender.toLowerCase() === tuitionFilters.preferredGender.toLowerCase());
    return typeMatch && subjectMatch && locationMatch && salaryMatch && genderMatch;
  });

  const bloodFilterCount = (bloodFilters.bloodGroup ? 1 : 0) + (bloodFilters.urgency ? 1 : 0);
  const tuitionFilterCount = Object.values(tuitionFilters).filter(Boolean).length;
  const activeFilterCount = activeTab === 'blood' ? bloodFilterCount : tuitionFilterCount;

  const clearBloodFilters = () => setBloodFilters({ bloodGroup: '', urgency: '', sortByDate: true });
  const clearTuitionFilters = () =>
    setTuitionFilters({ postType: '', subject: '', location: '', minSalary: '', preferredGender: '' });

  const renderSkeletons = () => (
    <div aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div className="forum-card forum-card-skeleton" key={i} aria-hidden="true">
          <span className="skel forum-skel-tile" />
          <div className="forum-card-main">
            <span className="skel forum-skel-line" style={{ width: '45%', height: 16 }} />
            <span className="skel forum-skel-line" style={{ width: '80%' }} />
            <span className="skel forum-skel-line" style={{ width: '60%' }} />
          </div>
        </div>
      ))}
    </div>
  );

  const renderBloodFilters = () => (
    <>
      <div className="filter-input-group">
        <label htmlFor="blood-group-filter">Blood group</label>
        <select
          id="blood-group-filter"
          value={bloodFilters.bloodGroup}
          onChange={(e) => setBloodFilters({ ...bloodFilters, bloodGroup: e.target.value })}
        >
          <option value="">All</option>
          {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map((group) => (
            <option key={group} value={group}>{group}</option>
          ))}
        </select>
      </div>
      <div className="filter-input-group">
        <label htmlFor="urgency-filter">Urgency</label>
        <select
          id="urgency-filter"
          value={bloodFilters.urgency}
          onChange={(e) => setBloodFilters({ ...bloodFilters, urgency: e.target.value })}
        >
          <option value="">All</option>
          <option value="low">Low</option>
          <option value="moderate">Moderate</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>
      <label className="filter-checkbox-label">
        <input
          type="checkbox"
          checked={bloodFilters.sortByDate}
          onChange={(e) => setBloodFilters({ ...bloodFilters, sortByDate: e.target.checked })}
        />
        Soonest needed first
      </label>
      <button type="button" onClick={clearBloodFilters} className="filter-clear-btn" disabled={bloodFilterCount === 0}>
        Clear filters
      </button>
    </>
  );

  const renderTuitionFilters = () => (
    <>
      <div className="filter-type-buttons" role="group" aria-label="Post type">
        {[
          ['', 'All'],
          ['seeking_tutor', 'Seeking'],
          ['offering_tuition', 'Offering'],
        ].map(([value, label]) => (
          <button
            key={value || 'all'}
            type="button"
            aria-pressed={tuitionFilters.postType === value}
            onClick={() => setTuitionFilters({ ...tuitionFilters, postType: value })}
            className={`filter-type-btn ${tuitionFilters.postType === value ? 'active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="filter-input-group">
        <label htmlFor="subject-filter">Subject</label>
        <input
          id="subject-filter"
          type="text"
          placeholder="e.g. Math, Physics"
          value={tuitionFilters.subject}
          onChange={(e) => setTuitionFilters({ ...tuitionFilters, subject: e.target.value })}
        />
      </div>
      <div className="filter-input-group">
        <label htmlFor="location-filter">Location</label>
        <input
          id="location-filter"
          type="text"
          placeholder="e.g. Dhaka, Gulshan"
          value={tuitionFilters.location}
          onChange={(e) => setTuitionFilters({ ...tuitionFilters, location: e.target.value })}
        />
      </div>
      <div className="filter-input-group">
        <label htmlFor="salary-filter">Minimum salary (৳)</label>
        <input
          id="salary-filter"
          type="number"
          min="0"
          placeholder="e.g. 5000"
          value={tuitionFilters.minSalary}
          onChange={(e) => setTuitionFilters({ ...tuitionFilters, minSalary: e.target.value })}
        />
      </div>
      <div className="filter-input-group">
        <label htmlFor="gender-filter">Preferred gender</label>
        <select
          id="gender-filter"
          value={tuitionFilters.preferredGender}
          onChange={(e) => setTuitionFilters({ ...tuitionFilters, preferredGender: e.target.value })}
        >
          <option value="">All</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
      </div>
      <button type="button" onClick={clearTuitionFilters} className="filter-clear-btn" disabled={tuitionFilterCount === 0}>
        Clear filters
      </button>
    </>
  );

  const results = activeTab === 'blood' ? filteredRequests : filteredTuition;
  const total = activeTab === 'blood' ? bloodRequests.length : tuitionPosts.length;

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container forums-page">
          <div className="forums-header">
            <div>
              <h1>Forums</h1>
              <p className="page-subtitle">Ask for blood donors, or find and offer tuition within the BUET community.</p>
            </div>
          </div>

          <div className="forums-tabs" role="tablist" aria-label="Forum sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'blood'}
              className={`tab ${activeTab === 'blood' ? 'active' : ''}`}
              onClick={() => { setActiveTab('blood'); setFiltersOpen(false); }}
            >
              <FaTint aria-hidden="true" /> Blood donation
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tuition'}
              className={`tab ${activeTab === 'tuition' ? 'active' : ''}`}
              onClick={() => { setActiveTab('tuition'); setFiltersOpen(false); }}
            >
              <FaBook aria-hidden="true" /> Tuition
            </button>
          </div>

          <div className="section-header">
            <p className="results-count" aria-live="polite">
              {loading || loadError ? '' : `Showing ${results.length} of ${total}`}
            </p>
            <div className="section-actions">
              {activeTab === 'blood' ? (
                <button type="button" className="btn btn-primary" onClick={() => setShowBloodModal(true)}>
                  <FaPlus aria-hidden="true" /> Request blood
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-primary" onClick={openSeekTuitionModal}>
                    <FaPlus aria-hidden="true" /> Seek a tutor
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={openOfferTuitionModal}>
                    <FaPlus aria-hidden="true" /> Offer tuition
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="forum-layout">
            <div className="forum-posts">
              {loading ? (
                renderSkeletons()
              ) : loadError ? (
                <div className="state-card" role="alert">
                  <FaExclamationCircle aria-hidden="true" />
                  <strong>Couldn't load the forums</strong>
                  <p>Check your connection and try again.</p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setLoading(true);
                      loadForums();
                    }}
                  >
                    Try again
                  </button>
                </div>
              ) : results.length === 0 ? (
                <div className="state-card">
                  {activeTab === 'blood' ? <FaTint aria-hidden="true" /> : <FaBook aria-hidden="true" />}
                  <strong>
                    {activeFilterCount > 0
                      ? 'Nothing matches these filters'
                      : activeTab === 'blood'
                        ? 'No blood requests right now'
                        : 'No tuition posts yet'}
                  </strong>
                  <p>
                    {activeFilterCount > 0
                      ? 'Try removing a filter to see more.'
                      : activeTab === 'blood'
                        ? 'If you need blood, post a request and the community will see it.'
                        : 'Post what you are looking for, or offer to teach.'}
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={activeTab === 'blood' ? clearBloodFilters : clearTuitionFilters}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : activeTab === 'blood' ? (
                filteredRequests.map((request) => (
                  <BloodRequestCard
                    key={request.id || request.request_id}
                    request={request}
                    isOwner={isOwnerOf(request.requester_id)}
                    canMessage={Boolean(currentUser?.id) && Boolean(request.requester_id) && !isOwnerOf(request.requester_id)}
                    onEdit={handleEditBlood}
                    onDelete={(item) => handleDeleteBlood(item.id || item.request_id)}
                  />
                ))
              ) : (
                filteredTuition.map((post) => {
                  const posterId = Number(post.poster_id || post.user_id || post.poster?.id || 0);
                  return (
                    <TuitionCard
                      key={post.id || post.tuition_id}
                      post={post}
                      posterId={posterId}
                      isOwner={isOwnerOf(posterId)}
                      canMessage={Boolean(currentUser?.id) && posterId > 0 && !isOwnerOf(posterId)}
                      onEdit={handleEditTuition}
                      onDelete={(item) => handleDeleteTuition(item.id || item.tuition_id)}
                    />
                  );
                })
              )}
            </div>

            <aside className="forum-filters" aria-label="Filters">
              <button
                type="button"
                className="filters-toggle"
                aria-expanded={filtersOpen}
                aria-controls="forum-filter-body"
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <FaFilter aria-hidden="true" /> Filters
                {activeFilterCount > 0 && <span className="tab-badge">{activeFilterCount}</span>}
              </button>
              <div id="forum-filter-body" className={`filters-body ${filtersOpen ? 'open' : ''}`}>
                <h2 className="filters-title">Filters</h2>
                {activeTab === 'blood' ? renderBloodFilters() : renderTuitionFilters()}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {showBloodModal && (
        <div className="modal-overlay" onClick={() => setShowBloodModal(false)}>
          <div className="modal-content large" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
          <div className="modal-content large" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
          <div className="modal-content large" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
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
