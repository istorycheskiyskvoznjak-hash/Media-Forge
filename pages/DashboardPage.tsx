
import React from 'react';

const StatCard: React.FC<{title: string, value: string, change: string}> = ({title, value, change}) => (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg">
        <h3 className="text-sm font-medium text-gray-400">{title}</h3>
        <p className="text-3xl font-bold text-white mt-2">{value}</p>
        <p className="text-sm text-green-400 mt-1">{change}</p>
    </div>
);

const ChartPlaceholder: React.FC<{title: string}> = ({ title }) => (
    <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg col-span-1 md:col-span-2">
        <h3 className="text-lg font-semibold text-purple-300 mb-4">{title}</h3>
        <div className="h-64 bg-gray-900/50 rounded-md flex items-center justify-center">
            <p className="text-gray-500">[ Chart Data ]</p>
        </div>
    </div>
)

const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-8">
        <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
                Dashboard
            </h1>
            <p className="text-gray-400 mt-1">Welcome back to the Media Forge.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard title="Total Videos" value="12" change="+2 this week" />
            <StatCard title="Total Views" value="1.2M" change="+5.4% this month" />
            <StatCard title="Subscribers" value="15.7K" change="+210 this week" />
            <StatCard title="Revenue" value="$4,820" change="+12% this month" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ChartPlaceholder title="Views Over Time" />
            <ChartPlaceholder title="Audience Demographics" />
        </div>
    </div>
  );
};

export default DashboardPage;
