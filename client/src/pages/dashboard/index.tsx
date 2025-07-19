import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatsCard from "@/components/dashboard/stats-card";
import SimpleJobTable from "@/components/dashboard/simple-job-table";
import ErrorBoundary from "@/components/ui/error-boundary";
import { 
  TrendingUp, 
  Briefcase, 
  CheckCircle, 
  Server,
  Zap,
  Key,
  BarChart3,
  Plus,
  Bell
} from "lucide-react";

// Set document title for better SEO
document.title = "Dashboard - IndexNow Pro";

interface DashboardStats {
  totalUrlsIndexed: number;
  activeJobs: number;
  successRate: number;
  apiQuotaUsed: number;
  apiQuotaLimit: number;
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const successRateColor = (stats?.successRate || 0) >= 95 ? "positive" : 
                          (stats?.successRate || 0) >= 80 ? "neutral" : "negative";

  const quotaPercentage = stats ? (stats.apiQuotaUsed / stats.apiQuotaLimit) * 100 : 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-slate-600 mt-1">
            Monitor your indexing performance and manage your requests
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/indexnow">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Request
            </Button>
          </Link>
          <Button variant="outline" size="icon">
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total URLs Indexed"
          value={isLoading ? "..." : stats?.totalUrlsIndexed.toLocaleString() || "0"}
          icon={<TrendingUp className="h-6 w-6 text-emerald-600" />}
          trend={{
            value: "+12%",
            label: "from last week",
            type: "positive"
          }}
        />
        
        <StatsCard
          title="Active Jobs"
          value={isLoading ? "..." : stats?.activeJobs || "0"}
          icon={<Briefcase className="h-6 w-6 text-amber-600" />}
          description="3 scheduled"
        />
        
        <StatsCard
          title="Success Rate"
          value={isLoading ? "..." : `${stats?.successRate.toFixed(1) || "0"}%`}
          icon={<CheckCircle className="h-6 w-6 text-emerald-600" />}
          trend={{
            value: "Excellent",
            label: "",
            type: successRateColor
          }}
        />
        
        <StatsCard
          title="API Quota Used"
          value={isLoading ? "..." : stats?.apiQuotaUsed.toLocaleString() || "0"}
          icon={<Server className="h-6 w-6 text-blue-600" />}
          description={`of ${stats?.apiQuotaLimit.toLocaleString() || "0"} daily limit`}
        />
      </div>

      {/* Quick Actions and Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href="/dashboard/indexnow">
              <Button 
                variant="ghost" 
                className="w-full justify-start p-4 h-auto bg-primary/5 hover:bg-primary/10"
              >
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-slate-800">Submit URLs for Indexing</p>
                  <p className="text-sm text-slate-600">Manually add URLs or import from sitemap</p>
                </div>
              </Button>
            </Link>
            
            <Link href="/dashboard/settings">
              <Button 
                variant="ghost" 
                className="w-full justify-start p-4 h-auto bg-amber-50 hover:bg-amber-100"
              >
                <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                  <Key className="h-5 w-5 text-white" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-slate-800">Manage Service Accounts</p>
                  <p className="text-sm text-slate-600">Add or update Google service accounts</p>
                </div>
              </Button>
            </Link>
            
            <Link href="/dashboard/jobs">
              <Button 
                variant="ghost" 
                className="w-full justify-start p-4 h-auto bg-emerald-50 hover:bg-emerald-100"
              >
                <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center mr-3 flex-shrink-0">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-slate-800">View Job Status</p>
                  <p className="text-sm text-slate-600">Monitor indexing progress and results</p>
                </div>
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">45 URLs indexed successfully</p>
                <p className="text-xs text-slate-500">2 minutes ago</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Scheduled job created</p>
                <p className="text-xs text-slate-500">15 minutes ago</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Key className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">New service account added</p>
                <p className="text-xs text-slate-500">1 hour ago</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-800">Sitemap imported - 120 URLs</p>
                <p className="text-xs text-slate-500">2 hours ago</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Jobs</CardTitle>
          <Link href="/dashboard/jobs">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          <ErrorBoundary>
            <SimpleJobTable limit={5} />
          </ErrorBoundary>
        </CardContent>
      </Card>
    </div>
  );
}
