import React, { useLayoutEffect, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiShield, FiFileText, FiUserCheck, FiCreditCard, FiAlertTriangle } from 'react-icons/fi';
import { themeColors } from '../../../../theme';
import { configService } from '../../../../services/configService';

const TermsConditions = () => {
  const navigate = useNavigate();
  const brandColor = themeColors.brand?.teal || '#347989';
  const [data, setData] = useState({
    title: 'Nexora Go Worker Terms of Service',
    lastUpdated: 'July 15, 2026',
    introduction: 'Please read these Terms & Conditions carefully before joining our platform as a service professional.',
    sections: [
      {
        title: "1. Worker Onboarding & Background Check",
        content: "To accept job assignments on Nexora Go, workers must undergo verification, submit valid identity proof (Aadhar/PAN), and maintain clean background check records. Account approval is subject to admin review.",
        iconType: "user"
      },
      {
        title: "2. Job Acceptance & Service Quality",
        content: "Workers must maintain professional conduct, punctuality, and follow quality standards. Repeated rejection of assigned jobs, late arrivals, or customer complaints may result in account suspension.",
        iconType: "shield"
      },
      {
        title: "3. Payouts & Commission Structure",
        content: "Earnings for completed jobs are credited to your worker wallet after deducting platform fees/commission. Payout settlements can be requested directly to your registered bank account or UPI ID.",
        iconType: "payment"
      },
      {
        title: "4. Safety & Work Conduct",
        content: "Workers must ensure safety protocols are followed on job sites. Any safety hazard, customer dispute, or property damage must be reported immediately to Nexora support.",
        iconType: "alert"
      },
      {
        title: "5. Termination & Policy Updates",
        content: "Nexora Go reserves the right to terminate worker access for violations of terms, fraudulent activity, or unresponsiveness. Policy updates will be notified in-app.",
        iconType: "file"
      }
    ]
  });

  useEffect(() => {
    const fetchTerms = async () => {
      try {
        const res = await configService.getSettings();
        const wTerms = res.settings?.workerTermsAndConditions;
        if (res.success && wTerms && Array.isArray(wTerms.sections) && wTerms.sections.length >= 3 && wTerms.title?.toLowerCase().includes('worker')) {
          setData(wTerms);
        }
      } catch (error) {
        console.error('Failed to fetch worker terms settings:', error);
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
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[var(--brand-teal)] to-teal-600" style={{ backgroundColor: brandColor }} />
          <h2 className="text-xl font-extrabold text-gray-900 mb-2">{data.title}</h2>
          <p className="text-xs text-gray-500 font-medium">Last updated: {data.lastUpdated}</p>
          <p className="text-sm text-gray-600 mt-4 leading-relaxed">
            {data.introduction}
          </p>
        </div>

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
      </main>
    </div>
  );
};

export default TermsConditions;
