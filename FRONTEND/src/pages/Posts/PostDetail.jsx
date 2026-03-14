import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import PostCard from '../../components/Posts/PostCard';
import { postAPI } from '../../services/apiService';
import { toast } from 'react-toastify';

const PostDetail = () => {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  const normalizePost = (data) => {
    const userFromObject = data.user || data.author || {};
    return {
      ...data,
      id: data.id || data.post_id,
      post_id: data.post_id || data.id,
      user_id: data.user_id || data.author_id || userFromObject.id,
      user_name: data.user_name || data.author_name || userFromObject.name,
      profile_picture:
        data.profile_picture ||
        data.user_picture ||
        data.author_picture ||
        userFromObject.profile_picture,
    };
  };

  useEffect(() => {
    const loadPost = async () => {
      try {
        setLoading(true);
        const response = await postAPI.getPost(postId);
        setPost(normalizePost(response.data));
      } catch (error) {
        toast.error('Failed to load post details');
      } finally {
        setLoading(false);
      }
    };

    loadPost();
  }, [postId]);

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">
        <div className="container" style={{ maxWidth: '760px', paddingTop: '26px' }}>
          {loading ? (
            <div className="loading">Loading post...</div>
          ) : post ? (
            <PostCard post={post} />
          ) : (
            <div className="error">Post not found</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PostDetail;
