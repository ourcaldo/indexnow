import { AlertTriangle, Clock, Calendar } from "lucide-react";
import { Alert, AlertContent, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface QuotaPauseNoticeProps {
  job: {
    id: string;
    name: string;
    status: string;
    pausedDueToQuota: boolean;
    pausedAt?: string;
    pauseReason?: string;
    resumeAfter?: string;
    quotaExceededUrls?: number;
    totalUrls: number;
    processedUrls: number;
    successfulUrls: number;
    failedUrls: number;
  };
  onResumeJob?: () => void;
}

export function QuotaPauseNotice({ job, onResumeJob }: QuotaPauseNoticeProps) {
  if (!job.pausedDueToQuota || job.status !== 'paused') {
    return null;
  }

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'Not specified';
    return format(new Date(dateString), 'PPP p');
  };

  const getTimeUntilResume = () => {
    if (!job.resumeAfter) return null;
    
    const resumeTime = new Date(job.resumeAfter);
    const now = new Date();
    const diffMs = resumeTime.getTime() - now.getTime();
    
    if (diffMs <= 0) return "Ready to resume";
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `Resumes in ${hours}h ${minutes}m`;
    } else {
      return `Resumes in ${minutes}m`;
    }
  };

  const progressPercentage = job.totalUrls > 0 ? 
    Math.round((job.processedUrls / job.totalUrls) * 100) : 0;

  return (
    <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          <CardTitle className="text-orange-800 dark:text-orange-200">
            Job Paused - Quota Exhausted
          </CardTitle>
          <Badge variant="outline" className="text-orange-700 border-orange-300">
            {progressPercentage}% Complete
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Alert className="border-orange-200 bg-orange-100/50 dark:border-orange-700 dark:bg-orange-900/20">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-orange-800 dark:text-orange-200">
            Processing Suspended
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            {job.pauseReason || 'Job paused due to quota limits'}
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Paused At:</span>
            </div>
            <p className="text-orange-600 dark:text-orange-400 pl-6">
              {formatDateTime(job.pausedAt)}
            </p>
          </div>

          {job.resumeAfter && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Auto Resume:</span>
              </div>
              <p className="text-orange-600 dark:text-orange-400 pl-6">
                {getTimeUntilResume()}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4 p-4 bg-white/50 dark:bg-black/10 rounded-lg border border-orange-200 dark:border-orange-800">
          <div className="text-center">
            <div className="text-lg font-semibold text-green-600 dark:text-green-400">
              {job.successfulUrls}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Successful</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-red-600 dark:text-red-400">
              {job.failedUrls}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Failed</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-orange-600 dark:text-orange-400">
              {job.quotaExceededUrls || 0}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Quota Exceeded</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
              {job.totalUrls - job.processedUrls}
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Remaining</div>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
          <div 
            className="bg-orange-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>

        <div className="flex gap-2 text-xs text-orange-600 dark:text-orange-400">
          <span>💡 Tip:</span>
          <span>
            The job will automatically resume when daily quotas reset at 00:00 UTC, 
            or you can add more service accounts to continue processing.
          </span>
        </div>

        {onResumeJob && (
          <div className="pt-2">
            <Button 
              onClick={onResumeJob}
              variant="outline" 
              size="sm"
              className="text-orange-700 border-orange-300 hover:bg-orange-100 dark:text-orange-300 dark:border-orange-700 dark:hover:bg-orange-900/20"
            >
              <Clock className="h-4 w-4 mr-2" />
              Check & Resume Now
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}