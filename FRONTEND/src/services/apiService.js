import api from './api';


export const authAPI = {
  register: (data) => {

    const hasFile = data.profile_picture instanceof File;

    if (hasFile) {

      const formData = new FormData();
      Object.keys(data).forEach(key => {
        if (data[key] !== null && data[key] !== undefined) {
          formData.append(key, data[key]);
        }
      });
      return api.post('/users/register/', formData);
    } else {

      return api.post('/users/register/', data);
    }
  },
  login: (data) => api.post('/users/login/', data),
};


export const userAPI = {
  getProfile: (userId) => api.get(`/users/profile/${userId}/`),
  updateProfile: (data) => api.patch('/users/profile/update/', data),
  uploadProfilePicture: (formData) => api.post('/users/profile/upload-picture/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  followUser: (userId) => api.post(`/users/follow/${userId}/`),
  acceptFollow: (followId) => api.post(`/users/follow/accept/${followId}/`),
  rejectFollow: (followId) => api.post(`/users/follow/reject/${followId}/`),
  getPendingRequests: () => api.get('/users/follow-requests/pending/'),
  getSuggestions: () => api.get('/users/suggestions/'),
  getMutualFollowers: () => api.get('/users/mutual-followers/'),
  getUserActivity: () => api.get('/users/activity/'),
  getFollowers: (userId) => api.get(`/users/${userId}/followers/`),
  getFollowing: (userId) => api.get(`/users/${userId}/following/`),
  getEngagement: (userId) => api.get(`/users/${userId}/engagement/`),
  getUserPosts: (userId) => api.get(`/users/${userId}/posts/`),
  searchUsers: (query) => api.get(`/users/search/?q=${query}`),
  getUsersByDepartment: (departmentName) => api.get(`/users/department/${encodeURIComponent(departmentName)}/`),
  getUsersByBloodGroup: (bloodGroup) => api.get(`/users/blood-group/${encodeURIComponent(bloodGroup)}/`),
};


export const postAPI = {
  createPost: (data) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.post('/posts/create/', data, isFormData ? {
      headers: { 'Content-Type': 'multipart/form-data' }
    } : undefined);
  },
  createPostWithMedia: (formData) => api.post('/posts/create-with-media/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadMedia: (formData) => api.post('/posts/upload-media/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getFeed: (page = 1) => api.get(`/posts/feed/?page=${page}`),
  getPublicPosts: (limit = 30) => api.get(`/posts/public/?limit=${limit}`),
  getTrending: () => api.get('/posts/trending/'),
  getPost: (postId) => api.get(`/posts/${postId}/`),
  updatePost: (postId, data) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.patch(`/posts/${postId}/`, data, isFormData ? {
      // Let the browser set the multipart boundary automatically.
    } : undefined);
  },
  deletePost: (postId) => api.delete(`/posts/${postId}/`),
  likePost: (postId) => api.post(`/posts/${postId}/like/`),
  getComments: (postId) => api.get(`/posts/${postId}/comments/`),
  addComment: (postId, data) => api.post(`/posts/${postId}/comments/`, data),
  updateComment: (commentId, data) => api.patch(`/posts/comments/${commentId}/`, data),
  deleteComment: (commentId) => api.delete(`/posts/comments/${commentId}/delete/`),
  searchPosts: (query) => api.get(`/posts/search/?q=${query}`),
  getPostsByHashtag: (hashtag) => api.get('/posts/hashtag/', { params: { hashtag } }),
  getTrendingHashtags: (limit = 10) => api.get(`/posts/hashtags/trending/?limit=${limit}`),
  getPostsByMediaType: (mediaType, limit = 20) => api.get(`/posts/media/${mediaType}/?limit=${limit}`),
  getEngagement: (postId) => api.get(`/posts/${postId}/engagement/`),
  getUserLikedPosts: (userId) => api.get(`/posts/liked/${userId}/`),
  likecomment: (commentId) => api.post(`/posts/comments/${commentId}/like/`),
};


