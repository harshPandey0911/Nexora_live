import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSend, FiUpload, FiCheck, FiCreditCard, FiSmartphone, FiDollarSign, FiX, FiCamera } from 'react-icons/fi';
import vendorWalletService from '../../../../services/vendorWalletService';
import { toast } from 'react-hot-toast';
import flutterBridge from '../../../../utils/flutterBridge';
import { uploadToCloudinary } from '../../../../utils/cloudinaryUpload';
import { compressImage } from '../../../../utils/imageCompression';

const SettlementRequest = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [wallet, setWallet] = useState({ amountDue: 0 });
  const [formData, setFormData] = useState({
    amount: '',
    paymentMethod: 'upi',
    paymentReference: '',
    paymentProof: '',
    notes: ''
  });
  const [proofPreview, setProofPreview] = useState(null);

  useEffect(() => {
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      setLoading(true);
      const res = await vendorWalletService.getWallet();
      if (res.success) {
        setWallet(res.data);
        setFormData(prev => ({ ...prev, amount: res.data.amountDue.toString() }));
      }
    } catch (error) {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };



  const handleNativeCamera = async () => {
    try {
      const file = await flutterBridge.openCamera();
      if (file) {
        setProofPreview(URL.createObjectURL(file));
        const loadingToast = toast.loading('Uploading Proof...');
        const secureUrl = await uploadToCloudinary(file);
        setFormData(prev => ({ ...prev, paymentProof: secureUrl }));
        toast.dismiss(loadingToast);
        toast.success('Proof captured & uploaded!');
        flutterBridge.hapticFeedback('success');
      }
    } catch (error) {
      console.error('Native capture failed:', error);
      toast.error('Failed to capture proof');
      toast.dismiss();
    }
  };

  const handleProofUpload = async (e) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    if (originalFile.size > 20 * 1024 * 1024) {
      toast.error('File too large (max 20MB)');
      return;
    }

    const previewUrl = URL.createObjectURL(originalFile);
    setProofPreview(previewUrl);

    let loadingToast;
    try {
      loadingToast = toast.loading('Optimizing & Uploading...');
      
      let fileToUpload = originalFile;
      if (originalFile.type.startsWith('image/')) {
        try {
          fileToUpload = await compressImage(originalFile, {
            maxWidth: 1200,
            maxHeight: 1200,
            quality: 0.85
          });
        } catch (compressError) {
          console.warn('Image compression failed, using original file:', compressError);
          fileToUpload = originalFile;
        }
      }

      const secureUrl = await uploadToCloudinary(fileToUpload);
      setFormData(prev => ({ ...prev, paymentProof: secureUrl }));
      toast.dismiss(loadingToast);
      toast.success('Proof uploaded successfully');
    } catch (error) {
      console.error('Upload failed:', error);
      toast.error('Failed to upload proof');
      if (loadingToast) toast.dismiss(loadingToast);
      setProofPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    if (parseFloat(formData.amount) > wallet.amountDue) {
      toast.error(`Amount cannot exceed ₹${wallet.amountDue}`);
      return;
    }

    if (!formData.paymentReference) {
      toast.error('Please enter UPI/Transaction reference');
      return;
    }

    if (!formData.paymentProof) {
      toast.error('Payment screenshot is required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await vendorWalletService.requestSettlement({
        amount: parseFloat(formData.amount),
        paymentMethod: formData.paymentMethod,
        paymentReference: formData.paymentReference,
        paymentProof: formData.paymentProof,
        notes: formData.notes
      });

      if (res.success) {
        toast.success('Settlement request submitted!');
        navigate('/vendor/wallet');
      } else {
        toast.error(res.message || 'Failed to submit request');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative overflow-x-hidden">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-100 px-10 py-6 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-all"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-medium text-gray-900 tracking-tight capitalize">Audit Logs</h1>
        </div>
        <div className="w-12 h-12 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-center">
          <FiSend className="w-6 h-6 text-blue-600" />
        </div>
      </header>

      <main className="px-8 pt-8 relative z-10 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Liability & Magnitude */}
          <div className="space-y-6">
            {/* Amount Due Banner */}
            <div className="bg-gradient-to-br from-rose-600 to-rose-700 rounded-3xl p-8 relative overflow-hidden group shadow-lg shadow-rose-900/10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-[80px] -mr-32 -mt-32 group-hover:scale-125 transition-transform duration-1000" />

              <div className="relative z-10 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-medium text-rose-100 capitalize tracking-[0.4em] mb-1.5 opacity-80">Operational Liability</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-medium text-rose-200">₹</span>
                    <p className="text-4xl font-medium text-white tracking-tighter leading-none">
                      {wallet.amountDue?.toLocaleString() || 0}
                    </p>
                  </div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-xl">
                  <FiDollarSign className="w-7 h-7" />
                </div>
              </div>

              <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-300 animate-pulse" />
                <p className="text-[8px] font-medium text-rose-100 capitalize tracking-[0.3em] opacity-80">Critical Settlement Required</p>
              </div>
            </div>

            {/* Settlement Form - Part 1 */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 space-y-8 shadow-sm">
              {/* Amount */}
              <div className="space-y-3">
                <label className="text-[9px] font-medium text-gray-400 capitalize tracking-[0.4em] ml-2">
                  Transfer Magnitude
                </label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-300 font-medium text-lg">₹</span>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full pl-10 pr-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl text-xl font-medium text-gray-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-all placeholder:text-gray-200"
                    placeholder="0.00"
                    max={wallet.amountDue}
                  />
                </div>
                <div className="flex justify-between items-center px-2">
                  <p className="text-[8px] font-medium text-gray-400 capitalize tracking-widest leading-relaxed">System Limit: ₹{wallet.amountDue?.toLocaleString()}</p>
                  <button
                    onClick={() => setFormData(prev => ({ ...prev, amount: wallet.amountDue.toString() }))}
                    className="text-[8px] font-medium text-blue-600 capitalize tracking-widest hover:text-blue-500 transition-colors"
                  >
                    Clear Liability
                  </button>
                </div>
              </div>

              {/* Transfer Mode */}
              <div className="space-y-4">
                <label className="text-[9px] font-medium text-gray-400 capitalize tracking-[0.4em] ml-2">
                  Protocol Selection
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'upi', label: 'UPI INTEL', icon: FiSmartphone },
                    { id: 'bank_transfer', label: 'WIRE TRANSFER', icon: FiCreditCard },
                  ].map(method => (
                    <button
                      key={method.id}
                      onClick={() => setFormData(prev => ({ ...prev, paymentMethod: method.id }))}
                      className={`p-5 rounded-2xl border transition-all duration-500 flex flex-col items-center gap-3 ${formData.paymentMethod === method.id
                        ? 'border-blue-500 bg-blue-50 shadow-md shadow-blue-900/5'
                        : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                        }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${formData.paymentMethod === method.id ? 'bg-blue-600 text-white' : 'bg-white text-gray-400 border border-gray-100'}`}>
                        <method.icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[9px] font-medium capitalize tracking-[0.2em] ${formData.paymentMethod === method.id ? 'text-blue-600' : 'text-gray-400'}`}>
                        {method.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Evidence & Verification */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 border border-gray-100 space-y-8 shadow-sm">
              {/* Reference */}
              <div className="space-y-3">
                <label className="text-[9px] font-medium text-gray-400 capitalize tracking-[0.4em] ml-2">
                  Verification Code (TXN ID)
                </label>
                <input
                  type="text"
                  value={formData.paymentReference}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentReference: e.target.value }))}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-medium text-gray-900 capitalize tracking-widest transition-all placeholder:text-gray-200"
                  placeholder="ENTER VECTOR REFERENCE..."
                />
              </div>

              {/* Proof */}
              <div className="space-y-3">
                <label className="text-[9px] font-medium text-gray-400 capitalize tracking-[0.4em] ml-2">
                  Visual Confirmation
                </label>
                {proofPreview ? (
                  <div className="relative group">
                    <img
                      src={proofPreview}
                      alt="Proof"
                      className="w-full h-64 object-cover bg-gray-50 rounded-2xl border border-gray-100 shadow-lg"
                    />
                    <button
                      onClick={() => {
                        setProofPreview(null);
                        setFormData(prev => ({ ...prev, paymentProof: '' }));
                      }}
                      className="absolute top-4 right-4 w-10 h-10 bg-white/90 hover:bg-red-600 hover:text-white text-gray-700 rounded-xl flex items-center justify-center backdrop-blur-xl transition-all border border-gray-100 shadow-md"
                    >
                      <FiX className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {flutterBridge.isFlutter && (
                      <button
                        type="button"
                        onClick={handleNativeCamera}
                        className="w-full py-4 bg-gray-50 border border-gray-100 text-gray-700 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-100 transition-all font-medium text-[10px] capitalize tracking-[0.3em] shadow-sm"
                      >
                        <FiCamera className="w-5 h-5 text-blue-600" />
                        INTEL CAPTURE
                      </button>
                    )}

                    <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-gray-200 rounded-3xl cursor-pointer hover:bg-gray-50 hover:border-blue-500/50 transition-all bg-gray-50/50">
                      <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center mb-3 text-blue-600 shadow-sm">
                        <FiUpload className="w-5 h-5" />
                      </div>
                      <span className="text-[9px] font-medium text-gray-900 capitalize tracking-[0.2em]">
                        {flutterBridge.isFlutter ? 'AUTHORIZE LIBRARY' : 'ATTACH EVIDENCE'}
                      </span>
                      <span className="text-[7px] text-gray-400 mt-1 capitalize tracking-[0.4em] font-medium">PNG / JPG / HEIC</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleProofUpload}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-3">
                <label className="text-[9px] font-medium text-gray-400 capitalize tracking-[0.4em] ml-2">
                  Operational Commentary
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-medium text-gray-900 capitalize tracking-widest transition-all placeholder:text-gray-200 resize-none"
                  rows={3}
                  placeholder="OPTIONAL LOG ENTRIES..."
                />
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-6 rounded-3xl font-medium text-white text-[11px] capitalize tracking-[0.5em] flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-50 bg-blue-600 shadow-xl shadow-blue-900/40 group relative overflow-hidden cursor-pointer"
            >
              {submitting ? (
                <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  AUTHORIZE AUDIT
                  <FiSend className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-500" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Audit Disclaimer */}
        <div className="mt-12 mb-16 flex flex-col items-center gap-3 px-10">
          <FiCheck className="w-4 h-4 text-gray-300" />
          <p className="text-center text-[8px] text-gray-400 font-medium capitalize tracking-[0.3em] leading-loose opacity-80">
            Audit logs are processed via secure financial nodes.<br />
            Verification protocols finalize within 24 operational hours.
          </p>
        </div>
      </main>
    </div>
  );
};

export default SettlementRequest;
