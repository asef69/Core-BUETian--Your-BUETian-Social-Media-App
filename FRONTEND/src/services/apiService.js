import api from './api';


export const authAPI = {
  register: (data) => api.post('/users/register/', data),
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
  getFollowers: (userId) => api.get(`/users/${userId}/followers/`),
  getFollowing: (userId) => api.get(`/users/${userId}/following/`),
  getUserPosts: (userId) => api.get(`/users/${userId}/posts/`),
  searchUsers: (query) => api.get(`/users/search/?q=${query}`),
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
  getTrending: () => api.get('/posts/trending/'),
  getPost: (postId) => api.get(`/posts/${postId}/`),
  updatePost: (postId, data) => api.patch(`/posts/${postId}/`, data),
  deletePost: (postId) => api.delete(`/posts/${postId}/`),
  likePost: (postId) => api.post(`/posts/${postId}/like/`),
  getComments: (postId) => api.get(`/posts/${postId}/comments/`),
  addComment: (postId, data) => api.post(`/posts/${postId}/comments/`, data),
  updateComment: (commentId, data) => api.put(`/posts/comments/${commentId}/`, data),
  deleteComment: (commentId) => api.delete(`/posts/comments/${commentId}/delete/`),
  searchPosts: (query) => api.get(`/posts/search/?q=${query}`),
  getPostsByHashtag: (hashtag) => api.get(`/posts/hashtag/${hashtag}/`),
};


export const chatAPI = {
  getConversations: () => api.get('/chat/messages/conversations/'),
  getMessages: (userId) => api.get(`/chat/messages/conversation/${userId}/`),
  sendMessage: (data) => api.post('/chat/messages/send/', data),
  uploadImage: (formData) => api.post('/chat/upload-image/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  uploadVideo: (formData) => api.post('/chat/upload-video/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  markAsRead: (messageId) => api.post(`/chat/messages/${messageId}/read/`),
  getUnreadCount: () => api.get('/chat/unread/total/'),
  searchMessages: (query) => api.get(`/chat/search/?q=${query}`),
};


export const groupAPI = {
  createGroup: (data) => api.post('/groups/create/', data),
  getGroup: (groupId) => api.get(`/groups/${groupId}/`),
  updateGroup: (groupId, data) => api.patch(`/groups/${groupId}/update/`, data),
  deleteGroup: (groupId) => api.delete(`/groups/${groupId}/delete/`),
  getMembers: (groupId) => api.get(`/groups/${groupId}/members/`),
  getPending: (groupId) => api.get(`/groups/${groupId}/pending/`),
  joinGroup: (groupId) => api.post(`/groups/${groupId}/join/`),
  leaveGroup: (groupId) => api.post(`/groups/${groupId}/leave/`),
  acceptMember: (groupId, userId) => api.post(`/groups/${groupId}/accept/${userId}/`),
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
};


export const marketplaceAPI = {
  createProduct: (formData) => api.post('/marketplace/products/create/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getProducts: (page = 1) => api.get(`/marketplace/products/?page=${page}`),
  getProduct: (productId) => api.get(`/marketplace/products/${productId}/`),
  updateProduct: (productId, data) => api.patch(`/marketplace/products/${productId}/`, data),
  deleteProduct: (productId) => api.delete(`/marketplace/products/${productId}/`),
  markSold: (productId) => api.post(`/marketplace/products/${productId}/mark-sold/`),
  reserveProduct: (productId) => api.post(`/marketplace/products/${productId}/reserve/`),
  getMyProducts: () => api.get('/marketplace/my-products/'),
  getUserProducts: (userId) => api.get(`/marketplace/users/${userId}/products/`),
  getTrending: () => api.get('/marketplace/trending/'),
  searchProducts: (query) => api.get(`/marketplace/search/?q=${query}`),
  getCategories: () => api.get('/marketplace/categories/'),
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
  
  
  createTuitionPost: (data) => api.post('/forums/tuition/create/', data),
  getTuitionPosts: () => api.get('/forums/tuition/'),
  getTuitionPost: (postId) => api.get(`/forums/tuition/${postId}/`),
  updateTuitionPost: (postId, data) => api.patch(`/forums/tuition/${postId}/`, data),
  deleteTuitionPost: (postId) => api.delete(`/forums/tuition/${postId}/`),
  updateTuitionStatus: (postId, data) => api.patch(`/forums/tuition/${postId}/status/`, data),
  searchTuitionPosts: (params = {}) => api.get('/forums/tuition/search/', { params }),
};


export const notificationAPI = {
  getAll: () => api.get('/notifications/'),
  getUnread: () => api.get('/notifications/unread/'),
  getCount: () => api.get('/notifications/count/'),
  markAsRead: (notificationId) => api.post(`/notifications/${notificationId}/read/`),
  markAllRead: () => api.post('/notifications/read-all/'),
  deleteNotification: (notificationId) => api.delete(`/notifications/${notificationId}/`),
  clearAll: () => api.delete('/notifications/clear/'),
};
