import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import ServiceAccountModal from "@/components/dashboard/service-account-modal";
import { ServiceAccount } from "@shared/schema";
import { 
  Settings as SettingsIcon, 
  Key, 
  Plus, 
  Trash2,
  Mail,
  Shield,
  Clock
} from "lucide-react";

export default function Settings() {
  const [serviceAccountModalOpen, setServiceAccountModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: serviceAccounts, isLoading } = useQuery<ServiceAccount[]>({
    queryKey: ["/api/service-accounts"],
  });

  const deleteServiceAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/service-accounts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-accounts"] });
      toast({
        title: "Success",
        description: "Service account deleted successfully",
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

  const handleDeleteServiceAccount = (id: string) => {
    if (confirm("Are you sure you want to delete this service account?")) {
      deleteServiceAccountMutation.mutate(id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        <p className="text-slate-600 mt-1">
          Configure your service accounts and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Accounts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Key className="h-5 w-5 mr-2 text-primary" />
              Service Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : serviceAccounts && serviceAccounts.length > 0 ? (
              serviceAccounts.map((account) => (
                <div
                  key={account.id}
                  className={`p-4 rounded-lg border ${
                    account.isActive 
                      ? "border-emerald-200 bg-emerald-50" 
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700">
                      {account.name}
                    </span>
                    <div className="flex items-center space-x-2">
                      <Badge className={
                        account.isActive 
                          ? "text-emerald-700 bg-emerald-100" 
                          : "text-slate-700 bg-slate-100"
                      }>
                        {account.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteServiceAccount(account.id)}
                        className="p-1 h-auto text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 truncate">
                    {account.clientEmail}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Daily Limit: {account.dailyQuotaLimit} requests
                  </p>
                  <p className="text-xs text-slate-500">
                    Added {new Date(account.createdAt!).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Key className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>No service accounts configured</p>
                <p className="text-sm">Add a service account to start indexing</p>
              </div>
            )}

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Plus className="h-8 w-8 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-4">Add a new service account</p>
              <Button onClick={() => setServiceAccountModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Service Account
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <SettingsIcon className="h-5 w-5 mr-2 text-primary" />
              General Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="defaultSchedule">Default Schedule</Label>
              <Select defaultValue="one-time">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-base font-medium flex items-center">
                <Mail className="h-4 w-4 mr-2" />
                Notification Settings
              </Label>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox id="emailCompletion" defaultChecked />
                  <Label htmlFor="emailCompletion" className="text-sm">
                    Email notifications for job completion
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="emailFailures" />
                  <Label htmlFor="emailFailures" className="text-sm">
                    Email notifications for failures
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="dailyReports" defaultChecked />
                  <Label htmlFor="dailyReports" className="text-sm">
                    Daily quota reports
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="requestTimeout" className="flex items-center">
                <Clock className="h-4 w-4 mr-2" />
                Request Timeout (seconds)
              </Label>
              <Input
                id="requestTimeout"
                type="number"
                defaultValue="30"
                min="5"
                max="300"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="retryAttempts" className="flex items-center">
                <Shield className="h-4 w-4 mr-2" />
                Retry Attempts
              </Label>
              <Input
                id="retryAttempts"
                type="number"
                defaultValue="3"
                min="0"
                max="10"
              />
            </div>

            <div className="pt-4 border-t">
              <Button className="w-full">
                Save Settings
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service Account Modal */}
      <ServiceAccountModal
        open={serviceAccountModalOpen}
        onOpenChange={setServiceAccountModalOpen}
      />
    </div>
  );
}
