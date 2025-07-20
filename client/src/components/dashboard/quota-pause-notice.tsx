import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
  
  const resumeTime = getTimeUntilResume();

  return (
    <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm dark:bg-orange-950/20 dark:border-orange-800">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-100 text-xs">
              Paused - Quota Exhausted
            </Badge>
            <span className="text-orange-600 dark:text-orange-400 text-xs">
              {progressPercentage}% complete ({job.processedUrls}/{job.totalUrls} URLs)
            </span>
          </div>
          <p className="text-orange-700 dark:text-orange-300 text-xs">
            Daily quota exhausted - all service accounts reached Google API limits.{' '}
            {resumeTime ? `Auto resume: ${resumeTime}` : 'Will resume at 00:00 UTC.'}
          </p>
        </div>
        
        {onResumeJob && (
          <Button 
            onClick={onResumeJob}
            variant="outline" 
            size="sm"
            className="text-orange-700 border-orange-300 hover:bg-orange-100 dark:text-orange-300 dark:border-orange-700 dark:hover:bg-orange-900/20 text-xs px-3 py-1 h-7"
          >
            Check & Resume
          </Button>
        )}
      </div>
    </div>
  );
}