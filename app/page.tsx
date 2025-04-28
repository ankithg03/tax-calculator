"use client";

import { useState } from "react";
import { usePDF } from "react-to-pdf";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

type TaxSlab = {
  min: number;
  max: number;
  rate: number;
  fixedAmount?: number;
  surcharge?: number;
};

const NEW_REGIME_SLABS: TaxSlab[] = [
  { min: 0, max: 400000, rate: 0 },
  { min: 400001, max: 800000, rate: 5 },
  { min: 800001, max: 1200000, rate: 10 },
  { min: 1200001, max: 1600000, rate: 15 },
  { min: 1600001, max: 2000000, rate: 20 },
  { min: 2000001, max: 2400000, rate: 25 },
  { min: 2400001, max: Infinity, rate: 30 }
];

const OLD_REGIME_SLABS: TaxSlab[] = [
  { min: 0, max: 300000, rate: 0 },
  { min: 300001, max: 700000, rate: 5 },
  { min: 700001, max: 1000000, rate: 10 },
  { min: 1000001, max: 1200000, rate: 15 },
  { min: 1200001, max: 1500000, rate: 20 },
  { min: 1500001, max: Infinity, rate: 30 }
];

const STANDARD_DEDUCTION = 75000; // For New Regime
const OLD_REGIME_STANDARD_DEDUCTION = 50000; // For Old Regime
const SECTION_80C_LIMIT = 150000;
const SECTION_80CCD_LIMIT = 50000;
const SECTION_80TTA_LIMIT = 10000;
const SECTION_80G_LIMIT = 100000;

