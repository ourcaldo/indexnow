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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { IndexingJob } from "@shared/schema";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Eye, MoreHorizontal, Pause, Play, Trash2, Filter } from "lucide-react";

interface JobTableProps {
  limit?: number;
}

export default function JobTable({ limit }: JobTableProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize WebSocket for real-time updates
  useWebSocket();

  const { data: jobs, isLoading } = useQuery<IndexingJob[]>({
    queryKey: ["/api/indexing-jobs"],
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
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

  const filteredJobs = jobs?.filter(job => 
    statusFilter === "all" || job.status === statusFilter
  ) || [];

  const displayJobs = limit ? filteredJobs.slice(0, limit) : filteredJobs;

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
        {schedule.charAt(0).toUpperCase() + schedule.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!limit && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>URLs</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayJobs.map((job) => {
              const progress = job.totalUrls > 0 
                ? (job.processedUrls / job.totalUrls) * 100 
                : 0;

              return (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.name}</TableCell>
                  <TableCell>
                    {new Date(job.createdAt!).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{getScheduleBadge(job.schedule)}</TableCell>
                  <TableCell>{job.totalUrls} URLs</TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Progress value={progress} className="h-2" />
                      <div className="text-xs text-slate-600">
                        {job.processedUrls}/{job.totalUrls} ({Math.round(progress)}%)
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
                            onClick={() => updateJobMutation.mutate({ 
                              id: job.id, 
                              status: "paused" 
                            })}
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </DropdownMenuItem>
                        )}
                        
                        {job.status === "paused" && (
                          <DropdownMenuItem
                            onClick={() => updateJobMutation.mutate({ 
                              id: job.id, 
                              status: "pending" 
                            })}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Resume
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuItem
                          onClick={() => deleteJobMutation.mutate(job.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {displayJobs.length === 0 && (
        <div className="text-center p-8 text-slate-500">
          <p>No jobs found</p>
          <p className="text-sm">Create your first indexing job to get started</p>
        </div>
      )}
    </div>
  );
}
