import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import QuotaStatus from "@/components/dashboard/quota-status";
import { 
  Send, 
  Save, 
  Download, 
  Zap,
  Calendar,
  Globe
} from "lucide-react";

export default function IndexNow() {
  // Set document title for better SEO
  useEffect(() => {
    document.title = "IndexNow - Submit URLs for Indexing | Google Indexing Dashboard";
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Submit URLs for instant indexing via Google Search Console API. Support both manual URLs and sitemap parsing with flexible scheduling options.');
    }
  }, []);
  const [activeTab, setActiveTab] = useState("manual");
  const [manualUrls, setManualUrls] = useState("");
  const [sitemapUrl, setSitemapUrl] = useState("");
  const [jobName, setJobName] = useState("");
  const [schedule, setSchedule] = useState("one-time");
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [parsedUrls, setParsedUrls] = useState<string[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Fetch existing jobs to generate automatic job names
  const { data: existingJobs } = useQuery({
    queryKey: ["/api/indexing-jobs"],
  });

  // Generate automatic job name if none is provided
  useEffect(() => {
    if (!jobName && existingJobs) {
      const jobNumbers = existingJobs
        .filter((job: any) => job.name.startsWith('#Job-'))
        .map((job: any) => {
          const match = job.name.match(/^#Job-(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .sort((a: number, b: number) => b - a);
      
      const nextNumber = jobNumbers.length > 0 ? jobNumbers[0] + 1 : 1;
      setJobName(`#Job-${nextNumber}`);
    }
  }, [existingJobs, jobName]);

  const createJobFromUrlsMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      urls: string[];
      schedule: string;
      cronExpression?: string;
    }) => {
      return apiRequest("POST", "/api/indexing-jobs/from-urls", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
      toast({
        title: "Success",
        description: "Indexing job created successfully",
      });
      resetForm();
      // Redirect to job detail page
      setLocation(`/dashboard/jobs/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createJobFromSitemapMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      sitemapUrl: string;
      schedule: string;
      cronExpression?: string;
    }) => {
      return apiRequest("POST", "/api/indexing-jobs/from-sitemap", data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
      toast({
        title: "Success",
        description: "Indexing job created successfully",
      });
      resetForm();
      // Redirect to job detail page
      setLocation(`/dashboard/jobs/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const parseSitemapMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/sitemap/parse", { url });
      return response.json();
    },
    onSuccess: (data) => {
      setParsedUrls(data.urls);
      toast({
        title: "Success",
        description: `Found ${data.urls.length} URLs in sitemap`,
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

  const resetForm = () => {
    setManualUrls("");
    setSitemapUrl("");
    setJobName("");
    setSchedule("one-time");
    setScheduledDateTime("");
    setParsedUrls([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!jobName.trim()) {
      toast({
        title: "Error",
        description: "Job name is required",
        variant: "destructive",
      });
      return;
    }

    if (activeTab === "manual") {
      const urls = manualUrls
        .split('\n')
        .map(url => url.trim())
        .filter(url => url.length > 0);

      if (urls.length === 0) {
        toast({
          title: "Error",
          description: "At least one URL is required",
          variant: "destructive",
        });
        return;
      }

      createJobFromUrlsMutation.mutate({
        name: jobName,
        urls,
        schedule,
      });
    } else {
      if (!sitemapUrl.trim()) {
        toast({
          title: "Error",
          description: "Sitemap URL is required",
          variant: "destructive",
        });
        return;
      }

      createJobFromSitemapMutation.mutate({
        name: jobName,
        sitemapUrl: sitemapUrl.trim(),
        schedule,
      });
    }
  };

  const handleParseSitemap = () => {
    if (!sitemapUrl.trim()) {
      toast({
        title: "Error",
        description: "Please enter a sitemap URL",
        variant: "destructive",
      });
      return;
    }

    parseSitemapMutation.mutate(sitemapUrl.trim());
  };

  const isSubmitting = createJobFromUrlsMutation.isPending || createJobFromSitemapMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">IndexNow</h1>
        <p className="text-slate-600 mt-1">
          Submit URLs for indexing and manage schedules
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* URL Input Form */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Zap className="h-5 w-5 mr-2 text-primary" />
                Submit URLs for Indexing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Job Name */}
                <div className="space-y-2">
                  <Label htmlFor="jobName">Job Name</Label>
                  <Input
                    id="jobName"
                    placeholder="Enter a descriptive name for this job"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    required
                  />
                </div>

                {/* URL Input Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="manual" className="flex items-center">
                      <Globe className="h-4 w-4 mr-2" />
                      Manual Input
                    </TabsTrigger>
                    <TabsTrigger value="sitemap" className="flex items-center">
                      <Download className="h-4 w-4 mr-2" />
                      From Sitemap
                    </TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="manual" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="manualUrls">URLs (one per line)</Label>
                      <Textarea
                        id="manualUrls"
                        placeholder="https://example.com/page1&#10;https://example.com/page2&#10;https://example.com/page3"
                        value={manualUrls}
                        onChange={(e) => setManualUrls(e.target.value)}
                        className="h-40 resize-none"
                        required={activeTab === "manual"}
                      />
                      <p className="text-xs text-slate-500">
                        Enter one URL per line. Maximum 1000 URLs per job.
                      </p>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="sitemap" className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="sitemapUrl">Sitemap URL</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="sitemapUrl"
                          type="url"
                          placeholder="https://example.com/sitemap.xml"
                          value={sitemapUrl}
                          onChange={(e) => setSitemapUrl(e.target.value)}
                          required={activeTab === "sitemap"}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleParseSitemap}
                          disabled={parseSitemapMutation.isPending}
                        >
                          {parseSitemapMutation.isPending ? (
                            "Parsing..."
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Parse
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">
                        Supports nested sitemaps and sitemap indexes.
                      </p>
                    </div>

                    {parsedUrls.length > 0 && (
                      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                        <p className="text-sm font-medium text-emerald-800 mb-2">
                          Found {parsedUrls.length} URLs
                        </p>
                        <div className="max-h-32 overflow-y-auto text-xs text-emerald-700">
                          {parsedUrls.slice(0, 10).map((url, index) => (
                            <div key={index} className="truncate">{url}</div>
                          ))}
                          {parsedUrls.length > 10 && (
                            <div className="text-emerald-600 font-medium">
                              ... and {parsedUrls.length - 10} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>

                {/* Schedule Settings */}
                <div className="border-t pt-6 space-y-4">
                  <Label className="text-base font-medium flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    Schedule
                  </Label>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="schedule">Frequency</Label>
                      <Select value={schedule} onValueChange={setSchedule}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one-time">One-time</SelectItem>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {schedule !== "one-time" && (
                      <div className="space-y-2">
                        <Label htmlFor="scheduledDateTime">Start Time</Label>
                        <Input
                          id="scheduledDateTime"
                          type="datetime-local"
                          value={scheduledDateTime}
                          onChange={(e) => setScheduledDateTime(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-4">
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      "Creating..."
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit for Indexing
                      </>
                    )}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={resetForm}
                    className="w-full sm:w-auto"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Clear Form
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Quota Status */}
        <div>
          <QuotaStatus />
        </div>
      </div>
    </div>
  );
}
