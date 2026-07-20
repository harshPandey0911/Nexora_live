import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUser, FiEdit2, FiMapPin, FiPhone, FiMail, FiBriefcase, FiStar, FiChevronRight, FiTag, FiLogOut, FiFileText, FiShield } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import { workerTheme as themeColors, vendorTheme } from '../../../../theme';
import { workerAuthService } from '../../../../services/authService';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import LogoLoader from '../../../../components/common/LogoLoader';
import ConfirmDialog from '../../../../components/common/ConfirmDialog';

const Profile = () => {
  const navigate = useNavigate();
  // Initialize with empty/default values - will be loaded from localStorage
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useLayoutEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root');
    const bgStyle = themeColors.backgroundGradient;

    if (html) html.style.background = bgStyle;
    if (body) body.style.background = bgStyle;
    if (root) root.style.background = bgStyle;

    return () => {
      if (html) html.style.background = '';
      if (body) body.style.background = '';
      if (root) root.style.background = '';
    };
  }, []);

  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await workerAuthService.getProfile();
        if (response.success) {
          const workerData = response.worker;
          // Format address
          const addressString = workerData.address
            ? `${workerData.address.addressLine1 || ''} ${workerData.address.addressLine2 || ''} ${workerData.address.city || ''} ${workerData.address.state || ''} ${workerData.address.pincode || ''}`.trim() || 'Not set'
            : 'Not set';

          setProfile({
            name: workerData.name || 'Worker Name',
            phone: workerData.phone || '',
            email: workerData.email || '',
            address: addressString,
            rating: workerData.rating || 0,
            totalJobs: workerData.totalJobs || 0,
            completedJobs: workerData.completedJobs || 0,
            serviceCategories: workerData.serviceCategories || (workerData.serviceCategory ? [workerData.serviceCategory] : []),
            photo: workerData.profilePhoto || null,
            isPhoneVerified: workerData.isPhoneVerified || false,
            isEmailVerified: workerData.isEmailVerified || false
          });
          localStorage.setItem('workerData', JSON.stringify(workerData));
        } else {
          setError(response.message || 'Failed to fetch profile');
          toast.error(response.message || 'Failed to fetch profile');
          // Fallback to local storage if API fails
          const localWorkerData = JSON.parse(localStorage.getItem('workerData') || '{}');
          if (localWorkerData && Object.keys(localWorkerData).length > 0) {
            setProfile({
              name: localWorkerData.name || 'Worker Name',
              phone: localWorkerData.phone || '',
              email: localWorkerData.email || '',
              address: 'Not set',
              rating: localWorkerData.rating || 0,
              totalJobs: localWorkerData.totalJobs || 0,
              completedJobs: localWorkerData.completedJobs || 0,
              serviceCategories: localWorkerData.serviceCategories || (localWorkerData.serviceCategory ? [localWorkerData.serviceCategory] : []),
              photo: localWorkerData.profilePhoto || null
            });
            toast('Loaded profile from local storage (API failed)');
          }
        }
      } catch (err) {
        console.error('Error fetching worker profile:', err);
        setError(err.response?.data?.message || 'Failed to fetch profile');
        toast.error(err.response?.data?.message || 'Failed to fetch profile');
        // Fallback to local storage if API fails
        const localWorkerData = JSON.parse(localStorage.getItem('workerData') || '{}');
        if (localWorkerData && Object.keys(localWorkerData).length > 0) {
          setProfile({
            name: localWorkerData.name || 'Worker Name',
            phone: localWorkerData.phone || '',
            email: localWorkerData.email || '',
            address: 'Not set',
            rating: localWorkerData.rating || 0,
            totalJobs: localWorkerData.totalJobs || 0,
            completedJobs: localWorkerData.completedJobs || 0,
            serviceCategories: localWorkerData.serviceCategories || (localWorkerData.serviceCategory ? [localWorkerData.serviceCategory] : []),
            photo: localWorkerData.profilePhoto || null
          });
          toast('Loaded profile from local storage (API failed)');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await workerAuthService.logout();
      toast.success('Logged out successfully');
      navigate('/worker/login');
    } catch (error) {
      localStorage.removeItem('workerAccessToken');
      localStorage.removeItem('workerRefreshToken');
      localStorage.removeItem('workerData');
      toast.success('Logged out successfully');
      navigate('/worker/login');
    }
  };

  if (isLoading) {
    return <LogoLoader />;
  }

  if (error && !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: themeColors.backgroundGradient }}>
        <div className="text-center p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-2">Error loading profile</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-xl text-white font-semibold transition-all duration-300 hover:opacity-90"
            style={{ backgroundColor: themeColors.button }}
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: themeColors.backgroundGradient }}>
      <Header title="Profile" />

      <main className="px-4 pt-4 pb-6">
        {/* Profile Header Card */}
        <div
          className="rounded-2xl p-5 mb-4 shadow-xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)',
            border: '1.5px solid #99F6E4',
          }}
        >
          {/* Decorative Pattern */}
          <div
            className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
            style={{
              background: `radial-gradient(circle, ${themeColors.button} 0%, transparent 70%)`,
              transform: 'translate(30px, -30px)',
            }}
          />

          <div className="relative z-10">
            <div className="flex items-start gap-4">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'rgba(255, 255, 255, 0.8)',
                  border: '3px solid #CCFBF1',
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.1)',
                }}
              >
                {profile.photo ? (
                  <img
                    src={profile.photo}
                    alt={profile.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <FiUser className="w-10 h-10 text-teal-700" />
                )}
              </div>
              <div className="flex-1 pr-12">
                <h2 className="text-xl font-bold text-teal-950 mb-0.5">{profile.name}</h2>
                <div className="mb-2"></div>

                <div className="flex items-center gap-3">
                  <div 
                    onClick={() => navigate('/worker/reviews')}
                    className="flex items-center gap-1 bg-teal-800/10 hover:bg-teal-800/20 px-2.5 py-0.5 rounded-lg border border-teal-850/15 cursor-pointer transition-colors"
                    title="View Customer Reviews"
                  >
                    <FiStar className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-teal-900 text-sm font-bold">{profile.rating || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Profile Button - Absolute Positioned */}
            <button
              onClick={() => navigate('/worker/profile/edit')}
              className="absolute top-0 right-0 p-2.5 rounded-lg transition-all active:scale-95 text-teal-750"
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(10px)',
                boxShadow: '0 2px 8px rgba(13, 148, 136, 0.1)',
                border: '1.5px solid #99F6E4',
              }}
            >
              <FiEdit2 className="w-5 h-5 text-teal-700" />
            </button>
          </div>
        </div>

        {/* Profile Details */}
        <div
          className="bg-white rounded-xl p-4 mb-4 shadow-md"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="font-bold text-gray-800 mb-4">Personal Information</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <FiPhone className="w-5 h-5" style={{ color: themeColors.icon }} />
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="text-sm font-semibold text-gray-800">{profile.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiMail className="w-5 h-5" style={{ color: themeColors.icon }} />
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-sm font-semibold text-gray-800">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FiMapPin className="w-5 h-5" style={{ color: themeColors.icon }} />
              <div>
                <p className="text-sm text-gray-600">Address</p>
                <p className="text-sm font-semibold text-gray-800">{profile.address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Service Category & Skills */}
        <div
          className="bg-white rounded-xl p-4 mb-4 shadow-md"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="font-bold text-gray-800 mb-4">Service Information</h3>
          <div className="space-y-3">
            {/* Service Categories */}
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg" style={{ background: `${themeColors.icon}15` }}>
                <FiBriefcase className="w-5 h-5" style={{ color: themeColors.icon }} />
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Service Categories</p>
                {profile.serviceCategories && profile.serviceCategories.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {profile.serviceCategories.map((cat, idx) => (
                      <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-sm font-medium border border-gray-200">
                        {cat}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-800">Not set</p>
                )}
              </div>
            </div>

            {/* Removed Skills display */}
          </div>
        </div>

        {/* Stats */}
        <div
          className="bg-white rounded-xl p-4 mb-4 shadow-md"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="font-bold text-gray-800 mb-3">Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-800">{profile.totalJobs}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-800">{profile.completedJobs}</p>
            </div>
          </div>
        </div>

        {/* Legal & Policies */}
        <div
          className="bg-white rounded-xl p-4 mb-4 shadow-md"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h3 className="font-bold text-gray-800 mb-3">Legal & Policies</h3>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/worker/terms')}
              className="w-full py-2.5 px-3 rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <FiFileText className="w-5 h-5" style={{ color: themeColors.button }} />
                <span className="text-sm font-semibold text-gray-800">Terms & Conditions</span>
              </div>
              <FiChevronRight className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => navigate('/worker/privacy')}
              className="w-full py-2.5 px-3 rounded-lg flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <FiShield className="w-5 h-5" style={{ color: themeColors.button }} />
                <span className="text-sm font-semibold text-gray-800">Privacy Policy</span>
              </div>
              <FiChevronRight className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Settings Button */}
        <button
          onClick={() => navigate('/worker/settings')}
          className="w-full bg-white rounded-xl p-4 flex items-center justify-between shadow-md transition-all active:scale-95 mb-4"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div className="flex items-center gap-3">
            <FiEdit2 className="w-5 h-5" style={{ color: themeColors.button }} />
            <span className="font-semibold text-gray-800">Settings</span>
          </div>
          <FiChevronRight className="w-5 h-5 text-gray-400" />
        </button>

        {/* Logout Button */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleLogout();
          }}
          className="w-full bg-white rounded-xl p-4 flex items-center justify-between shadow-md transition-all active:scale-95"
          style={{
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
            cursor: 'pointer'
          }}
        >
          <div className="flex items-center gap-3">
            <FiLogOut className="w-5 h-5 text-red-500" />
            <span className="font-semibold text-red-500">Logout</span>
          </div>
          <FiChevronRight className="w-5 h-5 text-gray-400" />
        </button>
      </main>

      <BottomNav />

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Logout?"
        message="Are you sure you want to logout from your worker account?"
        confirmLabel="Logout"
        cancelLabel="Stay"
        type="danger"
      />
    </div>
  );
};

export default Profile;