export const chatAPI = {
  getConversationList: () => api.get('/chat/conversations/'),
  getConversations: () => api.get('/chat/messages/conversations/'),
  getConversationWithUser: (userId) => api.get(`/chat/messages/conversation/${userId}/`),
  getMessageList: (otherUserId) => api.get(`/chat/messages/${otherUserId}/`),
  getMessages: (userId) => api.get(`/chat/messages/conversation/${userId}/`),
  getProductMessages: (userId, productId) => api.get(`/chat/messages/${userId}/product/${productId}/`),
  sendMessage: (data) => api.post('/chat/messages/send/', data),
  contactSeller: (data) => api.post('/chat/contact-seller/', data),
  uploadImage: (formData) => api.post('/chat/upload-image/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadVideo: (formData) => api.post('/chat/upload-video/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  markAsRead: (messageId) => api.post(`/chat/messages/${messageId}/read/`),
  markConversationRead: (userId) => api.post(`/chat/conversation/${userId}/read/`),
  deleteConversation: (userId) => api.delete(`/chat/conversation/${userId}/delete/`),
  getConversationParticipants: (userId) => api.get(`/chat/conversation/${userId}/participants/`),
  canMessageUser: (userId) => api.get(`/chat/can-message/${userId}/`),
  getUnreadCountByConversation: () => api.get('/chat/unread/count/'),
  getUnreadCount: () => api.get('/chat/unread/total/'),
  getMessageStats: () => api.get('/chat/stats/'),
  searchMessages: (query) => api.get(`/chat/search/?q=${query}`),
};


export const groupAPI = {
  createGroup: (data) =>api.post('/groups/create/', data, {headers: { 'Content-Type': 'multipart/form-data' },}),
  getGroup: (groupId) => api.get(`/groups/${groupId}/`),
  updateGroup: (groupId, data) => {
    const isFormData = typeof FormData !== 'undefined' && data instanceof FormData;
    return api.patch(`/groups/${groupId}/update/`, data, isFormData ? {
      headers: { 'Content-Type': 'multipart/form-data' },
    } : undefined);
  },
  deleteGroup: (groupId) => api.delete(`/groups/${groupId}/delete/`),
  getMembers: (groupId) => api.get(`/groups/${groupId}/members/`),
  getPending: (groupId) => api.get(`/groups/${groupId}/pending/`),
  getInvited: (groupId) => api.get(`/groups/${groupId}/invited/`),
  cancelInvite: (groupId, userId) => api.post(`/groups/${groupId}/cancel-invite/${userId}/`),
  getInvites: () => api.get('/groups/invites/'),
  joinGroup: (groupId) => api.post(`/groups/${groupId}/join/`),
  leaveGroup: (groupId) => api.post(`/groups/${groupId}/leave/`),
  acceptMember: (groupId, userId) => api.post(`/groups/${groupId}/accept/${userId}/`),
  rejectMember: (groupId, userId) => api.post(`/groups/${groupId}/reject/${userId}/`),
  inviteMember: (groupId, userId) => api.post(`/groups/${groupId}/invite/`, { user_id: userId }),
  promoteMember: (groupId, userId) => api.post(`/groups/${groupId}/promote/${userId}/`),
  demoteMember: (groupId, userId) => api.post(`/groups/${groupId}/demote/${userId}/`),
  transferAdmin: (groupId, data) => api.post(`/groups/${groupId}/transfer-admin/`, data),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}/`),
  getGroupPosts: (groupId) => api.get(`/groups/${groupId}/posts/`),
  createGroupPost: (groupId, data) => api.post(`/groups/${groupId}/posts/create/`, data),
  getUserGroups: () => api.get('/groups/my-groups/'),
  getSuggested: () => api.get('/groups/suggested/'),
  searchGroups: (query) => api.get(`/groups/search/?q=${query}`),
  getActivity: (groupId, days = 30) => api.get(`/groups/${groupId}/activity/?days=${days}`),
  acceptInvite: (groupId) => api.post(`/groups/${groupId}/accept/`),
  rejectInvite: (groupId) => api.post(`/groups/${groupId}/reject/`),
};


export const marketplaceAPI = {
  createProduct: (formData) => api.post('/marketplace/products/create/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getProducts: (page = 1, status = 'available') => api.get(`/marketplace/products/?page=${page}&status=${encodeURIComponent(status)}`),
  getProduct: (productId) => api.get(`/marketplace/products/${productId}/`),
  updateProduct: (productId, data) => api.patch(`/marketplace/products/${productId}/`, data),
  deleteProduct: (productId) => api.delete(`/marketplace/products/${productId}/`),
  markSold: (productId) => api.post(`/marketplace/products/${productId}/mark-sold/`),
  reserveProduct: (productId) => api.post(`/marketplace/products/${productId}/reserve/`),
  getMyProducts: () => api.get('/marketplace/my-products/'),
  getMyProductsByStatus: (status) => api.get(`/marketplace/my-products/?status=${status}`),
  getUserProducts: (userId) => api.get(`/marketplace/users/${userId}/products/`),
  getUserStats: (userId) => api.get(`/marketplace/users/${userId}/stats/`),
  getMyStats: () => api.get('/marketplace/my-stats/'),
  getTrending: () => api.get('/marketplace/trending/'),
  getDepartmentProducts: (department) => api.get('/marketplace/department-products/', {
    params: department ? { department } : undefined,
  }),
  getPriceRanges: () => api.get('/marketplace/price-ranges/'),
  getSimilarProducts: (productId, limit = 5) => api.get(`/marketplace/products/${productId}/similar/?limit=${limit}`),
  searchProducts: (query) => api.get(`/marketplace/search/?q=${query}`),
  getCategories: () => api.get('/marketplace/categories/'),
  
  // Reviews and Ratings
  createReview: (productId, data) => api.post(`/marketplace/products/${productId}/reviews/`, data),
  getSellerReviews: (sellerId, page = 1, productId = null) => {
    const productQuery = productId ? `&product_id=${productId}` : '';
    return api.get(`/marketplace/sellers/${sellerId}/reviews/?page=${page}${productQuery}`);
  },
  getSellerReputation: (sellerId) => api.get(`/marketplace/sellers/${sellerId}/reputation/`),
  
  // Transaction Confirmation
  confirmTransaction: (productId, data) => api.post(`/marketplace/transactions/${productId}/confirm/`, data),
  uploadImage: (formData) => api.post('/marketplace/upload-image/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
};


export const forumAPI = {
  createBloodRequest: (data) => api.post('/forums/blood/create/', data),
  getBloodRequests: () => api.get('/forums/blood/'),
  getBloodRequest: (requestId) => api.get(`/forums/blood/${requestId}/`),
  updateBloodRequest: (requestId, data) => api.patch(`/forums/blood/${requestId}/`, data),
  deleteBloodRequest: (requestId) => api.delete(`/forums/blood/${requestId}/`),
  updateBloodStatus: (requestId, data) => api.patch(`/forums/blood/${requestId}/status/`, data),
  searchBloodRequests: (location, blood_group, limit) => api.get('/forums/blood/search/location/', {
    params: { location, blood_group, limit }
  }),
  getMyBloodRequests: () => api.get('/forums/blood/my-requests/'),


  createTuitionPost: (data) => api.post('/forums/tuition/create/', data),
  getTuitionPosts: () => api.get('/forums/tuition/'),
  getTuitionPost: (postId) => api.get(`/forums/tuition/${postId}/`),
  updateTuitionPost: (postId, data) => api.patch(`/forums/tuition/${postId}/`, data),
  deleteTuitionPost: (postId) => api.delete(`/forums/tuition/${postId}/`),
  updateTuitionStatus: (postId, data) => api.patch(`/forums/tuition/${postId}/status/`, data),
  searchTuitionPosts: (params = {}) => api.get('/forums/tuition/search/', { params }),
  getMyTuitionPosts: () => api.get('/forums/tuition/my-posts/'),
  getTuitionStatsBySubject: () => api.get('/forums/tuition/stats/subjects/'),
};


export const notificationAPI = {
  getAll: (limit = 200) => api.get('/notifications/', { params: { limit } }),
  getUnread: (limit = 200) => api.get('/notifications/unread/', { params: { limit } }),
  getCount: () => api.get('/notifications/count/'),
  getSummary: () => api.get('/notifications/summary/'),
  getActivity: (limit = 20) => api.get(`/notifications/activity/?limit=${limit}`),
  markByType: (type) => api.post(`/notifications/mark-read/${type}/`),
  markAsRead: (notificationId) => api.post(`/notifications/${notificationId}/read/`),
  markAllRead: () => api.post('/notifications/read-all/'),
  deleteNotification: (notificationId) => api.delete(`/notifications/${notificationId}/`),
  clearAll: () => api.delete('/notifications/clear/'),
};


export const blogAPI = {
  getPublishedBlogs: (params = {}) => api.get('/blogs/', { params }),
  // Fetches current user's drafts (unpublished blogs)
  getMyBlogs: (params = {}) => api.get('/blogs/', { params: { ...params, mine: true, is_published: false } }),
  getBlogDetail: (blogId) => api.get(`/blogs/${blogId}/`),
  trackView: (blogId) => api.post(`/blogs/${blogId}/view/`),
  createBlog: (data) => api.post('/blogs/create/', data),
  toggleLike: (blogId) => api.post(`/blogs/${blogId}/like/`),
  getComments: (blogId) => api.get(`/blogs/${blogId}/comments/`),
  addComment: (blogId, data) => api.post(`/blogs/${blogId}/comments/`, data),
  likeComment: (commentId) => api.post(`/blogs/comments/${commentId}/like/`),
  deleteBlog: (blogId) => api.delete(`/blogs/${blogId}/delete/`),
};
