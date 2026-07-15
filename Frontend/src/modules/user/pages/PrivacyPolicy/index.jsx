import React, { useLayoutEffect, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiLock, FiEye, FiMapPin, FiBell, FiShare2 } from 'react-icons/fi';
import { themeColors } from '../../../../theme';
import { configService } from '../../../../services/configService';

const PrivacyPolicy = () => {
  const navigate = useNavigate();
  const brandColor = themeColors.brand?.teal || '#347989';
  const [data, setData] = useState({
    title: 'Nexora Go Privacy Policy',
    lastUpdated: 'July 15, 2026',
    introduction: 'Your privacy is highly important to us. This Privacy Policy details the types of personal information we collect, how we use it, and the safeguards in place to protect your data.',
    sections: [
      {
        title: "1. Information We Collect",
        content: "We collect information you provide directly to us when creating an account, updating your profile, or booking a service. This includes your name, phone number, email address, and service address details.",
        iconType: "lock"
      },
      {
        title: "2. Location and Tracking Data",
        content: "To facilitate real-time tracking of service professionals and ensure accurate logistics, Nexora Go collects precise location data from your device. This location tracking is used solely to coordinate active service bookings.",
        iconType: "map"
      },
      {
        title: "3. How We Use Your Data",
        content: "Your data is used to process bookings, verify partner identities, facilitate communication between you and the assigned service professional, send promotional alerts (if opted in), and enhance application performance and security.",
        iconType: "eye"
      },
      {
        title: "4. Information Sharing & Disclosure",
        content: "We do not sell your personal data. We share necessary details (such as name, phone number, and address) with the assigned service professional to carry out the service. We may disclose data when legally required by public authorities.",
        iconType: "share"
      },
      {
        title: "5. Push Notifications & Security",
        content: "We use FCM notifications to keep you updated on your booking status. We implement robust administrative, technical, and physical security measures to protect your personal information against unauthorized access, loss, or alteration.",
        iconType: "bell"
      }
    ]
  });

  useEffect(() => {
    const fetchPrivacy = async () => {
      try {
        const res = await configService.getSettings();
        if (res.success && res.settings && res.settings.privacyPolicy) {
          setData(res.settings.privacyPolicy);
        }
      } catch (error) {
        console.error('Failed to fetch privacy settings:', error);
      }
    };
    fetchPrivacy();
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'lock': return <FiLock className="w-6 h-6 text-teal-600" />;
      case 'map': return <FiMapPin className="w-6 h-6 text-indigo-600" />;
      case 'eye': return <FiEye className="w-6 h-6 text-emerald-600" />;
      case 'share': return <FiShare2 className="w-6 h-6 text-amber-600" />;
      case 'bell':
      default:
        return <FiBell className="w-6 h-6 text-rose-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white sticky top-0 z-40 border-b border-gray-100 shadow-sm">
        <div className="px-4 py-4 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiArrowLeft className="w-6 h-6 text-gray-800" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Privacy Policy</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Intro Card */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--brand-teal)] to-teal-600" style={{ backgroundColor: brandColor }} />
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">{data.title}</h2>
          <p className="text-xs text-gray-500 font-medium">Last updated: {data.lastUpdated}</p>
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            {data.introduction}
          </p>
        </div>

        {/* Section List */}
        <div className="space-y-4">
          {data.sections && data.sections.map((section, idx) => (
            <div key={idx} className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center">
                {getIcon(section.iconType)}
              </div>
              <div className="space-y-1 flex-1">
                <h3 className="font-bold text-gray-900 text-base">{section.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed font-normal">{section.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Closing Agreement Card */}
        <div className="bg-gradient-to-r from-teal-50 to-emerald-50 rounded-3xl p-6 border border-teal-100 text-center">
          <h3 className="font-bold text-teal-900 mb-2">Have concerns about your privacy?</h3>
          <p className="text-sm text-teal-700 mb-4 opacity-90">
            If you want to request data deletion or have questions about how we handle user data, please contact our Support team.
          </p>
          <button
            onClick={() => navigate('/user/help-support')}
            className="w-full py-3 bg-white text-teal-700 font-bold rounded-xl shadow-sm border border-teal-200 active:scale-95 transition-all"
          >
            Contact Help & Support
          </button>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
