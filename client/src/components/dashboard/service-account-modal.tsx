import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Plus } from "lucide-react";

interface ServiceAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ServiceAccountModal({ 
  open, 
  onOpenChange 
}: ServiceAccountModalProps) {
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [validateAccount, setValidateAccount] = useState(true);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addServiceAccountMutation = useMutation({
    mutationFn: async (data: {
      serviceAccountJson: string;
      name?: string;
    }) => {
      return apiRequest("POST", "/api/service-accounts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/service-accounts"] });
      toast({
        title: "Success",
        description: "Service account added successfully",
      });
      setServiceAccountJson("");
      setDisplayName("");
      onOpenChange(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serviceAccountJson.trim()) {
      toast({
        title: "Error",
        description: "Service account JSON is required",
        variant: "destructive",
      });
      return;
    }

    try {
      JSON.parse(serviceAccountJson);
    } catch {
      toast({
        title: "Error",
        description: "Invalid JSON format",
        variant: "destructive",
      });
      return;
    }

    addServiceAccountMutation.mutate({
      serviceAccountJson: serviceAccountJson.trim(),
      name: displayName.trim() || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Service Account</DialogTitle>
          <DialogDescription>
            Add a Google service account to enable indexing requests. The service account must be added as an owner in Google Search Console.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="serviceAccountJson">Service Account JSON</Label>
            <Textarea
              id="serviceAccountJson"
              placeholder="Paste your service account JSON here..."
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
              className="h-48 font-mono text-sm"
              required
            />
            <p className="text-xs text-slate-500">
              Download this JSON file from Google Cloud Console → IAM & Admin → Service Accounts
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name (Optional)</Label>
            <Input
              id="displayName"
              placeholder="e.g., Production Account"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="validateAccount"
              checked={validateAccount}
              onCheckedChange={(checked) => setValidateAccount(checked as boolean)}
            />
            <Label htmlFor="validateAccount" className="text-sm">
              Validate account before saving
            </Label>
          </div>

          <div className="flex justify-end space-x-4 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={addServiceAccountMutation.isPending}
            >
              {addServiceAccountMutation.isPending ? (
                <>Adding...</>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service Account
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
