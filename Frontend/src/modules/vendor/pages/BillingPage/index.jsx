import React, { useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiCheck, FiTool, FiPackage, FiFileText, FiPlus, FiTrash2, FiArrowLeft, FiDollarSign, FiClock, FiCreditCard, FiArrowRight, FiKey, FiCheckCircle, FiSearch } from 'react-icons/fi';
import { MdQrCode } from 'react-icons/md';
import { toast } from 'react-hot-toast';
import { vendorTheme as themeColors } from '../../../../theme';
import vendorBillService from '../../../../services/vendorBillService';
import vendorWalletService from '../../../../services/vendorWalletService';
import { getBookingById } from '../../services/bookingService';
import { publicCatalogService } from '../../../../services/catalogService';
import { OtpVerificationModal, ScanAndPayModal } from '../../components/common';
import LogoLoader from '../../../../components/common/LogoLoader';
import { motion } from 'framer-motion';

const BillingPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState(null);

  // --- VIEW MODE: 'timeline' | 'select-services' | 'select-parts' ---
  const [viewMode, setViewMode] = useState('timeline');
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = localStorage.getItem(`billing_step_${id}`);
    return saved ? parseInt(saved) : 1;
  });
  const [maxStep, setMaxStep] = useState(() => {
    const saved = localStorage.getItem(`billing_max_step_${id}`);
    return saved ? parseInt(saved) : 1;
  });

  // Track max step reached for timeline highlighting
  useEffect(() => {
    if (id) {
      localStorage.setItem(`billing_step_${id}`, currentStep);
      if (currentStep > maxStep) {
        setMaxStep(currentStep);
        localStorage.setItem(`billing_max_step_${id}`, currentStep);
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
  const [walletInfo, setWalletInfo] = useState(null);

  // Fetch Data
  useEffect(() => {
    fetchData();
  }, [id]);

  // Scroll to top on mount or view change or loading complete
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [id, viewMode, currentStep, loading]);

  const [isInitialized, setIsInitialized] = useState(false);

  // Save draft data (ONLY when initialized and not loading)
  useEffect(() => {
    if (id && !loading && isInitialized) {
      const data = { selectedServices, selectedParts, customItems, transportCharges, applyPartsGST };
      localStorage.setItem(`billing_data_${id}`, JSON.stringify(data));

      // Auto-sync draft bill to backend API
      const timer = setTimeout(() => {
        vendorBillService.createOrUpdateBill(id, data).catch(err => {
          console.warn('Auto-save draft bill error:', err?.message);
        });
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [id, selectedServices, selectedParts, customItems, transportCharges, applyPartsGST, loading, isInitialized]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const bookingRes = await getBookingById(id);
      const bookingData = bookingRes.data || bookingRes;
      setBooking(bookingData);

      // Check if OTP was already sent
      if (bookingData?.customerConfirmationOTP || bookingData?.paymentOtp) {
        setIsOtpSent(true);
      }

      const [servicesRes, partsRes, catRes, walletRes] = await Promise.all([
        vendorBillService.getServiceCatalog(),
        vendorBillService.getPartsCatalog(),
        publicCatalogService.getCategories(),
        vendorWalletService.getWallet().catch(() => ({ success: false }))
      ]);

      if (walletRes && walletRes.success) {
        setWalletInfo(walletRes.data || walletRes.wallet);
      }
      const services = servicesRes.services || [];
      const parts = partsRes.parts || [];

      setServicesCatalog(services);
      setPartsCatalog(parts);

      // Extract categories from categories API or catalog items
      if (catRes && catRes.success) {
        const apiCats = (catRes.categories || []).map(c => c.title);
        const allCats = ['All', ...apiCats];

        // Add Uncategorized if any catalog item is missing a category
        const hasUncategorizedServices = services.some(s => !s.categoryId?.title);
        const hasUncategorizedParts = parts.some(p => !p.categoryId?.title);
        if (hasUncategorizedServices || hasUncategorizedParts) {
          allCats.push('Uncategorized');
        }

        // Ensure uniqueness and filter nulls just in case
        const uniqueCats = [...new Set(allCats)].filter(Boolean);
        setServiceCategories(uniqueCats);
        setPartCategories(uniqueCats);
      } else {
        // Fallback to legacy behavior if API fails
        const cats = ['All', ...new Set(services.map(s => s.categoryId?.title || 'Uncategorized'))];
        setServiceCategories(cats.filter(Boolean));

        const pCats = ['All', ...new Set(parts.map(p => p.categoryId?.title || 'Uncategorized'))];
        setPartCategories(pCats.filter(Boolean));
      }

      // 1. Load from Backend
      let backendBill = null;
      try {
        const billRes = await vendorBillService.getBill(id);
        if (billRes.success && billRes.bill) {
          backendBill = billRes.bill;
        }
      } catch (bErr) {
        console.warn('Get bill error:', bErr.message);
      }

      // 2. Try to load from Local Storage (Draft)
      let draftData = null;
      const savedDraft = localStorage.getItem(`billing_data_${id}`);
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
          servicePayoutPct: pc.serviceSplitPercentage ?? 70,
          partsPayoutPct: pc.partsSplitPercentage ?? 10
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

      // Fallback settings logic if no backend payout config
      if (!backendBill?.payoutConfig) {
        try {
          const token = localStorage.getItem('vendorToken');
          const res = await fetch('/api/vendors/settings', { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (data.success && data.data?.global) {
            const g = data.data.global;
            setPayoutSettings({
              serviceGstPct: g.serviceGstPercentage ?? 18,
              partsGstPct: g.partsGstPercentage ?? 18,
              servicePayoutPct: g.servicePayoutPercentage ?? 70,
              partsPayoutPct: g.partsPayoutPercentage ?? 10
            });
          }
        } catch (e) { console.error('Error fetching global settings:', e); }
      }

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


  // --- HANDLERS (SELECTION) ---
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

  // --- HANDLERS (QTY UPDATES ON TIMELINE) ---
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

  // Custom Items
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
  }


  // --- Settings (fetched for vendor-side preview) ---
  const [payoutSettings, setPayoutSettings] = useState({
    serviceGstPct: 18,
    partsGstPct: 18,
    servicePayoutPct: 90,
    partsPayoutPct: 100
  });

  // Settings fetched in fetchData to ensure bill priority

  // --- CALCULATIONS ---
  const calculations = useMemo(() => {
    if (!booking) return null;

    const { serviceGstPct, partsGstPct, servicePayoutPct, partsPayoutPct } = payoutSettings;

    // Original booking base (service)
    const isPlanBooking = booking.paymentMethod === 'plan_benefit';
    const originalBase = isPlanBooking ? 0 : (booking.basePrice || 0);
    const originalServiceGST = isPlanBooking ? 0 : parseFloat(((originalBase * serviceGstPct) / 100).toFixed(2));

    // Extra Services: price is base, GST calculated separately
    let extraServiceBase = 0;
    let extraServiceGST = 0;
    selectedServices.forEach(s => {
      const base = s.price * s.quantity;
      const gst = parseFloat(((base * serviceGstPct) / 100).toFixed(2));
      extraServiceBase += base;
      extraServiceGST += gst;
    });

    // Parts: each part has its own gstPercentage (defaults to partsGstPct)
    let partsBase = 0;
    let partsGST = 0;
    selectedParts.forEach(p => {
      partsBase += (p.price * p.quantity);
      if (applyPartsGST) {
        partsGST += p.gstAmount;
      }
    });

    // Custom Items: use partsGstPct
    let customBase = 0;
    let customGST = 0;
    customItems.forEach(c => {
      customBase += (c.price * c.quantity);
      if (applyPartsGST) {
        customGST += c.gstAmount;
      }
    });

    // Visiting Charges
    const visitingCharges = Number(booking.visitingCharges) || 0;
    const finalTransportCharges = Number(transportCharges) || 0;

    const totalServiceBase = originalBase + extraServiceBase;
    const totalServiceGST = originalServiceGST + extraServiceGST;
    const totalPartsBase = partsBase + customBase;
    const totalPartsGST = partsGST + customGST;

    const finalBillAmount = parseFloat(((totalServiceBase + totalServiceGST) + (totalPartsBase + totalPartsGST) + visitingCharges + finalTransportCharges).toFixed(2));

    // Vendor Earnings estimate
    const vendorServiceEarnings = parseFloat(((totalServiceBase * servicePayoutPct) / 100).toFixed(2));
    const vendorPartsEarnings = parseFloat(((totalPartsBase * partsPayoutPct) / 100).toFixed(2));
    const totalVendorEarnings = parseFloat((vendorServiceEarnings + vendorPartsEarnings).toFixed(2));

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
      totalVendorEarnings,
      vendorServiceEarnings,
      vendorPartsEarnings,
      servicePayoutPct,
      partsPayoutPct
    };
  }, [booking, selectedServices, selectedParts, customItems, transportCharges, payoutSettings, applyPartsGST]);

  const willExceedCashLimit = useMemo(() => {
    if (!walletInfo || !calculations) return false;
    const currentDues = walletInfo.dues || 0;
    const currentEarnings = walletInfo.earnings || 0;
    const cashLimit = walletInfo.cashLimit || 10000;
    const expectedNewNetOwed = (currentDues + calculations.finalBillAmount) - (currentEarnings + calculations.totalVendorEarnings);
    return expectedNewNetOwed > cashLimit;
  }, [walletInfo, calculations]);


  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const res = await vendorBillService.createOrUpdateBill(id, {
        services: selectedServices,
        parts: selectedParts,
        customItems,
        transportCharges,
        applyPartsGST
      });

      if (res.success) {
        toast.success('Bill generated successfully!');
        localStorage.removeItem(`billing_step_${id}`);
        localStorage.removeItem(`billing_max_step_${id}`);
        localStorage.removeItem(`billing_data_${id}`);
        navigate(`/vendor/booking/${id}`);
      } else {
        toast.error(res.message || 'Failed to generate bill');
        setSubmitting(false);
      }
    } catch (error) {
      console.error('Submit bill error:', error);
      toast.error('An error occurred');
      setSubmitting(false);
    }
  };

  const handleStepChange = async (targetStep) => {
    setCurrentStep(targetStep);

    if (targetStep === 5) {
      // Step 5 (Summary & Pay): finalize bill on backend & unlock customer Pay Online
      try {
        await vendorBillService.createOrUpdateBill(id, {
          services: selectedServices,
          parts: selectedParts,
          customItems,
          transportCharges,
          applyPartsGST,
          isFinalized: true
        });
        toast.success('Invoice finalized & sent to customer!');
      } catch (err) {
        console.warn('Notice setting isFinalized true:', err);
      }
    } else {
      // Steps 1-4 (Editing): un-finalize bill on backend to lock customer Pay Online
      try {
        await vendorBillService.createOrUpdateBill(id, {
          services: selectedServices,
          parts: selectedParts,
          customItems,
          transportCharges,
          applyPartsGST,
          isFinalized: false
        });
      } catch (err) {
        console.warn('Notice setting isFinalized false:', err);
      }
    }
  };

  const handleSendOTP = async () => {
    if (isPaid) {
      toast.success('Payment has already been received!');
      navigate(`/vendor/booking/${id}`);
      return;
    }

    // Immediately open OTP modal without sending duplicate SMS/push notifications
    setIsOtpSent(true);
    setShowOtpModal(true);
    setPaymentMode('cash');
    setOnlinePaymentData(null);

    try {
      // Ensure bill is finalized & synced with backend
      await vendorBillService.createOrUpdateBill(id, {
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
      await vendorWalletService.initiateCashCollection(
        id,
        calculations.finalBillAmount,
        [...selectedParts, ...customItems]
      );
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

      const res = await vendorWalletService.confirmCashCollection(
        id,
        calculations.finalBillAmount,
        code,
        [...selectedParts, ...customItems]
      );

      if (res.success) {
        setShowOtpModal(false);
        toast.success('Cash payment verified successfully!');
        localStorage.removeItem(`billing_step_${id}`);
        localStorage.removeItem(`billing_max_step_${id}`);
        localStorage.removeItem(`billing_data_${id}`);
        fetchData();
        navigate(`/vendor/booking/${id}`);
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
      // First save the bill to ensure backend has latest amounts
      await vendorBillService.createOrUpdateBill(id, {
        services: selectedServices,
        parts: selectedParts,
        customItems,
        transportCharges,
        applyPartsGST
      });

      const res = await vendorWalletService.initiateOnlineCollection(id, calculations.finalBillAmount, [...selectedParts, ...customItems]);

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
  const isPaid = booking?.cashCollected || ['success', 'collected_by_vendor', 'paid', 'paid_online'].includes(booking?.paymentStatus?.toLowerCase()) || ['completed'].includes(booking?.status?.toLowerCase());

  useEffect(() => {
    let pollInterval = null;

    if ((currentStep === 5 || showQrModal) && !isPaid && id) {
      pollInterval = setInterval(async () => {
        try {
          const bookingRes = await getBookingById(id);
          const freshData = bookingRes.data || bookingRes;
          const freshIsPaid = freshData?.cashCollected || ['success', 'collected_by_vendor', 'paid', 'paid_online'].includes(freshData?.paymentStatus?.toLowerCase()) || ['completed'].includes(freshData?.status?.toLowerCase());

          if (freshIsPaid) {
            setBooking(freshData);
            setShowQrModal(false);
            setShowOtpModal(false);
            toast.success('Payment Received!');
            localStorage.removeItem(`billing_step_${id}`);
            localStorage.removeItem(`billing_max_step_${id}`);
            localStorage.removeItem(`billing_data_${id}`);
            navigate(`/vendor/booking/${id}`);
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
      const res = await vendorWalletService.verifyOnlineCollection(id);

      if (res.success) {
        setShowQrModal(false);
        toast.success('Payment verified successfully!');
        localStorage.removeItem(`billing_step_${id}`);
        localStorage.removeItem(`billing_max_step_${id}`);
        localStorage.removeItem(`billing_data_${id}`);
        fetchData();
        navigate(`/vendor/booking/${id}`);
      } else {
        toast.error(res.message || 'Payment not yet confirmed');
      }
    } catch (error) {
      console.error('Verify payment error:', error);
      toast.error('Verification failed or payment pending');
    } finally {
      setQrLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <LogoLoader />
    </div>
  );
  if (!booking) return null;

  // --- RENDER LOGIC ---

  if (viewMode === 'select-services') {
    return (
      <div className="min-h-screen bg-white pb-10 relative">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-gray-100 px-4 py-4 md:px-10 md:py-6 flex flex-col gap-4 md:gap-6">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={() => setViewMode('timeline')} className="w-9 h-9 md:w-12 md:h-12 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors shadow-inner">
              <FiArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex-1 relative group">
              <FiSearch className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5 md:w-6 md:h-6 group-focus-within:text-blue-600 transition-colors" />
              <input 
                autoFocus 
                placeholder="Search for a service..." 
                value={serviceSearch} 
                onChange={e => setServiceSearch(e.target.value)}
                className="w-full bg-gray-50 rounded-xl md:rounded-2xl py-3.5 md:py-4.5 pl-11 md:pl-16 pr-6 md:pr-8 text-sm md:text-[15px] font-normal text-gray-900 border border-gray-100 focus:border-blue-600/50 outline-none transition-all placeholder:text-gray-300 focus:ring-4 focus:ring-blue-600/5" 
              />
            </div>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-hide">
            {serviceCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 md:px-6 md:py-2.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-medium capitalize tracking-widest whitespace-nowrap transition-all duration-300 ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100'}`}>{cat}</button>
            ))}
          </div>
        </header>
        <div className="px-4 py-6 md:px-10 md:py-10 space-y-3.5 md:space-y-4 pb-36 md:pb-48 max-w-[1600px] mx-auto">
          {filteredServices.map(item => {
            const selected = isServiceSelected(item._id);
            return (
              <div key={item._id}
                onClick={() => !selected && toggleService(item)}
                className={`p-4 md:p-6 rounded-2xl md:rounded-[32px] border transition-all active:scale-[0.98] cursor-pointer group flex justify-between items-center ${selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                <div className="flex-1">
                  <h4 className={`font-medium text-sm md:text-lg mb-1.5 md:mb-2 tracking-tight ${selected ? 'text-gray-900' : 'text-gray-800'}`}>{item.name}</h4>
                  <div className="flex items-center gap-3.5 md:gap-4">
                    <span className={`text-sm md:text-base font-medium ${selected ? 'text-blue-600' : 'text-gray-900'}`}>₹{item.price}</span>
                    {item.categoryId?.title && <span className="text-[9px] md:text-[10px] font-medium capitalize tracking-widest px-2 py-0.5 md:px-3 md:py-1 rounded bg-gray-50 text-gray-400 border border-gray-100">{item.categoryId.title}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                  {selected ? (
                    <div className="flex items-center gap-3 md:gap-4 bg-gray-50 rounded-xl md:rounded-2xl p-1 md:p-1.5 border border-gray-100 shadow-inner">
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
                        className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white rounded-lg md:rounded-xl text-blue-600 border border-gray-100 hover:bg-gray-100 active:scale-95 transition-all shadow-sm">
                        <span className="font-medium text-lg md:text-xl leading-none">-</span>
                      </button>
                      <span className="font-medium text-sm md:text-base min-w-[20px] md:min-w-[24px] text-center text-gray-900">
                        {selectedServices.find(s => s.catalogId === item._id).quantity}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const idx = selectedServices.findIndex(s => s.catalogId === item._id);
                          updateServiceQty(idx, 1);
                        }}
                        className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-blue-600 rounded-lg md:rounded-xl text-white shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all">
                        <FiPlus className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleService(item); }}
                      className="w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center bg-gray-50 text-gray-400 hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90 border border-gray-100">
                      <FiPlus className="w-5 h-5 md:w-6 md:h-6" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-0 left-0 right-0 p-4 md:p-8 bg-white/90 backdrop-blur-2xl border-t border-gray-100 z-[100] flex gap-4 md:gap-6 mt-auto">
          <button onClick={() => setViewMode('timeline')} className="flex-1 py-3.5 md:py-6 bg-gray-50 text-gray-400 font-medium text-[10px] md:text-xs capitalize tracking-widest rounded-xl md:rounded-[28px] border border-gray-100 hover:bg-gray-100 transition-all shadow-inner">
            Save & Exit
          </button>
          <button onClick={() => {
            setViewMode('select-parts');
            setCurrentStep(2);
          }} className="flex-[2] py-3.5 md:py-6 bg-blue-600 text-white font-medium text-[10px] md:text-xs capitalize tracking-[0.2em] rounded-xl md:rounded-[28px] flex items-center justify-center gap-2 md:gap-4 shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">
            Next: Logistics <FiArrowRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>
    );
  }

  if (viewMode === 'select-parts') {
    return (
      <div className="min-h-screen bg-white pb-10 relative">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-gray-100 px-4 py-4 md:px-10 md:py-6 flex flex-col gap-4 md:gap-6">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={() => setViewMode('timeline')} className="w-9 h-9 md:w-12 md:h-12 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors shadow-inner">
              <FiArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div className="flex-1 relative group">
              <FiSearch className="absolute left-4 md:left-6 top-1/2 -translate-y-1/2 text-gray-300 w-5 h-5 md:w-6 md:h-6 group-focus-within:text-amber-600 transition-colors" />
              <input 
                autoFocus 
                placeholder="Search for parts..." 
                value={partSearch} 
                onChange={e => setPartSearch(e.target.value)}
                className="w-full bg-gray-50 rounded-xl md:rounded-2xl py-3.5 md:py-4.5 pl-11 md:pl-16 pr-6 md:pr-8 text-sm md:text-[15px] font-normal text-gray-900 border border-gray-100 focus:border-amber-600/50 outline-none transition-all placeholder:text-gray-300 focus:ring-4 focus:ring-amber-600/5" 
              />
            </div>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1.5 scrollbar-hide">
            {partCategories.map(cat => (
              <button key={cat} onClick={() => setSelectedPartCategory(cat)}
                className={`px-4 py-2 md:px-6 md:py-2.5 rounded-lg md:rounded-xl text-[10px] md:text-xs font-medium capitalize tracking-widest whitespace-nowrap transition-all duration-300 ${selectedPartCategory === cat ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/20' : 'bg-gray-50 text-gray-400 border border-gray-100 hover:bg-gray-100'}`}>{cat}</button>
            ))}
          </div>
        </header>
        <div className="px-4 py-6 md:px-10 md:py-10 space-y-3.5 md:space-y-4 pb-36 md:pb-48 max-w-[1600px] mx-auto">
          {filteredParts.map(item => {
            const selected = isPartSelected(item._id);
            return (
              <div key={item._id}
                onClick={() => togglePart(item)}
                className={`p-4 md:p-6 rounded-2xl md:rounded-[32px] border transition-all active:scale-[0.98] cursor-pointer group flex justify-between items-center ${selected ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                <div className="flex-1">
                  <h4 className={`font-medium text-sm md:text-lg mb-1.5 md:mb-2 tracking-tight ${selected ? 'text-gray-900' : 'text-gray-800'}`}>{item.name}</h4>
                  <div className="flex items-center gap-3.5 md:gap-4">
                    <span className={`text-sm md:text-base font-medium ${selected ? 'text-amber-600' : 'text-gray-900'}`}>₹{item.price}</span>
                    {item.categoryId?.title && <span className="text-[9px] md:text-[10px] font-medium capitalize tracking-widest px-2 py-0.5 md:px-3 md:py-1 rounded bg-gray-50 text-gray-400 border border-gray-100">{item.categoryId.title}</span>}
                  </div>
                </div>
                <button
                  className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all ${selected ? 'bg-rose-50 text-rose-500 border border-rose-200' : 'bg-amber-600 text-white shadow-lg shadow-amber-500/20'}`}>
                  {selected ? <FiTrash2 className="w-5 h-5 md:w-6 md:h-6" /> : <FiPlus className="w-5 h-5 md:w-7 md:h-7" />}
                </button>
              </div>
            );
          })}
        </div>
        <div className="sticky bottom-0 left-0 right-0 p-4 md:p-8 bg-white/90 backdrop-blur-2xl border-t border-gray-100 z-[100] flex gap-4 md:gap-6 mt-auto">
          <button onClick={() => setViewMode('timeline')} className="flex-1 py-3.5 md:py-6 bg-gray-50 text-gray-400 font-medium text-[10px] md:text-xs capitalize tracking-widest rounded-xl md:rounded-[28px] border border-gray-100 hover:bg-gray-100 transition-all shadow-inner">
            Save & Exit
          </button>
          <button onClick={() => {
            setViewMode('timeline');
            setCurrentStep(3); // Go to Extras
          }} className="flex-[2] py-3.5 md:py-6 bg-blue-600 text-white font-medium text-[10px] md:text-xs capitalize tracking-[0.2em] rounded-xl md:rounded-[28px] flex items-center justify-center gap-2 md:gap-4 shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all">
            Next: Adjustments <FiArrowRight className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-0 relative">
      {/* Unified Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100">
        {/* Title Bar */}
        <div className="px-4 py-4 md:px-10 md:py-6 flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <button onClick={() => navigate(-1)} className="w-9 h-9 md:w-12 md:h-12 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100 flex items-center justify-center hover:bg-gray-100 transition-colors shadow-inner">
              <FiArrowLeft className="w-5 h-5 text-gray-400" />
            </button>
            <div>
              <h1 className="text-lg md:text-2xl font-medium text-gray-900 tracking-tight leading-none">Generate Bill</h1>
              <p className="text-[9px] md:text-[10px] font-medium text-blue-500 capitalize tracking-widest mt-1.5 md:mt-2">Booking #{booking.bookingNumber}</p>
            </div>
          </div>
          <div className="w-9 h-9 md:w-12 md:h-12 bg-gray-50 rounded-xl md:rounded-2xl border border-gray-100 flex items-center justify-center shadow-inner">
            <FiFileText className="w-5 h-5 text-blue-500" />
          </div>
        </div>

        {/* Step Indicator */}
        <div className="px-3 py-5 md:px-10 md:py-8 border-t border-gray-100 flex justify-between relative overflow-hidden bg-gray-50/50">
          {[
            { id: 1, label: 'Services', icon: FiTool },
            { id: 2, label: 'Parts', icon: FiPackage },
            { id: 3, label: 'Add-ons', icon: FiPlus },
            { id: 4, label: 'Transport', icon: FiPackage },
            { id: 5, label: 'Summary & Pay', icon: FiCheckCircle }
          ].map((step) => {
            const isCompleted = step.id < currentStep;
            const isActive = step.id === currentStep;
            const isReached = step.id <= maxStep;

            return (
              <button key={step.id} onClick={() => isReached && handleStepChange(step.id)}
                className={`flex flex-col items-center gap-2 md:gap-3 z-10 relative transition-all duration-300 ${isActive ? 'scale-105 md:scale-110' : isReached ? 'opacity-100' : 'opacity-65'}`}>
                <div className={`w-9 h-9 md:w-12 md:h-12 rounded-xl md:rounded-[18px] flex items-center justify-center text-xs md:text-sm font-bold transition-all duration-500 ${(isActive || isCompleted) ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white text-gray-400 border border-gray-200'} ${isActive ? 'ring-6 md:ring-8 ring-blue-500/10' : ''}`}>
                  {isCompleted ? <FiCheck className="w-4 h-4 md:w-5 md:h-5 stroke-[2.5]" /> : <step.icon className="w-4 h-4 md:w-5 md:h-5" />}
                </div>
                <span className={`text-[9px] md:text-xs font-bold capitalize tracking-wider transition-colors ${isActive ? 'text-blue-700' : 'text-gray-600'}`}>{step.label}</span>
              </button>
            );
          })}
          <div className="absolute top-[2.65rem] md:top-[3.75rem] left-0 right-0 h-1 bg-gray-200 -z-0 mx-10 md:mx-24 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${((currentStep - 1) / 4) * 100}%` }}
              className="h-full bg-blue-600 shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            />
          </div>
        </div>
      </header>

      <main className="px-4 py-6 md:px-10 md:py-10 space-y-6 md:space-y-10 pb-36 md:pb-48 max-w-[1600px] mx-auto relative z-10">
        {currentStep === 1 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="bg-white p-5 md:p-10 rounded-2xl md:rounded-[40px] border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-6 pb-4 md:mb-10 md:pb-6 border-b border-gray-100">
                <div>
                  <h3 className="text-lg md:text-2xl font-bold text-gray-900 tracking-tight">Services & Labor</h3>
                  <p className="text-xs font-medium text-gray-500 mt-1 md:mt-2">Add extra service items to the bill</p>
                </div>
                <button onClick={() => setViewMode('select-services')} className="px-4 py-2 md:px-8 md:py-3 bg-blue-600 text-white font-bold text-xs md:text-sm rounded-xl md:rounded-2xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all flex items-center gap-2 md:gap-3">
                  <FiPlus className="w-4 h-4" /> Add Services
                </button>
              </div>
              {selectedServices.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-[32px] border border-dashed border-gray-300">
                  <FiTool className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
                  <p className="text-gray-500 font-bold text-sm">No extra services added</p>
                  <button onClick={() => setViewMode('select-services')} className="mt-2 text-blue-600 hover:underline font-bold text-xs">Browse Services Catalog</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedServices.map((s, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 md:p-6 bg-gray-50 rounded-2xl md:rounded-[28px] border border-gray-200 group hover:bg-white hover:shadow-md transition-all">
                      <div>
                        <p className="font-bold text-sm md:text-lg text-gray-900 tracking-tight">{s.name}</p>
                        <div className="flex items-center gap-4 mt-2.5 md:mt-3">
                          <div className="flex items-center gap-2.5 md:gap-3 bg-white rounded-lg md:rounded-xl p-1 border border-gray-200 shadow-sm">
                            <button onClick={() => updateServiceQty(idx, -1)} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-gray-100 rounded-md md:rounded-lg text-blue-600 hover:bg-gray-200 transition-all font-bold text-lg">-</button>
                            <span className="text-xs font-bold text-gray-900 w-5 md:w-6 text-center">{s.quantity}</span>
                            <button onClick={() => updateServiceQty(idx, 1)} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-blue-600 rounded-md md:rounded-lg text-white shadow hover:bg-blue-700 transition-all"><FiPlus className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                      <p className="font-extrabold text-lg md:text-2xl text-gray-900 tracking-tight">₹{s.total.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="bg-white p-5 md:p-10 rounded-2xl md:rounded-[40px] border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-6 pb-4 md:mb-10 md:pb-6 border-b border-gray-100">
                <div>
                  <h3 className="text-lg md:text-2xl font-bold text-gray-900 tracking-tight">Spare Parts & Materials</h3>
                  <p className="text-xs font-medium text-gray-500 mt-1 md:mt-2">Select spare parts used from inventory</p>
                </div>
                <button onClick={() => setViewMode('select-parts')} className="px-4 py-2 md:px-8 md:py-3 bg-amber-600 text-white font-bold text-xs md:text-sm rounded-xl md:rounded-2xl shadow-lg shadow-amber-500/20 hover:bg-amber-700 transition-all flex items-center gap-2 md:gap-3">
                  <FiPlus className="w-4 h-4" /> Add Spare Parts
                </button>
              </div>
              {selectedParts.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-2xl md:rounded-[32px] border border-dashed border-gray-300">
                  <FiPackage className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
                  <p className="text-gray-500 font-bold text-sm">No spare parts added</p>
                  <button onClick={() => setViewMode('select-parts')} className="mt-2 text-amber-600 hover:underline font-bold text-xs">Browse Parts Catalog</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedParts.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-4 md:p-6 bg-gray-50 rounded-2xl md:rounded-[28px] border border-gray-200 group hover:bg-white hover:shadow-md transition-all">
                      <div>
                        <p className="font-bold text-sm md:text-lg text-gray-900 tracking-tight">{p.name}</p>
                        <div className="flex items-center gap-4 mt-2.5 md:mt-3">
                          <div className="flex items-center gap-2.5 md:gap-3 bg-white rounded-lg md:rounded-xl p-1 border border-gray-200 shadow-sm">
                            <button onClick={() => updatePartQty(idx, -1)} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-gray-100 rounded-md md:rounded-lg text-amber-600 hover:bg-gray-200 transition-all font-bold text-lg">-</button>
                            <span className="text-xs font-bold text-gray-900 w-5 md:w-6 text-center">{p.quantity}</span>
                            <button onClick={() => updatePartQty(idx, 1)} className="w-7 h-7 md:w-8 md:h-8 flex items-center justify-center bg-amber-600 rounded-md md:rounded-lg text-white shadow hover:bg-amber-700 transition-all"><FiPlus className="w-3.5 h-3.5" /></button>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-extrabold text-lg md:text-2xl text-gray-900 tracking-tight">₹{p.total.toFixed(2)}</p>
                        <p className="text-xs font-semibold text-gray-500 mt-0.5">+ GST</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex justify-between items-end mb-6 md:mb-10">
              <div>
                <h3 className="text-xl md:text-3xl font-bold text-gray-900 tracking-tight">Custom Add-ons</h3>
                <p className="text-xs font-medium text-gray-500 mt-1.5 md:mt-2">Add non-catalog items or custom materials</p>
              </div>
              <button onClick={addCustomItem} className="bg-blue-600 text-white px-4 py-2 md:px-8 md:py-3.5 rounded-xl md:rounded-2xl font-bold text-xs md:text-sm shadow-lg shadow-blue-500/20 flex items-center gap-2 hover:bg-blue-700 transition-all">
                <FiPlus className="w-4 h-4" /> Add Item Row
              </button>
            </div>

            <div className="space-y-4 md:space-y-6">
              {customItems.map((item, idx) => {
                return (
                  <div key={idx} className="bg-white p-5 md:p-8 rounded-2xl md:rounded-[40px] border border-gray-200 shadow-sm relative">
                    <button
                      onClick={() => removeCustomItem(idx)}
                      className="absolute top-4 right-4 md:top-6 md:right-6 w-9 h-9 md:w-10 md:h-10 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex items-center justify-center hover:bg-rose-100 transition-all z-10"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-700">Item Name</label>
                        <input
                          placeholder="e.g. Copper Wire / Custom Valve"
                          value={item.name}
                          onChange={e => updateCustomItem(idx, 'name', e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-blue-600 transition-all"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-gray-700">HSN Code (Optional)</label>
                        <input
                          placeholder="e.g. 8415"
                          value={item.hsnCode || ''}
                          onChange={e => updateCustomItem(idx, 'hsnCode', e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:border-blue-600 transition-all uppercase"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4 md:col-span-2">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-gray-700">Unit Price (₹)</label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={item.price || ''}
                            onChange={e => updateCustomItem(idx, 'price', e.target.value)}
                            onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-blue-600 transition-all"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-bold text-gray-700">Quantity</label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => updateCustomItem(idx, 'quantity', e.target.value)}
                            onKeyDown={(e) => ['e', 'E', '+', '-'].includes(e.key) && e.preventDefault()}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 outline-none focus:border-blue-600 transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-gray-100 mt-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          id={`gst-${idx}`}
                          checked={item.gstApplicable}
                          onChange={e => updateCustomItem(idx, 'gstApplicable', e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <label htmlFor={`gst-${idx}`} className="text-xs font-bold text-gray-700 cursor-pointer">Apply 18% GST on this item</label>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-500">Item Total</p>
                        <span className="text-lg md:text-2xl font-extrabold text-gray-900">₹{item.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {customItems.length === 0 && (
                <div className="text-center py-16 bg-gray-50 rounded-2xl md:rounded-[40px] border border-dashed border-gray-300">
                  <FiPackage className="w-12 h-12 text-gray-400 mx-auto mb-3 opacity-60" />
                  <p className="text-gray-500 font-bold text-sm">No custom add-ons added</p>
                  <button onClick={addCustomItem} className="text-blue-600 font-bold text-xs mt-2 hover:underline">+ Add First Custom Item</button>
                </div>
              )}
            </div>
          </div>
        )}
        {currentStep === 4 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="bg-white p-8 md:p-16 rounded-2xl md:rounded-[48px] border border-gray-200 flex flex-col items-center text-center shadow-sm relative overflow-hidden">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 shadow-sm">
                <FiPackage className="w-8 h-8 md:w-10 md:h-10" />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight mb-2">Transport & Delivery Charges</h3>
              <p className="text-xs md:text-sm text-gray-600 mb-8 max-w-md leading-relaxed">Enter any additional travel or transport costs incurred for this service.</p>

              <div className="w-full max-w-sm relative text-left">
                <label className="text-xs font-bold text-gray-700 ml-1 mb-2 block">Transport Amount (₹)</label>
                <div className="relative">
                  <span className="absolute left-6 top-1/2 -translate-y-1/2 font-bold text-blue-600 text-2xl">₹</span>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    value={transportCharges || ''}
                    onChange={e => setTransportCharges(Math.max(0, Number(e.target.value)))}
                    onBlur={e => { if (Number(e.target.value) < 0) setTransportCharges(0); }}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-14 pr-6 py-5 text-2xl md:text-3xl font-extrabold outline-none focus:border-blue-600 transition-all text-gray-900 placeholder:text-gray-300"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentStep === 5 && calculations && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500 pb-10">
            <div className="bg-white rounded-2xl md:rounded-[40px] overflow-hidden border border-gray-200 shadow-md relative">
              <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 px-6 py-8 md:px-10 md:py-10 text-white text-center relative overflow-hidden">
                <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-2">Total Invoice Amount</p>
                <h2 className="text-4xl md:text-6xl font-black tracking-tight">₹{calculations.finalBillAmount.toFixed(2)}</h2>
              </div>
              <div className="p-5 md:p-10 space-y-6 md:space-y-8">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm md:text-base flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center text-sm border border-blue-100"><FiTool /></span>
                    Services & Labor
                  </h4>
                  <div className="space-y-3 text-sm pl-2">
                    <div className="flex justify-between items-center text-gray-700 font-medium">
                      <span>Original Service: {booking.serviceName || 'Standard Service'}</span>
                      {booking.paymentMethod === 'plan_benefit' ? (
                        <span className="text-emerald-700 font-bold text-xs bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">Free (Plan)</span>
                      ) : (
                        <span className="font-bold text-gray-900">₹{calculations.originalBase.toFixed(2)}</span>
                      )}
                    </div>
                    {selectedServices.map(s => (
                      <div key={s.catalogId} className="flex justify-between items-center text-gray-700 font-medium">
                        <span>{s.name} <span className="text-xs text-gray-500 font-semibold">x {s.quantity}</span></span>
                        <span className="font-bold text-gray-900">₹{(s.price * s.quantity).toFixed(2)}</span>
                      </div>
                    ))}
 
                    <div className="flex justify-between items-center text-xs font-bold text-gray-600 border-t border-dashed border-gray-200 pt-3 mt-2">
                      <span>Service GST ({calculations.serviceGstPct}%)</span>
                      <span className="font-bold text-gray-900">₹{calculations.totalServiceGST.toFixed(2)}</span>
                    </div>
 
                    <div className="flex justify-between items-center font-bold text-gray-900 text-base pt-3 border-t border-gray-200">
                      <span>Services Subtotal</span>
                      <span className="text-lg font-black text-gray-900">₹{(calculations.originalBase + calculations.extraServiceBase + calculations.totalServiceGST).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                {(selectedParts.length > 0 || customItems.length > 0) && (
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm md:text-base flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                      <span className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center text-sm border border-amber-100"><FiPackage /></span>
                      Spare Parts & Materials
                    </h4>
 
                    {/* Parts GST toggle */}
                    <label className="flex items-center gap-4 cursor-pointer mb-6 p-4 rounded-2xl border border-gray-200 bg-gray-50 hover:bg-white transition-all">
                      <div className="relative">
                        <input
                          type="checkbox"
                          id="partsGstToggle"
                          checked={applyPartsGST}
                          onChange={e => setApplyPartsGST(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-12 h-6 rounded-full transition-all duration-300 ${applyPartsGST ? 'bg-amber-600' : 'bg-gray-300'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow absolute top-1 transition-all duration-300 ${applyPartsGST ? 'left-7' : 'left-1'}`} />
                        </div>
                      </div>
                      <div className="text-left flex-1">
                        <p className="text-sm font-bold text-gray-900">Apply GST on Parts ({calculations.partsGstPct}%)</p>
                        <p className="text-xs font-semibold text-gray-500 mt-0.5">
                          {applyPartsGST ? `GST (${calculations.partsGstPct}%): +₹${calculations.totalPartsGST.toFixed(2)}` : 'Exempt / No GST on parts'}
                        </p>
                      </div>
                    </label>
 
                    <div className="space-y-3 text-sm pl-2">
                      {selectedParts.map(p => (
                        <div key={p.catalogId} className="flex justify-between items-center text-gray-700 font-medium">
                          <span>{p.name} <span className="text-xs text-gray-500 font-semibold">x {p.quantity}</span></span>
                          <span className="font-bold text-gray-900">₹{(p.price * p.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                      {customItems.map((c, i) => (
                        <div key={i} className="flex justify-between items-center text-gray-700 font-medium">
                          <div>
                            <span>{c.name || 'Custom Item'} <span className="text-xs text-gray-500 font-semibold">x {c.quantity}</span></span>
                            {c.hsnCode && <p className="text-xs font-semibold text-gray-500">HSN: {c.hsnCode}</p>}
                          </div>
                          <span className="font-bold text-gray-900">₹{(c.price * c.quantity).toFixed(2)}</span>
                        </div>
                      ))}
 
                      <div className="flex justify-between items-center text-xs font-bold text-gray-600 border-t border-dashed border-gray-200 pt-3 mt-2">
                        <span>Parts GST ({calculations.partsGstPct}%)</span>
                        <span className="font-bold text-gray-900">₹{calculations.totalPartsGST.toFixed(2)}</span>
                      </div>
 
                      <div className="flex justify-between items-center font-bold text-gray-900 text-base pt-3 border-t border-gray-200">
                        <span>Parts Subtotal</span>
                        <span className="text-lg font-black text-gray-900">₹{(calculations.partsBase + calculations.totalPartsGST).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                  {booking.visitingCharges > 0 && (
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                      <p className="text-xs font-bold text-gray-600 mb-1 flex items-center gap-2">
                        <FiClock className="w-4 h-4 text-blue-600" /> Visiting Charge
                      </p>
                      <p className="text-xl font-black text-gray-900">₹{Number(booking.visitingCharges).toFixed(2)}</p>
                    </div>
                  )}
 
                  {transportCharges > 0 && (
                    <div className="bg-gray-50 p-4 rounded-2xl border border-gray-200">
                      <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-2">
                        <FiPackage className="w-4 h-4 text-blue-600" /> Logistics Fee
                      </p>
                      <p className="text-xl font-black text-gray-900">₹{Number(transportCharges).toFixed(2)}</p>
                    </div>
                  )}
                </div>
 
                {willExceedCashLimit && (
                  <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 border border-amber-300">
                      <FiClock className="w-6 h-6 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-800">Cash Limit Warning</p>
                      <p className="text-xs text-amber-700 font-medium leading-relaxed mt-1">
                        Total collection exceeds cash limit (₹{(walletInfo?.cashLimit || 10000).toLocaleString()}). 
                        Please settle pending dues with admin.
                      </p>
                    </div>
                  </div>
                )}
              </div>
 
              {booking.status === 'completed' ? (
                <div className="bg-emerald-600 px-6 py-6 md:px-10 md:py-8 border-t border-white/10 text-white">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-emerald-100 text-xs font-bold uppercase tracking-wider mb-1">Your Earnings</p>
                      <h4 className="text-2xl md:text-4xl font-black text-white tracking-tight">₹{calculations.totalVendorEarnings.toFixed(2)}</h4>
                    </div>
                    <div className="text-right">
                      <p className="text-emerald-100 text-xs font-semibold mb-1">Payout</p>
                      <p className="text-white font-bold text-sm bg-white/20 px-3 py-1 rounded-full">{calculations.servicePayoutPct}% Share</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-100 px-6 py-4 border-t border-gray-200 text-center">
                  <p className="text-xs font-bold text-gray-600 flex items-center justify-center gap-2">
                    <FiClock className="w-4 h-4 text-blue-600" />
                    Earnings calculated after completion
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="sticky bottom-0 left-0 right-0 p-4 md:p-6 bg-white/95 backdrop-blur-md border-t border-gray-200 z-[100] mt-auto">
        <div className="max-w-[1600px] mx-auto flex gap-3 md:gap-6">
          {currentStep === 1 && (
            <button onClick={() => handleStepChange(2)} className="w-full py-4 bg-blue-600 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">
              Next: Spare Parts <FiArrowRight className="w-5 h-5" />
            </button>
          )}
          {currentStep === 2 && (
            <>
              <button onClick={() => handleStepChange(1)} className="flex-1 py-4 text-gray-800 font-bold text-sm bg-gray-100 border border-gray-200 rounded-2xl hover:bg-gray-200 transition-all">Back</button>
              <button onClick={() => handleStepChange(3)} className="flex-[2] py-4 bg-blue-600 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">
                Next: Add-ons <FiArrowRight className="w-5 h-5" />
              </button>
            </>
          )}
          {currentStep === 3 && (
            <>
              <button onClick={() => handleStepChange(2)} className="flex-1 py-4 text-gray-800 font-bold text-sm bg-gray-100 border border-gray-200 rounded-2xl hover:bg-gray-200 transition-all">Back</button>
              <button onClick={() => handleStepChange(4)} className="flex-[2] py-4 bg-blue-600 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all">
                Next: Logistics Fee <FiArrowRight className="w-5 h-5" />
              </button>
            </>
          )}
          {currentStep === 4 && (
            <>
              <button onClick={() => handleStepChange(3)} className="flex-1 py-4 text-gray-800 font-bold text-sm bg-gray-100 border border-gray-200 rounded-2xl hover:bg-gray-200 transition-all">Back</button>
              <button
                onClick={async () => {
                  if (Number(transportCharges) < 0) {
                    toast.error('Logistics fee cannot be negative.');
                    setTransportCharges(0);
                    return;
                  }
                  try {
                    setSubmitting(true);
                    await vendorBillService.createOrUpdateBill(id, {
                      services: selectedServices,
                      parts: selectedParts,
                      customItems,
                      transportCharges,
                      applyPartsGST,
                      isFinalized: true
                    });
                    toast.success('Invoice finalized & sent to customer!');
                    setCurrentStep(5);
                  } catch (err) {
                    toast.error('Failed to finalize invoice');
                  } finally {
                    setSubmitting(false);
                  }
                }}
                disabled={submitting}
                className="flex-[2] py-4 bg-blue-600 text-white font-bold text-sm rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
              >
                Review Invoice <FiArrowRight className="w-5 h-5" />
              </button>
            </>
          )}
          {currentStep === 5 && (
            <>
              {isPaid ? (
                <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
                      <FiCheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-emerald-900 text-sm">Payment Verified & Completed</p>
                      <p className="text-emerald-700 text-xs mt-0.5">Online transaction completed successfully.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/vendor/booking/${id}`)}
                    className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-all shrink-0"
                  >
                    View Booking
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={async () => {
                      try {
                        setSubmitting(true);
                        await vendorBillService.createOrUpdateBill(id, {
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
                    className="flex-1 py-4 text-gray-800 font-bold text-sm bg-gray-100 border border-gray-200 rounded-2xl hover:bg-gray-200 transition-all disabled:opacity-50"
                  >
                    Edit Bill
                  </button>

                  <div className="flex-[3] grid grid-cols-2 gap-3">
                    <button
                      onClick={handleSendOTP}
                      disabled={otpLoading || qrLoading}
                      className="py-4 bg-emerald-600 text-white font-bold text-xs md:text-sm rounded-2xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <FiDollarSign className="w-5 h-5" />
                      <span>Collect Cash</span>
                    </button>

                    <button
                      onClick={handleOnlinePayment}
                      disabled={otpLoading || qrLoading}
                      className="py-4 bg-blue-600 text-white font-bold text-xs md:text-sm rounded-2xl shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50"
                    >
                      <MdQrCode className="w-5 h-5" />
                      <span>{qrLoading ? 'Loading...' : 'Digital Pay'}</span>
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </footer>

      <OtpVerificationModal
        isOpen={showOtpModal}
        onClose={() => setShowOtpModal(false)}
        onVerify={handleVerifyOTP}
        onResend={handleResendOTP}
        loading={otpLoading}
      />

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
