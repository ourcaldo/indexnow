import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import JobTable from "@/components/dashboard/job-table";
import { Briefcase } from "lucide-react";

export default function Jobs() {
  // Set document title for better SEO
  useEffect(() => {
    document.title = "Manage Jobs - IndexNow";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Manage and monitor your Google indexing jobs. View job status, progress, and performance metrics.');
    }
  }, []);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Jobs</h1>
        <p className="text-slate-600 mt-1">
          View and manage your indexing jobs
        </p>
      </div>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Briefcase className="h-5 w-5 mr-2 text-primary" />
            Indexing Jobs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6">
          <JobTable />
        </CardContent>
      </Card>
    </div>
  );
}
