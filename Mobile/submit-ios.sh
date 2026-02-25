#!/bin/bash
# iOS TestFlight submission script
# This script submits the latest iOS build to TestFlight

set -e

echo "🚀 Starting iOS TestFlight submission..."

# Navigate to Mobile directory
cd "$(dirname "$0")"

# Check if build is ready
echo "📦 Checking latest iOS build status..."
BUILD_STATUS=$(npx eas-cli build:list --platform ios --limit 1 --json 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")

if [ "$BUILD_STATUS" != "finished" ]; then
    echo "⚠️  Latest build is not ready. Status: $BUILD_STATUS"
    if [ "$BUILD_STATUS" = "errored" ] || [ "$BUILD_STATUS" = "failed" ] || [ "$BUILD_STATUS" = "canceled" ]; then
      echo "❌ Build is not eligible for TestFlight submission."
      exit 1
    fi
    echo "⏳ Please wait for the build to complete, then run this script again."
    exit 1
fi

echo "✅ Build is ready for submission"
echo "📤 Submitting to TestFlight..."

# Submit to TestFlight
EAS_NO_VCS=1 npx eas-cli submit --platform ios --latest --non-interactive

echo "✅ Submission completed!"
echo "📱 Check App Store Connect for TestFlight status"

