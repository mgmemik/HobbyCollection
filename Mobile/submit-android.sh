#!/bin/bash
# Android Google Play submission script
# This script submits the latest Android build to Google Play (Internal Testing track)

set -e

echo "🚀 Starting Android Google Play submission..."

# Navigate to Mobile directory
cd "$(dirname "$0")"

# Check if service account key exists
if [ ! -f "google-play-service-account.json" ]; then
    echo "❌ ERROR: google-play-service-account.json not found!"
    echo "   Please ensure the service account key file exists in the Mobile directory."
    exit 1
fi

# Check if build is ready
echo "📦 Checking latest Android build status..."
BUILD_STATUS=$(npx eas-cli build:list --platform android --limit 1 --json 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")

if [ "$BUILD_STATUS" != "finished" ]; then
    echo "⚠️  Latest build is not finished yet. Status: $BUILD_STATUS"
    echo "⏳ Please wait for the build to complete, then run this script again."
    echo ""
    echo "To check build status manually:"
    echo "  npx eas-cli build:list --platform android --limit 5"
    exit 1
fi

echo "✅ Build is ready for submission"
echo "📤 Submitting to Google Play (Internal Testing track)..."

# Submit to Google Play
EAS_NO_VCS=1 npx eas-cli submit --platform android --latest --profile production --non-interactive

echo ""
echo "✅ Submission completed!"
echo "📱 Check Google Play Console for submission status"
echo "   Track: Internal Testing"
echo ""

