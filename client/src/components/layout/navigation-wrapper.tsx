import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";

interface NavigationWrapperProps {
  children: React.ReactNode;
}

export default function NavigationWrapper({ children }: NavigationWrapperProps) {
  const [location] = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Only clear specific queries that might cause conflicts
    if (location.includes('/dashboard/jobs') || location.includes('/dashboard')) {
      queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
    }
  }, [location, queryClient]);

  return <>{children}</>;
}