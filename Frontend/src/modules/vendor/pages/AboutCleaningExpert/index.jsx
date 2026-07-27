import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUsers, FiShield, FiClock, FiAward, FiGlobe } from 'react-icons/fi';
import { motion } from 'framer-motion';
import Logo from '../../../../components/common/Logo';
import { configService } from '../../../../services/configService';

const AboutPlugPro = () => {
  const navigate = useNavigate();
  const [platformConfig, setPlatformConfig] = useState({
    companyName: 'PlugPro',
    stats: [
      { number: '10K+', label: 'Happy Customers' },
      { number: '500+', label: 'Service Partners' },
      { number: '4.8', label: 'Platform Rating' },
    ]
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await configService.getSettings();
        if (res && res.success) {
          const companyName = res.settings?.companyName || 'PlugPro';
          const happyCustomers = res.stats?.happyCustomers || '10K+';
          const servicePartners = res.stats?.servicePartners || '500+';
          const platformRating = res.stats?.platformRating || '4.8';

          setPlatformConfig({
            companyName,
            stats: [
              { number: happyCustomers, label: 'Happy Customers' },
              { number: servicePartners, label: 'Service Partners' },
              { number: platformRating, label: 'Platform Rating' },
            ]
          });
        }
      } catch (error) {
        console.error('Error fetching platform config:', error);
      }
    };

    fetchConfig();
  }, []);

  // Container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1]
      }
    }
  };

  const features = [
    {
      icon: FiUsers,
      title: 'Expert Providers',
      description: 'Verified professionals for all your needs'
    },
    {
      icon: FiShield,
      title: 'Safe & Secure',
      description: 'Your safety is our top priority'
    },
    {
      icon: FiClock,
      title: 'On-Time Service',
      description: 'Punctual delivery at your convenience'
    },
    {
      icon: FiAward,
      title: 'Quality Assured',
      description: 'Service with 100% satisfaction guarantee'
    }
  ];

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="min-h-screen bg-white pb-10"
    >
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-gray-100">
        <div className="px-5 py-5 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-all active:scale-90"
          >
            <FiArrowLeft className="w-5 h-5 text-black" />
          </button>
          <span className="text-sm font-medium capitalize tracking-[0.3em] text-black">
            About {platformConfig.companyName}
          </span>
        </div>
      </header>

      <main className="px-5 py-10 space-y-12 max-w-lg mx-auto">
        {/* Hero Section */}
        <motion.div variants={itemVariants} className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-black rounded-[32px] shadow-2xl flex items-center justify-center transform rotate-6 scale-90 opacity-10" />
            <div className="absolute inset-0 bg-white rounded-[32px] shadow-sm border border-gray-100 flex items-center justify-center relative z-10">
              <Logo className="w-14 h-14 object-contain" />
            </div>
          </div>

          <h1 className="text-4xl font-medium text-black mb-4 tracking-tighter">
            {platformConfig.companyName} <span className="text-gray-200">Network</span>
          </h1>
          <p className="text-[10px] font-medium capitalize tracking-[0.2em] text-gray-400 max-w-xs mx-auto leading-loose">
            Redefining professional service delivery through technology and trust.
          </p>
        </motion.div>

        {/* Stats Row */}
        <motion.div variants={itemVariants} className="flex justify-between bg-black rounded-[40px] p-8 shadow-2xl shadow-gray-200">
          {platformConfig.stats.map((stat, idx) => (
            <div key={idx} className="flex-1 text-center px-2">
              <div className="text-xl font-medium text-white tracking-tighter">
                {stat.number}
              </div>
              <div className="text-[8px] font-medium capitalize tracking-[0.2em] text-white/40 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Mission Statement */}
        <motion.div variants={itemVariants}>
          <div className="bg-gray-50 rounded-[40px] p-8 border border-gray-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 text-black opacity-[0.03]">
              <FiGlobe className="w-32 h-32" />
            </div>
            <h3 className="text-xs font-medium text-black capitalize tracking-[0.3em] mb-4">Our Vision</h3>
            <p className="text-[11px] font-normal text-gray-500 leading-relaxed relative z-10 tracking-tighter">
              {platformConfig.companyName} is architecting a new standard for home and personal services. We bridge the gap between skilled experts and discerning users through a seamless, secure, and transparent marketplace. Our focus is quality at scale.
            </p>
          </div>
        </motion.div>

        {/* Why Choose Us Grid */}
        <motion.div variants={itemVariants}>
          <h3 className="text-xs font-medium text-black capitalize tracking-[0.3em] mb-6 px-1 text-center">Core Pillars</h3>
          <div className="grid grid-cols-2 gap-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white rounded-[32px] p-6 shadow-sm border border-gray-100 group hover:border-black transition-all"
              >
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center mb-4 group-hover:bg-black group-hover:text-white transition-all border border-gray-100">
                  <feature.icon className="w-5 h-5" />
                </div>
                <h4 className="text-[10px] font-medium text-black capitalize tracking-widest mb-2">{feature.title}</h4>
                <p className="text-[9px] font-normal text-gray-400 leading-relaxed tracking-tighter">{feature.description}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Footer Info */}
        <motion.div variants={itemVariants} className="text-center pt-8 border-t border-gray-100">
          <p className="text-[9px] font-medium text-gray-300 capitalize tracking-[0.2em] mb-1">Ecosystem Managed By</p>
          <span className="text-sm font-medium text-black capitalize tracking-[0.4em]">{platformConfig.companyName} Elite</span>
          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
            <p className="text-[9px] font-medium text-gray-400 capitalize tracking-widest">Version 8.0.0 Global</p>
          </div>
        </motion.div>
      </main>
    </motion.div>
  );
};

export default AboutPlugPro;
