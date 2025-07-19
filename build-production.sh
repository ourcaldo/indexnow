#!/bin/bash
# Production build script for Google Indexing Dashboard
# This script fixes the import.meta.dirname issue in production builds

echo "🔨 Building Google Indexing Dashboard for production..."
echo "📦 Building frontend..."
npm run build:frontend

echo "🚀 Building backend with proper path resolution..."
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist \
  --define:import.meta.dirname='"./"'

echo "✅ Production build completed successfully!"
echo "🏃 To start production server: NODE_ENV=production node dist/index.js"