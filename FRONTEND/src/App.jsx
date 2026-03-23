import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Pages
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import Home from './pages/Home/Home';
import Profile from './pages/Profile/Profile';
import Chat from './pages/Chat/Chat';
import Groups from './pages/Groups/Groups';
import GroupDetail from './pages/Groups/GroupDetail';
import NonMemberGroupView from './pages/Groups/NonMemberGroupView';
import Marketplace from './pages/Marketplace/Marketplace';
import ProductDetail from './pages/Marketplace/ProductDetail';
import Forums from './pages/Forums/Forums';
import Blogs from './pages/Blogs/Blogs';
import BlogDetail from './pages/Blogs/BlogDetail';
import Notifications from './pages/Notifications/Notifications';
import Search from './pages/Search/Search';
import PostDetail from './pages/Posts/PostDetail';
import ProtectedRoute from './components/ProtectedRoute';
import { ThemeProvider } from './context/ThemeContext';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            hideProgressBar={false}
            newestOnTop
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
          />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes */}
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/search" element={<ProtectedRoute><Search /></ProtectedRoute>} />
            <Route path="/profile/:userId" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/chat/:userId" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
            <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
            <Route path="/groups/:groupId/nonmember" element={<ProtectedRoute><NonMemberGroupView /></ProtectedRoute>} />
            <Route path="/marketplace" element={<ProtectedRoute><Marketplace /></ProtectedRoute>} />
            <Route path="/marketplace/:productId" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
            <Route path="/forums" element={<ProtectedRoute><Forums /></ProtectedRoute>} />
            <Route path="/blogs" element={<ProtectedRoute><Blogs /></ProtectedRoute>} />
            <Route path="/blogs/:blogId" element={<ProtectedRoute><BlogDetail /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
            <Route path="/posts/:postId" element={<ProtectedRoute><PostDetail /></ProtectedRoute>} />

            {/* Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;