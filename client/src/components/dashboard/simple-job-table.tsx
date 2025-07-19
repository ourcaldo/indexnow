import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { IndexingJob } from "@shared/schema";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Eye, MoreHorizontal, Pause, Play, Trash2, ChevronLeft, ChevronRight } from "lucide-react";

interface SimpleJobTableProps {
  limit?: number;
}

export default function SimpleJobTable({ limit }: SimpleJobTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  useWebSocket();

  const pageSize = 20;

  const { data: jobs = [], isLoading, error } = useQuery<IndexingJob[]>({
    queryKey: ["/api/indexing-jobs"],
    queryFn: () => apiRequest("GET", "/api/indexing-jobs"),
  });

  // Client-side pagination
  const totalPages = limit ? 1 : Math.ceil(jobs.length / pageSize);
  const startIndex = limit ? 0 : (currentPage - 1) * pageSize;
  const endIndex = limit ? limit : startIndex + pageSize;
  const displayJobs = jobs.slice(startIndex, endIndex);

  const updateJobMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/indexing-jobs/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
      toast({
        title: "Success",
        description: "Job updated successfully",
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
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/indexing-jobs/${id}`);
    },
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
      setSelectedJobs(prev => prev.filter(jobId => jobId !== deletedId));
      toast({
        title: "Success",
        description: "Job deleted successfully",
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

  const bulkDeleteMutation = useMutation({
    mutationFn: async (jobIds: string[]) => {
      return apiRequest("DELETE", "/api/indexing-jobs/bulk", { jobIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
      setSelectedJobs([]);
      setShowDeleteDialog(false);
      toast({
        title: "Success",
        description: `${selectedJobs.length} jobs deleted successfully`,
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedJobs(displayJobs.map(job => job.id));
    } else {
      setSelectedJobs([]);
    }
  };

  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (checked) {
      setSelectedJobs(prev => [...prev, jobId]);
    } else {
      setSelectedJobs(prev => prev.filter(id => id !== jobId));
    }
  };

  const handleBulkDelete = () => {
    if (selectedJobs.length > 0) {
      bulkDeleteMutation.mutate(selectedJobs);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: "text-amber-700 bg-amber-100",
      running: "text-blue-700 bg-blue-100",
      completed: "text-emerald-700 bg-emerald-100",
      failed: "text-red-700 bg-red-100",
      paused: "text-slate-700 bg-slate-100",
      cancelled: "text-slate-700 bg-slate-100",
    };

    return (
      <Badge className={statusConfig[status as keyof typeof statusConfig] || statusConfig.pending}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getScheduleBadge = (schedule: string) => {
    const colors = {
      "one-time": "text-emerald-700 bg-emerald-100",
      "hourly": "text-blue-700 bg-blue-100",
      "daily": "text-purple-700 bg-purple-100",
      "weekly": "text-amber-700 bg-amber-100",
      "monthly": "text-pink-700 bg-pink-100",
    };

    return (
      <Badge className={colors[schedule as keyof typeof colors] || colors["one-time"]}>
        {schedule}
      </Badge>
    );
  };

  const getProgress = (job: IndexingJob) => {
    if (job.totalUrls === 0) return 0;
    return Math.round((job.processedUrls / job.totalUrls) * 100);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-600">Loading jobs...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-red-600">Error loading jobs</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk Delete Button */}
      {!limit && selectedJobs.length > 0 && (
        <div className="flex justify-end">
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            disabled={bulkDeleteMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Selected ({selectedJobs.length})
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {!limit && (
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedJobs.length === displayJobs.length && displayJobs.length > 0}
                    onCheckedChange={handleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead>Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>URLs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={!limit ? 8 : 7} className="text-center py-8 text-slate-500">
                  No jobs found
                </TableCell>
              </TableRow>
            ) : (
              displayJobs.map((job) => (
                <TableRow key={job.id}>
                  {!limit && (
                    <TableCell>
                      <Checkbox
                        checked={selectedJobs.includes(job.id)}
                        onCheckedChange={(checked) => handleSelectJob(job.id, checked as boolean)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell>{formatDate(job.createdAt)}</TableCell>
                  <TableCell>{getScheduleBadge(job.schedule)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{job.totalUrls} total</div>
                      <div className="text-slate-500">
                        {job.successfulUrls} success, {job.failedUrls} failed
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={getProgress(job)} className="h-2" />
                      <div className="text-xs text-slate-500">
                        {job.processedUrls}/{job.totalUrls} processed
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/jobs/${job.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {job.status === "running" && (
                          <DropdownMenuItem
                            onClick={() => updateJobMutation.mutate({ id: job.id, status: "paused" })}
                            disabled={updateJobMutation.isPending}
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </DropdownMenuItem>
                        )}
                        {(job.status === "paused" || job.status === "failed") && (
                          <DropdownMenuItem
                            onClick={() => updateJobMutation.mutate({ id: job.id, status: "pending" })}
                            disabled={updateJobMutation.isPending}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => deleteJobMutation.mutate(job.id)}
                          disabled={deleteJobMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!limit && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Selected Jobs</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedJobs.length} selected jobs? This action cannot be undone.
              All associated URL submissions will also be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={bulkDeleteMutation.isPending}
            >
              {bulkDeleteMutation.isPending ? "Deleting..." : "Delete Jobs"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}