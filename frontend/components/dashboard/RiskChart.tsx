'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import type { RiskAssessment } from '@/lib/api';
import { format } from 'date-fns';

interface RiskChartProps {
  assessments: RiskAssessment[];
  stats: { highRiskCount: number; mediumRiskCount: number; lowRiskCount: number };
}

export default function RiskChart({ assessments, stats }: RiskChartProps) {
  const timelineData = assessments
    .slice(0, 20)
    .reverse()
    .map((a) => ({
      time: format(new Date(a.timestamp), 'HH:mm'),
      score: a.riskScore,
      level: a.riskLevel,
    }));

  const pieData = [
    { name: 'High Risk', value: stats.highRiskCount, color: '#ef4444' },
    { name: 'Medium Risk', value: stats.mediumRiskCount, color: '#f59e0b' },
    { name: 'Low Risk', value: stats.lowRiskCount, color: '#10b981' },
  ].filter((d) => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Timeline Chart */}
      <div className="lg:col-span-2 glass-card p-5">
        <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-blink" />
          Risk Score Timeline
        </h3>
        {timelineData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timelineData}>
              <defs>
                <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis dataKey="time" tick={{ fill: '#6b7280', fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af' }}
                itemStyle={{ color: '#10b981' }}
              />
              <Area type="monotone" dataKey="score" stroke="#10b981" fill="url(#riskGradient)"
                strokeWidth={2} dot={{ fill: '#10b981', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-gray-500">
            No assessment data yet. Run a simulation to generate data.
          </div>
        )}
      </div>

      {/* Risk Distribution Pie */}
      <div className="glass-card p-5">
        <h3 className="font-semibold text-white mb-4">Risk Distribution</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                paddingAngle={4} dataKey="value">
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Legend iconType="circle" iconSize={8}
                formatter={(value) => <span style={{ color: '#9ca3af', fontSize: 12 }}>{value}</span>} />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                itemStyle={{ color: '#e5e7eb' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
            No data
          </div>
        )}
      </div>
    </div>
  );
}
