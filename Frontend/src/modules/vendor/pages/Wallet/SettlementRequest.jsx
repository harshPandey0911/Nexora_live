import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FiArrowLeft, FiSend, FiUpload, FiCheck, FiCreditCard, 
  FiSmartphone, FiDollarSign, FiX, FiCamera, FiCopy, FiInfo, FiShield, FiClock 
} from 'react-icons/fi';
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
  const [settlementHistory, setSettlementHistory] = useState([]);
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

      // Fetch wallet metrics safely
      try {
        const res = await vendorWalletService.getWallet();
        if (res?.success && res?.data) {
          setWallet(res.data);
          setFormData(prev => ({ ...prev, amount: (res.data.amountDue || 0).toString() }));
        }
      } catch (err) {
        console.error('Failed to load wallet metrics:', err);
      }

      // Fetch settlement history safely
      try {
        const setRes = await vendorWalletService.getSettlements({ limit: 20 });
        if (setRes?.success && Array.isArray(setRes.data)) {
          setSettlementHistory(setRes.data);
        } else if (Array.isArray(setRes)) {
          setSettlementHistory(setRes);
        } else {
          setSettlementHistory([]);
        }
      } catch (err) {
        console.error('Failed to load settlement history:', err);
        setSettlementHistory([]);
      }
    } catch (error) {
      console.error('Error loading settlement page:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const formatDateSafe = (dateStr) => {
    if (!dateStr) return 'N/A';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleString('en-IN');
  };

  const handleNativeCamera = async () => {
    try {
      const file = await flutterBridge.openCamera();
      if (file) {
        setProofPreview(URL.createObjectURL(file));
        const loadingToast = toast.loading('Uploading Payment Proof...');
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
    const parsedAmount = parseFloat(formData.amount);
    const cleanRef = (formData.paymentReference || '').trim();
    const currentDues = wallet?.amountDue || 0;

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid positive amount');
      return;
    }

    if (parsedAmount > currentDues) {
      toast.error(`Settlement amount (₹${parsedAmount}) cannot exceed active dues (₹${currentDues})`);
      return;
    }

    if (!cleanRef) {
      toast.error('Please enter your UPI UTR / Transaction Reference ID');
      return;
    }

    if (cleanRef.length < 6 || cleanRef.length > 25) {
      toast.error('Transaction Ref / UTR must be between 6 and 25 characters (e.g. 12-digit UPI UTR)');
      return;
    }

    if (!formData.paymentProof) {
      toast.error('Payment screenshot proof is required');
      return;
    }

    try {
      setSubmitting(true);
      const res = await vendorWalletService.requestSettlement({
        amount: parsedAmount,
        paymentMethod: formData.paymentMethod,
        paymentReference: cleanRef,
        paymentProof: formData.paymentProof,
        notes: formData.notes
      });

      if (res?.success) {
        toast.success('Cash settlement submitted for Admin verification!');
        loadWallet();
        navigate('/vendor/wallet');
      } else {
        toast.error(res?.message || 'Failed to submit request');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit settlement request');
    } finally {
      setSubmitting(false);
    }
  };

  const adminBank = wallet?.adminPaymentDetails || {
    upiId: 'nexora.settle@okicici',
    accountName: 'Nexora Platform Pvt Ltd',
    bankName: 'HDFC Bank Ltd',
    accountNumber: '50200088991122',
    ifscCode: 'HDFC0001234'
  };

  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 5;

  const safeHistory = Array.isArray(settlementHistory) ? settlementHistory : [];
  const pendingItem = safeHistory.find(s => s?.status === 'pending');
  const currentDues = wallet?.amountDue || 0;

  const totalEntries = safeHistory.length;
  const totalPages = Math.ceil(totalEntries / PAGE_SIZE) || 1;
  const paginatedHistory = safeHistory.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const startEntry = totalEntries === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endEntry = Math.min(currentPage * PAGE_SIZE, totalEntries);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-100 px-6 sm:px-10 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-all active:scale-95"
          >
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Clear Cash Platform Dues</h1>
            <p className="text-xs text-gray-500 font-medium">Deposit collected customer cash back to Admin account</p>
          </div>
        </div>
        <div className="w-11 h-11 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-center text-blue-600">
          <FiSend className="w-5 h-5" />
        </div>
      </header>

      <main className="px-4 sm:px-8 pt-6 max-w-5xl mx-auto space-y-6">
        {/* Official Admin Receiver Details Card */}
        <div className="bg-gradient-to-br from-gray-900 via-slate-900 to-gray-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-gray-800 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                <FiShield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Official Admin Receiving Account</h3>
                <p className="text-xs text-gray-400">Transfer dues to this verified platform account</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
              Verified Beneficiary
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* UPI ID Card */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">Admin UPI VPA</p>
                <p className="text-base font-black font-mono text-white tracking-wide">{adminBank.upiId}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{adminBank.accountName}</p>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(adminBank.upiId, 'UPI ID')}
                className="p-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all border border-white/10 active:scale-95 flex items-center gap-1.5 text-xs font-bold shrink-0"
              >
                <FiCopy className="w-4 h-4" /> Copy
              </button>
            </div>

            {/* Bank Transfer Details */}
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10 space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-0.5">Bank Wire Transfer</p>
              <div className="text-xs space-y-1 font-medium text-gray-300">
                <div className="flex justify-between">
                  <span className="text-gray-400">Bank Name:</span>
                  <span className="font-bold text-white">{adminBank.bankName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Account No:</span>
                  <span className="font-mono font-bold text-white">{adminBank.accountNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">IFSC Code:</span>
                  <span className="font-mono font-bold text-white">{adminBank.ifscCode}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/10 rounded-2xl p-3 border border-blue-500/20 flex items-center gap-3 text-xs text-blue-200">
            <FiInfo className="w-4 h-4 shrink-0 text-blue-400" />
            <p>
              <strong className="text-white">Instruction:</strong> Transfer your cash dues using UPI or NetBanking above, copy your <strong>12-digit UTR</strong> code, and submit form below.
            </p>
          </div>
        </div>

        {/* Active Pending Request Banner */}
        {pendingItem && (
          <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white font-bold flex items-center justify-center shrink-0 shadow">
                <FiClock className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-bold text-amber-950">Pending Cash Settlement Under Review</h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                    ⏳ Awaiting Admin Approval
                  </span>
                </div>
                <p className="text-xs text-amber-800 font-medium">
                  Requested amount: <strong className="text-amber-950">₹{Number(pendingItem.amount || 0).toLocaleString('en-IN')}</strong> • Ref/UTR: <span className="font-mono font-bold">{pendingItem.paymentReference || 'N/A'}</span>
                </p>
                <p className="text-[11px] text-amber-700 mt-1">
                  Submitted on {formatDateSafe(pendingItem.createdAt)}. Admin will verify UTR & payment screenshot within 24h.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Dues & Amount */}
          <div className="space-y-6">
            {/* Amount Due Banner */}
            <div className="bg-gradient-to-br from-rose-600 via-red-600 to-rose-700 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-rose-500/30">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-rose-200">Active Cash Dues Owed</p>
                  <p className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
                    ₹{Number(currentDues).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow shrink-0">
                  <FiDollarSign className="w-6 h-6" />
                </div>
              </div>
              <p className="text-xs text-rose-100 font-medium">Must be cleared to maintain cash collection access</p>
            </div>

            {/* Form Part 1 */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 space-y-6 shadow-sm">
              {/* Amount Input */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Settlement Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">₹</span>
                  <input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full pl-9 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-lg font-bold text-gray-900 focus:outline-none focus:border-blue-600 focus:bg-white transition-all placeholder:text-gray-300"
                    placeholder="0.00"
                    max={currentDues}
                  />
                </div>
                <div className="flex justify-between items-center px-1 text-xs">
                  <span className="text-gray-500 font-medium">Max Dues Limit: ₹{Number(currentDues).toLocaleString('en-IN')}</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, amount: currentDues.toString() }))}
                    className="font-bold text-blue-600 hover:text-blue-700 capitalize"
                  >
                    Set Full Amount
                  </button>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Payment Method Used <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'upi', label: 'UPI Payment', icon: FiSmartphone },
                    { id: 'bank_transfer', label: 'Wire / Bank Transfer', icon: FiCreditCard },
                  ].map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, paymentMethod: method.id }))}
                      className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${formData.paymentMethod === method.id
                        ? 'border-blue-600 bg-blue-50/50 shadow-sm text-blue-600 font-bold'
                        : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 font-medium'
                        }`}
                    >
                      <method.icon className={`w-5 h-5 ${formData.paymentMethod === method.id ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="text-xs tracking-wide">{method.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Reference, Proof & Notes */}
          <div className="space-y-6">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 space-y-6 shadow-sm">
              {/* UTR / Transaction Reference Code */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    UPI UTR / Transaction Ref ID <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-medium">6 to 25 chars</span>
                </div>
                <input
                  type="text"
                  maxLength={25}
                  value={formData.paymentReference}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentReference: e.target.value.toUpperCase() }))}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:border-blue-600 focus:bg-white text-sm font-mono font-bold text-gray-900 tracking-wider transition-all placeholder:text-gray-300 uppercase"
                  placeholder="e.g. 234567898765"
                />
                <p className="text-[11px] text-gray-500 px-1">Find the 12-digit UTR code on your Google Pay / PhonePe / Paytm receipt.</p>
              </div>

              {/* Payment Proof Screenshot Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Payment Proof Screenshot <span className="text-rose-500">*</span>
                </label>
                {proofPreview ? (
                  <div className="relative group rounded-2xl overflow-hidden border border-gray-200 shadow">
                    <img
                      src={proofPreview}
                      alt="Payment Proof"
                      className="w-full h-56 object-cover bg-gray-50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setProofPreview(null);
                        setFormData(prev => ({ ...prev, paymentProof: '' }));
                      }}
                      className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-rose-600 hover:text-white text-gray-700 rounded-full backdrop-blur-md transition-all shadow border border-gray-200 active:scale-95"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {flutterBridge.isFlutter && (
                      <button
                        type="button"
                        onClick={handleNativeCamera}
                        className="w-full py-3.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-100 transition-all font-bold text-xs shadow-xs"
                      >
                        <FiCamera className="w-4 h-4 text-blue-600" />
                        Take Photo with Camera
                      </button>
                    )}

                    <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-200 rounded-2xl cursor-pointer hover:bg-blue-50/30 hover:border-blue-400 transition-all bg-gray-50/50">
                      <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center mb-2 text-blue-600 shadow-xs">
                        <FiUpload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-gray-800">
                        {flutterBridge.isFlutter ? 'Upload from Photo Library' : 'Click to Upload Screenshot'}
                      </span>
                      <span className="text-[10px] text-gray-400 mt-0.5">PNG, JPG or WEBP (Max 20MB)</span>
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

              {/* Optional Notes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Optional Message / Remarks
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl focus:outline-none focus:border-blue-600 focus:bg-white text-xs font-medium text-gray-800 transition-all placeholder:text-gray-300 resize-none"
                  rows={2}
                  placeholder="Add any note for admin verification..."
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-4 rounded-2xl font-bold text-white text-sm tracking-wide flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/25 cursor-pointer"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Submit Cash Settlement Request
                  <FiSend className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Settlement Submission History */}
        {safeHistory.length > 0 && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-100 shadow-sm space-y-6 mt-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">Your Cash Settlement Requests History</h3>
                <p className="text-xs text-gray-500 font-medium">Track your submitted cash dues deposits & verification status</p>
              </div>
              <span className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
                {safeHistory.length} Total Requests
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3.5">
              {paginatedHistory.map((item) => {
                if (!item) return null;
                const isPending = item.status === 'pending';
                const isApproved = item.status === 'approved' || item.status === 'completed';
                const isRejected = item.status === 'rejected';

                return (
                  <div
                    key={item._id || Math.random()}
                    className="p-4 sm:p-5 rounded-2xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-blue-200 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-inner ${
                        isPending ? 'bg-amber-50 text-amber-600 border-amber-200' :
                        isApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                        'bg-rose-50 text-rose-600 border-rose-200'
                      }`}>
                        {isPending ? <FiClock className="w-5 h-5" /> :
                         isApproved ? <FiCheck className="w-5 h-5" /> :
                         <FiX className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-base font-black text-gray-900">
                            ₹{Number(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </p>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                            isPending ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                            isApproved ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            'bg-rose-100 text-rose-800 border border-rose-200'
                          }`}>
                            {isPending ? '⏳ Pending Review' : isApproved ? '✅ Approved & Cleared' : '❌ Rejected'}
                          </span>
                        </div>

                        <p className="text-xs text-gray-600 font-medium">
                          Payment Mode: <span className="font-bold text-gray-900 capitalize">{item.paymentMethod?.replace('_', ' ') || 'UPI'}</span>
                          {item.paymentReference && (
                            <span className="font-mono ml-2 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                              Ref: {item.paymentReference}
                            </span>
                          )}
                        </p>

                        {isRejected && item.rejectionReason && (
                          <p className="text-xs font-semibold text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-100 mt-1">
                            Rejection Reason: {item.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-gray-200 w-full sm:w-auto">
                      <p className="text-[11px] text-gray-400 font-medium">Submitted On</p>
                      <p className="text-xs font-bold text-gray-700 mt-0.5">
                        {formatDateSafe(item.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* History Pagination Bar */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-6 pt-4 border-t border-gray-100 px-2">
                <p className="text-xs font-semibold text-gray-500">
                  Showing <span className="font-bold text-gray-900">{startEntry}–{endEntry}</span> of <span className="font-bold text-gray-900">{totalEntries}</span> requests
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                  >
                    Previous
                  </button>

                  <div className="flex items-center gap-1 px-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-7 h-7 rounded-xl text-xs font-bold transition-all border ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-100 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Disclaimer */}
        <div className="py-6 text-center text-xs text-gray-500 font-medium border-t border-gray-200 mt-8">
          <p>
            Settlement requests are reviewed and verified by Nexora Admin within 24 hours.<br />
            Once approved, your active dues will be cleared automatically.
          </p>
        </div>
      </main>
    </div>
  );
};

export default SettlementRequest;
