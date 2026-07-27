import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiVolume2, FiInfo, FiLogOut, FiTrash2, FiMapPin, FiChevronRight, FiSettings } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import { vendorAuthService } from '../../../../services/authService';
import vendorService from '../../../../services/vendorService';
import { registerFCMToken, removeFCMToken } from '../../../../services/pushNotificationService';
import ConfirmDialog from '../../../../components/common/ConfirmDialog';

const Settings = () => {
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [settings, setSettings] = useState({
    notifications: true,
    soundAlerts: true,
  });

  useEffect(() => {
    const loadSettings = async () => {
      // 1. Instant load from local storage
      try {
        const savedSettings = JSON.parse(localStorage.getItem('vendorSettings') || '{}');
        if (Object.keys(savedSettings).length > 0) {
          setSettings(prev => ({ ...prev, ...savedSettings }));
        }
      } catch (error) {
        console.error('Error loading local settings:', error);
      }

      // 2. Fetch latest settings from backend API
      try {
        const res = await vendorService.getSettings();
        if (res?.success && res?.data?.settings) {
          const apiSettings = res.data.settings;
          setSettings(prev => {
            const merged = { ...prev, ...apiSettings };
            localStorage.setItem('vendorSettings', JSON.stringify(merged));
            const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
            localStorage.setItem('vendorData', JSON.stringify({ ...vendorData, settings: merged }));
            return merged;
          });
        }
      } catch (error) {
        console.error('Error loading server settings:', error);
      }
    };

    loadSettings();
  }, []);

  const updateDBSettings = async (newSettings) => {
    try {
      localStorage.setItem('vendorSettings', JSON.stringify(newSettings));
      const vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}');
      localStorage.setItem('vendorData', JSON.stringify({ ...vendorData, settings: newSettings }));
      await vendorService.updateSettings(newSettings);
    } catch (error) {
      console.error('Error syncing vendor settings to server:', error);
    }
  };

  const handleToggle = async (key) => {
    const updated = { ...settings, [key]: !settings[key] };
    setSettings(updated);
    await updateDBSettings(updated);

    // Handle FCM Token registration/removal if notifications toggled
    if (key === 'notifications') {
      if (updated.notifications) {
        // Turning ON
        try {
          await registerFCMToken('vendor', true);
          toast.success('Notifications enabled');
        } catch (error) {
          console.error('Error enabling notifications:', error);
          toast.error('Failed to enable notifications');
        }
      } else {
        // Turning OFF
        try {
          await removeFCMToken('vendor');
          toast.success('Notifications disabled');
        } catch (error) {
          console.error('Error disabling notifications:', error);
        }
      }
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    try {
      await vendorAuthService.logout();
      toast.success('Logged out successfully');
      navigate('/vendor/login');
    } catch (error) {
      localStorage.removeItem('vendorAccessToken');
      localStorage.removeItem('vendorRefreshToken');
      localStorage.removeItem('vendorData');
      toast.success('Logged out successfully');
      navigate('/vendor/login');
    }
  };

  const handleDeleteAccount = () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      // Clear all vendor data
      localStorage.removeItem('vendorProfile');
      localStorage.removeItem('vendorSettings');
      localStorage.removeItem('vendorWorkers');
      localStorage.removeItem('vendorAcceptedBookings');
      localStorage.removeItem('vendorWallet');
      localStorage.removeItem('vendorTransactions');
      // Navigate to home
      navigate('/');
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header - White Style - Hidden on Mobile */}
      <div className="hidden md:flex bg-white p-6 rounded-3xl shadow-sm flex-row items-center justify-between text-gray-900 border border-gray-100 gap-6">
        <div>
          <h2 className="text-3xl font-medium text-gray-900 tracking-tight leading-none">
            System Configuration
          </h2>
          <p className="text-gray-500 font-medium mt-2">
            Customize your operational interface and alert protocols
          </p>
        </div>
        <div className="w-16 h-16 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center shadow-inner group transition-all">
          <FiSettings className="w-8 h-8 text-blue-600" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Notification Settings */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <h3 className="text-[10px] font-normal text-gray-400 capitalize tracking-widest mb-4">Alerts & Signals</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                  <FiBell className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-normal text-gray-800 tracking-tight capitalize text-xs">Push Notifications</p>
                  <p className="text-[8px] font-normal text-gray-400 capitalize tracking-widest mt-0.5">Real-time deployment alerts</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('notifications')}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 p-0.5 shrink-0 ${settings.notifications ? 'bg-blue-600 shadow shadow-blue-200' : 'bg-gray-200'}`}
              >
                <motion.span
                  animate={{ x: settings.notifications ? 20 : 0 }}
                  className="block w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <FiVolume2 className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-normal text-gray-800 tracking-tight capitalize text-xs">Auditory Feedback</p>
                  <p className="text-[8px] font-normal text-gray-400 capitalize tracking-widest mt-0.5">Operational sound signals</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('soundAlerts')}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 p-0.5 shrink-0 ${settings.soundAlerts ? 'bg-blue-600 shadow shadow-blue-200' : 'bg-gray-200'}`}
              >
                <motion.span
                  animate={{ x: settings.soundAlerts ? 20 : 0 }}
                  className="block w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/vendor/address-management')}
            className="w-full bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
                <FiMapPin className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
              </div>
              <div className="text-left">
                <p className="font-normal text-gray-800 tracking-tight capitalize text-xs">Operational Base</p>
                <p className="text-[8px] font-normal text-gray-400 capitalize tracking-widest mt-0.5">Manage business location</p>
              </div>
            </div>
            <FiChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" />
          </button>

          <button
            onClick={() => navigate('/vendor/support')}
            className="w-full bg-white rounded-2xl p-4 border border-gray-100 flex items-center justify-between group hover:shadow-md transition-all shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:bg-indigo-50 transition-colors shrink-0">
                <FiInfo className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
              </div>
              <div className="text-left">
                <p className="font-normal text-gray-800 tracking-tight capitalize text-xs">Deployment Support</p>
                <p className="text-[8px] font-normal text-gray-400 capitalize tracking-widest mt-0.5">Direct uplink to helpdesk</p>
              </div>
            </div>
            <FiChevronRight className="w-5 h-5 text-gray-300 group-hover:text-gray-900 group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>

      <div className="bg-gray-100/50 rounded-[28px] p-6 border border-gray-100 flex items-center gap-5">
        <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center shadow-sm">
          <FiInfo className="w-5 h-5 text-gray-400" />
        </div>
        <div>
          <h3 className="font-normal text-[10px] text-gray-400 capitalize tracking-widest">System Architecture</h3>
          <p className="text-[9px] font-normal text-gray-600 capitalize tracking-widest mt-1">v2.4.0-PREMIUM · ENCRYPTED BUILD 2026</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button
          onClick={handleLogout}
          className="py-5 rounded-3xl bg-white border border-gray-200 text-gray-600 font-normal text-[11px] capitalize tracking-widest hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-4 shadow-sm group"
        >
          <FiLogOut className="w-5 h-5 text-gray-400 group-hover:text-gray-900 group-hover:-translate-x-1 transition-all" />
          Logout Secure Session
        </button>

        <button
          onClick={handleDeleteAccount}
          className="py-5 rounded-3xl bg-rose-50 border border-rose-100 text-rose-600 font-normal text-[11px] capitalize tracking-widest hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-4 shadow-sm group"
        >
          <FiTrash2 className="w-5 h-5 group-hover:scale-110 transition-transform" />
          De-authorize Identity
        </button>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
        title="Logout Session?"
        message="Are you sure you want to logout from your vendor account?"
        confirmLabel="Logout"
        cancelLabel="Stay"
        type="danger"
      />
    </div>
  );
};

export default Settings;

