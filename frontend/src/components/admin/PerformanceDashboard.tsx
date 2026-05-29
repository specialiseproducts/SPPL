import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Server, Smartphone } from 'lucide-react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { apiFetch } from '../../services/api';

type MetricsSnapshot = {
  startedAt: string;
  uptimeSeconds: number;
  requests: {
    total: number;
    slowCount: number;
    largePayloadCount: number;
    errors5xx: number;
    errors4xx: number;
    topEndpoints: { endpoint: string; count: number; avgMs: number; maxMs: number; slowCount: number }[];
    recentSlow: { method: string; path: string; durationMs: number; responseBytes: number }[];
  };
  dynamodb: {
    operations: Record<string, number>;
    estimatedRcu: number;
    estimatedWcu: number;
    throttled: number;
    gsiUsage: { index: string; count: number }[];
    recentSlow: { operation: string; tableName: string; durationMs: number }[];
  };
  frontend: { type?: string; name?: string; durationMs?: number; at?: string }[];
};

async function fetchMetrics(): Promise<MetricsSnapshot> {
  const res = await apiFetch('/api/metrics');
  return (res?.data || res) as MetricsSnapshot;
}

export default function PerformanceDashboard() {
  const query = useQuery({
    queryKey: ['metrics', 'snapshot'],
    queryFn: fetchMetrics,
    refetchInterval: 15000,
  });

  const data = query.data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#212529]">System performance</h1>
          <p className="text-sm text-gray-500">Live metrics from this API instance (resets on deploy/restart).</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()} disabled={query.isFetching}>
          Refresh
        </Button>
      </div>

      {query.isLoading && <p className="text-sm text-gray-500">Loading metrics…</p>}
      {query.isError && <p className="text-sm text-red-600">Could not load metrics (admin/developer only).</p>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Server className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">API requests</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{data.requests.total}</p>
              <p className="text-xs text-gray-500">Uptime {data.uptimeSeconds}s</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Activity className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Slow (&gt;500ms)</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{data.requests.recentSlow.length}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Database className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">DynamoDB RCU</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{data.dynamodb.estimatedRcu}</p>
              <p className="text-xs text-gray-500">
                Query {data.dynamodb.operations.query} · Scan {data.dynamodb.operations.scan}
              </p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-gray-600">
                <Smartphone className="h-4 w-4" />
                <span className="text-xs font-medium uppercase">Frontend events</span>
              </div>
              <p className="mt-2 text-2xl font-semibold">{data.frontend.length}</p>
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Top endpoints</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="py-2 pr-4">Endpoint</th>
                    <th className="py-2 pr-4">Count</th>
                    <th className="py-2 pr-4">Avg ms</th>
                    <th className="py-2 pr-4">Max ms</th>
                    <th className="py-2">Slow</th>
                  </tr>
                </thead>
                <tbody>
                  {data.requests.topEndpoints.map((row) => (
                    <tr key={row.endpoint} className="border-b border-gray-100">
                      <td className="py-2 pr-4 font-mono text-xs">{row.endpoint}</td>
                      <td className="py-2 pr-4">{row.count}</td>
                      <td className="py-2 pr-4">{row.avgMs}</td>
                      <td className="py-2 pr-4">{row.maxMs}</td>
                      <td className="py-2">{row.slowCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">Recent slow API calls</h2>
              <ul className="max-h-48 space-y-1 overflow-auto text-xs font-mono">
                {data.requests.recentSlow.map((r, i) => (
                  <li key={i}>
                    {r.method} {r.path} — {r.durationMs}ms ({Math.round(r.responseBytes / 1024)}KB)
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-4">
              <h2 className="mb-2 text-sm font-semibold">GSI usage</h2>
              <ul className="max-h-48 space-y-1 overflow-auto text-xs">
                {data.dynamodb.gsiUsage.map((g) => (
                  <li key={g.index}>
                    {g.index}: {g.count}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
