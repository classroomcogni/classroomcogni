'use client';

import { useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Message, Upload, AIInsight, User } from '@/lib/supabase';

interface InsightsDashboardProps {
  messages: Message[];
  uploads: Upload[];
  insights: AIInsight[];
  members: User[];
}

const COLORS = ['#e01e5a', '#2eb67d', '#4a154b', '#ecb22e', '#36c5f0'];

export default function InsightsDashboard({ messages, uploads, insights, members }: InsightsDashboardProps) {
  // Use mock data for insights (UI demo)
  const processedData = useMemo(() => {
    return {
      totalMessages: 128,
      activeStudents: 18,
      totalUploads: 24,
      chatActivity: [
        { day: 'Mon', messages: 18 },
        { day: 'Tue', messages: 22 },
        { day: 'Wed', messages: 26 },
        { day: 'Thu', messages: 20 },
        { day: 'Fri', messages: 15 },
        { day: 'Sat', messages: 10 },
        { day: 'Sun', messages: 17 },
      ],
      activityByHour: [
        { hour: '8am', activity: 2, hourNum: 8 },
        { hour: '10am', activity: 8, hourNum: 10 },
        { hour: '12pm', activity: 12, hourNum: 12 },
        { hour: '2pm', activity: 15, hourNum: 14 },
        { hour: '4pm', activity: 20, hourNum: 16 },
        { hour: '6pm', activity: 10, hourNum: 18 },
      ],
      unitStruggles: [
        { name: 'Unit 1: Functions', students: 6, percentage: 33 },
        { name: 'Unit 2: Derivatives', students: 8, percentage: 44 },
        { name: 'Unit 3: Integrals', students: 5, percentage: 28 },
        { name: 'Unit 4: Series', students: 3, percentage: 17 },
      ],
      messageChange: 12,
      maxStruggleUnit: { name: 'Unit 2: Derivatives', students: 8, percentage: 44 },
      minStruggleUnit: { name: 'Unit 4: Series', students: 3, percentage: 17 },
      peakHour: { hour: '4pm', activity: 20 },
      totalStudents: 24,
    };
  }, []);
  
  const {
    totalMessages,
    activeStudents,
    totalUploads,
    chatActivity,
    activityByHour,
    unitStruggles,
    messageChange,
    maxStruggleUnit,
    peakHour,
    minStruggleUnit,
    totalStudents
  } = processedData;
  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 border border-[#dadce0]">
          <div className="text-[#5f6368] text-sm mb-1">Total Messages</div>
          <div className="text-[#202124] text-2xl font-bold">{totalMessages}</div>
          {messageChange !== 0 && (
            <div className={`text-xs mt-1 ${messageChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {messageChange > 0 ? '↑' : '↓'} {Math.abs(messageChange)}% from last week
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dadce0]">
          <div className="text-[#5f6368] text-sm mb-1">Active Students</div>
          <div className="text-[#202124] text-2xl font-bold">{activeStudents}</div>
          <div className="text-[#5f6368] text-xs mt-1">of {totalStudents} total</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dadce0]">
          <div className="text-[#5f6368] text-sm mb-1">Notes Uploaded</div>
          <div className="text-[#202124] text-2xl font-bold">{totalUploads}</div>
          <div className="text-[#1a73e8] text-xs mt-1">Total uploads</div>
        </div>
        <div className="bg-white rounded-lg p-4 border border-[#dadce0]">
          <div className="text-[#5f6368] text-sm mb-1">Class Members</div>
          <div className="text-[#202124] text-2xl font-bold">{members.length}</div>
          <div className="text-[#5f6368] text-xs mt-1">Total participants</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Units Students Struggle With */}
        <div className="bg-white rounded-lg p-6 border border-[#dadce0]">
          <h3 className="text-[#202124] font-semibold mb-4 text-lg">Units Students Struggle With</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={unitStruggles.length > 0 ? unitStruggles : [{ name: 'No data', students: 0, percentage: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="name" 
                stroke="#5f6368"
                tick={{ fill: '#5f6368', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="#5f6368"
                tick={{ fill: '#5f6368', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #dadce0',
                  borderRadius: '6px',
                  color: '#202124'
                }}
              />
              <Bar dataKey="students" fill="#e01e5a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-[#5f6368]">
            Shows number of students who asked questions or showed confusion about each unit
          </div>
        </div>

        {/* Chat Activity Over Time */}
        <div className="bg-white rounded-lg p-6 border border-[#dadce0]">
          <h3 className="text-[#202124] font-semibold mb-4 text-lg">Chat Activity (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chatActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="day" 
                stroke="#5f6368"
                tick={{ fill: '#5f6368', fontSize: 12 }}
              />
              <YAxis 
                stroke="#5f6368"
                tick={{ fill: '#5f6368', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #dadce0',
                  borderRadius: '6px',
                  color: '#202124'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="messages" 
                stroke="#2eb67d" 
                strokeWidth={2}
                dot={{ fill: '#2eb67d', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-[#5f6368]">
            Total messages sent per day across all channels
          </div>
        </div>

        {/* Activity by Hour */}
        <div className="bg-white rounded-lg p-6 border border-[#dadce0]">
          <h3 className="text-[#202124] font-semibold mb-4 text-lg">Activity by Hour of Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={activityByHour.length > 0 ? activityByHour : [{ hour: 'No data', activity: 0, hourNum: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis 
                dataKey="hour" 
                stroke="#5f6368"
                tick={{ fill: '#5f6368', fontSize: 12 }}
              />
              <YAxis 
                stroke="#5f6368"
                tick={{ fill: '#5f6368', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #dadce0',
                  borderRadius: '6px',
                  color: '#202124'
                }}
              />
              <Bar dataKey="activity" fill="#4a154b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-[#5f6368]">
            Peak activity times help identify when students are most engaged
          </div>
        </div>

        {/* Unit Difficulty Distribution */}
        <div className="bg-white rounded-lg p-6 border border-[#dadce0]">
          <h3 className="text-[#202124] font-semibold mb-4 text-lg">Unit Difficulty Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={unitStruggles.length > 0 ? unitStruggles : [{ name: 'No data', percentage: 0 }]}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry: any) => {
                  const percentage = entry.percentage || 0;
                  const name = entry.name || '';
                  return percentage > 0 ? `${name}: ${percentage}%` : '';
                }}
                outerRadius={100}
                fill="#8884d8"
                dataKey="percentage"
              >
                {(unitStruggles.length > 0 ? unitStruggles : [{ name: 'No data', percentage: 0 }]).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #dadce0',
                  borderRadius: '6px',
                  color: '#202124'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-[#5f6368]">
            Percentage of students struggling with each unit
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="bg-white rounded-lg p-6 border border-[#dadce0]">
        <h3 className="text-[#202124] font-semibold mb-4 text-lg">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {maxStruggleUnit && maxStruggleUnit.students > 0 && (
            <div className="bg-[#f8f9fa] rounded p-4 border border-[#dadce0]">
              <div className="text-yellow-500 text-sm font-medium mb-2">⚠️ High Priority</div>
              <div className="text-[#202124] text-sm">
                <strong>{maxStruggleUnit.name}</strong> shows the highest confusion rate ({maxStruggleUnit.percentage}%).  
                <br></br>{maxStruggleUnit.students} {maxStruggleUnit.students === 1 ? 'student has' : 'students have'} asked questions. 
                Consider scheduling a review session.
              </div>
            </div>
          )}
          {messageChange !== 0 && (
            <div className="bg-[#f8f9fa] rounded p-4 border border-[#dadce0]">
              <div className={`text-sm font-medium mb-2 ${messageChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {messageChange > 0 ? '✅ Positive Trend' : '📉 Activity Decline'}
              </div>
              <div className="text-[#202124] text-sm">
                Chat activity {messageChange > 0 ? 'increased' : 'decreased'} {Math.abs(messageChange)}% this week, 
                {messageChange > 0 ? ' indicating higher engagement.' : ' may need attention.'}
              </div>
            </div>
          )}
          {peakHour && peakHour.activity > 0 && (
            <div className="bg-[#f8f9fa] rounded p-4 border border-[#dadce0]">
              <div className="text-blue-500 text-sm font-medium mb-2">📊 Peak Hours</div>
              <div className="text-[#202124] text-sm">
                Most active at <strong>{peakHour.hour}</strong> ({peakHour.activity} {peakHour.activity === 1 ? 'message' : 'messages'}). 
                Consider scheduling office hours during this time.
              </div>
            </div>
          )}
          {minStruggleUnit && minStruggleUnit.students === 0 && unitStruggles.length > 1 && (
            <div className="bg-[#f8f9fa] rounded p-4 border border-[#dadce0]">
              <div className="text-purple-500 text-sm font-medium mb-2">💡 Suggestion</div>
              <div className="text-[#202124] text-sm">
                <strong>{minStruggleUnit.name}</strong> has low confusion ({minStruggleUnit.percentage}%). 
                Students are grasping this well!
              </div>
            </div>
          )}
          {(!maxStruggleUnit || maxStruggleUnit.students === 0) && (
            <div className="bg-[#f8f9fa] rounded p-4 border border-[#dadce0]">
              <div className="text-gray-400 text-sm font-medium mb-2">ℹ️ No Data Yet</div>
              <div className="text-[#202124] text-sm">
                Not enough data to generate insights. More student activity will provide better analytics.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

