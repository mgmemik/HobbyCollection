#!/bin/bash
# Android build script for EAS Build
# This script handles git issues and builds Android app for production

set -e

echo "🚀 Starting Android build process..."

# Navigate to Mobile directory
cd "$(dirname "$0")"

# Default to production profile if not specified
PROFILE="${1:-production}"

echo "📦 Build profile: $PROFILE"

# Check if git is properly configured
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "⚠️  Git repository not found in parent directory"
    echo "📦 Building without version control..."
    EAS_NO_VCS=1 npx eas-cli build --platform android --profile "$PROFILE" --non-interactive "${@:2}"
else
    echo "✅ Git repository found"
    # Try normal build first
    if ! npx eas-cli build --platform android --profile "$PROFILE" --non-interactive "${@:2}" 2>&1 | grep -q "git clone"; then
        echo "✅ Build started successfully with git"
    else
        echo "⚠️  Git clone issue detected, using EAS_NO_VCS mode..."
        EAS_NO_VCS=1 npx eas-cli build --platform android --profile "$PROFILE" --non-interactive "${@:2}"
    fi
fi

echo ""
echo "✅ Build process completed!"
echo "📱 To submit to Google Play after build finishes, run:"
echo "   ./submit-android.sh"
echo ""

