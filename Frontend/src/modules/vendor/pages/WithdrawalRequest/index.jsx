import React, { useState, useEffect, useLayoutEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDollarSign, FiArrowRight, FiCreditCard, FiAlertCircle, FiCheckCircle, FiEdit2, FiClock, FiPlusCircle, FiActivity } from 'react-icons/fi';
import { vendorTheme as themeColors } from '../../../../theme';
import Header from '../../components/layout/Header';
import { requestWithdrawal, getWalletBalance, getWithdrawalHistory } from '../../services/walletService';
import { vendorDashboardService } from '../../services/dashboardService';
import { toast } from 'react-hot-toast';
import LogoLoader from '../../../../components/common/LogoLoader';

const WithdrawalRequest = () => {
  const navigate = useNavigate();
  const [wallet, setWallet] = useState({ available: 0 });
  const [amount, setAmount] = useState('');
  const [showBankForm, setShowBankForm] = useState(false);
  const [history, setHistory] = useState([]);
  const [bankAccount, setBankAccount] = useState({
    accountHolderName: '',
    bankName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifscCode: '',
    upiId: ''
  });
  const [isBankSaved, setIsBankSaved] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [vendorStats, setVendorStats] = useState({
    commissionRate: 15,
    level: 3,
    platformFeeRate: 2
  });

  // Removed legacy layout effect background injection

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [walletRes, historyRes, statsRes] = await Promise.all([
        getWalletBalance(),
        getWithdrawalHistory(),
        vendorDashboardService.getDashboardStats()
      ]);
      setWallet({ available: walletRes.earnings || 0 });
      setHistory(historyRes || []);

      if (statsRes.success) {
        const stats = statsRes.data.stats;
        const level = stats.level || 3;
        const levelKey = `level${level}`;

        // Use dynamic rates from backend
        const commRate = stats.commissionRates?.[levelKey] || stats.commissionRate || 15;
        const pfRate = stats.platformFeeRates?.[levelKey] || 2;

        setVendorStats({
          commissionRate: commRate,
          level: level,
          platformFeeRate: pfRate
        });
      }

      const savedBank = JSON.parse(localStorage.getItem('vendorBankAccount') || 'null');
      if (savedBank) {
        setBankAccount({ ...savedBank, confirmAccountNumber: savedBank.accountNumber });
        setIsBankSaved(true);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleAmountChange = (value) => {
    const numValue = value.replace(/[^0-9]/g, '');
    setAmount(numValue);
    setError('');

    const numAmount = parseInt(numValue) || 0;
    if (numAmount > wallet.available) {
      setError('Amount cannot exceed available earnings');
    } else if (numAmount < 100 && numValue !== '') {
      setError('Minimum withdrawal amount is ₹100');
    }
  };

  const handleMaxAmount = () => {
    setAmount(wallet.available.toString());
    setError('');
  };

  const [fetchingIfsc, setFetchingIfsc] = useState(false);

  const fetchBankFromIFSC = async (ifsc) => {
    if (!ifsc || ifsc.length !== 11) return;
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc)) return;

    try {
      setFetchingIfsc(true);
      const res = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.BANK) {
          setBankAccount(prev => ({
            ...prev,
            bankName: data.BANK + (data.BRANCH ? ` (${data.BRANCH})` : '')
          }));
          toast.success(`Bank identified: ${data.BANK}`);
        }
      }
    } catch (err) {
      console.error('Error fetching IFSC details:', err);
    } finally {
      setFetchingIfsc(false);
    }
  };

  const handleBankInputChange = (e) => {
    const { name, value } = e.target;

    // Numbers only for account numbers
    if (name === 'accountNumber' || name === 'confirmAccountNumber') {
      const numValue = value.replace(/[^0-9]/g, '');
      setBankAccount(prev => ({ ...prev, [name]: numValue }));
      return;
    }

    // Auto uppercase for IFSC & auto fetch bank name
    if (name === 'ifscCode') {
      const upperIfsc = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
      setBankAccount(prev => ({ ...prev, ifscCode: upperIfsc }));
      if (upperIfsc.length === 11) {
        fetchBankFromIFSC(upperIfsc);
      }
      return;
    }

    setBankAccount(prev => ({ ...prev, [name]: value }));
  };

  const saveBankDetails = () => {
    const { accountHolderName, bankName, accountNumber, confirmAccountNumber, ifscCode } = bankAccount;

    if (!accountHolderName || !accountNumber || !bankName || !ifscCode) {
      toast.error('Please fill all mandatory bank details');
      return;
    }

    if (accountHolderName.trim().length < 3) {
      toast.error('Account Holder Name must be at least 3 characters long');
      return;
    }

    if (bankName.trim().length < 2) {
      toast.error('Please enter a valid Bank Name');
      return;
    }

    if (accountNumber.length < 9 || accountNumber.length > 18) {
      toast.error('Bank Account Number must be between 9 and 18 digits');
      return;
    }

    if (confirmAccountNumber && accountNumber !== confirmAccountNumber) {
      toast.error('Account numbers do not match');
      return;
    }

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifscCode)) {
      toast.error('Invalid IFSC Code format (e.g. SBIN0001234)');
      return;
    }

    const updatedBank = {
      ...bankAccount,
      confirmAccountNumber: accountNumber,
      ifscCode: ifscCode.toUpperCase()
    };

    localStorage.setItem('vendorBankAccount', JSON.stringify(updatedBank));
    setBankAccount(updatedBank);
    setIsBankSaved(true);
    setShowBankForm(false);
    toast.success('Bank details verified & saved successfully');
  };

  const handleSubmit = async () => {
    const numAmount = parseInt(amount) || 0;
    if (!amount || numAmount === 0 || error) return;
    if (!isBankSaved) {
      toast.error('Please add bank details');
      return;
    }

    try {
      setLoading(true);
      await requestWithdrawal({
        amount: numAmount,
        bankDetails: bankAccount
      });
      toast.success('Request sent successfully!');
      window.dispatchEvent(new Event('vendorWalletUpdated'));
      navigate('/vendor/wallet');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  const tdsRate = 1; // Statutory TDS (1%)
  const platformFeeRate = vendorStats.platformFeeRate || 1; // Platform Fee (1%)

  const grossAmount = parseInt(amount) || 0;
  const platformFeeAmount = Math.round(grossAmount * (platformFeeRate / 100));
  const tdsAmount = Math.round(grossAmount * (tdsRate / 100));
  const netAmount = grossAmount - platformFeeAmount - tdsAmount;

  return (
    <AnimatePresence mode="wait">
      {(!wallet.available && !history.length) ? (
        <LogoLoader key="loader" fullScreen overlay />
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="min-h-screen bg-gray-50 pb-28 relative"
        >
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-gray-100 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-gray-50 shadow-sm border border-gray-100 flex items-center justify-center text-gray-700"
          >
            <FiArrowRight className="w-5 h-5 rotate-180" />
          </motion.button>
          <h1 className="text-xl font-medium text-gray-900 tracking-tight">Redeem Assets</h1>
        </div>
        <div className="w-10 h-10 bg-gray-50 rounded-xl shadow-sm border border-gray-100 flex items-center justify-center">
          <FiActivity className="w-5 h-5 text-blue-600" />
        </div>
      </header>

      <main className="px-5 pt-6 relative z-10 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column: Balance & Input */}
          <div className="space-y-5">
            {/* Compact Premium Balance Card */}
            <div
              className="rounded-2xl p-6 shadow-lg shadow-blue-500/5 relative overflow-hidden group"
              style={{ background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
            >
              <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-1000" />

              <div className="relative z-10 flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-[9px] font-medium text-blue-50 capitalize tracking-[0.2em] mb-1 opacity-80">Redeemable Liquidity</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-lg font-medium text-blue-100">₹</span>
                    <h2 className="text-3xl font-medium text-white tracking-tighter leading-none">{wallet.available.toLocaleString()}</h2>
                  </div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                  <FiDollarSign className="w-6 h-6" />
                </div>
              </div>

              <div className="relative z-10 mt-4 pt-4 border-t border-white/10 flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-[8px] font-medium text-blue-50 capitalize tracking-widest opacity-80">Assets Verified & Transferrable</p>
              </div>
            </div>

            {/* Amount Input Section */}
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[9px] font-medium text-gray-400 capitalize tracking-[0.3em]">Settlement Value</h3>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleMaxAmount}
                  className="text-[8px] font-medium text-blue-600 px-4 py-1.5 rounded-lg bg-blue-50 active:scale-95 transition-all capitalize tracking-widest border border-blue-100"
                >
                  Maximum
                </motion.button>
              </div>

              <div className="relative mb-6">
                <div className="absolute top-1/2 left-0 -translate-y-1/2 text-gray-200 font-medium text-3xl">₹</div>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0"
                  className={`w-full pl-10 pr-2 py-2 bg-transparent border-b-2 border-dashed ${error ? 'border-red-500 text-red-500' : 'border-gray-100 focus:border-blue-500'
                    } text-5xl font-medium text-right focus:outline-none transition-all text-gray-900 placeholder:text-gray-200 tracking-tighter`}
                />
              </div>

              {error && (
                <div className="bg-red-50 rounded-xl p-4 flex items-center gap-3 mb-6 border border-red-100">
                  <FiAlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <p className="text-red-500 text-[9px] font-medium capitalize tracking-widest leading-relaxed">
                    {error}
                  </p>
                </div>
              )}

              {amount && !error && (
                <div className="bg-gray-50 rounded-xl p-5 space-y-3 border border-gray-100">
                  <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                    <span>Requested Amount</span>
                    <span className="text-gray-900">₹{grossAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-medium text-gray-500">
                    <span>Platform Charge ({platformFeeRate}%)</span>
                    <span className="text-red-500 font-bold">-₹{platformFeeAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs font-medium text-gray-500">
                    <span>Statutory TDS (1%)</span>
                    <span className="text-red-500 font-bold">-₹{tdsAmount.toLocaleString()}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-200 flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">Final Net Payout</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-emerald-600">₹</span>
                      <span className="text-2xl font-black text-emerald-600 tracking-tight">{netAmount.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Bank Details & Action */}
          <div className="space-y-5">
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 border border-gray-100 shadow-inner">
                    <FiCreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-[10px] font-medium text-gray-900 capitalize tracking-[0.2em]">Destination Path</h3>
                    <p className="text-[8px] font-medium text-gray-400 capitalize tracking-widest mt-1">Authorized Institution</p>
                  </div>
                </div>
                {isBankSaved && !showBankForm && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowBankForm(true)}
                    className="text-[9px] font-medium text-blue-600 capitalize tracking-widest flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 transition-all hover:bg-blue-100 border border-blue-100"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" /> Update
                  </motion.button>
                )}
              </div>

              {!isBankSaved || showBankForm ? (
                <div className="space-y-5">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider ml-1">Account Holder Name</label>
                      <input
                        type="text"
                        name="accountHolderName"
                        value={bankAccount.accountHolderName}
                        onChange={handleBankInputChange}
                        className="w-full px-5 py-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm font-bold text-gray-900 transition-all placeholder:text-gray-400"
                        placeholder="Full Name as per Bank Account"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider ml-1 flex items-center justify-between">
                          <span>Bank Name</span>
                          {fetchingIfsc && <span className="text-[9px] text-blue-600 font-normal animate-pulse">Auto-fetching...</span>}
                        </label>
                        <input
                          type="text"
                          name="bankName"
                          value={bankAccount.bankName}
                          onChange={handleBankInputChange}
                          className="w-full px-5 py-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm font-bold text-gray-900 transition-all placeholder:text-gray-400"
                          placeholder="e.g. HDFC Bank, SBI"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider ml-1">IFSC Code</label>
                        <div className="relative">
                          <input
                            type="text"
                            name="ifscCode"
                            value={bankAccount.ifscCode}
                            onChange={handleBankInputChange}
                            className="w-full px-5 py-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-sm font-bold text-gray-900 uppercase tracking-widest transition-all placeholder:text-gray-400"
                            placeholder="e.g. SBIN0001234"
                            maxLength={11}
                          />
                          {fetchingIfsc && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider ml-1">Account Number (9-18 digits)</label>
                      <input
                        type="text"
                        name="accountNumber"
                        value={bankAccount.accountNumber}
                        onChange={handleBankInputChange}
                        className="w-full px-5 py-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-base font-black text-gray-900 tracking-widest transition-all placeholder:text-gray-400"
                        placeholder="Enter Bank Account Number"
                        maxLength={18}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider ml-1">Confirm Account Number</label>
                      <input
                        type="text"
                        name="confirmAccountNumber"
                        value={bankAccount.confirmAccountNumber || ''}
                        onChange={handleBankInputChange}
                        className="w-full px-5 py-3.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-blue-500 outline-none text-base font-black text-gray-900 tracking-widest transition-all placeholder:text-gray-400"
                        placeholder="Re-enter Bank Account Number"
                        maxLength={18}
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={saveBankDetails}
                    className="w-full py-4.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20 active:scale-95 transition-all"
                  >
                    Save & Authenticate Bank Details
                  </motion.button>
                </div>
              ) : (
                <div
                  className="bg-gray-50 rounded-2xl p-6 border border-gray-100 flex flex-col gap-6 group cursor-pointer hover:bg-gray-100 transition-all shadow-inner"
                  onClick={() => setShowBankForm(true)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[8px] text-gray-400 font-medium capitalize tracking-[0.3em] mb-1.5">Primary Asset Destination</p>
                      <p className="font-medium text-gray-900 text-sm capitalize tracking-[0.2em]">{bankAccount.bankName}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                      <FiCheckCircle className="w-5 h-5" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[8px] text-gray-400 font-medium capitalize tracking-[0.3em] mb-2">Verified Settlement Path</p>
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-200" />)}
                      </div>
                      <p className="font-medium text-gray-900 text-xl tracking-[0.3em]">
                        {bankAccount.accountNumber?.slice(-4)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Final Execution Button */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={!amount || !!error || !isBankSaved || loading}
              className="w-full py-6 rounded-2xl font-medium text-white text-[10px] capitalize tracking-[0.35em] flex items-center justify-center gap-4 transition-all active:scale-95 disabled:opacity-50 bg-blue-600 shadow-xl shadow-blue-900/40 group relative overflow-hidden"
            >
              {loading ? (
                <div className="w-5 h-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Deploy Asset Settlement
                  <FiArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                </>
              )}
            </motion.button>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 px-10">
          <FiClock className="w-4 h-4 text-gray-300" />
          <p className="text-center text-[8px] text-gray-400 font-medium capitalize tracking-[0.2em] leading-relaxed">
            Secure processing timeline: 24-48 business hours.<br />
            Digital receipt will be issued post-verification.
          </p>
        </div>
      </main>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default WithdrawalRequest;
