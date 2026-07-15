import React from 'react';
import mobileImage from '../../../../../assets/mobile.png';

const AppDownloadBanner = ({ appData }) => {
  const title = appData?.title || 'Download the Nexora GO App';
  const subtitle = appData?.subtitle || 'Better experience, exclusive offers & faster everything. Scan to download or use the stores.';
  const playStoreUrl = appData?.playStoreUrl || '#';
  const appStoreUrl = appData?.appStoreUrl || '#';
  const qrCodeUrl = appData?.qrCodeUrl || '/qr-code.png';
  const imageUrl = appData?.imageUrl || mobileImage;

  return (
    <div className="px-5 max-w-[1400px] mx-auto w-full mt-6 lg:mt-10 mb-10 lg:mb-16">
      <div className="bg-white rounded-[32px] lg:rounded-[40px] p-6 lg:p-10 relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-10 border border-black/[0.03] shadow-[0_32px_80px_-20px_rgba(0,0,0,0.08)]">
        
        {/* Content */}
        <div className="relative z-10 flex-1 max-w-xl text-center lg:text-left">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-[1000] text-gray-900 leading-tight mb-4 lg:mb-5">
            {title}
          </h2>
          <p className="text-gray-500 font-medium text-sm lg:text-base leading-relaxed mb-6 lg:mb-8 max-w-md mx-auto lg:mx-0">
            {subtitle}
          </p>
          
          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center lg:justify-start gap-3 lg:gap-4">
            <a 
              href={playStoreUrl !== '#' ? playStoreUrl : undefined}
              target={playStoreUrl !== '#' ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={(e) => { if (playStoreUrl === '#') e.preventDefault(); }}
              className="flex items-center gap-2 lg:gap-3 bg-black text-white px-6 py-3 lg:px-7 lg:py-3.5 rounded-xl lg:rounded-2xl hover:scale-105 transition-transform w-full sm:w-auto justify-center cursor-pointer"
            >
              <div className="text-left">
                <div className="text-[8px] lg:text-[9px] uppercase font-bold leading-none">Get it on</div>
                <div className="text-[14px] lg:text-[15px] font-black">Google Play</div>
              </div>
            </a>
            <a 
              href={appStoreUrl !== '#' ? appStoreUrl : undefined}
              target={appStoreUrl !== '#' ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={(e) => { if (appStoreUrl === '#') e.preventDefault(); }}
              className="flex items-center gap-2 lg:gap-3 bg-black text-white px-6 py-3 lg:px-7 lg:py-3.5 rounded-xl lg:rounded-2xl hover:scale-105 transition-transform w-full sm:w-auto justify-center cursor-pointer"
            >
              <div className="text-left">
                <div className="text-[8px] lg:text-[9px] uppercase font-bold leading-none">Download on the</div>
                <div className="text-[14px] lg:text-[15px] font-black">App Store</div>
              </div>
            </a>
          </div>
        </div>

        {/* Device Image */}
        <div className="relative w-[220px] lg:w-[260px] drop-shadow-[0_40px_80px_rgba(0,0,0,0.12)] hidden lg:block">
          <img 
            src={imageUrl} 
            alt="App Phone" 
            className="w-full h-auto rounded-[2.5rem] lg:rounded-[3rem]"
          />
        </div>

      </div>
    </div>
  );
};

export default AppDownloadBanner;
