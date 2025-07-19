import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SimpleJobTable from "@/components/dashboard/simple-job-table";
import { Briefcase } from "lucide-react";

export default function Jobs() {
  return (
    <div className="p-6 space-y-6">
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
        <CardContent>
          <SimpleJobTable />
        </CardContent>
      </Card>
    </div>
  );
}
