import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { publicCatalogService } from '../../../../services/catalogService';
import ContactUs from '../Home/components/ContactUs';
import LogoLoader from '../../../../components/common/LogoLoader';

const ContactPage = () => {
  const [homeContent, setHomeContent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchContent = async () => {
      try {
        const cityId = localStorage.getItem('currentCityId');
        const response = await publicCatalogService.getHomeData(cityId);
        if (response.success && response.homeContent) {
          setHomeContent(response.homeContent);
        }
      } catch (error) {
        console.error('Error fetching contact content:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, []);

  if (loading) return <LogoLoader />;

  return (
    <div className="min-h-screen bg-white">
      <Header 
        siteIdentity={homeContent?.siteIdentity} 
        homeContent={homeContent}
      />
      
      <main className="pt-10 pb-24">
        <ContactUs data={homeContent?.contactUs || {}} />
      </main>

      <BottomNav />
    </div>
  );
};

export default ContactPage;
