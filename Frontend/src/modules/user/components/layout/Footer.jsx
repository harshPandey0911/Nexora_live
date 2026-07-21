import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMail, FiPhone, FiMapPin } from 'react-icons/fi';
import Logo from '../../../../components/common/Logo';
import { configService } from '../../../../services/configService';
import { publicCatalogService } from '../../../../services/catalogService';
import api from '../../../../services/api';

const Footer = ({ hasBottomNav }) => {
  const location = useLocation();
  const currentYear = new Date().getFullYear();
  const [settings, setSettings] = useState(null);
  const [dynamicLinks, setDynamicLinks] = useState([]);
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      const data = await configService.getSettings();
      if (data?.success) {
        setSettings(data.settings);
      }
    };
    const fetchLinks = async () => {
      try {
        const response = await api.get('/footer-links');
        if (response.data.success) {
          setDynamicLinks(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch footer links:', error);
      }
    };
    const fetchLogo = async () => {
      try {
        let currentCity = {};
        try {
          const stored = localStorage.getItem('currentCity');
          if (stored) {
            if (stored.trim().startsWith('{') || stored.trim().startsWith('[')) {
              currentCity = JSON.parse(stored);
            } else {
              currentCity = { name: stored };
            }
          }
        } catch (e) {
          currentCity = {};
        }
        const cityId = currentCity?._id || currentCity?.id || '';
        const response = await publicCatalogService.getHomeData(cityId);
        if (response?.success && response?.homeContent?.siteIdentity?.logoUrl) {
          setLogoUrl(response.homeContent.siteIdentity.logoUrl);
        }
      } catch (error) {
        console.error('Failed to fetch logo for footer:', error);
      }
    };
    fetchSettings();
    fetchLinks();
    fetchLogo();
  }, []);

  // Only show on home page as per user request
  if (location.pathname !== '/user' && location.pathname !== '/user/') {
    return null;
  }

  // Group dynamic links by section
  const groupedLinks = dynamicLinks.reduce((acc, link) => {
    const sec = link.section.toUpperCase();
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push({ label: link.title, path: link.url });
    return acc;
  }, {});

  const supportLinks = [
    ...(groupedLinks['USER BOTTOM'] || []),
    {
      label: settings?.supportEmail || 'Nexora@gmail.com',
      path: `mailto:${settings?.supportEmail || 'Nexora@gmail.com'}`,
      icon: FiMail
    },
    {
      label: settings?.supportPhone || '+917014641102',
      path: `tel:${settings?.supportPhone || '+917014641102'}`,
      icon: FiPhone
    }
  ];

  return (
    <footer className={`bg-gray-50 border-t border-gray-100 pt-16 ${hasBottomNav ? 'pb-28' : 'pb-8'} lg:pb-12 mt-20 relative overflow-hidden group`}>
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl -mr-32 -mt-32 transition-colors group-hover:bg-teal-500/10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/5 rounded-full blur-3xl -ml-32 -mb-32 transition-colors group-hover:bg-orange-500/10 pointer-events-none" />

      <div className="max-w-[1400px] mx-auto px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link to="/user" className="inline-block transform hover:scale-105 transition-transform duration-300">
              <Logo className="h-10 w-auto" src={logoUrl} />
            </Link>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              Nexora Go is your one-stop destination for all home services. From electrical repairs to premium salon services, we bring the experts to your doorstep.
            </p>
          </div>

          {/* Support & Services Column */}
          {supportLinks.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest">Support &amp; Services</h3>
              <ul className="space-y-2">
                {supportLinks.map((link) => (
                  <li key={link.label}>
                    {link.path.startsWith('http') || link.path.startsWith('mailto') || link.path.startsWith('tel') ? (
                      <a
                        href={link.path}
                        className="text-gray-500 hover:text-[#347989] text-sm flex items-center gap-2 transition-colors duration-200"
                      >
                        {link.icon && <link.icon className="w-4 h-4" />}
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.path}
                        className="text-gray-500 hover:text-[#347989] text-sm flex items-center gap-2 transition-colors duration-200"
                      >
                        {link.icon && <link.icon className="w-4 h-4" />}
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4" />

        {/* Bottom Row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-400 text-sm">
            © {currentYear} {(settings?.companyName && settings.companyName !== 'TodayMyDream') ? settings.companyName : 'Nexora Go'}. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="/user/privacy" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy</Link>
            <Link to="/user/terms" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
