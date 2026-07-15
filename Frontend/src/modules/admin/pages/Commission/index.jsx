import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiDollarSign, FiSave, FiAlertCircle, FiCheckCircle, FiInfo, FiTrendingUp } from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import CardShell from '../UserCategories/components/CardShell';
import adminVendorService from '../../../../services/adminVendorService';
import api from '../../../../services/api';

const CommissionSettings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    commissionRates: {
      level1: 10,
      level2: 15,
      level3: 20
    },
    platformFeeRates: {
      level1: 0.5,
      level2: 1.0,
      level3: 2.0
    },
    tdsPercentage: 1
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/settings');
      if (response.data.success) {
        const s = response.data.settings;
        setSettings({
          commissionRates: s.commissionRates || { level1: 10, level2: 15, level3: 20 },
          platformFeeRates: s.platformFeeRates || { level1: 0.5, level2: 1.0, level3: 2.0 },
          tdsPercentage: s.tdsPercentage || 1
        });
      }
    } catch (error) {
      console.error('Error fetching commission settings:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRateChange = (category, level, value) => {
    const numValue = parseFloat(value) || 0;
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [level]: numValue < 0 ? 0 : numValue
      }
    }));
  };

  const handleTdsChange = (value) => {
    const numValue = parseFloat(value) || 0;
    setSettings(prev => ({
      ...prev,
      tdsPercentage: numValue < 0 ? 0 : numValue
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await api.put('/admin/settings', settings);
      if (response.data.success) {
        toast.success('Commission rates updated successfully!');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <CardShell
        icon={FiDollarSign}
        title="Commission & Fee Management"
        subtitle="Configure level-based commission and platform fees"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Job Commission Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <FiTrendingUp className="text-blue-600" />
              <h3 className="font-bold text-gray-800">Job Commission (%)</h3>
            </div>
            <p className="text-xs text-gray-500 italic">
              Percentage deducted from the gross service amount.
            </p>

            <div className="space-y-4">
              {[1, 2, 3].map(level => (
                <div key={level} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex flex-col">
                    <span className="font-bold text-gray-700">Level {level} Vendor</span>
                    <span className="text-[10px] text-gray-400 font-medium">
                      {level === 1 ? 'Top Performing' : level === 2 ? 'Intermediate' : 'New / Low Rating'}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={settings.commissionRates[`level${level}`]}
                      onChange={(e) => handleRateChange('commissionRates', `level${level}`, e.target.value)}
                      className="w-24 pl-4 pr-8 py-2 bg-white border border-gray-200 rounded-lg font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Platform Fees & TDS Section */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
              <FiDollarSign className="text-emerald-600" />
              <h3 className="font-bold text-gray-800">Platform & Tax (%)</h3>
            </div>
            <p className="text-xs text-gray-500 italic">
              Fees applied during the withdrawal process.
            </p>

            <div className="space-y-4">
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-bold text-emerald-800">TDS Deduction</span>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={settings.tdsPercentage}
                      onChange={(e) => handleTdsChange(e.target.value)}
                      className="w-24 pl-4 pr-8 py-2 bg-white border border-emerald-200 rounded-lg font-bold text-emerald-800 focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">%</span>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-600 font-medium">Standard TDS as per Section 194-O (usually 1%).</p>
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Platform Payout Fee</h4>
                {[1, 2, 3].map(level => (
                  <div key={level} className="flex items-center justify-between bg-blue-50/30 p-3 rounded-lg border border-blue-100">
                    <span className="text-xs font-bold text-gray-600">Level {level} Fee</span>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={settings.platformFeeRates[`level${level}`]}
                        onChange={(e) => handleRateChange('platformFeeRates', `level${level}`, e.target.value)}
                        className="w-20 pl-3 pr-7 py-1.5 bg-white border border-blue-100 rounded-md font-bold text-blue-700 focus:outline-none text-xs"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-300 font-bold text-[10px]">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <FiAlertCircle className="w-4 h-4" />
              <span className="text-xs font-bold italic">Important Notice</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              Updating these rates will immediately affect all **Withdrawal Calculations** for vendors. 
              Job commissions will be applied to all **New Work Completion** bills generated after this change.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className={`px-8 py-4 bg-gray-900 text-white rounded-xl font-bold flex items-center gap-2 shadow-xl hover:shadow-2xl transition-all active:scale-95 ${saving ? 'opacity-50' : ''}`}
          >
            {saving ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <FiSave className="w-5 h-5" />
            )}
            Save Configuration
          </button>
        </div>
      </CardShell>

      {/* Info Card */}
      <div className="bg-white rounded-2xl p-6 border border-blue-100 shadow-sm flex gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          <FiInfo className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 mb-1">How Level-based Commission works?</h3>
          <p className="text-xs text-gray-500 leading-relaxed">
            The platform rewards top-performing vendors with lower commission rates. 
            Level 1 vendors (Score &gt; 80%) usually pay the least, while Level 3 vendors pay standard rates.
            Deductions for **Online Payments** are calculated at the time of withdrawal, while **Cash Jobs** commissions are added to vendor's payable dues.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CommissionSettings;
