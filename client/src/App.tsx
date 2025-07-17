import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthContextProvider } from "@/components/auth/auth-provider";
import NotFound from "@/pages/not-found";
import Login from "@/pages/auth/login";
import Signup from "@/pages/auth/signup";
import Dashboard from "@/pages/dashboard/index";
import IndexNow from "@/pages/dashboard/indexnow";
import Jobs from "@/pages/dashboard/jobs";
import JobDetail from "@/pages/dashboard/job-detail";
import Settings from "@/pages/dashboard/settings";
import DashboardLayout from "@/components/layout/dashboard-layout";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/dashboard" nest>
        <DashboardLayout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/indexnow" component={IndexNow} />
            <Route path="/jobs" component={Jobs} />
            <Route path="/jobs/:id" component={JobDetail} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </DashboardLayout>
      </Route>
      <Route path="/" component={() => <Login />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthContextProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthContextProvider>
    </QueryClientProvider>
  );
}

export default App;
