import React, { useLayoutEffect, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShield, FiFileText, FiUserCheck, FiCreditCard, FiAlertTriangle } from 'react-icons/fi';
import { themeColors } from '../../../../theme';
import { configService } from '../../../../services/configService';

const TermsConditions = () => {
  const navigate = useNavigate();
  const brandColor = themeColors.brand?.teal || '#347989';
  const [data, setData] = useState({
    title: 'Nexora Go Terms of Service',
    lastUpdated: 'July 15, 2026',
    introduction: 'Please read these Terms & Conditions carefully before using our website or mobile application. By accessing or using Nexora Go (Homestr), you agree to be bound by these terms.',
    sections: [
      {
        title: "1. User Account & Eligibility",
        content: "To use Nexora Go (Homestr) services, you must register for an account and provide accurate, current information. You are solely responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must be at least 18 years of age to create an account.",
        iconType: "user"
      },
      {
        title: "2. Service Bookings & Partner Platform",
        content: "Nexora Go operates as an intermediary platform connecting users with independent service professionals. While we run background checks and maintain quality control protocols, services are executed by third-party professionals. Users agree to provide a safe and respectful working environment for our service partners.",
        iconType: "shield"
      },
      {
        title: "3. Payments, Cancellations & Refunds",
        content: "All payments must be made online through the platform's integrated payment systems. Cancellation of booked services is subject to our Cancellation Policy. Penalties may apply if bookings are cancelled after a professional has been assigned or has started traveling to your location.",
        iconType: "payment"
      },
      {
        title: "4. Limitations of Liability",
        content: "Nexora Go is not liable for indirect, incidental, special, exemplary, or consequential damages, including lost profits, lost data, personal injury, or property damage related to or resulting from any use of the services. Maximum liability is capped at the amount paid by the user for the specific service booking.",
        iconType: "alert"
      },
      {
        title: "5. Modifications of Terms",
        content: "We reserve the right to modify these Terms and Conditions at any time. Updated terms will be posted on the platform, and your continued use of Nexora Go services constitutes acceptance of the amended terms. We recommend reviewing these terms periodically.",
        iconType: "file"
      }
    ]
  });

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await configService.getSettings();
        if (res.success && res.settings && res.settings.termsAndConditions) {
          setData(res.settings.termsAndConditions);
        }
      } catch (error) {
        console.error('Failed to fetch terms settings:', error);
      }
    };
    fetchTerms();
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const getIcon = (type) => {
    switch (type) {
      case 'user': return <FiUserCheck className="w-6 h-6 text-teal-600" />;
      case 'shield': return <FiShield className="w-6 h-6 text-indigo-600" />;
      case 'payment': return <FiCreditCard className="w-6 h-6 text-emerald-600" />;
      case 'alert': return <FiAlertTriangle className="w-6 h-6 text-amber-600" />;
      case 'file':
      default:
        return <FiFileText className="w-6 h-6 text-rose-600" />;
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
          <h1 className="text-xl font-bold text-gray-900">Terms & Conditions</h1>
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
          <h3 className="font-bold text-teal-900 mb-2">Have questions about our Terms?</h3>
          <p className="text-sm text-teal-700 mb-4 opacity-90">
            If you need clarification on any part of our Terms & Conditions, please reach out to our Customer Support.
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

export default TermsConditions;
