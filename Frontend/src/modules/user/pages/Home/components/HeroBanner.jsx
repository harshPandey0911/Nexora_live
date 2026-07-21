import React from 'react';
import { motion } from 'framer-motion';
import { FiCheckCircle, FiClock, FiTruck, FiArrowRight, FiGrid } from 'react-icons/fi';
import { toAssetUrl } from '../../../../admin/pages/UserCategories/utils';

const HeroBanner = ({ banners = [], onSearchClick, heroData }) => {
  const title = heroData?.title || 'Everything You Need, Delivered to You.';
  const subtitle = heroData?.subtitle || 'One super app for all your daily needs.\nFast, reliable & secure delivery at your doorstep.';
  const primaryBtnText = heroData?.primaryBtnText || 'Get Started';
  const secondaryBtnText = heroData?.secondaryBtnText || 'Explore Services';
  // Desktop image: from API, fallback to static file
  const desktopImage = heroData?.imageUrl ? toAssetUrl(heroData.imageUrl) : '/home page .jpeg';
  // Mobile image: from API, fallback to desktop image
  const mobileImage = heroData?.mobileImageUrl ? toAssetUrl(heroData.mobileImageUrl) : desktopImage;

  // Split title for styling - make "Delivered to You." in blue
  const renderTitle = () => {
    const parts = title.split(/(Delivered to You\.?)/i);
    return parts.map((part, i) => {
      if (/delivered to you\.?/i.test(part)) {
        return <span key={i} style={{ color: '#2563eb' }}>{part}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="relative w-full overflow-hidden min-h-[420px] sm:min-h-[500px] lg:min-h-[600px] flex items-stretch">
      {/* Background Image Layer */}
      <div className="absolute inset-0 z-0">
        {/* Mobile: uses mobileImage */}
        <img
          src={mobileImage}
          alt="Hero background mobile"
          className="lg:hidden w-full h-full object-cover object-[75%_center]"
        />
        {/* Desktop: uses desktopImage */}
        <img
          src={desktopImage}
          alt="Hero background desktop"
          className="hidden lg:block w-full h-full object-cover object-right"
        />
        {/* Subtle overlay for text contrast without washing out image */}
        <div className="absolute inset-0 lg:hidden bg-gradient-to-r from-white/35 via-white/10 to-transparent pointer-events-none" />
      </div>

      {/* Subtle Cityscape Silhouette Effect */}
      <div className="absolute inset-0 opacity-[0.03] z-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 200'%3E%3Crect x='50' y='80' width='40' height='120' fill='%232563eb'/%3E%3Crect x='100' y='40' width='30' height='160' fill='%232563eb'/%3E%3Crect x='140' y='60' width='50' height='140' fill='%232563eb'/%3E%3Crect x='200' y='90' width='35' height='110' fill='%232563eb'/%3E%3Crect x='250' y='50' width='45' height='150' fill='%232563eb'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat-x',
        backgroundPosition: 'bottom',
        backgroundSize: 'auto 200px'
      }} />

      <div className="relative z-10 max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-5 sm:py-8 lg:py-10 w-full flex flex-col justify-between">
        {/* Top Content: Title & Subtitle */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col gap-2 sm:gap-3 lg:gap-4 max-w-[58%] sm:max-w-xl lg:max-w-2xl pt-1 sm:pt-2 lg:pt-4"
        >
          <div className="space-y-1.5 sm:space-y-3 lg:space-y-5">
            <h1 className="text-xl sm:text-3xl lg:text-[3.5rem] xl:text-6xl font-[900] text-gray-900 leading-[1.15] lg:leading-[1.1] tracking-tight">
              {renderTitle()}
            </h1>
            <p className="text-[11px] sm:text-sm lg:text-lg text-gray-700 lg:text-gray-500 font-medium max-w-xs sm:max-w-md leading-relaxed whitespace-pre-line">
              {subtitle}
            </p>
          </div>
        </motion.div>

        {/* Bottom Section: Action Buttons + Trust Badges */}
        <div className="mt-auto pt-4 sm:pt-6 flex flex-col gap-2.5 sm:gap-4">
          {/* Action Buttons (Right above trust badges) */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-fit">
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: '0 20px 40px rgba(37, 99, 235, 0.3)' }}
              whileTap={{ scale: 0.96 }}
              onClick={onSearchClick}
              className="px-4 py-2 sm:px-7 sm:py-3 lg:px-9 lg:py-3.5 text-white border-none rounded-full font-bold shadow-lg shadow-blue-500/25 flex items-center justify-center gap-1.5 text-xs sm:text-sm lg:text-base transition-all duration-300 w-full sm:w-auto"
              style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
            >
              {primaryBtnText}
              <FiArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.04, backgroundColor: '#f0f6ff' }}
              whileTap={{ scale: 0.96 }}
              onClick={onSearchClick}
              className="px-4 py-2 sm:px-7 sm:py-3 lg:px-9 lg:py-3.5 bg-white/90 backdrop-blur-sm text-gray-800 border-2 border-gray-200/80 rounded-full font-bold flex items-center justify-center gap-1.5 text-xs sm:text-sm lg:text-base transition-all duration-300 hover:border-blue-300 w-full sm:w-auto"
            >
              {secondaryBtnText}
              <FiGrid className="w-3.5 h-3.5" />
            </motion.button>
          </div>

          {/* Trust Badges */}
          <div className="flex items-center gap-1.5 sm:gap-3 max-w-full overflow-x-auto no-scrollbar pb-1 sm:pb-0 sm:flex-wrap">
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-900 bg-white/85 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border border-white/70 shadow-sm whitespace-nowrap">
              <div className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 bg-blue-600 rounded-md sm:rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
                <FiCheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-3.5 lg:h-3.5" />
              </div>
              <span>100% Secure Payments</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-900 bg-white/85 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border border-white/70 shadow-sm whitespace-nowrap">
              <div className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 bg-blue-600 rounded-md sm:rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
                <FiClock className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-3.5 lg:h-3.5" />
              </div>
              <span>24/7 Support</span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs lg:text-sm font-semibold text-gray-900 bg-white/85 backdrop-blur-md px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full border border-white/70 shadow-sm whitespace-nowrap">
              <div className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 bg-blue-600 rounded-md sm:rounded-lg flex items-center justify-center text-white shadow-sm shrink-0">
                <FiTruck className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-3.5 lg:h-3.5" />
              </div>
              <span>Fast & Reliable Delivery</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
