import dotenv from 'dotenv';
dotenv.config();

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { jobScheduler } from "./services/job-scheduler";
import { securityHeaders, rateLimit, validateEnvironment, sanitizeLogsMiddleware } from "./middleware/security";
import { sanitizeInputs, validateSqlInjection, validateFileUpload } from "./middleware/input-validation";
import { requestLoggingMiddleware, errorLoggingMiddleware } from "./middleware/secure-logging";
import { validateContentSecurityPolicy, csrfProtection } from "./middleware/authorization";
import { SecurityAudit } from "./middleware/security-audit";
import { assetConfig } from "./services/asset-config";

// Validate environment variables at startup
validateEnvironment();

const app = express();

// Security middleware
app.use(securityHeaders);
app.use(sanitizeLogsMiddleware);

// Advanced security monitoring (temporarily disabled verbose logging)
// app.use(SecurityAudit.monitorSuspiciousActivity);
// app.use(SecurityAudit.detectVulnerabilityScanning);
// app.use(SecurityAudit.monitorRequestPatterns);
// app.use(SecurityAudit.detectBruteForce());

// Input validation and sanitization
app.use(sanitizeInputs);
app.use(validateSqlInjection);
app.use(validateContentSecurityPolicy);
app.use(csrfProtection);
app.use(validateFileUpload());

// Rate limiting for API routes
app.use('/api/', rateLimit(100, 15 * 60 * 1000)); // 100 requests per 15 minutes

// CORS middleware with environment-based origins
app.use((req, res, next) => {
  const allowedOrigins = assetConfig.getAllowedOrigins();
  const origin = req.headers.origin;
  
  if (!origin || assetConfig.isOriginAllowed(origin)) {
    res.header('Access-Control-Allow-Origin', origin || allowedOrigins[0]);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: false, limit: '10mb' })); // Limit URL-encoded payload size

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use(errorLoggingMiddleware);
  
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Don't expose internal error details in production
    if (process.env.NODE_ENV === 'production') {
      res.status(status).json({ error: status >= 500 ? 'Internal Server Error' : message });
    } else {
      res.status(status).json({ error: message, stack: err.stack });
    }
    
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Initialize job scheduler after server starts
    try {
      await jobScheduler.initializeScheduler();
      log("Job scheduler initialized successfully");
      


    } catch (error) {
      console.error("Failed to initialize job scheduler:", error);
    }
  });
})();
