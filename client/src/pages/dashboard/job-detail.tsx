import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { IndexingJob, UrlSubmission } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useWebSocket } from "@/hooks/useWebSocket";
import { QuotaPauseNotice } from "@/components/dashboard/quota-pause-notice";
import { 
  ArrowLeft, 
  Calendar, 
  Globe, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Play,
  Pause,
  Square,
  RotateCcw,
  Trash2
} from "lucide-react";

export default function JobDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const jobId = params.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize WebSocket for real-time updates
  useWebSocket();

  const { data: job, isLoading: jobLoading } = useQuery<IndexingJob>({
    queryKey: ["/api/indexing-jobs", jobId],
    enabled: !!jobId,
  });

  const { data: submissions, isLoading: submissionsLoading } = useQuery<UrlSubmission[]>({
    queryKey: ["/api/indexing-jobs", jobId, "submissions"],
    enabled: !!jobId,
  });

  // Job action mutations
  const updateJobMutation = useMutation({
    mutationFn: async (data: { status: string }) => {
      const response = await apiRequest("PATCH", `/api/indexing-jobs/${jobId}`, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
      toast({
        title: "Success",
        description: "Job status updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const rerunJobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/indexing-jobs/${jobId}/rerun`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
      toast({
        title: "Success",
        description: "Job re-run started successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const resumeJobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/indexing-jobs/${jobId}/resume`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
      toast({
        title: "Success",
        description: "Job resume attempt completed",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/indexing-jobs/${jobId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
      toast({
        title: "Success",
        description: "Job deleted successfully",
      });
      // Redirect to jobs list after deletion
      setLocation("/dashboard/jobs");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Job action handlers
  const handleStartJob = () => {
    updateJobMutation.mutate({ status: 'pending' });
  };

  const handlePauseJob = () => {
    updateJobMutation.mutate({ status: 'paused' });
  };

  const handleStopJob = () => {
    updateJobMutation.mutate({ status: 'cancelled' });
  };

  const handleRerunJob = () => {
    rerunJobMutation.mutate();
  };

  const handleResumeJob = () => {
    resumeJobMutation.mutate();
  };

  const handleDeleteJob = () => {
    if (window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      deleteJobMutation.mutate();
    }
  };

  // Determine which buttons should be shown based on job status
  const canStart = job && ['paused', 'failed', 'cancelled'].includes(job.status);
  const canPause = job && job.status === 'running';
  const canStop = job && ['pending', 'running', 'paused'].includes(job.status);
  const canRerun = job && ['completed', 'failed', 'cancelled'].includes(job.status);
  const canDelete = job && ['completed', 'failed', 'cancelled', 'paused'].includes(job.status);

  if (jobLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold text-slate-800">Job Not Found</h2>
          <p className="text-slate-600 mt-2">The requested job could not be found.</p>
          <Button 
            onClick={() => setLocation("/dashboard/jobs")}
            className="mt-4"
          >
            Back to Jobs
          </Button>
        </div>
      </div>
    );
  }

  const progress = job.totalUrls > 0 ? Math.min((job.processedUrls / job.totalUrls) * 100, 100) : 0;
  const successRate = job.processedUrls > 0 ? (job.successfulUrls / job.processedUrls) * 100 : 0;

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, color: "text-amber-700 bg-amber-100" },
      running: { variant: "default" as const, color: "text-blue-700 bg-blue-100" },
      completed: { variant: "default" as const, color: "text-emerald-700 bg-emerald-100" },
      failed: { variant: "destructive" as const, color: "text-red-700 bg-red-100" },
      paused: { variant: "secondary" as const, color: "text-slate-700 bg-slate-100" },
      cancelled: { variant: "secondary" as const, color: "text-slate-700 bg-slate-100" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge className={config.color}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getUrlStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "quota_exceeded":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getUrlStatusBadge = (status: string) => {
    const statusConfig = {
      pending: "text-slate-700 bg-slate-100",
      success: "text-emerald-700 bg-emerald-100",
      error: "text-red-700 bg-red-100",
      quota_exceeded: "text-amber-700 bg-amber-100",
    };

    return (
      <Badge className={statusConfig[status as keyof typeof statusConfig] || statusConfig.pending}>
        {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setLocation("/dashboard/jobs")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{job.name}</h1>
            <p className="text-slate-600">Job details and progress</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {canStart && (
            <Button
              onClick={handleStartJob}
              disabled={updateJobMutation.isPending}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Play className="h-4 w-4 mr-2" />
              Start
            </Button>
          )}
          
          {canPause && (
            <Button
              onClick={handlePauseJob}
              disabled={updateJobMutation.isPending}
              size="sm"
              variant="outline"
            >
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          
          {canStop && (
            <Button
              onClick={handleStopJob}
              disabled={updateJobMutation.isPending}
              size="sm"
              variant="destructive"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          )}
          
          {canRerun && (
            <Button
              onClick={handleRerunJob}
              disabled={rerunJobMutation.isPending}
              size="sm"
              variant="outline"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Re-run
            </Button>
          )}
          
          {canDelete && (
            <Button
              onClick={handleDeleteJob}
              disabled={deleteJobMutation.isPending}
              size="sm"
              variant="destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Quota Pause Notice */}
      <QuotaPauseNotice job={job} onResumeJob={handleResumeJob} />

      {/* Job Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Job Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Status</span>
              {getStatusBadge(job.status)}
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Schedule</span>
              <Badge variant="outline">
                {job.schedule.charAt(0).toUpperCase() + job.schedule.slice(1)}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Created</span>
              <span className="text-sm">
                {new Date(job.createdAt!).toLocaleDateString()}
              </span>
            </div>

            {job.lastRun && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Last Run</span>
                <span className="text-sm">
                  {new Date(job.lastRun).toLocaleString()}
                </span>
              </div>
            )}

            {job.nextRun && job.schedule !== 'one-time' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Next Run</span>
                <span className="text-sm">
                  {new Date(job.nextRun).toLocaleString()}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-600">Total URLs</span>
                <p className="text-lg font-semibold">{job.totalUrls}</p>
              </div>
              <div>
                <span className="text-slate-600">Processed</span>
                <p className="text-lg font-semibold">{job.processedUrls}</p>
              </div>
              <div>
                <span className="text-slate-600">Successful</span>
                <p className="text-lg font-semibold text-emerald-600">{job.successfulUrls}</p>
              </div>
              <div>
                <span className="text-slate-600">Failed</span>
                <p className="text-lg font-semibold text-red-600">{job.failedUrls}</p>
              </div>
            </div>

            {job.processedUrls > 0 && (
              <div>
                <span className="text-sm text-slate-600">Success Rate</span>
                <p className="text-lg font-semibold">{Math.round(successRate)}%</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.sitemapUrl ? (
              <div>
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <Globe className="h-4 w-4 mr-2" />
                  Sitemap
                </div>
                <p className="text-sm break-all bg-slate-50 p-2 rounded">
                  {job.sitemapUrl}
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <Globe className="h-4 w-4 mr-2" />
                  Manual URLs
                </div>
                <p className="text-sm text-slate-600">
                  {job.manualUrls?.length || 0} URLs provided manually
                </p>
              </div>
            )}

            {job.cronExpression && (
              <div>
                <div className="flex items-center text-sm text-slate-600 mb-2">
                  <Calendar className="h-4 w-4 mr-2" />
                  Cron Expression
                </div>
                <p className="text-sm font-mono bg-slate-50 p-2 rounded">
                  {job.cronExpression}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* URL Submissions */}
      <Card>
        <CardHeader>
          <CardTitle>URL Submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {submissionsLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : submissions && submissions.length > 0 ? (
            <div className="rounded-md border overflow-hidden">
              <div className="max-h-96 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted At</TableHead>
                      <TableHead>Error Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell className="font-mono text-sm max-w-md truncate">
                          {submission.url}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            {getUrlStatusIcon(submission.status)}
                            {getUrlStatusBadge(submission.status)}
                          </div>
                        </TableCell>
                        <TableCell>
                          {submission.submittedAt 
                            ? new Date(submission.submittedAt).toLocaleString()
                            : "-"
                          }
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {submission.errorMessage || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <Globe className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No URL submissions yet</p>
              <p className="text-sm">Submissions will appear here when the job starts processing</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