export default function Home() {
  const { toPDF, targetRef } = usePDF({ filename: "tax-calculation-report.pdf" });
  const [income, setIncome] = useState<number>(0);
  const [age, setAge] = useState<string>("below60");
  const [salaryDetails, setSalaryDetails] = useState({
    basic: 0,
    hraReceived: 0,
    rentPaid: 0,
    metroCity: false,
  });
  const [deductions, setDeductions] = useState({
    section80C: 0,
    section80D: {
      self: 0,
      parents: 0,
      parentsSenior: false
    },
    section80CCD: 0,
    section80TTA: 0,
    section80G: 0,
    hra: 0,
    nps: 0,
    educationLoan: 0,
    homeLoan: {
      principal: 0,
      interest: 0,
    },
  });
  const [newRegimeTax, setNewRegimeTax] = useState<number>(0);
  const [oldRegimeTax, setOldRegimeTax] = useState<number>(0);

  // Calculate HRA exemption based on three rules
  const calculateHRA = () => {
    const { basic, hraReceived, rentPaid, metroCity } = salaryDetails;
    
    // Rule 1: Actual HRA received
    const rule1 = hraReceived;
    
    // Rule 2: 50% of basic salary for metro cities, 40% for non-metro
    const rule2 = (metroCity ? 0.5 : 0.4) * basic;
    
    // Rule 3: Rent paid minus 10% of basic salary
    const rule3 = Math.max(0, rentPaid - (0.1 * basic));
    
    // HRA exemption is the least of the three rules
    return Math.min(rule1, rule2, rule3);
  };

  // Calculate home loan deductions (principal and interest)
  const calculateHomeLoanDeductions = () => {
    const { principal, interest } = deductions.homeLoan;
    
    // Principal repayment is part of 80C (max 1.5L)
    const principalDeduction = Math.min(principal, SECTION_80C_LIMIT - deductions.section80C);
    
    // Interest deduction (max 2L)
    const interestDeduction = Math.min(interest, 200000);
    
    return {
      principal: principalDeduction,
      interest: interestDeduction,
      total: principalDeduction + interestDeduction
    };
  };

  // Calculate tax based on income and tax slabs
  const calculateTax = (income: number, slabs: typeof NEW_REGIME_SLABS | typeof OLD_REGIME_SLABS) => {
    let totalTax = 0;
    let remainingIncome = income;

    for (const slab of slabs) {
      if (remainingIncome <= 0) break;

      const taxableAmount = Math.min(
        remainingIncome,
        slab.max === Infinity ? remainingIncome : slab.max - slab.min + 1
      );
      
      // Calculate base tax
      const baseTax = slab.fixedAmount || 0;
      const rateTax = (taxableAmount * slab.rate) / 100;
      totalTax += baseTax + rateTax;
      
      // Apply surcharge if applicable
      if ('surcharge' in slab && slab.surcharge) {
        const surchargeAmount = (totalTax * slab.surcharge) / 100;
        totalTax += surchargeAmount;
      }
      
      remainingIncome -= taxableAmount;
    }

    return totalTax;
  };

  // Calculate tax under old regime with all applicable deductions
  const calculateOldRegimeTax = (income: number) => {
    const hraExemption = calculateHRA();
    const homeLoanDeductions = calculateHomeLoanDeductions();
    
    // Calculate Section 80D deduction with proper limits
    const selfAndFamilyLimit = 25000;
    const parentsLimit = deductions.section80D.parentsSenior ? 50000 : 25000;
    const total80DLimit = selfAndFamilyLimit + parentsLimit;
    
    const section80DDeduction = Math.min(
      total80DLimit,
      deductions.section80D.self + deductions.section80D.parents
    );
    
    // Calculate taxable income after all deductions
    const taxableIncome = Math.max(
      0,
      income - 
      OLD_REGIME_STANDARD_DEDUCTION - 
      Math.min(deductions.section80C + homeLoanDeductions.principal, SECTION_80C_LIMIT) - 
      section80DDeduction - 
      Math.min(deductions.section80CCD, SECTION_80CCD_LIMIT) - 
      Math.min(deductions.section80TTA, SECTION_80TTA_LIMIT) - 
      Math.min(deductions.section80G, SECTION_80G_LIMIT) - 
      hraExemption - 
      deductions.nps - 
      deductions.educationLoan - 
      homeLoanDeductions.interest
    );
    return calculateTax(taxableIncome, OLD_REGIME_SLABS);
  };

  // Handle income change and update tax calculations
  const handleIncomeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setIncome(0);
      setNewRegimeTax(0);
      setOldRegimeTax(0);
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setIncome(numValue);
        setNewRegimeTax(calculateTax(numValue, NEW_REGIME_SLABS));
        setOldRegimeTax(calculateOldRegimeTax(numValue));
      }
    }
  };

  // Handle salary detail changes and update HRA calculation
  const handleSalaryDetailChange = (key: keyof typeof salaryDetails, value: string | boolean) => {
    if (typeof value === 'boolean') {
      setSalaryDetails(prev => ({
        ...prev,
        [key]: value
      }));
    } else {
      if (value === '') {
        setSalaryDetails(prev => ({
          ...prev,
          [key]: 0
        }));
      } else {
        const numValue = parseFloat(value);
        if (!isNaN(numValue)) {
          setSalaryDetails(prev => ({
            ...prev,
            [key]: numValue
          }));
        }
      }
    }
    setOldRegimeTax(calculateOldRegimeTax(income));
  };

  // Handle deduction changes and update tax calculations
  const handleDeductionChange = (key: keyof typeof deductions, value: string) => {
    if (value === '') {
      setDeductions(prev => ({
        ...prev,
        [key]: 0
      }));
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setDeductions(prev => ({
          ...prev,
          [key]: numValue
        }));
      }
    }
    setOldRegimeTax(calculateOldRegimeTax(income));
  };

  // Handle home loan changes and update deductions
  const handleHomeLoanChange = (type: 'principal' | 'interest', value: string) => {
    if (value === '') {
      setDeductions(prev => ({
        ...prev,
        homeLoan: {
          ...prev.homeLoan,
          [type]: 0
        }
      }));
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setDeductions(prev => ({
          ...prev,
          homeLoan: {
            ...prev.homeLoan,
            [type]: numValue
          }
        }));
      }
    }
    setOldRegimeTax(calculateOldRegimeTax(income));
  };

  // Handle health insurance changes and update Section 80D deduction
  const handleHealthInsuranceChange = (type: 'self' | 'parents', value: string) => {
    if (value === '') {
      setDeductions(prev => ({
        ...prev,
        section80D: {
          ...prev.section80D,
          [type]: 0
        }
      }));
    } else {
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        setDeductions(prev => ({
          ...prev,
          section80D: {
            ...prev.section80D,
            [type]: numValue
          }
        }));
      }
    }
    setOldRegimeTax(calculateOldRegimeTax(income));
  };

  // Handle senior citizen status change for parents
  const handleParentsSeniorChange = (checked: boolean) => {
    setDeductions(prev => ({
      ...prev,
      section80D: {
        ...prev.section80D,
        parentsSenior: checked
      }
    }));
    setOldRegimeTax(calculateOldRegimeTax(income));
  };

  const formatDate = () => {
    const now = new Date();
    return now.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const getTaxDistribution = () => {
    return [
      { name: 'New Regime Tax', value: newRegimeTax },
      { name: 'Old Regime Tax', value: oldRegimeTax }
    ];
  };

  const getTaxSlabData = () => {
    const newRegimeData = NEW_REGIME_SLABS.map(slab => ({
      name: slab.min === 0 ? 'Up to ₹4L' : 
            slab.max === Infinity ? 'Above ₹24L' : 
            `₹${(slab.min/100000).toFixed(1)}L-₹${(slab.max/100000).toFixed(1)}L`,
      rate: slab.rate
    }));

    const oldRegimeData = OLD_REGIME_SLABS.map(slab => ({
      name: slab.min === 0 ? 'Up to ₹2.5L' : 
            slab.max === Infinity ? 'Above ₹10L' : 
            `₹${(slab.min/100000).toFixed(1)}L-₹${(slab.max/100000).toFixed(1)}L`,
      rate: slab.rate
    }));

    return { newRegimeData, oldRegimeData };
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];


  return (
    <div className="min-h-screen bg-[#ffffff] text-[#0f1419] p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-[#e5e5e5]">
          <div className="bg-[#1d9bf0] p-6 text-white">
            <h1 className="text-xl md:text-2xl font-bold text-center tracking-tight">
              Income Tax Calculator FY 2025-26
            </h1>
          </div>
          
          <div className="p-4 md:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Annual Income */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <label className="block text-[#536471] text-sm font-medium mb-2">
                  Annual Income (₹)
                </label>
                <input
                  type="text"
                  value={income || ''}
                  onChange={handleIncomeChange}
                  className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                  placeholder="Enter your annual income"
                />
              </div>

              {/* Age Group */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <label className="block text-[#536471] text-sm font-medium mb-2">
                  Age Group
                </label>
                <select
                  value={age}
                  onChange={(e) => {
                    setAge(e.target.value);
                    setOldRegimeTax(calculateOldRegimeTax(income));
                  }}
                  className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                >
                  <option value="below60">Below 60 years</option>
                  <option value="60to79">60 to 79 years</option>
                  <option value="above80">80 years and above</option>
                </select>
              </div>

              {/* Salary Details for HRA */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5] md:col-span-2">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">Salary Details for HRA Calculation</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      Basic Salary (₹ per month)
                    </label>
                    <input
                      type="text"
                      value={salaryDetails.basic || ''}
                      onChange={(e) => handleSalaryDetailChange('basic', e.target.value)}
                      onBlur={(e) => handleSalaryDetailChange('basic', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter basic salary"
                    />
                  </div>
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      HRA Received (₹ per month)
                    </label>
                    <input
                      type="text"
                      value={salaryDetails.hraReceived || ''}
                      onChange={(e) => handleSalaryDetailChange('hraReceived', e.target.value)}
                      onBlur={(e) => handleSalaryDetailChange('hraReceived', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter HRA received"
                    />
                  </div>
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      Monthly Rent Paid (₹)
                    </label>
                    <input
                      type="text"
                      value={salaryDetails.rentPaid || ''}
                      onChange={(e) => handleSalaryDetailChange('rentPaid', e.target.value)}
                      onBlur={(e) => handleSalaryDetailChange('rentPaid', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter monthly rent"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={salaryDetails.metroCity}
                      onChange={(e) => handleSalaryDetailChange('metroCity', e.target.checked)}
                      className="w-5 h-5 text-[#1d9bf0] border-[#e5e5e5] rounded focus:ring-[#1d9bf0]"
                    />
                    <span className="text-[#536471] text-sm">Living in Metro City (Delhi, Mumbai, Kolkata, or Chennai)</span>
                  </label>
                </div>
              </div>

              {/* Home Loan Details */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">Home Loan Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      Principal Repayment (₹)
                    </label>
                    <input
                      type="text"
                      value={deductions.homeLoan.principal || ''}
                      onChange={(e) => handleHomeLoanChange('principal', e.target.value)}
                      onBlur={(e) => handleHomeLoanChange('principal', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter principal amount"
                    />
                  </div>
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      Interest Payment (₹)
                    </label>
                    <input
                      type="text"
                      value={deductions.homeLoan.interest || ''}
                      onChange={(e) => handleHomeLoanChange('interest', e.target.value)}
                      onBlur={(e) => handleHomeLoanChange('interest', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter interest amount"
                    />
                  </div>
                </div>
              </div>

              {/* Section 80C */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">Section 80C Investments</h2>
                <div>
                  <label className="block text-[#536471] text-sm font-medium mb-2">
                    Total 80C Investments (₹)
                  </label>
                  <input
                    type="text"
                    value={deductions.section80C || ''}
                    onChange={(e) => handleDeductionChange('section80C', e.target.value)}
                    onBlur={(e) => handleDeductionChange('section80C', e.target.value || '0')}
                    className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                    placeholder="Enter 80C investments"
                  />
                  <div className="mt-2 text-sm text-[#536471]">
                    <p>Maximum Deduction: ₹1,50,000</p>
                    <p>Eligible Investments:</p>
                    <ul className="list-disc ml-4 mt-1">
                      <li>PPF (Public Provident Fund)</li>
                      <li>ELSS (Equity Linked Savings Scheme)</li>
                      <li>Life Insurance Premium</li>
                      <li>NSC (National Savings Certificate)</li>
                      <li>5-year Bank FD</li>
                      <li className="font-medium text-[#1d9bf0]">Home Loan Principal Repayment</li>
                    </ul>
                  </div>
                  {(deductions.section80C > 0 || deductions.homeLoan.principal > 0) && (
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="p-3 bg-[#f7f9f9] rounded-xl border border-[#e5e5e5]">
                        <p className="font-medium text-[#0f1419]">Section 80C Breakdown:</p>
                        <div className="mt-2 space-y-1">
                          {deductions.section80C > 0 && (
                            <div className="flex justify-between">
                              <span>Other 80C Investments:</span>
                              <span>₹{deductions.section80C.toLocaleString()}</span>
                            </div>
                          )}
                          {deductions.homeLoan.principal > 0 && (
                            <div className="flex justify-between">
                              <span className="text-[#1d9bf0]">Home Loan Principal:</span>
                              <span className="text-[#1d9bf0]">₹{deductions.homeLoan.principal.toLocaleString()}</span>
                            </div>
                          )}
                          <div className="border-t border-[#e5e5e5] my-1"></div>
                          <div className="flex justify-between font-medium">
                            <span>Total 80C Amount:</span>
                            <span>₹{(deductions.section80C + deductions.homeLoan.principal).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Maximum Limit:</span>
                            <span>₹{SECTION_80C_LIMIT.toLocaleString()}</span>
                          </div>
                          <div className="border-t border-[#e5e5e5] my-1"></div>
                          <div className="flex justify-between font-medium text-[#1d9bf0]">
                            <span>Eligible Deduction:</span>
                            <span>₹{Math.min(deductions.section80C + deductions.homeLoan.principal, SECTION_80C_LIMIT).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      {deductions.section80C + deductions.homeLoan.principal > SECTION_80C_LIMIT && (
                        <p className="text-red-500 text-sm">
                          Note: Only ₹{SECTION_80C_LIMIT.toLocaleString()} will be considered for deduction as it exceeds the maximum limit
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Section 80D */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">Section 80D - Health Insurance</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      Self & Family Premium (₹)
                    </label>
                    <input
                      type="text"
                      value={deductions.section80D.self || ''}
                      onChange={(e) => handleHealthInsuranceChange('self', e.target.value)}
                      onBlur={(e) => handleHealthInsuranceChange('self', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter premium amount"
                    />
                    <div className="mt-2 text-sm text-[#536471]">
                      <p>Maximum Deduction: ₹25,000</p>
                      <p>Additional ₹5,000 for preventive health check-up</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      Parents Premium (₹)
                    </label>
                    <input
                      type="text"
                      value={deductions.section80D.parents || ''}
                      onChange={(e) => handleHealthInsuranceChange('parents', e.target.value)}
                      onBlur={(e) => handleHealthInsuranceChange('parents', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter premium amount"
                    />
                    <div className="mt-2 text-sm text-[#536471]">
                      <p>Maximum Deduction: ₹25,000 (₹50,000 if senior citizens)</p>
                      <p>Additional ₹5,000 for preventive health check-up</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={deductions.section80D.parentsSenior}
                      onChange={(e) => handleParentsSeniorChange(e.target.checked)}
                      className="w-5 h-5 text-[#1d9bf0] border-[#e5e5e5] rounded focus:ring-[#1d9bf0]"
                    />
                    <span className="text-[#536471] text-sm">Parents are Senior Citizens (60+ years)</span>
                  </div>
                </div>
              </div>

              {/* HRA Calculation */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5] md:col-span-2">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">HRA Exemption Calculation</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      Basic Salary (₹ per month)
                    </label>
                    <input
                      type="text"
                      value={salaryDetails.basic || ''}
                      onChange={(e) => handleSalaryDetailChange('basic', e.target.value)}
                      onBlur={(e) => handleSalaryDetailChange('basic', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter basic salary"
                    />
                  </div>
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      HRA Received (₹ per month)
                    </label>
                    <input
                      type="text"
                      value={salaryDetails.hraReceived || ''}
                      onChange={(e) => handleSalaryDetailChange('hraReceived', e.target.value)}
                      onBlur={(e) => handleSalaryDetailChange('hraReceived', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter HRA received"
                    />
                  </div>
                  <div>
                    <label className="block text-[#536471] text-sm font-medium mb-2">
                      Monthly Rent Paid (₹)
                    </label>
                    <input
                      type="text"
                      value={salaryDetails.rentPaid || ''}
                      onChange={(e) => handleSalaryDetailChange('rentPaid', e.target.value)}
                      onBlur={(e) => handleSalaryDetailChange('rentPaid', e.target.value || '0')}
                      className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                      placeholder="Enter monthly rent"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={salaryDetails.metroCity}
                      onChange={(e) => handleSalaryDetailChange('metroCity', e.target.checked)}
                      className="w-5 h-5 text-[#1d9bf0] border-[#e5e5e5] rounded focus:ring-[#1d9bf0]"
                    />
                    <span className="text-[#536471] text-sm">Living in Metro City (Delhi, Mumbai, Kolkata, or Chennai)</span>
                  </label>
                </div>
                {salaryDetails.basic > 0 && (
                  <div className="mt-4 space-y-2 text-sm text-[#536471]">
                    <h3 className="font-medium text-[#0f1419]">HRA Exemption Calculation:</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 bg-[#f7f9f9] rounded-xl border border-[#e5e5e5]">
                        <p className="font-medium">Rule 1: Actual HRA Received</p>
                        <p>₹{(salaryDetails.hraReceived * 12).toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-[#f7f9f9] rounded-xl border border-[#e5e5e5]">
                        <p className="font-medium">Rule 2: {salaryDetails.metroCity ? '50%' : '40%'} of Basic Salary</p>
                        <p>₹{((salaryDetails.metroCity ? 0.5 : 0.4) * salaryDetails.basic * 12).toLocaleString()}</p>
                      </div>
                      <div className="p-3 bg-[#f7f9f9] rounded-xl border border-[#e5e5e5]">
                        <p className="font-medium">Rule 3: Rent Paid - 10% of Basic</p>
                        <p>₹{(Math.max(0, salaryDetails.rentPaid * 12 - (0.1 * salaryDetails.basic * 12))).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-2 p-3 bg-[#e8f5fd] rounded-xl">
                      <p className="font-medium text-[#1d9bf0]">Eligible HRA Exemption:</p>
                      <p className="text-lg font-semibold">₹{calculateHRA().toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Section 80CCD */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">Section 80CCD - NPS</h2>
                <div>
                  <label className="block text-[#536471] text-sm font-medium mb-2">
                    NPS Contribution (₹)
                  </label>
                  <input
                    type="text"
                    value={deductions.section80CCD || ''}
                    onChange={(e) => handleDeductionChange('section80CCD', e.target.value)}
                    onBlur={(e) => handleDeductionChange('section80CCD', e.target.value || '0')}
                    className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                    placeholder="Enter NPS amount"
                  />
                </div>
              </div>

              {/* Section 80TTA */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">Section 80TTA - Savings Interest</h2>
                <div>
                  <label className="block text-[#536471] text-sm font-medium mb-2">
                    Savings Account Interest (₹)
                  </label>
                  <input
                    type="text"
                    value={deductions.section80TTA || ''}
                    onChange={(e) => handleDeductionChange('section80TTA', e.target.value)}
                    onBlur={(e) => handleDeductionChange('section80TTA', e.target.value || '0')}
                    className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                    placeholder="Enter interest amount"
                  />
                </div>
              </div>

              {/* Section 80G */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">Section 80G - Donations</h2>
                <div>
                  <label className="block text-[#536471] text-sm font-medium mb-2">
                    Charitable Donations (₹)
                  </label>
                  <input
                    type="text"
                    value={deductions.section80G || ''}
                    onChange={(e) => handleDeductionChange('section80G', e.target.value)}
                    onBlur={(e) => handleDeductionChange('section80G', e.target.value || '0')}
                    className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                    placeholder="Enter donation amount"
                  />
                </div>
              </div>

              {/* Education Loan */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">Education Loan Interest</h2>
                <div>
                  <label className="block text-[#536471] text-sm font-medium mb-2">
                    Education Loan Interest (₹)
                  </label>
                  <input
                    type="text"
                    value={deductions.educationLoan || ''}
                    onChange={(e) => handleDeductionChange('educationLoan', e.target.value)}
                    onBlur={(e) => handleDeductionChange('educationLoan', e.target.value || '0')}
                    className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                    placeholder="Enter interest amount"
                  />
                </div>
              </div>

              {/* Additional NPS */}
              <div className="bg-white rounded-2xl shadow-sm p-4 border border-[#e5e5e5]">
                <h2 className="text-lg font-semibold mb-3 text-[#0f1419]">Additional NPS Contribution</h2>
                <div>
                  <label className="block text-[#536471] text-sm font-medium mb-2">
                    Additional NPS Amount (₹)
                  </label>
                  <input
                    type="text"
                    value={deductions.nps || ''}
                    onChange={(e) => handleDeductionChange('nps', e.target.value)}
                    onBlur={(e) => handleDeductionChange('nps', e.target.value || '0')}
                    className="w-full px-4 py-3 bg-white border-2 border-[#e5e5e5] rounded-xl focus:outline-none focus:border-[#1d9bf0] focus:ring-1 focus:ring-[#1d9bf0] transition-all text-[#0f1419]"
                    placeholder="Enter additional NPS amount"
                  />
                </div>
              </div>
            </div>

            <div ref={targetRef} className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border border-[#e5e5e5]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg md:text-xl font-semibold text-[#0f1419]">Tax Calculation</h2>
                <button
                  onClick={() => toPDF()}
                  className="px-4 py-2 bg-[#1d9bf0] text-white rounded-lg hover:bg-[#1a8cd8] transition-all font-medium flex items-center space-x-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  <span>Export Report</span>
                </button>
              </div>

              <div className="space-y-4">
                <div className="text-sm text-[#536471] mb-4">
                  Generated on: {formatDate()}
                </div>

                <div className="flex justify-between items-center p-4 bg-[#f7f9f9] rounded-xl border border-[#e5e5e5]">
                  <span className="text-[#536471]">Annual Income:</span>
                  <span className="font-semibold text-[#0f1419]">₹{income.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-[#f7f9f9] rounded-xl border border-[#e5e5e5]">
                  <span className="text-[#536471]">Total Deductions (Old Regime):</span>
                  <span className="font-semibold text-[#0f1419]">₹{(
                    OLD_REGIME_STANDARD_DEDUCTION + 
                    Math.min(deductions.section80C, SECTION_80C_LIMIT) + 
                    Math.min(
                      deductions.section80D.self + deductions.section80D.parents,
                      (deductions.section80D.parentsSenior ? 75000 : 50000)
                    ) + 
                    Math.min(deductions.section80CCD, SECTION_80CCD_LIMIT) + 
                    Math.min(deductions.section80TTA, SECTION_80TTA_LIMIT) + 
                    Math.min(deductions.section80G, SECTION_80G_LIMIT) + 
                    calculateHRA() + 
                    deductions.nps + 
                    deductions.educationLoan + 
                    Math.min(deductions.homeLoan.interest, 200000)
                  ).toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-[#e8f5fd] rounded-xl">
                  <span className="text-[#536471]">New Regime Tax:</span>
                  <span className="font-semibold text-[#1d9bf0]">₹{newRegimeTax.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-[#e8f5fd] rounded-xl">
                  <span className="text-[#536471]">Old Regime Tax:</span>
                  <span className="font-semibold text-[#1d9bf0]">₹{oldRegimeTax.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-[#e8f5fd] to-[#f0f8ff] rounded-xl">
                  <span className="text-[#536471] font-semibold">Recommended Regime:</span>
                  <span className={`font-bold ${newRegimeTax < oldRegimeTax ? "text-[#00ba7c]" : "text-[#f4212e]"}`}>
                    {newRegimeTax < oldRegimeTax ? "New Regime" : "Old Regime"}
                  </span>
                </div>

                {/* Tax Calculation Explanation */}
                <div className="mt-8 space-y-6">
                  <div className="bg-white rounded-2xl shadow-sm p-6 border border-[#e5e5e5]">
                    <h3 className="text-lg font-semibold text-[#0f1419] mb-4">Tax Calculation Breakdown</h3>
                    
                    {/* New Regime Explanation */}
                    <div className="mb-6">
                      <h4 className="text-md font-semibold text-[#0f1419] mb-3">New Regime Tax Calculation</h4>
                      <div className="space-y-2 text-sm text-[#536471]">
                        <p>1. Annual Income: ₹{income.toLocaleString()}</p>
                        <p>2. Standard Deduction: ₹{STANDARD_DEDUCTION.toLocaleString()}</p>
                        <p>3. Taxable Income: ₹{(income - STANDARD_DEDUCTION).toLocaleString()}</p>
                        <div className="mt-2">
                          <p className="font-medium">Tax Slabs Applied:</p>
                          {NEW_REGIME_SLABS.map((slab, index) => {
                            const taxableAmount = Math.min(
                              Math.max(0, income - STANDARD_DEDUCTION - slab.min),
                              slab.max === Infinity ? income - STANDARD_DEDUCTION - slab.min : slab.max - slab.min
                            );
                            if (taxableAmount > 0) {
                              return (
                                <p key={index} className="ml-4">
                                  {slab.min === 0 ? "Up to ₹4L" : 
                                   slab.max === Infinity ? "Above ₹24L" : 
                                   `₹${(slab.min/100000).toFixed(1)}L-₹${(slab.max/100000).toFixed(1)}L`}: 
                                  ₹{taxableAmount.toLocaleString()} × {slab.rate}% = ₹{(taxableAmount * slab.rate / 100).toLocaleString()}
                                </p>
                              );
                            }
                            return null;
                          })}
                        </div>
                        <p className="mt-2 font-medium">Total New Regime Tax: ₹{newRegimeTax.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Old Regime Explanation */}
                    <div>
                      <h4 className="text-md font-semibold text-[#0f1419] mb-3">Old Regime Tax Calculation</h4>
                      <div className="space-y-2 text-sm text-[#536471]">
                        <p>1. Annual Income: ₹{income.toLocaleString()}</p>
                        <p>2. Standard Deduction: ₹{OLD_REGIME_STANDARD_DEDUCTION.toLocaleString()}</p>
                        <p>3. Section 80C Deduction: ₹{Math.min(deductions.section80C, SECTION_80C_LIMIT).toLocaleString()}</p>
                        <p>4. Section 80D Deduction: ₹{Math.min(
                          deductions.section80D.self + deductions.section80D.parents,
                          (deductions.section80D.parentsSenior ? 75000 : 50000)
                        ).toLocaleString()}</p>
                        <p>5. Section 80CCD Deduction: ₹{Math.min(deductions.section80CCD, SECTION_80CCD_LIMIT).toLocaleString()}</p>
                        <p>6. HRA Exemption: ₹{calculateHRA().toLocaleString()}</p>
                        <p>7. Home Loan Interest: ₹{Math.min(deductions.homeLoan.interest, 200000).toLocaleString()}</p>
                        <p className="mt-2 font-medium">Total Deductions: ₹{(
                          OLD_REGIME_STANDARD_DEDUCTION + 
                          Math.min(deductions.section80C, SECTION_80C_LIMIT) + 
                          Math.min(
                            deductions.section80D.self + deductions.section80D.parents,
                            (deductions.section80D.parentsSenior ? 75000 : 50000)
                          ) + 
                          Math.min(deductions.section80CCD, SECTION_80CCD_LIMIT) + 
                          Math.min(deductions.section80TTA, SECTION_80TTA_LIMIT) + 
                          Math.min(deductions.section80G, SECTION_80G_LIMIT) + 
                          calculateHRA() + 
                          deductions.nps + 
                          deductions.educationLoan + 
                          Math.min(deductions.homeLoan.interest, 200000)
                        ).toLocaleString()}</p>
                        <div className="mt-2">
                          <p className="font-medium">Tax Slabs Applied:</p>
                          {OLD_REGIME_SLABS.map((slab, index) => {
                            const taxableAmount = Math.min(
                              Math.max(0, income - OLD_REGIME_STANDARD_DEDUCTION - 
                                Math.min(deductions.section80C, SECTION_80C_LIMIT) - 
                                Math.min(
                                  deductions.section80D.self + deductions.section80D.parents,
                                  (deductions.section80D.parentsSenior ? 75000 : 50000)
                                ) - 
                                Math.min(deductions.section80CCD, SECTION_80CCD_LIMIT) - 
                                Math.min(deductions.section80TTA, SECTION_80TTA_LIMIT) - 
                                Math.min(deductions.section80G, SECTION_80G_LIMIT) - 
                                calculateHRA() - 
                                deductions.nps - 
                                deductions.educationLoan - 
                                Math.min(deductions.homeLoan.interest, 200000) - slab.min),
                              slab.max === Infinity ? income - OLD_REGIME_STANDARD_DEDUCTION - 
                                Math.min(deductions.section80C, SECTION_80C_LIMIT) - 
                                Math.min(
                                  deductions.section80D.self + deductions.section80D.parents,
                                  (deductions.section80D.parentsSenior ? 75000 : 50000)
                                ) - 
                                Math.min(deductions.section80CCD, SECTION_80CCD_LIMIT) - 
                                Math.min(deductions.section80TTA, SECTION_80TTA_LIMIT) - 
                                Math.min(deductions.section80G, SECTION_80G_LIMIT) - 
                                calculateHRA() - 
                                deductions.nps - 
                                deductions.educationLoan - 
                                Math.min(deductions.homeLoan.interest, 200000) - slab.min : slab.max - slab.min
                            );
                            if (taxableAmount > 0) {
                              return (
                                <p key={index} className="ml-4">
                                  {slab.min === 0 ? "Up to ₹2.5L" : 
                                   slab.max === Infinity ? "Above ₹10L" : 
                                   `₹${(slab.min/100000).toFixed(1)}L-₹${(slab.max/100000).toFixed(1)}L`}: 
                                  ₹{taxableAmount.toLocaleString()} × {slab.rate}% = ₹{(taxableAmount * slab.rate / 100).toLocaleString()}
                                </p>
                              );
                            }
                            return null;
                          })}
                        </div>
                        <p className="mt-2 font-medium">Total Old Regime Tax: ₹{oldRegimeTax.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-[#0f1419] mb-4">Tax Comparison</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: 'New Regime', tax: newRegimeTax },
                            { name: 'Old Regime', tax: oldRegimeTax }
                          ]}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value) => [`₹${value.toLocaleString()}`, 'Tax Amount']}
                            labelFormatter={(label) => `${label} Tax`}
                          />
                          <Bar dataKey="tax" fill="#8884d8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-[#0f1419] mb-4">Tax Distribution</h3>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getTaxDistribution()}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                          >
                            {getTaxDistribution().map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value) => [`₹${value.toLocaleString()}`, 'Tax Amount']}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-semibold text-[#0f1419] mb-4">New Regime Tax Slabs</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={getTaxSlabData().newRegimeData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value) => [`${value}%`, 'Tax Rate']}
                            />
                            <Bar dataKey="rate" fill="#8884d8" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-[#0f1419] mb-4">Old Regime Tax Slabs</h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={getTaxSlabData().oldRegimeData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip 
                              formatter={(value) => [`${value}%`, 'Tax Rate']}
                            />
                            <Bar dataKey="rate" fill="#82ca9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border border-[#e5e5e5]">
                <h2 className="text-lg md:text-xl font-semibold mb-4 text-[#0f1419]">New Regime Slabs FY 2025-26</h2>
                <div className="space-y-3">
                  {NEW_REGIME_SLABS.map((slab, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-[#f7f9f9] rounded-xl border border-[#e5e5e5]">
                      <span className="text-[#536471]">
                        {slab.min === 0
                          ? "Up to ₹4,00,000"
                          : slab.max === Infinity
                          ? "Above ₹24,00,000"
                          : `₹${slab.min.toLocaleString()} - ₹${slab.max.toLocaleString()}`}
                      </span>
                      <span className="font-semibold text-[#1d9bf0]">{slab.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 border border-[#e5e5e5]">
                <h2 className="text-lg md:text-xl font-semibold mb-4 text-[#0f1419]">Old Regime Slabs FY 2025-26</h2>
                <div className="space-y-3">
                  {OLD_REGIME_SLABS.map((slab, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-[#f7f9f9] rounded-xl border border-[#e5e5e5]">
                      <span className="text-[#536471]">
                        {slab.min === 0
                          ? "Up to ₹2,50,000"
                          : slab.max === Infinity
                          ? "Above ₹10,00,000"
                          : `₹${slab.min.toLocaleString()} - ₹${slab.max.toLocaleString()}`}
                      </span>
                      <span className="font-semibold text-[#1d9bf0]">{slab.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer className="mt-8 text-center text-sm text-[#536471] pb-8">
        <p>© {new Date().getFullYear()} Income Tax Calculator. All rights reserved.</p>
        <p className="mt-1">Created by Ankith G</p>
      </footer>
    </div>
  );
}
