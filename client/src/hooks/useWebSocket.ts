import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  jobId: string;
  status: string;
  data?: any;
  timestamp: string;
}

export function useWebSocket() {
  const ws = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.current.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === 'jobUpdate') {
            console.log('Job update received:', message);
            
            // Invalidate all relevant queries to trigger real-time updates
            queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs", message.jobId] });
            queryClient.invalidateQueries({ queryKey: ["/api/indexing-jobs", message.jobId, "submissions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/dashboard-stats"] });
            queryClient.invalidateQueries({ queryKey: ["/api/service-accounts"] });
            
            // Force immediate refetch for active job details
            queryClient.refetchQueries({ queryKey: ["/api/indexing-jobs", message.jobId] });
            queryClient.refetchQueries({ queryKey: ["/api/indexing-jobs", message.jobId, "submissions"] });
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.current.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    connect,
    disconnect,
    isConnected: ws.current?.readyState === WebSocket.OPEN
  };
}