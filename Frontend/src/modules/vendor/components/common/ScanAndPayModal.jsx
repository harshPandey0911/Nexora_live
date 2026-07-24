import React, { useState, useEffect } from 'react';
import { FiCheckCircle, FiX } from 'react-icons/fi';
import { MdQrCode } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';

const ScanAndPayModal = ({ 
  isOpen, 
  onClose, 
  qrImageUrl, 
  amount, 
  onCheckStatus 
}) => {
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.documentElement.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-white/60 backdrop-blur-xl touch-none overscroll-contain">
        <div className="bg-white w-full max-w-sm rounded-[3rem] overflow-hidden shadow-[0_50px_100px_-20px_rgba(0,0,0,0.1)] relative animate-in zoom-in-95 duration-500 border border-gray-100">
          <div className="p-10 pb-6 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-100 shadow-sm">
              <MdQrCode className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-medium text-gray-900 tracking-tight mb-2">Digital Receipt</h2>
            <p className="text-[10px] font-medium text-gray-400 capitalize tracking-[0.3em] mb-6">
              Invoicing <span className="text-blue-600">₹{amount.toFixed(2)}</span>
            </p>

            <div
              className="bg-gray-50 p-6 rounded-[2.5rem] overflow-hidden mb-10 border border-gray-100 shadow-inner transition-transform active:scale-95 cursor-zoom-in relative group"
              onClick={() => setIsZoomed(true)}
            >
              <img
                src={qrImageUrl}
                alt="Payment QR"
                className="w-full h-auto max-h-[350px] mx-auto mix-blend-multiply object-contain block"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 text-[10px] font-medium text-gray-900 bg-white/90 px-4 py-2 rounded-2xl shadow-2xl capitalize tracking-widest">Expand Protocol</span>
              </div>
            </div>

            <div className="space-y-4">
              <button
                onClick={onCheckStatus}
                className="w-full py-6 bg-blue-600 text-white rounded-[28px] font-medium text-xs capitalize tracking-[0.2em] shadow-xl shadow-blue-500/30 active:scale-95 transition-all flex items-center justify-center gap-4"
              >
                <FiCheckCircle className="w-5 h-5" />
                Validate Transaction
              </button>
              
              <button
                onClick={onClose}
                className="w-full py-4 text-gray-400 font-medium capitalize tracking-widest text-[10px] hover:text-gray-600 transition-colors"
              >
                Abort Operation
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Zoom */}
      {isZoomed && (
        <div 
          className="fixed inset-0 z-[300] bg-white/95 backdrop-blur-3xl flex flex-col items-center justify-center p-8 animate-in fade-in duration-500"
          onClick={() => setIsZoomed(false)}
        >
          <div className="relative w-full max-w-xl flex flex-col items-center animate-in zoom-in-95 duration-500">
            <div className="bg-white p-10 rounded-[4rem] shadow-[0_0_100px_rgba(0,0,0,0.05)] w-full mb-10 text-center border border-gray-100">
               <img 
                src={qrImageUrl} 
                alt="Zoomed QR" 
                className="w-full h-auto max-h-[70vh] object-contain rounded-3xl block mx-auto mix-blend-multiply"
              />
            </div>
            
            <div className="text-center mb-12">
              <p className="text-gray-400 text-[10px] font-medium capitalize tracking-[0.4em] mb-4">Transaction Payload</p>
              <p className="text-5xl font-medium text-gray-900 tracking-tighter">₹{amount.toFixed(2)}</p>
            </div>

            <button 
              className="px-12 py-5 bg-gray-900 text-white rounded-[24px] font-medium text-xs capitalize tracking-[0.2em] flex items-center gap-4 active:scale-95 transition-all shadow-2xl"
              onClick={() => setIsZoomed(false)}
            >
              Close Asset View
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ScanAndPayModal;
