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

const COLORS = ['#f472b6', '#6366f1', '#22c55e', '#f59e0b', '#06b6d4'];

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
        <div className="bg-white rounded-2xl p-5 border border-[#e2e0dc] shadow-sm hover:shadow-md transition-all">
          <div className="text-[#64748b] text-sm mb-1">Total Messages</div>
          <div className="text-[#1e293b] text-2xl font-bold">{totalMessages}</div>
          {messageChange !== 0 && (
            <div className={`text-xs mt-1 ${messageChange > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
              {messageChange > 0 ? '↑' : '↓'} {Math.abs(messageChange)}% from last week
            </div>
          )}
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#e2e0dc] shadow-sm hover:shadow-md transition-all">
          <div className="text-[#64748b] text-sm mb-1">Active Students</div>
          <div className="text-[#1e293b] text-2xl font-bold">{activeStudents}</div>
          <div className="text-[#64748b] text-xs mt-1">of {totalStudents} total</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#e2e0dc] shadow-sm hover:shadow-md transition-all">
          <div className="text-[#64748b] text-sm mb-1">Notes Uploaded</div>
          <div className="text-[#1e293b] text-2xl font-bold">{totalUploads}</div>
          <div className="text-[#6366f1] text-xs mt-1">Total uploads</div>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-[#e2e0dc] shadow-sm hover:shadow-md transition-all">
          <div className="text-[#64748b] text-sm mb-1">Class Members</div>
          <div className="text-[#1e293b] text-2xl font-bold">{members.length}</div>
          <div className="text-[#64748b] text-xs mt-1">Total participants</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Units Students Struggle With */}
        <div className="bg-white rounded-2xl p-6 border border-[#e2e0dc] shadow-sm">
          <h3 className="text-[#1e293b] font-semibold mb-4 text-lg">Units Students Struggle With</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={unitStruggles.length > 0 ? unitStruggles : [{ name: 'No data', students: 0, percentage: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e0dc" />
              <XAxis 
                dataKey="name" 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e2e0dc',
                  borderRadius: '12px',
                  color: '#1e293b',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}
              />
              <Bar dataKey="students" fill="#f472b6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-[#64748b]">
            Shows number of students who asked questions or showed confusion about each unit
          </div>
        </div>

        {/* Chat Activity Over Time */}
        <div className="bg-white rounded-2xl p-6 border border-[#e2e0dc] shadow-sm">
          <h3 className="text-[#1e293b] font-semibold mb-4 text-lg">Chat Activity (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chatActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e0dc" />
              <XAxis 
                dataKey="day" 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e2e0dc',
                  borderRadius: '12px',
                  color: '#1e293b',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="messages" 
                stroke="#22c55e" 
                strokeWidth={2}
                dot={{ fill: '#22c55e', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-[#64748b]">
            Total messages sent per day across all channels
          </div>
        </div>

        {/* Activity by Hour */}
        <div className="bg-white rounded-2xl p-6 border border-[#e2e0dc] shadow-sm">
          <h3 className="text-[#1e293b] font-semibold mb-4 text-lg">Activity by Hour of Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={activityByHour.length > 0 ? activityByHour : [{ hour: 'No data', activity: 0, hourNum: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e0dc" />
              <XAxis 
                dataKey="hour" 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <YAxis 
                stroke="#64748b"
                tick={{ fill: '#64748b', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  border: '1px solid #e2e0dc',
                  borderRadius: '12px',
                  color: '#1e293b',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}
              />
              <Bar dataKey="activity" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-[#64748b]">
            Peak activity times help identify when students are most engaged
          </div>
        </div>

        {/* Unit Difficulty Distribution */}
        <div className="bg-white rounded-2xl p-6 border border-[#e2e0dc] shadow-sm">
          <h3 className="text-[#1e293b] font-semibold mb-4 text-lg">Unit Difficulty Distribution</h3>
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
                  border: '1px solid #e2e0dc',
                  borderRadius: '12px',
                  color: '#1e293b',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-[#64748b]">
            Percentage of students struggling with each unit
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="bg-white rounded-2xl p-6 border border-[#e2e0dc] shadow-sm">
        <h3 className="text-[#1e293b] font-semibold mb-4 text-lg">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {maxStruggleUnit && maxStruggleUnit.students > 0 && (
            <div className="bg-gradient-to-br from-[#fef3c7] to-[#fef9c3] rounded-xl p-5 border border-[#fde68a]">
              <div className="text-[#f59e0b] text-sm font-semibold mb-2">⚠️ High Priority</div>
              <div className="text-[#1e293b] text-sm leading-relaxed">
                <strong>{maxStruggleUnit.name}</strong> shows the highest confusion rate ({maxStruggleUnit.percentage}%).  
                <br></br>{maxStruggleUnit.students} {maxStruggleUnit.students === 1 ? 'student has' : 'students have'} asked questions. 
                Consider scheduling a review session.
              </div>
            </div>
          )}
          {messageChange !== 0 && (
            <div className={`rounded-xl p-5 border ${messageChange > 0 ? 'bg-gradient-to-br from-[#dcfce7] to-[#d1fae5] border-[#86efac]' : 'bg-gradient-to-br from-[#fee2e2] to-[#fecaca] border-[#fca5a5]'}`}>
              <div className={`text-sm font-semibold mb-2 ${messageChange > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                {messageChange > 0 ? '✅ Positive Trend' : '📉 Activity Decline'}
              </div>
              <div className="text-[#1e293b] text-sm leading-relaxed">
                Chat activity {messageChange > 0 ? 'increased' : 'decreased'} {Math.abs(messageChange)}% this week, 
                {messageChange > 0 ? ' indicating higher engagement.' : ' may need attention.'}
              </div>
            </div>
          )}
          {peakHour && peakHour.activity > 0 && (
            <div className="bg-gradient-to-br from-[#dbeafe] to-[#eff6ff] rounded-xl p-5 border border-[#93c5fd]">
              <div className="text-[#6366f1] text-sm font-semibold mb-2">📊 Peak Hours</div>
              <div className="text-[#1e293b] text-sm leading-relaxed">
                Most active at <strong>{peakHour.hour}</strong> ({peakHour.activity} {peakHour.activity === 1 ? 'message' : 'messages'}). 
                Consider scheduling office hours during this time.
              </div>
            </div>
          )}
          {minStruggleUnit && minStruggleUnit.students === 0 && unitStruggles.length > 1 && (
            <div className="bg-gradient-to-br from-[#fae8ff] to-[#f5d0fe] rounded-xl p-5 border border-[#e879f9]">
              <div className="text-[#a855f7] text-sm font-semibold mb-2">💡 Suggestion</div>
              <div className="text-[#1e293b] text-sm leading-relaxed">
                <strong>{minStruggleUnit.name}</strong> has low confusion ({minStruggleUnit.percentage}%). 
                Students are grasping this well!
              </div>
            </div>
          )}
          {(!maxStruggleUnit || maxStruggleUnit.students === 0) && (
            <div className="bg-[#faf8f5] rounded-xl p-5 border border-[#e2e0dc]">
              <div className="text-[#94a3b8] text-sm font-semibold mb-2">ℹ️ No Data Yet</div>
              <div className="text-[#1e293b] text-sm leading-relaxed">
                Not enough data to generate insights. More student activity will provide better analytics.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

