import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthContextProvider } from "@/components/auth/auth-provider";
import { useAuth } from "@/hooks/use-auth";
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
  const { user, loading } = useAuth();
  
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <Switch>
      <Route path="/login">
        {user ? <Redirect to="/dashboard" /> : <Login />}
      </Route>
      <Route path="/signup">
        {user ? <Redirect to="/dashboard" /> : <Signup />}
      </Route>
      <Route path="/dashboard">
        {!user ? <Redirect to="/login" /> : (
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/dashboard/indexnow">
        {!user ? <Redirect to="/login" /> : (
          <DashboardLayout>
            <IndexNow />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/dashboard/jobs">
        {!user ? <Redirect to="/login" /> : (
          <DashboardLayout>
            <Jobs />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/dashboard/jobs/:id">
        {!user ? <Redirect to="/login" /> : (
          <DashboardLayout>
            <JobDetail />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/dashboard/settings">
        {!user ? <Redirect to="/login" /> : (
          <DashboardLayout>
            <Settings />
          </DashboardLayout>
        )}
      </Route>
      <Route path="/">
        {user ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
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
