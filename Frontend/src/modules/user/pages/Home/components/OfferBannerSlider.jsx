import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Mousewheel } from 'swiper/modules';
import { useNavigate } from 'react-router-dom';
import 'swiper/css';
import 'swiper/css/pagination';

const OfferBannerSlider = ({ banners }) => {
  const navigate = useNavigate();

  if (!banners || banners.length === 0) return null;

  const handleBannerClick = (banner) => {
    if (banner.link) {
      if (banner.link.startsWith('http')) {
        window.open(banner.link, '_blank');
      } else {
        navigate(banner.link);
      }
    }
  };

  return (
    <div className="mb-6 w-full px-1">
      <div className="mb-4 px-1">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
          Offers For You
        </h2>
      </div>

      <Swiper
        modules={[Pagination, Mousewheel]}
        spaceBetween={12}
        slidesPerView={1.15}
        breakpoints={{
          640: {
            slidesPerView: 1.8,
            spaceBetween: 16
          },
          1024: {
            slidesPerView: 2.4,
            spaceBetween: 20
          }
        }}
        mousewheel={{
          forceToAxis: true,
        }}
        pagination={{
          clickable: true,
          dynamicBullets: true,
        }}
        className="w-full overflow-hidden shadow-sm"
      >
        {banners.map((banner) => (
          <SwiperSlide key={banner._id}>
            <div 
              className="relative w-full aspect-[2/1] bg-transparent rounded-2xl sm:rounded-3xl overflow-hidden cursor-pointer active:scale-[0.98] transition-transform duration-200 flex items-center justify-center"
              onClick={() => handleBannerClick(banner)}
            >
              <img 
                src={banner.imageUrl} 
                alt={banner.title} 
                className="w-full h-full object-fill rounded-2xl sm:rounded-3xl"
                loading="lazy"
              />
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
      
      <style>{`
        .swiper-pagination-bullet-active {
          background: #2874f0 !important;
        }
        .swiper-pagination {
          bottom: 10px !important;
        }
      `}</style>
    </div>
  );
};

export default OfferBannerSlider;
