import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiMail, FiPhone, FiMapPin } from 'react-icons/fi';
import Logo from '../../../../components/common/Logo';
import { configService } from '../../../../services/configService';
import { publicCatalogService } from '../../../../services/catalogService';
import api from '../../../../services/api';

const toAssetUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000').replace(/\/api$/, '');
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
};

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
        if (response?.success && response?.homeContent?.siteIdentity) {
          const identity = response.homeContent.siteIdentity;
          setLogoUrl(identity.brandLogoUrl || identity.logoUrl || '');
        }
      } catch (error) {
        console.error('Failed to fetch logo for footer:', error);
      }
    };
    fetchSettings();
    fetchLinks();
    fetchLogo();
  }, []);

  if (location.pathname !== '/user' && location.pathname !== '/user/') {
    return null;
  }

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
    <footer className={`bg-white border-t border-gray-100 pt-10 ${hasBottomNav ? 'pb-24' : 'pb-6'} lg:pb-10 mt-12 relative overflow-hidden`}>
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 relative z-10 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Brand Column */}
          <div className="space-y-2">
            <Link to="/user" className="inline-block transition-transform hover:scale-105">
              {logoUrl ? (
                <img src={toAssetUrl(logoUrl)} alt="Nexora Go" className="h-8 w-auto max-w-[180px] object-contain" />
              ) : (
                <Logo className="h-8 w-auto" />
              )}
            </Link>
            <p className="text-gray-500 text-xs leading-relaxed max-w-sm font-medium">
              Nexora Go is your one-stop destination for all home services. From electrical repairs to premium salon services, we bring the experts to your doorstep.
            </p>
          </div>

          {/* Support & Services Column */}
          {supportLinks.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Support &amp; Services</h3>
              <ul className="space-y-1.5">
                {supportLinks.map((link) => (
                  <li key={link.label}>
                    {link.path.startsWith('http') || link.path.startsWith('mailto') || link.path.startsWith('tel') ? (
                      <a
                        href={link.path}
                        className="text-gray-500 hover:text-blue-600 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        {link.icon && <link.icon className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        <span>{link.label}</span>
                      </a>
                    ) : (
                      <Link
                        to={link.path}
                        className="text-gray-500 hover:text-blue-600 text-xs font-medium flex items-center gap-1.5 transition-colors"
                      >
                        {link.icon && <link.icon className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                        <span>{link.label}</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-gray-100" />

        {/* Bottom Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-medium text-gray-400">
          <p>
            © {currentYear} {(settings?.companyName && settings.companyName !== 'TodayMyDream') ? settings.companyName : 'Nexora Go'}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/user/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link to="/user/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
