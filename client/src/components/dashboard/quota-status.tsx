import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface QuotaUsageData {
  id: string;
  serviceAccountId: string;
  date: string;
  requestsCount: number;
  serviceAccount: {
    id: string;
    name: string;
    clientEmail: string;
    dailyQuotaLimit: number;
    perMinuteQuotaLimit: number;
    isActive: boolean;
  };
}

export default function QuotaStatus() {
  const { data: quotaUsage, isLoading } = useQuery<QuotaUsageData[]>({
    queryKey: ["/api/quota-usage"],
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Quota Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="p-4 border rounded-lg space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const todayUsages = quotaUsage?.filter(usage => usage.date === today) || [];

  // Group by service account
  const accountUsages = todayUsages.reduce((acc, usage) => {
    acc[usage.serviceAccountId] = usage;
    return acc;
  }, {} as Record<string, QuotaUsageData>);

  // Calculate totals
  const totalUsed = todayUsages.reduce((sum, usage) => sum + usage.requestsCount, 0);
  const totalLimit = todayUsages.reduce((sum, usage) => sum + usage.serviceAccount.dailyQuotaLimit, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Quota Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.values(accountUsages).map((usage) => {
          const percentage = (usage.requestsCount / usage.serviceAccount.dailyQuotaLimit) * 100;
          const status = percentage >= 95 ? "critical" : percentage >= 80 ? "warning" : "good";
          
          return (
            <div
              key={usage.serviceAccountId}
              className={`p-4 rounded-lg border ${
                status === "critical" ? "border-red-200 bg-red-50" :
                status === "warning" ? "border-amber-200 bg-amber-50" :
                "border-emerald-200 bg-emerald-50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  {usage.serviceAccount.name}
                </span>
                <Badge variant={
                  status === "critical" ? "destructive" :
                  status === "warning" ? "secondary" :
                  "default"
                }>
                  {status === "critical" ? "Critical" :
                   status === "warning" ? "Limited" :
                   "Active"}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span>Daily Requests</span>
                    <span>{usage.requestsCount}/{usage.serviceAccount.dailyQuotaLimit}</span>
                  </div>
                  <Progress 
                    value={percentage} 
                    className={`h-2 ${
                      status === "critical" ? "[&>div]:bg-red-500" :
                      status === "warning" ? "[&>div]:bg-amber-500" :
                      "[&>div]:bg-emerald-500"
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {totalLimit > 0 && (
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-center">
              <p className="text-sm font-medium text-slate-700">Combined Quota</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{totalUsed}/{totalLimit}</p>
              <p className="text-xs text-slate-500">Daily requests available</p>
            </div>
          </div>
        )}

        {todayUsages.length === 0 && (
          <div className="text-center p-8 text-slate-500">
            <p>No service accounts configured</p>
            <p className="text-sm">Add service accounts in Settings to monitor quota usage</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
