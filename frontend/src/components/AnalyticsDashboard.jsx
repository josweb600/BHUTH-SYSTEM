import React, { useState } from 'react';
import { LineChart, BarChart, PieChart, TrendingUp, Download, Filter, Calendar, Settings, AlertCircle, CheckCircle } from 'lucide-react';

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('month');
  const [selectedMetric, setSelectedMetric] = useState('revenue');

  // Revenue Data
  const revenueData = [
    { month: 'Jan', value: 45600, budget: 50000 },
    { month: 'Feb', value: 52300, budget: 50000 },
    { month: 'Mar', value: 48900, budget: 50000 },
    { month: 'Apr', value: 61200, budget: 50000 },
    { month: 'May', value: 55800, budget: 50000 },
    { month: 'Jun', value: 67400, budget: 50000 },
  ];

  // Department Performance
  const deptPerformance = [
    { name: 'Internal Medicine', patients: 342, revenue: 1245000, avgWait: 12, satisfaction: 4.2 },
    { name: 'Cardiology', patients: 156, revenue: 856000, avgWait: 18, satisfaction: 4.1 },
    { name: 'Surgery', patients: 89, revenue: 654000, avgWait: 8, satisfaction: 4.5 },
    { name: 'Pediatrics', patients: 234, revenue: 456000, avgWait: 10, satisfaction: 4.3 },
    { name: 'Orthopedics', patients: 123, revenue: 345000, avgWait: 15, satisfaction: 4.0 },
  ];

  // Patient Metrics
  const patientMetrics = [
    { label: 'Total Patients', value: 2547, change: '+12%', status: 'up' },
    { label: 'New Patients', value: 234, change: '+8%', status: 'up' },
    { label: 'Readmissions', value: 34, change: '-5%', status: 'down' },
    { label: 'Avg Satisfaction', value: '4.2/5', change: '+0.3', status: 'up' },
  ];

  // Financial KPIs
  const financialKPIs = [
    { label: 'Total Revenue', value: '331,200 Br', status: 'positive' },
    { label: 'Outstanding Bills', value: '245,600 Br', status: 'negative' },
    { label: 'Collection Rate', value: '87%', status: 'positive' },
    { label: 'Cost per Patient', value: '1,240 Br', status: 'neutral' },
  ];

  const maxRevenue = Math.max(...revenueData.map(d => d.value));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Analytics & Business Intelligence</h1>
        <p className="text-gray-400">Real-time hospital performance metrics and insights</p>
      </div>

      {/* Controls */}
      <div className="flex gap-4 mb-8 flex-wrap">
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-blue-500"
        >
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition">
          <Filter size={18} /> Filter
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition">
          <Download size={18} /> Export Report
        </button>
      </div>

      {/* Patient Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {patientMetrics.map((metric, idx) => (
          <div key={idx} className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition">
            <p className="text-gray-400 text-sm mb-2">{metric.label}</p>
            <div className="flex justify-between items-end">
              <p className="text-3xl font-bold">{metric.value}</p>
              <span className={`text-sm font-semibold ${metric.status === 'up' ? 'text-green-400' : 'text-red-400'}`}>
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {financialKPIs.map((kpi, idx) => (
          <div key={idx} className={`rounded-lg p-6 border ${
            kpi.status === 'positive' ? 'bg-green-900 border-green-700' :
            kpi.status === 'negative' ? 'bg-red-900 border-red-700' :
            'bg-gray-800 border-gray-700'
          }`}>
            <p className="text-gray-300 text-sm mb-2">{kpi.label}</p>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Revenue Chart */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <TrendingUp className="text-blue-400" /> Monthly Revenue vs Budget
          </h2>
          <div className="flex items-end justify-between h-64 gap-2 mb-4">
            {revenueData.map((data, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="relative w-full h-48 flex items-end justify-center gap-1">
                  <div
                    className="bg-blue-600 rounded-t-lg w-1/2 hover:bg-blue-500 transition"
                    style={{ height: `${(data.value / maxRevenue) * 100}%` }}
                    title={`Actual: ${data.value}`}
                  ></div>
                  <div
                    className="bg-gray-600 rounded-t-lg w-1/2 hover:bg-gray-500 transition"
                    style={{ height: `${(data.budget / maxRevenue) * 100}%` }}
                    title={`Budget: ${data.budget}`}
                  ></div>
                </div>
                <p className="text-xs text-gray-400">{data.month}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-600 rounded"></div>
              <span>Actual Revenue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-600 rounded"></div>
              <span>Budget</span>
            </div>
          </div>
        </div>

        {/* Department Performance */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6">Department Performance Matrix</h2>
          <div className="space-y-3">
            {deptPerformance.map((dept, idx) => (
              <div key={idx} className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold">{dept.name}</h3>
                  <span className="text-sm text-gray-400">{dept.patients} patients</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Revenue</p>
                    <p className="font-semibold">{(dept.revenue / 1000).toFixed(0)}K Br</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Avg Wait</p>
                    <p className="font-semibold">{dept.avgWait} min</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Satisfaction</p>
                    <p className="font-semibold text-yellow-400">{dept.satisfaction}/5</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Service Line Analysis */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-6">Service Line Revenue Distribution</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Pie representation */}
          <div className="flex flex-col items-center">
            <div className="relative w-48 h-48 rounded-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 flex items-center justify-center">
              <div className="w-40 h-40 bg-gray-800 rounded-full flex items-center justify-center">
                <div className="text-center">
                  <p className="text-3xl font-bold">68%</p>
                  <p className="text-sm text-gray-400">Clinical Services</p>
                </div>
              </div>
            </div>
            <div className="mt-6 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-600 rounded"></div>
                <span>Clinical: 68% (2.3M Br)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-purple-600 rounded"></div>
                <span>Support: 20% (680K Br)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-pink-600 rounded"></div>
                <span>Other: 12% (410K Br)</span>
              </div>
            </div>
          </div>

          {/* Key Insights */}
          <div className="space-y-4">
            <div className="p-4 bg-blue-900 border border-blue-700 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-blue-400 mt-1" size={20} />
                <div>
                  <p className="font-semibold mb-1">Revenue Growth</p>
                  <p className="text-sm text-gray-300">12% YoY growth, exceeding targets</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-400 mt-1" size={20} />
                <div>
                  <p className="font-semibold mb-1">Outstanding Receivables</p>
                  <p className="text-sm text-gray-300">245K Br (18% of monthly revenue)</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-green-900 border border-green-700 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="text-green-400 mt-1" size={20} />
                <div>
                  <p className="font-semibold mb-1">Collection Rate</p>
                  <p className="text-sm text-gray-300">87% - Above industry average of 82%</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Bed Occupancy */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6">Bed Occupancy Rate</h2>
          <div className="space-y-4">
            {[
              { ward: 'General Ward', occupancy: 78, capacity: 45 },
              { ward: 'ICU', occupancy: 92, capacity: 12 },
              { ward: 'Surgical Ward', occupancy: 65, capacity: 30 },
              { ward: 'Pediatrics', occupancy: 81, capacity: 20 },
            ].map((ward, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-2">
                  <span>{ward.ward}</span>
                  <span className="font-semibold">{ward.occupancy}% ({ward.capacity} beds)</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${ward.occupancy > 85 ? 'bg-red-500' : ward.occupancy > 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                    style={{ width: `${ward.occupancy}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Utilization */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-6">Staff Utilization</h2>
          <div className="space-y-4">
            {[
              { role: 'Physicians', utilized: 34, total: 42, utilization: 81 },
              { role: 'Nurses', utilized: 56, total: 62, utilization: 90 },
              { role: 'Technicians', utilized: 28, total: 35, utilization: 80 },
              { role: 'Support Staff', utilized: 45, total: 52, utilization: 87 },
            ].map((staff, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-sm mb-2">
                  <span>{staff.role}</span>
                  <span className="font-semibold">{staff.utilized}/{staff.total} ({staff.utilization}%)</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${staff.utilization}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
