import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { DashboardStats } from './types';

interface ChartsProps {
  stats: DashboardStats;
}

export default function Charts({ stats }: ChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Tier Distribution</h2>
        {stats.tierDistribution.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.tierDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }: any) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {stats.tierDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-slate-500">No tiered vendors yet</div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Risk Rating Distribution</h2>
        {stats.riskDistribution.some((d) => d.count > 0) ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.riskDistribution}>
              <XAxis dataKey="range" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#0f172a" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12 text-slate-500">No risk assessments yet</div>
        )}
      </div>
    </div>
  );
}
