import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBell, FiVolume2, FiInfo, FiLogOut, FiTrash2, FiMapPin, FiChevronRight, FiSettings } from 'react-icons/fi';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
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
      try {
        const savedSettings = JSON.parse(localStorage.getItem('vendorSettings') || '{}');
        if (Object.keys(savedSettings).length > 0) {
          setSettings(prev => ({ ...prev, ...savedSettings }));
        }
      } catch (error) {
        console.error('Error loading local settings:', error);
      }

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

    if (key === 'notifications') {
      if (updated.notifications) {
        try {
          await registerFCMToken('vendor', true);
          toast.success('Notifications enabled');
        } catch (error) {
          console.error('Error enabling notifications:', error);
          toast.error('Failed to enable notifications');
        }
      } else {
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
      localStorage.removeItem('vendorProfile');
      localStorage.removeItem('vendorSettings');
      localStorage.removeItem('vendorWorkers');
      localStorage.removeItem('vendorAcceptedBookings');
      localStorage.removeItem('vendorWallet');
      localStorage.removeItem('vendorTransactions');
      navigate('/');
    }
  };

  return (
    <div className="space-y-3 sm:space-y-4 pb-16">
      {/* Header - Compact & Modern */}
      <div className="bg-white p-3.5 sm:p-4 rounded-xl shadow-2xs flex flex-row items-center justify-between text-gray-900 border border-gray-100 gap-3">
        <div>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 tracking-tight leading-tight capitalize">
            Store & System Settings
          </h2>
          <p className="text-gray-500 text-[10px] sm:text-xs font-medium mt-0.5">
            Customize notification preferences, operational base and account access
          </p>
        </div>
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <FiSettings className="w-4 h-4 sm:w-5 sm:h-5" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Notification & Sound Settings Card */}
        <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-gray-100 shadow-2xs space-y-3">
          <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Alerts & Signals</h3>

          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <FiBell className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xs">Push Notifications</p>
                  <p className="text-[10px] text-gray-400 font-medium">Real-time deployment alerts</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('notifications')}
                className={`relative w-10 h-5 rounded-full transition-all duration-300 p-0.5 shrink-0 cursor-pointer ${settings.notifications ? 'bg-blue-600 shadow-2xs' : 'bg-gray-200'}`}
              >
                <motion.span
                  animate={{ x: settings.notifications ? 20 : 0 }}
                  className="block w-4 h-4 bg-white rounded-full shadow-2xs"
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-gray-50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
                  <FiVolume2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-xs">Auditory Signals</p>
                  <p className="text-[10px] text-gray-400 font-medium">Operational sound feedback</p>
                </div>
              </div>
              <button
                onClick={() => handleToggle('soundAlerts')}
                className={`relative w-10 h-5 rounded-full transition-all duration-300 p-0.5 shrink-0 cursor-pointer ${settings.soundAlerts ? 'bg-blue-600 shadow-2xs' : 'bg-gray-200'}`}
              >
                <motion.span
                  animate={{ x: settings.soundAlerts ? 20 : 0 }}
                  className="block w-4 h-4 bg-white rounded-full shadow-2xs"
                />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Links Section */}
        <div className="space-y-2.5">
          <button
            onClick={() => navigate('/vendor/address-management')}
            className="w-full bg-white rounded-xl p-3.5 border border-gray-100 flex items-center justify-between group hover:border-gray-200 shadow-2xs transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors shrink-0">
                <FiMapPin className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-bold text-gray-900 text-xs truncate">Operational Base</p>
                <p className="text-[10px] text-gray-400 font-medium truncate">Manage business location & service zone</p>
              </div>
            </div>
            <FiChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>

          <button
            onClick={() => navigate('/vendor/support')}
            className="w-full bg-white rounded-xl p-3.5 border border-gray-100 flex items-center justify-between group hover:border-gray-200 shadow-2xs transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-purple-50 group-hover:text-purple-600 transition-colors shrink-0">
                <FiInfo className="w-4 h-4" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-bold text-gray-900 text-xs truncate">Deployment Support</p>
                <p className="text-[10px] text-gray-400 font-medium truncate">Direct helpdesk support & FAQ</p>
              </div>
            </div>
            <FiChevronRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all shrink-0" />
          </button>
        </div>
      </div>

      {/* System Architecture Version Card */}
      <div className="bg-white rounded-xl p-3.5 border border-gray-100 flex items-center gap-3 shadow-2xs">
        <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
          <FiInfo className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-bold text-[10px] text-gray-400 uppercase tracking-widest">Nexora System Engine</h3>
          <p className="text-[10px] font-bold text-gray-800 uppercase tracking-wider mt-0.5">v2.4.0 Premium · Encrypted Build 2026</p>
        </div>
      </div>

      {/* Danger Zone Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <button
          onClick={handleLogout}
          className="py-3 px-4 rounded-xl bg-white border border-gray-200 text-gray-700 font-bold text-xs uppercase tracking-wider hover:bg-gray-50 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-2xs group cursor-pointer"
        >
          <FiLogOut className="w-4 h-4 text-gray-400 group-hover:text-gray-900 transition-all" />
          <span>Logout Session</span>
        </button>

        <button
          onClick={handleDeleteAccount}
          className="py-3 px-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 font-bold text-xs uppercase tracking-wider hover:bg-rose-100 transition-all active:scale-95 flex items-center justify-center gap-2 shadow-2xs group cursor-pointer"
        >
          <FiTrash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span>Delete Account</span>
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
