import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheck, FiTool, FiPackage, FiFileText, FiPlus, FiTrash2, FiArrowLeft, FiDollarSign, FiClock, FiCreditCard, FiArrowRight, FiKey, FiCheckCircle } from 'react-icons/fi';
import { MdQrCode } from 'react-icons/md';
import { toast } from 'react-hot-toast';
import { workerTheme as themeColors } from '../../../../theme';
import { useAppNotifications } from '../../../../hooks/useAppNotifications';
import { OtpVerificationModal, ScanAndPayModal } from '../../components/common';
import workerBillService from '../../../../services/workerBillService';
import workerService from '../../../../services/workerService';
import { publicCatalogService } from '../../../../services/catalogService';

const BillingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob] = useState(null);

  // --- VIEW MODE: 'timeline' | 'select-services' | 'select-parts' ---
  const [viewMode, setViewMode] = useState('timeline');
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem(`worker_billing_step_${id}`);
    return saved ? parseInt(saved) : 1;
  });
  const [maxStep, setMaxStep] = useState(() => {
    const saved = localStorage.getItem(`worker_billing_max_step_${id}`);
    return saved ? parseInt(saved) : 1;
  });

  // Track max step reached for timeline highlighting
  useEffect(() => {
    if (id) {
      localStorage.setItem(`worker_billing_step_${id}`, currentStep);
      if (currentStep > maxStep) {
        setMaxStep(currentStep);
        localStorage.setItem(`worker_billing_max_step_${id}`, currentStep);
      }
    }
  }, [currentStep, id]);

  // Catalogs
  const [servicesCatalog, setServicesCatalog] = useState([]);
  const [partsCatalog, setPartsCatalog] = useState([]);
  const [serviceCategories, setServiceCategories] = useState(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [partCategories, setPartCategories] = useState(['All']);
  const [selectedPartCategory, setSelectedPartCategory] = useState('All');

  // New Data Structure
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedParts, setSelectedParts] = useState([]);
  const [customItems, setCustomItems] = useState([]);
  const [transportCharges, setTransportCharges] = useState(0);
  const [applyPartsGST, setApplyPartsGST] = useState(true);

  // Search
  const [serviceSearch, setServiceSearch] = useState('');
  const [partSearch, setPartSearch] = useState('');

  // OTP State
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);

  // Payment Options
  const [onlinePaymentData, setOnlinePaymentData] = useState(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [paymentMode, setPaymentMode] = useState(null); // 'cash' | 'online'

  const socket = useAppNotifications('worker');

  // --- Settings ---
  const [payoutSettings, setPayoutSettings] = useState({
    serviceGstPct: 18,
    partsGstPct: 18,
    servicePayoutPct: 90,
    partsPayoutPct: 100
  });

  // Fetch Data
  useEffect(() => {
    fetchData();
  }, [id]);

  // Scroll to top on mount or view change or loading complete
  useLayoutEffect(() => {
    const scrollToTop = () => {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    };

    scrollToTop();
    const timer = setTimeout(scrollToTop, 50);
    return () => clearTimeout(timer);
  }, [id, viewMode, currentStep, loading]);

  const [isInitialized, setIsInitialized] = useState(false);

  // Save draft data (ONLY when initialized and not loading)
  useEffect(() => {
    if (id && !loading && isInitialized) {
      const data = { selectedServices, selectedParts, customItems, transportCharges, applyPartsGST };
      localStorage.setItem(`worker_billing_data_${id}`, JSON.stringify(data));

      // Auto-sync draft bill to backend API
      const timer = setTimeout(() => {
        workerBillService.createOrUpdateBill(id, data).catch(err => {
          console.warn('Auto-save draft bill error:', err?.message);
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [id, selectedServices, selectedParts, customItems, transportCharges, applyPartsGST, loading, isInitialized]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const jobRes = await workerService.getJobById(id);
      const jobData = jobRes.data || jobRes;
      setJob(jobData);

      // Check for existing OTP
      if (jobData?.customerConfirmationOTP || jobData?.paymentOtp) {
        setIsOtpSent(true);
      }

      const [servicesRes, partsRes, catRes] = await Promise.all([
        workerBillService.getServiceCatalog(),
        workerBillService.getPartsCatalog(),
        publicCatalogService.getCategories().catch(() => ({ success: false }))
      ]);
      const services = servicesRes.services || [];
      const parts = partsRes.parts || [];

      setServicesCatalog(services);
      setPartsCatalog(parts);

      // Extract categories from categories API or catalog items
      if (catRes && catRes.success) {
        const apiCats = (catRes.categories || catRes.data || []).map(c => c.title);
        const allCats = ['All', ...apiCats];

        // Add Uncategorized if any catalog item is missing a category
        const hasUncategorizedServices = services.some(s => !s.categoryId?.title);
        const hasUncategorizedParts = parts.some(p => !p.categoryId?.title);
        if (hasUncategorizedServices || hasUncategorizedParts) {
          allCats.push('Uncategorized');
        }

        const uniqueCats = [...new Set(allCats)].filter(Boolean);
        setServiceCategories(uniqueCats);
        setPartCategories(uniqueCats);
      } else {
        const cats = ['All', ...new Set(services.map(s => s.categoryId?.title || 'Uncategorized'))];
        setServiceCategories(cats.filter(Boolean));
        const pCats = ['All', ...new Set(parts.map(p => p.categoryId?.title || 'Uncategorized'))];
        setPartCategories(pCats.filter(Boolean));
      }

      // 1. Load from Backend
      let backendBill = null;
      try {
        const billRes = await workerBillService.getBill(id);
        if (billRes.success && billRes.bill) {
          backendBill = billRes.bill;
        }
      } catch (bErr) {
        console.warn('Get bill error:', bErr.message);
      }

      // 2. Try to load from Local Storage (Draft)
      let draftData = null;
      const savedDraft = localStorage.getItem(`worker_billing_data_${id}`);
      if (savedDraft) {
        try {
          draftData = JSON.parse(savedDraft);
        } catch (e) {
          console.error('Error parsing draft:', e);
        }
      }

      const hasDraftItems = draftData && (
        (Array.isArray(draftData.selectedServices) && draftData.selectedServices.length > 0) ||
        (Array.isArray(draftData.selectedParts) && draftData.selectedParts.length > 0) ||
        (Array.isArray(draftData.customItems) && draftData.customItems.length > 0) ||
        draftData.transportCharges > 0
      );

      const backendServices = (backendBill?.services || []).filter(s => !s.isOriginal);
      const backendParts = backendBill?.parts || [];
      const backendCustom = backendBill?.customItems || [];
      const backendTransport = backendBill?.transportCharges || 0;
      const backendApplyGST = backendBill?.applyPartsGST !== undefined ? backendBill.applyPartsGST : true;

      if (hasDraftItems) {
        setSelectedServices(draftData.selectedServices || []);
        setSelectedParts(draftData.selectedParts || []);
        setCustomItems(draftData.customItems || []);
        setTransportCharges(draftData.transportCharges || 0);
        setApplyPartsGST(draftData.applyPartsGST !== undefined ? draftData.applyPartsGST : true);
      } else {
        setSelectedServices(backendServices);
        setSelectedParts(backendParts);
        setCustomItems(backendCustom);
        setTransportCharges(backendTransport);
        setApplyPartsGST(backendApplyGST);
      }

      if (backendBill?.payoutConfig) {
        const pc = backendBill.payoutConfig;
        setPayoutSettings({
          serviceGstPct: pc.serviceGstPercentage ?? 18,
          partsGstPct: pc.partsGstPercentage ?? 18,
          servicePayoutPct: pc.serviceSplitPercentage ?? 90,
          partsPayoutPct: pc.partsSplitPercentage ?? 100
        });
      }

      const activeData = hasDraftItems ? draftData : {
        selectedServices: backendServices,
        selectedParts: backendParts,
        customItems: backendCustom,
        transportCharges: backendTransport
      };

      let reachedStep = 1;
      if (activeData.transportCharges > 0) reachedStep = 4;
      else if (activeData.customItems?.length > 0) reachedStep = 3;
      else if (activeData.selectedParts?.length > 0) reachedStep = 2;
      else if (activeData.selectedServices?.length > 0) reachedStep = 1;

      setMaxStep(prev => Math.max(prev, reachedStep));
    } catch (error) {
      console.error('Error loading billing data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  // --- FILTERING ---
  const filteredServices = useMemo(() => {
    return servicesCatalog.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(serviceSearch.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || (item.categoryId?.title || 'Uncategorized') === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [servicesCatalog, serviceSearch, selectedCategory]);

  const filteredParts = useMemo(() => {
    return partsCatalog.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(partSearch.toLowerCase());
      const matchesCategory = selectedPartCategory === 'All' || (item.categoryId?.title || 'Uncategorized') === selectedPartCategory;
      return matchesSearch && matchesCategory;
    });
  }, [partsCatalog, partSearch, selectedPartCategory]);

  // --- HANDLERS ---
  const toggleService = (item) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.catalogId === item._id);
      if (exists) {
        return prev.filter(s => s.catalogId !== item._id);
      }
      return [...prev, {
        catalogId: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        total: item.price
      }];
    });
  };

  const isServiceSelected = (id) => selectedServices.some(s => s.catalogId === id);

  const togglePart = (item) => {
    setSelectedParts(prev => {
      const exists = prev.find(p => p.catalogId === item._id);
      if (exists) {
        return prev.filter(p => p.catalogId !== item._id);
      }
      const gstPercentage = item.gstPercentage || 18;
      const gstAmount = (item.price * gstPercentage) / 100;
      return [...prev, {
        catalogId: item._id,
        name: item.name,
        price: item.price,
        gstPercentage,
        quantity: 1,
        gstAmount,
        total: item.price + gstAmount
      }];
    });
  };

  const isPartSelected = (id) => selectedParts.some(p => p.catalogId === id);

  const updateServiceQty = (idx, delta) => {
    const newArr = [...selectedServices];
    const q = Math.max(1, newArr[idx].quantity + delta);
    newArr[idx] = { ...newArr[idx], quantity: q, total: newArr[idx].price * q };
    setSelectedServices(newArr);
  };

  const updatePartQty = (idx, delta) => {
    const newArr = [...selectedParts];
    const q = Math.max(1, newArr[idx].quantity + delta);
    const base = newArr[idx].price * q;
    const gstAmt = base * (newArr[idx].gstPercentage / 100);
    newArr[idx] = { ...newArr[idx], quantity: q, gstAmount: gstAmt, total: base + gstAmt };
    setSelectedParts(newArr);
  };

  const addCustomItem = () => {
    setCustomItems([...customItems, {
      name: '',
      hsnCode: '',
      price: 0,
      gstApplicable: true,
      gstPercentage: 18,
      quantity: 1,
      gstAmount: 0,
      total: 0
    }]);
  };

  const updateCustomItem = (index, field, value) => {
    setCustomItems(prev => {
      const newItems = [...prev];
      let finalVal = value;
      if (field === 'price' || field === 'quantity') {
        finalVal = Math.max(0, Number(value) || 0);
      }
      const newItem = { ...newItems[index], [field]: finalVal };
      const baseTotal = newItem.price * newItem.quantity;
      newItem.gstAmount = newItem.gstApplicable ? baseTotal * (newItem.gstPercentage / 100) : 0;
      newItem.total = baseTotal + newItem.gstAmount;
      newItems[index] = newItem;
      return newItems;
    });
  };

  const removeCustomItem = (index) => {
    const newItems = [...customItems];
    newItems.splice(index, 1);
    setCustomItems(newItems);
  };

  // --- CALCULATIONS ---
  const calculations = useMemo(() => {
    if (!job) return null;
    const { serviceGstPct, partsGstPct, servicePayoutPct, partsPayoutPct } = payoutSettings;

    const isPlanBooking = job.paymentMethod === 'plan_benefit';
    const originalBase = isPlanBooking ? 0 : (job.basePrice || 0);
    const originalServiceGST = isPlanBooking ? 0 : parseFloat(((originalBase * serviceGstPct) / 100).toFixed(2));

    let extraServiceBase = 0;
    let extraServiceGST = 0;
    selectedServices.forEach(s => {
      const base = s.price * s.quantity;
      const gst = parseFloat(((base * serviceGstPct) / 100).toFixed(2));
      extraServiceBase += base;
      extraServiceGST += gst;
    });

    let partsBase = 0;
    let partsGST = 0;
    selectedParts.forEach(p => {
      partsBase += (p.price * p.quantity);
      if (applyPartsGST) {
        partsGST += p.gstAmount;
      }
    });

    let customBase = 0;
    let customGST = 0;
    customItems.forEach(c => {
      customBase += (c.price * c.quantity);
      if (applyPartsGST) {
        customGST += c.gstAmount;
      }
    });

    const visitingCharges = Number(job.visitingCharges) || 0;
    const finalTransportCharges = Number(transportCharges) || 0;

    const totalServiceBase = originalBase + extraServiceBase;
    const totalServiceGST = originalServiceGST + extraServiceGST;
    const totalPartsBase = partsBase + customBase;
    const totalPartsGST = partsGST + customGST;

    const finalBillAmount = parseFloat(((totalServiceBase + totalServiceGST) + (totalPartsBase + totalPartsGST) + visitingCharges + finalTransportCharges).toFixed(2));

    const workerServiceEarnings = parseFloat(((totalServiceBase * servicePayoutPct) / 100).toFixed(2));
    const workerPartsEarnings = parseFloat(((totalPartsBase * partsPayoutPct) / 100).toFixed(2));
    const totalWorkerEarnings = parseFloat((workerServiceEarnings + workerPartsEarnings).toFixed(2));

    return {
      originalBase,
      extraServiceBase,
      partsBase: totalPartsBase,
      serviceGstPct,
      partsGstPct,
      totalServiceGST,
      totalPartsGST,
      totalGST: parseFloat((totalServiceGST + totalPartsGST).toFixed(2)),
      visitingCharges,
      transportCharges: finalTransportCharges,
      finalBillAmount,
      totalWorkerEarnings,
      workerServiceEarnings,
      workerPartsEarnings,
      servicePayoutPct,
      partsPayoutPct
    };
  }, [job, selectedServices, selectedParts, customItems, transportCharges, payoutSettings, applyPartsGST]);

  const handleStepChange = async (targetStep) => {
    setCurrentStep(targetStep);

    // Bill is finalized (isFinalized: true) on step 5 (Final Review).
    // It reverts to draft (isFinalized: false) if worker steps back to edit steps 1-4.
    const isFinal = targetStep === 5;
    try {
      await workerBillService.createOrUpdateBill(id, {
        services: selectedServices,
        parts: selectedParts,
        customItems,
        transportCharges,
        applyPartsGST,
        isFinalized: isFinal
      });
    } catch (err) {
      console.warn('Notice setting isFinalized:', err);
    }
  };

  const handleSendOTP = async () => {
    if (isPaid) {
      toast.success('Payment has already been received!');
      navigate(`/worker/job/${id}`, { replace: true });
      return;
    }

    // Immediately open OTP modal without sending duplicate SMS/push notifications
    setIsOtpSent(true);
    setShowOtpModal(true);
    setPaymentMode('cash');
    setOnlinePaymentData(null);

    try {
      await workerBillService.createOrUpdateBill(id, {
        services: selectedServices,
        parts: selectedParts,
        customItems,
        transportCharges,
        applyPartsGST,
        isFinalized: true
      });
    } catch (error) {
      console.warn('Background bill save notice:', error);
    }
  };

  const handleResendOTP = async () => {
    try {
      toast.loading('Resending OTP to customer...');
      await workerService.initiateCashCollection(id, calculations.finalBillAmount, [...selectedParts, ...customItems]);
      toast.dismiss();
      toast.success('OTP resent via Push/SMS!');
    } catch (err) {
      toast.dismiss();
      toast.error('Failed to resend OTP');
    }
  };

  const handleVerifyOTP = async (code) => {
    try {
      setOtpLoading(true);
      const res = await workerService.collectCash(id, code, calculations.finalBillAmount, [...selectedParts, ...customItems]);
      if (res.success) {
        setShowOtpModal(false);
        toast.success('Payment verified successfully!');
        localStorage.removeItem(`worker_billing_step_${id}`);
        localStorage.removeItem(`worker_billing_max_step_${id}`);
        localStorage.removeItem(`worker_billing_data_${id}`);
        fetchData();
        navigate(`/worker/job/${id}`, { replace: true });
      } else {
        toast.error(res.message || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast.error('Verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOnlinePayment = async () => {
    try {
      setQrLoading(true);
      await workerBillService.createOrUpdateBill(id, {
        services: selectedServices,
        parts: selectedParts,
        customItems,
        transportCharges,
        applyPartsGST
      });

      const res = await workerService.initiateOnlineCollection(id, calculations.finalBillAmount, [...selectedParts, ...customItems]);
      if (res.success) {
        setOnlinePaymentData(res.data);
        setShowQrModal(true);
        setIsOtpSent(true); // Generated OTP is available concurrently
        setPaymentMode('online');
        toast.success('QR Code and OTP generated!');
      } else {
        toast.error(res.message || 'Failed to initiate online payment');
      }
    } catch (error) {
      console.error('Online payment error:', error);
      toast.error('Failed to initiate online payment');
    } finally {
      setQrLoading(false);
    }
  };

  // Auto-poll payment status every 3 seconds when on Summary & Pay step or QR modal is open
  const isPaid = Boolean(job?.cashCollected === true || ['success', 'collected_by_vendor', 'paid', 'paid_online'].includes(job?.paymentStatus?.toLowerCase()));

  useEffect(() => {
    let pollInterval = null;

    if ((currentStep === 5 || showQrModal) && !isPaid && id) {
      pollInterval = setInterval(async () => {
        try {
          const jobRes = await workerService.getJobById(id);
          const freshData = jobRes.data || jobRes;
          const freshIsPaid = Boolean(freshData?.cashCollected === true || ['success', 'collected_by_vendor', 'paid', 'paid_online'].includes(freshData?.paymentStatus?.toLowerCase()));

          if (freshIsPaid) {
            setJob(freshData);
            setShowQrModal(false);
            setShowOtpModal(false);
            toast.success('Payment Received!');
            localStorage.removeItem(`worker_billing_step_${id}`);
            localStorage.removeItem(`worker_billing_max_step_${id}`);
            localStorage.removeItem(`worker_billing_data_${id}`);
            navigate(`/worker/job/${id}`, { replace: true });
          }
        } catch (e) {
          // silent poll error
        }
      }, 3000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentStep, showQrModal, isPaid, id]);

  const checkPaymentStatus = async () => {
    try {
      setQrLoading(true);
      const res = await workerService.verifyOnlineCollection(id);
      if (res.success) {
        setShowQrModal(false);
        toast.success('Payment verified successfully!');
        localStorage.removeItem(`worker_billing_step_${id}`);
        localStorage.removeItem(`worker_billing_max_step_${id}`);
        localStorage.removeItem(`worker_billing_data_${id}`);
        fetchData();
        navigate(`/worker/job/${id}`, { replace: true });
      } else {
        toast.error(res.message || 'Payment not yet confirmed');
      }
    } finally {
      setQrLoading(false);
    }
  };

  // Listen for Real-Time Job Updates (e.g. Online Payment Success)
  useEffect(() => {
    if (socket && id) {
      const handleJobUpdate = (data) => {
        if (data.bookingId === id || data.relatedId === id || data._id === id) {
          const isPaymentSuccess =
            data.paymentStatus === 'SUCCESS' ||
            data.paymentStatus === 'paid' ||
            data.type === 'payment_success';

          if (isPaymentSuccess) {
            toast.success('Online Payment Received!');
            // Clean up and navigate back to job details
            localStorage.removeItem(`worker_billing_step_${id}`);
            localStorage.removeItem(`worker_billing_max_step_${id}`);
            localStorage.removeItem(`worker_billing_data_${id}`);
            setTimeout(() => navigate(`/worker/job/${id}`, { replace: true }), 1000);
          }
        }
      };

      socket.on('booking_updated', handleJobUpdate);
      socket.on('payment_success', handleJobUpdate);

      return () => {
        socket.off('booking_updated', handleJobUpdate);
        socket.off('payment_success', handleJobUpdate);
      };
    }
  }, [socket, id, navigate]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!job) return null;

  // View logic matches vendor
  if (viewMode === 'select-services') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setViewMode('timeline')}><FiArrowLeft className="w-6 h-6 text-gray-600" /></button>
            <div className="flex-1 relative">
              <input autoFocus placeholder="Search for a service..." value={serviceSearch} onChange={e => setServiceSearch(e.target.value)}
                className="w-full bg-gray-100 pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-gray-800 placeholder:text-gray-400" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            </div>
          </div>
          <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {serviceCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div className="p-3 space-y-2.5 pb-28">
          {filteredServices.map(item => {
            const selected = isServiceSelected(item._id);
            return (
              <div key={item._id}
                onClick={() => !selected && toggleService(item)}
                className={`p-3 rounded-xl border shadow-2xs flex justify-between items-center cursor-pointer transition-all active:scale-[0.98] ${selected ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-100' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className={`font-bold text-xs sm:text-sm mb-1 truncate ${selected ? 'text-blue-900' : 'text-gray-900'}`}>{item.name}</h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-bold ${selected ? 'text-blue-700' : 'text-gray-900'}`}>₹{item.price}</span>
                    {item.categoryId?.title && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium truncate max-w-[120px]">{item.categoryId.title}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {selected ? (
                    <div className="flex items-center gap-1.5 bg-blue-50 rounded-lg p-0.5 border border-blue-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const currentQty = selectedServices.find(s => s.catalogId === item._id).quantity;
                          if (currentQty > 1) {
                            const idx = selectedServices.findIndex(s => s.catalogId === item._id);
                            updateServiceQty(idx, -1);
                          } else {
                            toggleService(item);
                          }
                        }}
                        className="w-6 h-6 flex items-center justify-center bg-white rounded-md text-blue-600 shadow-2xs border border-blue-100 hover:bg-blue-50 active:scale-95 transition-all cursor-pointer">
                        <span className="font-bold text-sm leading-none mb-0.5">-</span>
                      </button>
                      <span className="font-bold text-xs min-w-[16px] text-center text-blue-900">
                        {selectedServices.find(s => s.catalogId === item._id).quantity}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = selectedServices.findIndex(s => s.catalogId === item._id);
                          updateServiceQty(idx, 1);
                        }}
                        className="w-6 h-6 flex items-center justify-center bg-blue-600 rounded-md text-white shadow-2xs hover:bg-blue-700 active:scale-95 transition-all cursor-pointer">
                        <FiPlus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleService(item); }}
                      className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 text-gray-600 hover:bg-blue-600 hover:text-white transition-all shadow-2xs active:scale-90 cursor-pointer">
                      <FiPlus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 flex gap-2.5">
          <button onClick={() => setViewMode('timeline')} className="flex-1 py-2.5 bg-white text-gray-700 font-semibold text-xs rounded-xl border border-gray-200 active:scale-95 cursor-pointer">
            Save & Exit
          </button>
          <button onClick={() => {
            setViewMode('select-parts');
            setCurrentStep(2);
          }} className="flex-[2] py-2.5 bg-gray-900 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer">
            Next: Parts <FiArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'select-parts') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
          <div className="px-4 py-3 flex items-center gap-3">
            <button onClick={() => setViewMode('timeline')}><FiArrowLeft className="w-6 h-6 text-gray-600" /></button>
            <div className="flex-1 relative">
              <input autoFocus placeholder="Search for parts..." value={partSearch} onChange={e => setPartSearch(e.target.value)}
                className="w-full bg-gray-100 pl-10 pr-4 py-2.5 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-gray-800 placeholder:text-gray-400" />
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            </div>
          </div>
          <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
            {partCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedPartCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${selectedPartCategory === cat ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{cat}</button>
            ))}
          </div>
        </div>
        <div className="p-3 space-y-2.5 pb-28">
          {filteredParts.map(item => {
            const selected = isPartSelected(item._id);
            return (
              <div key={item._id}
                onClick={() => togglePart(item)}
                className={`p-3 rounded-xl border shadow-2xs flex justify-between items-center cursor-pointer transition-all active:scale-[0.98] ${selected ? 'bg-orange-50/50 border-orange-200 ring-1 ring-orange-100' : 'bg-white border-gray-100 hover:border-gray-200'}`}>
                <div className="flex-1 min-w-0 pr-2">
                  <h4 className={`font-bold text-xs sm:text-sm mb-1 truncate ${selected ? 'text-orange-900' : 'text-gray-900'}`}>{item.name}</h4>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-bold ${selected ? 'text-orange-700' : 'text-gray-900'}`}>₹{item.price}</span>
                    {item.categoryId?.title && <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500 font-medium truncate max-w-[120px]">{item.categoryId.title}</span>}
                  </div>
                </div>
                <button
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 cursor-pointer ${selected ? 'bg-red-100 text-red-600' : 'bg-orange-600 text-white shadow-2xs shadow-orange-200'}`}>
                  {selected ? <FiTrash2 className="w-4 h-4" /> : <FiPlus className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 flex gap-2.5">
          <button onClick={() => setViewMode('timeline')} className="flex-1 py-2.5 bg-white text-gray-700 font-semibold text-xs rounded-xl border border-gray-200 active:scale-95 cursor-pointer">
            Save & Exit
          </button>
          <button onClick={() => {
            setViewMode('timeline');
            setCurrentStep(3);
          }} className="flex-[2] py-2.5 bg-gray-900 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer">
            Next: Extras <FiArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-0 flex flex-col">
      <div className="sticky top-0 z-50 bg-white">
        <div className="px-4 py-4 shadow-sm border-b border-gray-100 flex items-center gap-3">
          <button onClick={() => navigate(`/worker/job/${id}`, { replace: true })} className="p-2 -ml-2 text-gray-600 hover:bg-gray-100 rounded-full">
            <FiArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Generate Bill</h1>
            <p className="text-xs text-gray-500">Job #{job.bookingNumber}</p>
          </div>
        </div>

        <div className="px-4 py-4 border-b border-gray-50 flex justify-between relative overflow-hidden shadow-sm">
          {[
            { id: 1, label: 'Services', icon: FiTool },
            { id: 2, label: 'Parts', icon: FiPackage },
            { id: 3, label: 'Extras', icon: FiPlus },
            { id: 4, label: 'Transport', icon: FiPackage },
            { id: 5, label: 'Review', icon: FiFileText }
          ].map((step) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;
            const isReached = step.id <= maxStep;

            return (
              <button key={step.id} onClick={() => isReached && handleStepChange(step.id)}
                className={`flex flex-col items-center gap-1 z-10 relative transition-all ${isActive ? 'opacity-100 scale-105' : isReached ? 'opacity-80' : 'opacity-40'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${(isActive || isCompleted) ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-gray-100 text-gray-400'} ${isActive ? 'ring-4 ring-blue-50' : ''}`}>
                  {isCompleted ? <FiCheck className="w-4 h-4" /> : <step.icon />}
                </div>
                <span className={`text-[10px] font-bold ${isReached ? 'text-gray-800' : 'text-gray-400'}`}>{step.label}</span>
              </button>
            );
          })}
          <div className="absolute top-8 left-0 right-0 h-0.5 bg-gray-200 -z-0 mx-8">
            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${((maxStep - 1) / 4) * 100}%` }}></div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6 pb-48">
        {currentStep === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">Added Services</h3>
                <button onClick={() => setViewMode('select-services')} className="text-blue-600 font-bold text-xs bg-blue-50 px-3 py-1.5 rounded-lg">+ Add Services</button>
              </div>
              {selectedServices.length === 0 ? <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-400 text-sm">No extra services added</div> : (
                <div className="space-y-3">
                  {selectedServices.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-blue-50/30 rounded-xl border border-blue-100">
                      <div>
                        <p className="font-bold text-sm text-gray-800">{s.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => updateServiceQty(idx, -1)} className="w-6 h-6 flex items-center justify-center bg-white border border-blue-200 rounded text-blue-600 font-bold">-</button>
                          <span className="text-xs font-bold w-4 text-center">{s.quantity}</span>
                          <button onClick={() => updateServiceQty(idx, 1)} className="w-6 h-6 flex items-center justify-center bg-white border border-blue-200 rounded text-blue-600 font-bold">+</button>
                        </div>
                      </div>
                      <p className="font-bold text-gray-800">₹{s.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-gray-800">Added Parts</h3>
                <button onClick={() => setViewMode('select-parts')} className="text-orange-600 font-bold text-xs bg-orange-50 px-3 py-1.5 rounded-lg">+ Add Parts</button>
              </div>
              {selectedParts.length === 0 ? <div className="text-center py-8 bg-gray-50 rounded-xl text-gray-400 text-sm">No parts added</div> : (
                <div className="space-y-3">
                  {selectedParts.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-orange-50/30 rounded-xl border border-orange-100">
                      <div>
                        <p className="font-bold text-sm text-gray-800">{p.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <button onClick={() => updatePartQty(idx, -1)} className="w-6 h-6 flex items-center justify-center bg-white border border-orange-200 rounded text-orange-600 font-bold">-</button>
                          <span className="text-xs font-bold w-4 text-center">{p.quantity}</span>
                          <button onClick={() => updatePartQty(idx, 1)} className="w-6 h-6 flex items-center justify-center bg-white border border-orange-200 rounded text-orange-600 font-bold">+</button>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-800">₹{p.total.toFixed(2)}</p>
                        <p className="text-[10px] text-gray-400">+ GST</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <div className="flex justify-between items-center mb-4 sm:mb-6">
              <div>
                <h3 className="font-bold text-base sm:text-lg text-gray-800">Add Extra Items</h3>
                <p className="text-[9px] sm:text-[10px] text-gray-400 font-bold uppercase tracking-wider">Parts & Materials</p>
              </div>
              <button onClick={addCustomItem} className="bg-blue-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs shadow-2xs flex items-center gap-1 hover:bg-blue-700 active:scale-95 transition-all cursor-pointer">
                <FiPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Add Row
              </button>
            </div>
            <div className="space-y-3 sm:space-y-5">
              {customItems.map((item, idx) => (
                <div key={idx} className="bg-white p-3.5 sm:p-4 rounded-xl border border-gray-100 shadow-2xs relative animate-in slide-in-from-bottom-2">
                  <button onClick={() => removeCustomItem(idx)} className="absolute -top-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 bg-white text-red-500 rounded-full border border-red-100 flex items-center justify-center hover:bg-red-50 transition-all shadow-2xs z-10 cursor-pointer">
                    <FiTrash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 mt-2 sm:mt-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase ml-1">Item Name</label>
                      <input placeholder="e.g. Copper Pipe" value={item.name} onChange={e => updateCustomItem(idx, 'name', e.target.value)}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 text-gray-800" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase ml-1">HSN Code</label>
                      <input placeholder="Optional code" value={item.hsnCode || ''} onChange={e => updateCustomItem(idx, 'hsnCode', e.target.value)}
                        className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 uppercase text-gray-800" />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase ml-1">Price (₹)</label>
                        <input type="number" min="0" placeholder="0" value={item.price || ''} onChange={e => updateCustomItem(idx, 'price', e.target.value)}
                          onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                          className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 text-gray-800" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase ml-1">Quantity</label>
                        <input type="number" min="1" value={item.quantity} onChange={e => updateCustomItem(idx, 'quantity', e.target.value)}
                          onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                          className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-bold outline-none focus:ring-1 focus:ring-blue-500 text-gray-800" />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50 mt-1 md:col-span-2 md:pt-3">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <input type="checkbox" id={`gst-${idx}`} checked={item.gstApplicable} onChange={e => updateCustomItem(idx, 'gstApplicable', e.target.checked)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-blue-600 border-gray-300" />
                        <label htmlFor={`gst-${idx}`} className="text-[11px] sm:text-xs font-bold text-gray-600">Apply 18% GST</label>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">Subtotal: </span>
                        <span className="text-sm sm:text-base font-black text-gray-900">₹{item.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {customItems.length === 0 && (
                <div className="text-center py-8 sm:py-10 bg-gray-50 rounded-xl border border-dashed border-gray-100">
                  <FiPackage className="w-6 h-6 sm:w-8 sm:h-8 text-gray-300 mx-auto mb-1.5 sm:mb-2" />
                  <p className="text-gray-400 font-bold text-xs sm:text-sm">No extra items added</p>
                  <button onClick={addCustomItem} className="text-blue-600 font-bold text-[11px] sm:text-xs mt-1 hover:underline underline-offset-4 cursor-pointer">+ Add Item Row</button>
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="animate-in fade-in slide-in-from-right-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <FiPackage className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Transport Charges</h3>
              <p className="text-sm text-gray-500 mb-6">Enter any additional transportation or travel costs for this service.</p>
              <div className="w-full max-w-xs relative text-left">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 mb-1 block">Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-gray-400">₹</span>
                  <input type="number" placeholder="0" value={transportCharges || ''} onChange={e => setTransportCharges(Number(e.target.value))}
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-8 pr-4 py-4 text-xl font-black outline-none focus:ring-2 focus:ring-blue-500/20 text-gray-900" />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && calculations && (
          <div className="animate-in fade-in slide-in-from-right-4 pb-10">
            <div className="bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-gray-200 mb-4 sm:mb-6">
              <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 px-4 py-4 sm:px-6 sm:py-6 text-white text-center">
                <p className="text-blue-200 text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-0.5 sm:mb-1">TOTAL INVOICE AMOUNT</p>
                <h2 className="text-3xl sm:text-4xl font-black">₹{calculations.finalBillAmount.toFixed(2)}</h2>
              </div>
              <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-6">
                <div>
                  <h4 className="font-bold text-xs sm:text-base text-gray-900 flex items-center gap-2 mb-2 sm:mb-3 pb-1.5 sm:pb-2 border-b border-gray-200">
                    <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] sm:text-xs shrink-0"><FiTool /></span>
                    Services & Labor
                  </h4>
                  <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm pl-1 sm:pl-2">
                    <div className="flex justify-between text-gray-700 font-medium gap-2">
                      <span className="truncate">Original Service: {job.serviceName || 'Service'}</span>
                      {job.paymentMethod === 'plan_benefit' ? <span className="text-emerald-700 font-bold shrink-0">FREE (PLAN)</span> : <span className="font-bold text-gray-900 shrink-0">₹{calculations.originalBase.toFixed(2)}</span>}
                    </div>
                    {selectedServices.map(s => <div key={s.catalogId} className="flex justify-between text-gray-700 font-medium gap-2"><span className="truncate">{s.name} x {s.quantity}</span><span className="font-bold text-gray-900 shrink-0">₹{(s.price * s.quantity).toFixed(2)}</span></div>)}
                    <div className="flex justify-between text-[11px] sm:text-xs font-bold text-gray-600 border-t border-dashed border-gray-200 pt-1 mt-1">
                      <span>Service GST ({calculations.serviceGstPct}%)</span>
                      <span className="font-bold text-gray-900">₹{calculations.totalServiceGST.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xs sm:text-sm text-gray-900 pt-1">
                      <span>Services Subtotal</span>
                      <span className="font-black text-gray-900">₹{(calculations.originalBase + calculations.extraServiceBase + calculations.totalServiceGST).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                {(selectedParts.length > 0 || customItems.length > 0) && (
                  <div>
                    <h4 className="font-bold text-xs sm:text-base text-gray-900 flex items-center gap-2 mb-2 sm:mb-3 pb-1.5 sm:pb-2 border-b border-gray-200">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-[10px] sm:text-xs shrink-0"><FiPackage /></span>
                      Spare Parts & Materials
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer mb-2.5 p-2 sm:p-2.5 rounded-xl border border-gray-200 bg-gray-50 hover:bg-white transition-colors">
                      <div className="relative shrink-0">
                        <input type="checkbox" checked={applyPartsGST} onChange={e => setApplyPartsGST(e.target.checked)} className="sr-only" />
                        <div className={`w-8 h-4 sm:w-10 sm:h-5 rounded-full transition-colors duration-200 ${applyPartsGST ? 'bg-amber-600' : 'bg-gray-300'}`}>
                          <div className={`w-3.5 h-3.5 sm:w-4 sm:h-4 bg-white rounded-full shadow-2xs absolute top-0.5 transition-all duration-200 ${applyPartsGST ? 'left-4 sm:left-5.5' : 'left-0.5'}`} />
                        </div>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-[11px] sm:text-xs font-bold text-gray-900 truncate">Apply GST on Parts ({calculations.partsGstPct}%)</p>
                        <p className="text-[9px] sm:text-[10px] text-gray-500 font-semibold truncate">{applyPartsGST ? `GST (${calculations.partsGstPct}%): +₹${calculations.totalPartsGST.toFixed(2)}` : 'Exempt / No GST'}</p>
                      </div>
                    </label>
                    <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm pl-1 sm:pl-2">
                      {selectedParts.map(p => <div key={p.catalogId} className="flex justify-between text-gray-700 font-medium gap-2"><span className="truncate">{p.name} x {p.quantity}</span><span className="font-bold text-gray-900 shrink-0">₹{(p.price * p.quantity).toFixed(2)}</span></div>)}
                      {customItems.map((c, i) => (
                        <div key={i} className="flex justify-between text-gray-700 font-medium gap-2">
                          <div className="min-w-0 truncate">
                            <span className="truncate">{c.name || 'Custom Item'} x {c.quantity}</span>
                            {c.hsnCode && <p className="text-[9px] text-gray-500 font-semibold">HSN: {c.hsnCode}</p>}
                          </div>
                          <span className="font-bold text-gray-900 shrink-0">₹{(c.price * c.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between text-[11px] sm:text-xs font-bold text-gray-600 border-t border-dashed border-gray-200 pt-1 mt-1">
                        <span>Parts GST ({calculations.partsGstPct}%)</span>
                        <span className="font-bold text-gray-900">₹{calculations.totalPartsGST.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-xs sm:text-sm text-gray-900 pt-1">
                        <span>Parts Subtotal</span>
                        <span className="font-black text-gray-900">₹{(calculations.partsBase + calculations.totalPartsGST).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
                {job.visitingCharges > 0 && (
                  <div>
                    <h4 className="font-bold text-xs sm:text-base text-gray-900 flex items-center gap-2 mb-1.5 sm:mb-2 pb-1.5 sm:pb-2 border-b border-gray-200">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-[10px] sm:text-xs shrink-0"><FiClock /></span>
                      Visiting Charge
                    </h4>
                    <div className="flex justify-between text-xs sm:text-sm pl-1 sm:pl-2 font-bold text-gray-900">
                      <span>Visiting Fee</span>
                      <span>₹{Number(job.visitingCharges).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {transportCharges > 0 && (
                  <div>
                    <h4 className="font-bold text-xs sm:text-base text-gray-900 flex items-center gap-2 mb-1.5 sm:mb-2 pb-1.5 sm:pb-2 border-b border-gray-200">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] sm:text-xs shrink-0"><FiPackage /></span>
                      Logistics Fee
                    </h4>
                    <div className="flex justify-between text-xs sm:text-sm pl-1 sm:pl-2 font-bold text-gray-900">
                      <span>Logistics Charge</span>
                      <span>₹{Number(transportCharges).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {(paymentMode && job.status === 'completed') && (
                  <div>
                    <h4 className="font-bold text-xs sm:text-base text-gray-900 flex items-center gap-2 mb-1.5 sm:mb-2 pb-1.5 sm:pb-2 border-b border-gray-200">
                      <span className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs shrink-0 ${paymentMode === 'cash' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                        {paymentMode === 'cash' ? <FiDollarSign /> : <MdQrCode />}
                      </span>
                      Payment Method
                    </h4>
                    <div className="flex justify-between text-xs sm:text-sm pl-1 sm:pl-2 font-black text-gray-900 uppercase tracking-tight">
                      <span>Status</span>
                      <span className={paymentMode === 'cash' ? 'text-emerald-600' : 'text-blue-600'}>
                        {paymentMode === 'cash' ? 'Cash Collected' : 'Digital QR'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Earnings Footer - ONLY SHOW WHEN COMPLETED */}
              {job.status === 'completed' ? (
                <div className="bg-emerald-50 px-4 py-3 sm:px-6 sm:py-4 border-t border-emerald-100">
                  <div className="space-y-1.5 sm:space-y-2 mb-2.5 sm:mb-3">
                    <div className="flex justify-between items-center text-emerald-800 text-xs sm:text-sm">
                      <span>Service Earnings ({calculations.servicePayoutPct}%)</span>
                      <span className="font-bold">₹{calculations.workerServiceEarnings.toFixed(2)}</span>
                    </div>
                    {(calculations.workerPartsEarnings > 0) && (
                      <div className="flex justify-between items-center text-emerald-800 text-xs sm:text-sm">
                        <span>Parts Earnings ({calculations.partsPayoutPct}%)</span>
                        <span className="font-bold">₹{calculations.workerPartsEarnings.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-emerald-200/50">
                    <span className="text-emerald-900 font-bold text-[10px] sm:text-xs uppercase tracking-wider">Total Net Earnings</span>
                    <span className="text-emerald-700 font-black text-lg sm:text-xl">₹{calculations.totalWorkerEarnings.toFixed(2)}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 px-4 py-3 sm:px-6 sm:py-4 border-t border-gray-200 text-center">
                  <p className="text-[11px] sm:text-xs font-bold text-gray-600 flex items-center justify-center gap-1.5">
                    <FiClock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" /> Net earnings will be calculated after completion
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-2.5 sm:p-4 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-50 flex gap-2 sm:gap-3">
        {currentStep === 1 && (
          <button onClick={() => handleStepChange(2)} className="w-full py-2.5 sm:py-3.5 bg-gray-900 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer">
            Next: Parts <FiArrowRight className="w-4 h-4" />
          </button>
        )}
        {currentStep === 2 && (
          <>
            <button onClick={() => handleStepChange(1)} className="flex-1 py-2.5 sm:py-3 text-gray-600 font-bold text-xs sm:text-sm bg-white border border-gray-200 rounded-xl cursor-pointer">Back</button>
            <button onClick={() => handleStepChange(3)} className="flex-[2] py-2.5 sm:py-3.5 bg-gray-900 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer">Next: Extras <FiArrowRight className="w-4 h-4" /></button>
          </>
        )}
        {currentStep === 3 && (
          <>
            <button onClick={() => handleStepChange(2)} className="flex-1 py-2.5 sm:py-3 text-gray-600 font-bold text-xs sm:text-sm bg-white border border-gray-200 rounded-xl cursor-pointer">Back</button>
            <button onClick={() => handleStepChange(4)} className="flex-[2] py-2.5 sm:py-3.5 bg-gray-900 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer">Next: Transport <FiArrowRight className="w-4 h-4" /></button>
          </>
        )}
        {currentStep === 4 && (
          <>
            <button onClick={() => handleStepChange(3)} className="flex-1 py-2.5 sm:py-3 text-gray-600 font-bold text-xs sm:text-sm bg-white border border-gray-200 rounded-xl cursor-pointer">Back</button>
            <button
              onClick={async () => {
                try {
                  setSubmitting(true);
                  await workerService.createOrUpdateBill(id, {
                    services: selectedServices,
                    parts: selectedParts,
                    customItems,
                    transportCharges,
                    applyPartsGST,
                    isFinalized: true
                  });
                  setCurrentStep(5);
                } catch (err) {
                  setCurrentStep(5);
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={submitting}
              className="flex-[2] py-2.5 sm:py-3.5 bg-gray-900 text-white font-bold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 cursor-pointer"
            >
              Next: Final Review <FiArrowRight className="w-4 h-4" />
            </button>
          </>
        )}
        {currentStep === 5 && (
          <>
            {isPaid ? (
              <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 sm:p-3 flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
                    <FiCheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-emerald-900 text-[11px] sm:text-xs truncate">Payment Completed</p>
                    <p className="text-emerald-700 text-[9px] sm:text-[10px] truncate">Online transaction verified.</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate(`/worker/job/${id}`)}
                  className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] sm:text-[10px] rounded-lg shadow-2xs transition-all shrink-0 cursor-pointer"
                >
                  View Job
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={async () => {
                    try {
                      setSubmitting(true);
                      await workerService.createOrUpdateBill(id, {
                        services: selectedServices,
                        parts: selectedParts,
                        customItems,
                        transportCharges,
                        applyPartsGST,
                        isFinalized: false
                      });
                      toast.info('Bill unlocked for editing.');
                      setCurrentStep(4);
                    } catch (err) {
                      setCurrentStep(4);
                    } finally {
                      setSubmitting(false);
                    }
                  }}
                  disabled={submitting || otpLoading}
                  className="flex-1 py-2.5 sm:py-3 text-gray-700 font-bold text-xs sm:text-sm bg-white border border-gray-200 rounded-xl disabled:opacity-50 cursor-pointer shadow-2xs active:scale-95"
                >
                  Edit Bill
                </button>
                <div className="flex-[2] grid grid-cols-2 gap-1.5 sm:gap-2">
                  {(isOtpSent && paymentMode === 'cash') ? (
                    <button onClick={() => setShowOtpModal(true)} disabled={otpLoading || qrLoading} className="py-2.5 sm:py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-center gap-1 active:scale-95 transition-all text-[10px] sm:text-xs cursor-pointer">
                      <FiKey className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /><span>Enter OTP</span>
                    </button>
                  ) : (
                    <button onClick={handleSendOTP} disabled={otpLoading || qrLoading} className="py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-50 text-[10px] sm:text-xs cursor-pointer">
                      <FiDollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /><span>Pay in Cash</span>
                    </button>
                  )}
                  <button onClick={handleOnlinePayment} disabled={otpLoading || qrLoading} className="py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md flex flex-col sm:flex-row items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-50 text-[10px] sm:text-xs cursor-pointer">
                    <MdQrCode className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /><span>{qrLoading ? '...' : 'Online (QR)'}</span>
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <OtpVerificationModal isOpen={showOtpModal} onClose={() => setShowOtpModal(false)} onVerify={handleVerifyOTP} onResend={handleResendOTP} loading={otpLoading} />

      <ScanAndPayModal
        isOpen={showQrModal}
        onClose={() => setShowQrModal(false)}
        qrImageUrl={onlinePaymentData?.qrImageUrl}
        amount={calculations.finalBillAmount}
        onCheckStatus={checkPaymentStatus}
      />
    </div>
  );
};

export default BillingPage;
