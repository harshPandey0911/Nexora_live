import React, { useLayoutEffect, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShield, FiFileText, FiUserCheck, FiCreditCard, FiAlertTriangle, FiChevronDown } from 'react-icons/fi';
import { themeColors } from '../../../../theme';
import { configService } from '../../../../services/configService';

const TermsConditions = () => {
  const navigate = useNavigate();
  const brandColor = themeColors.brand?.teal || '#347989';
  const [expandedIndex, setExpandedIndex] = useState(0); // First section open by default
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

  const toggleSection = (idx) => {
    setExpandedIndex(expandedIndex === idx ? null : idx);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'user': return <FiUserCheck className="w-5 h-5 text-teal-600" />;
      case 'shield': return <FiShield className="w-5 h-5 text-indigo-600" />;
      case 'payment': return <FiCreditCard className="w-5 h-5 text-emerald-600" />;
      case 'alert': return <FiAlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'file':
      default:
        return <FiFileText className="w-5 h-5 text-rose-600" />;
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

      <main className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {/* Intro Card */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--brand-teal)] to-teal-600" style={{ backgroundColor: brandColor }} />
          <h2 className="text-lg font-bold text-gray-900 mb-1">{data.title}</h2>
          <p className="text-[10px] text-gray-400 font-medium">Last updated: {data.lastUpdated}</p>
          <p className="text-xs md:text-sm text-gray-600 mt-3 leading-relaxed">
            {data.introduction}
          </p>
        </div>

        {/* Section List (Accordion) */}
        <div className="space-y-2.5">
          {data.sections && data.sections.map((section, idx) => {
            const isExpanded = expandedIndex === idx;
            return (
              <div 
                key={idx} 
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all duration-300 hover:shadow-md hover:border-gray-200/85"
              >
                <button
                  onClick={() => toggleSection(idx)}
                  className="w-full p-4 flex items-center justify-between gap-4 text-left focus:outline-none cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                      {getIcon(section.iconType)}
                    </div>
                    <h3 className="font-bold text-gray-800 text-sm md:text-base">{section.title}</h3>
                  </div>
                  <FiChevronDown 
                    className={`w-5 h-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${
                      isExpanded ? 'transform rotate-180 text-teal-600' : ''
                    }`} 
                  />
                </button>
                
                <div 
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isExpanded ? 'max-h-[500px] border-t border-gray-50' : 'max-h-0'
                  }`}
                >
                  <div className="p-4 bg-gray-50/20">
                    <p className="text-xs md:text-sm text-gray-600 leading-relaxed font-normal">{section.content}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Closing Agreement Card */}
        <div className="bg-gradient-to-r from-teal-50/50 to-emerald-50/50 rounded-2xl p-5 border border-teal-100/70 text-center">
          <h3 className="font-bold text-teal-900 mb-1 text-sm md:text-base">Have questions about our Terms?</h3>
          <p className="text-xs text-teal-700 mb-3 opacity-90 leading-relaxed">
            If you need clarification on any part of our Terms & Conditions, please reach out to our Customer Support.
          </p>
          <button
            onClick={() => navigate('/user/help-support')}
            className="w-full py-2.5 bg-white text-teal-700 font-bold rounded-xl shadow-xs border border-teal-200 active:scale-95 transition-all text-xs md:text-sm cursor-pointer hover:bg-teal-50/30"
          >
            Contact Help & Support
          </button>
        </div>
      </main>
    </div>
  );
};

export default TermsConditions;
