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
  // Process data for charts
  const processedData = useMemo(() => {
    // Calculate stats
    const totalMessages = messages.length;
    const activeStudents = new Set(messages.map(m => m.user_id)).size;
    const totalUploads = uploads.length;
    
    // Get study guide metadata for units
    const studyGuide = insights.find(i => i.insight_type === 'study_guide');
    
    // Try to get unit names from metadata first
    let unitNames: string[] = [];
    if (studyGuide?.metadata) {
      // Try different possible metadata structures
      if (Array.isArray(studyGuide.metadata.unit_names)) {
        unitNames = studyGuide.metadata.unit_names as string[];
      } else if (typeof studyGuide.metadata.unit_names === 'string') {
        // If it's a string, try to parse it
        try {
          unitNames = JSON.parse(studyGuide.metadata.unit_names as string);
        } catch {
          unitNames = [];
        }
      }
    }
    
    // Fallback: Extract units from study guide content if metadata doesn't have them
    if (unitNames.length === 0 && studyGuide?.content) {
      // Look for markdown headers that indicate units
      // Patterns: "# Unit X: [Name]", "## Unit: [Name]", "# 📘 Unit X: [Name]", etc.
      const content = studyGuide.content;
      
      // Match various unit header patterns - try multiple approaches
      // Approach 1: Look for explicit "Unit" headers
      const explicitUnitPatterns = [
        /#+\s*📘\s*Unit\s*\d+:\s*([^\n]+)/gi,
        /#+\s*Unit\s*\d+:\s*([^\n]+)/gi,
        /#+\s*Unit:\s*([^\n]+)/gi,
      ];
      
      for (const pattern of explicitUnitPatterns) {
        const matches = Array.from(content.matchAll(pattern));
        if (matches.length > 0) {
          unitNames = matches
            .map(match => {
              const name = (match[1] || match[0]).trim();
              // Clean up the name
              return name
                .replace(/^#+\s*📘\s*Unit\s*\d+:\s*/i, '')
                .replace(/^#+\s*Unit\s*\d+:\s*/i, '')
                .replace(/^#+\s*Unit:\s*/i, '')
                .replace(/^#+\s*/, '')
                .trim();
            })
            .filter(name => name.length > 0 && !name.toLowerCase().includes('overview') && !name.toLowerCase().includes('review'));
          
          if (unitNames.length > 0) break;
        }
      }
      
      // Approach 2: Extract all ## level headers (likely unit headers)
      if (unitNames.length === 0) {
        const headerMatches = content.matchAll(/^##\s+([^\n#]+)$/gm);
        const headers = Array.from(headerMatches)
          .map(match => match[1].trim())
          .filter(header => {
            const lower = header.toLowerCase();
            return !lower.includes('overview') && 
                   !lower.includes('review') && 
                   !lower.includes('key concepts') &&
                   !lower.includes('formulas') &&
                   !lower.includes('examples') &&
                   !lower.includes('summary') &&
                   !lower.includes('takeaways') &&
                   header.length > 3;
          });
        
        if (headers.length > 0) {
          unitNames = headers.slice(0, 10); // Limit to 10 units
        }
      }
      
      // Approach 3: Extract from # level headers (top-level sections)
      if (unitNames.length === 0) {
        const topLevelMatches = content.matchAll(/^#\s+([^\n#]+)$/gm);
        const topLevelHeaders = Array.from(topLevelMatches)
          .map(match => match[1].trim())
          .filter(header => {
            const lower = header.toLowerCase();
            return !lower.includes('study guide') && 
                   !lower.includes('complete') &&
                   header.length > 3;
          });
        
        if (topLevelHeaders.length > 0) {
          unitNames = topLevelHeaders.slice(0, 10);
        }
      }
    }
    
    // If still no units, try to extract from upload titles as a last resort
    if (unitNames.length === 0 && uploads.length > 0) {
      // Use upload titles as potential unit names (top 5 unique titles)
      const uniqueTitles = Array.from(new Set(uploads.map(u => u.title)))
        .slice(0, 5)
        .map(title => {
          // Clean up title - remove common prefixes
          return title
            .replace(/^(Chapter|Unit|Section|Topic)\s*\d+[:\s]*/i, '')
            .trim();
        });
      
      if (uniqueTitles.length > 0) {
        unitNames = uniqueTitles;
      }
    }
    
    // Calculate chat activity by day (last 7 days)
    const now = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (6 - i));
      return date;
    });
    
    const chatActivity = last7Days.map(date => {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayMessages = messages.filter(m => {
        const msgDate = new Date(m.created_at);
        return msgDate >= dayStart && msgDate <= dayEnd;
      });
      
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return {
        day: dayNames[date.getDay()],
        messages: dayMessages.length,
        date: date.toISOString().split('T')[0]
      };
    });
    
    // Calculate activity by hour
    const activityByHour = Array.from({ length: 24 }, (_, hour) => {
      const hourMessages = messages.filter(m => {
        const msgDate = new Date(m.created_at);
        return msgDate.getHours() === hour;
      });
      
      const hourLabel = hour === 0 ? '12am' : hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`;
      return {
        hour: hourLabel,
        activity: hourMessages.length,
        hourNum: hour
      };
    });
    
    // Calculate units students struggle with (from study guide metadata)
    // If we have unit names, we can estimate based on message content or use placeholder data
    // For now, we'll create a simple distribution based on available units
    const unitStruggles = unitNames.length > 0 
      ? unitNames.map((unitName, index) => {
          // Estimate based on message frequency mentioning unit-related keywords
          // This is a simplified approach - in production, you'd analyze message content
          const unitKeywords = unitName.toLowerCase().split(' ');
          const relevantMessages = messages.filter(m => {
            const content = m.content.toLowerCase();
            return unitKeywords.some(keyword => content.includes(keyword));
          });
          const uniqueStudents = new Set(relevantMessages.map(m => m.user_id)).size;
          const totalStudents = members.filter(m => m.role === 'student').length || 1;
          const percentage = Math.round((uniqueStudents / totalStudents) * 100);
          
          return {
            name: unitName,
            students: uniqueStudents,
            percentage: percentage
          };
        })
      : [
          // Fallback if no units available
          { name: 'No units available', students: 0, percentage: 0 }
        ];
    
    // Sort by students struggling (descending)
    unitStruggles.sort((a, b) => b.students - a.students);
    
    // Calculate week-over-week comparison (simplified - compare last 7 days to previous 7 days)
    const previousWeekStart = new Date(now);
    previousWeekStart.setDate(previousWeekStart.getDate() - 14);
    const previousWeekEnd = new Date(now);
    previousWeekEnd.setDate(previousWeekEnd.getDate() - 7);
    
    const previousWeekMessages = messages.filter(m => {
      const msgDate = new Date(m.created_at);
      return msgDate >= previousWeekStart && msgDate < previousWeekEnd;
    }).length;
    
    const currentWeekMessages = messages.filter(m => {
      const msgDate = new Date(m.created_at);
      return msgDate >= previousWeekEnd;
    }).length;
    
    const messageChange = previousWeekMessages > 0 
      ? Math.round(((currentWeekMessages - previousWeekMessages) / previousWeekMessages) * 100)
      : 0;
    
    // Calculate key insights
    const maxStruggleUnit = unitStruggles.length > 0 && unitStruggles[0].students > 0 
      ? unitStruggles[0] 
      : null;
    
    const peakHour = activityByHour.reduce((max, hour) => 
      hour.activity > max.activity ? hour : max, 
      activityByHour[0]
    );
    
    const minStruggleUnit = unitStruggles.length > 0 
      ? unitStruggles[unitStruggles.length - 1]
      : null;
    
    return {
      totalMessages,
      activeStudents,
      totalUploads,
      chatActivity,
      activityByHour: activityByHour.filter(h => h.hourNum >= 8 && h.hourNum <= 19), // 8am to 7pm
      unitStruggles: unitStruggles.slice(0, 5), // Top 5
      messageChange,
      maxStruggleUnit,
      peakHour,
      minStruggleUnit,
      totalStudents: members.filter(m => m.role === 'student').length
    };
  }, [messages, uploads, insights, members]);
  
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
        <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
          <div className="text-gray-400 text-sm mb-1">Total Messages</div>
          <div className="text-white text-2xl font-bold">{totalMessages}</div>
          {messageChange !== 0 && (
            <div className={`text-xs mt-1 ${messageChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
              {messageChange > 0 ? '↑' : '↓'} {Math.abs(messageChange)}% from last week
            </div>
          )}
        </div>
        <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
          <div className="text-gray-400 text-sm mb-1">Active Students</div>
          <div className="text-white text-2xl font-bold">{activeStudents}</div>
          <div className="text-gray-500 text-xs mt-1">of {totalStudents} total</div>
        </div>
        <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
          <div className="text-gray-400 text-sm mb-1">Notes Uploaded</div>
          <div className="text-white text-2xl font-bold">{totalUploads}</div>
          <div className="text-blue-500 text-xs mt-1">Total uploads</div>
        </div>
        <div className="bg-[#222529] rounded-lg p-4 border border-[#3f4147]">
          <div className="text-gray-400 text-sm mb-1">Class Members</div>
          <div className="text-white text-2xl font-bold">{members.length}</div>
          <div className="text-gray-500 text-xs mt-1">Total participants</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Units Students Struggle With */}
        <div className="bg-[#222529] rounded-lg p-6 border border-[#3f4147]">
          <h3 className="text-white font-semibold mb-4 text-lg">Units Students Struggle With</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={unitStruggles.length > 0 ? unitStruggles : [{ name: 'No data', students: 0, percentage: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f4147" />
              <XAxis 
                dataKey="name" 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1d21', 
                  border: '1px solid #3f4147',
                  borderRadius: '6px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="students" fill="#e01e5a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-gray-400">
            Shows number of students who asked questions or showed confusion about each unit
          </div>
        </div>

        {/* Chat Activity Over Time */}
        <div className="bg-[#222529] rounded-lg p-6 border border-[#3f4147]">
          <h3 className="text-white font-semibold mb-4 text-lg">Chat Activity (Last 7 Days)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chatActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f4147" />
              <XAxis 
                dataKey="day" 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1d21', 
                  border: '1px solid #3f4147',
                  borderRadius: '6px',
                  color: '#fff'
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
          <div className="mt-4 text-sm text-gray-400">
            Total messages sent per day across all channels
          </div>
        </div>

        {/* Activity by Hour */}
        <div className="bg-[#222529] rounded-lg p-6 border border-[#3f4147]">
          <h3 className="text-white font-semibold mb-4 text-lg">Activity by Hour of Day</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={activityByHour.length > 0 ? activityByHour : [{ hour: 'No data', activity: 0, hourNum: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#3f4147" />
              <XAxis 
                dataKey="hour" 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <YAxis 
                stroke="#9ca3af"
                tick={{ fill: '#9ca3af', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#1a1d21', 
                  border: '1px solid #3f4147',
                  borderRadius: '6px',
                  color: '#fff'
                }}
              />
              <Bar dataKey="activity" fill="#4a154b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-gray-400">
            Peak activity times help identify when students are most engaged
          </div>
        </div>

        {/* Unit Difficulty Distribution */}
        <div className="bg-[#222529] rounded-lg p-6 border border-[#3f4147]">
          <h3 className="text-white font-semibold mb-4 text-lg">Unit Difficulty Distribution</h3>
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
                  backgroundColor: '#1a1d21', 
                  border: '1px solid #3f4147',
                  borderRadius: '6px',
                  color: '#fff'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 text-sm text-gray-400">
            Percentage of students struggling with each unit
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="bg-[#222529] rounded-lg p-6 border border-[#3f4147]">
        <h3 className="text-white font-semibold mb-4 text-lg">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {maxStruggleUnit && maxStruggleUnit.students > 0 && (
            <div className="bg-[#1a1d21] rounded p-4 border border-[#3f4147]">
              <div className="text-yellow-500 text-sm font-medium mb-2">⚠️ High Priority</div>
              <div className="text-white text-sm">
                <strong>{maxStruggleUnit.name}</strong> shows the highest confusion rate ({maxStruggleUnit.percentage}%). 
                {maxStruggleUnit.students} {maxStruggleUnit.students === 1 ? 'student has' : 'students have'} asked questions. 
                Consider scheduling a review session.
              </div>
            </div>
          )}
          {messageChange !== 0 && (
            <div className="bg-[#1a1d21] rounded p-4 border border-[#3f4147]">
              <div className={`text-sm font-medium mb-2 ${messageChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {messageChange > 0 ? '✅ Positive Trend' : '📉 Activity Decline'}
              </div>
              <div className="text-white text-sm">
                Chat activity {messageChange > 0 ? 'increased' : 'decreased'} {Math.abs(messageChange)}% this week, 
                {messageChange > 0 ? ' indicating higher engagement.' : ' may need attention.'}
              </div>
            </div>
          )}
          {peakHour && peakHour.activity > 0 && (
            <div className="bg-[#1a1d21] rounded p-4 border border-[#3f4147]">
              <div className="text-blue-500 text-sm font-medium mb-2">📊 Peak Hours</div>
              <div className="text-white text-sm">
                Most active at <strong>{peakHour.hour}</strong> ({peakHour.activity} {peakHour.activity === 1 ? 'message' : 'messages'}). 
                Consider scheduling office hours during this time.
              </div>
            </div>
          )}
          {minStruggleUnit && minStruggleUnit.students === 0 && unitStruggles.length > 1 && (
            <div className="bg-[#1a1d21] rounded p-4 border border-[#3f4147]">
              <div className="text-purple-500 text-sm font-medium mb-2">💡 Suggestion</div>
              <div className="text-white text-sm">
                <strong>{minStruggleUnit.name}</strong> has low confusion ({minStruggleUnit.percentage}%). 
                Students are grasping this well!
              </div>
            </div>
          )}
          {(!maxStruggleUnit || maxStruggleUnit.students === 0) && (
            <div className="bg-[#1a1d21] rounded p-4 border border-[#3f4147]">
              <div className="text-gray-400 text-sm font-medium mb-2">ℹ️ No Data Yet</div>
              <div className="text-white text-sm">
                Not enough data to generate insights. More student activity will provide better analytics.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

