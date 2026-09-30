#!/bin/bash

# Flutter Chat Client Setup Script
# This script helps set up the Flutter client for first-time use

set -e

echo "🚀 Flutter Chat Client Setup"
echo "=============================="
echo ""

# Check if Flutter is installed
if ! command -v flutter &> /dev/null; then
    echo "❌ Flutter is not installed!"
    echo "Please install Flutter from: https://flutter.dev/docs/get-started/install"
    exit 1
fi

echo "✅ Flutter found: $(flutter --version | head -n 1)"
echo ""

# Run Flutter doctor
echo "📋 Checking Flutter setup..."
flutter doctor
echo ""

# Get dependencies
echo "📦 Installing dependencies..."
flutter pub get
echo ""

# Check for available devices
echo "📱 Available devices:"
flutter devices
echo ""

# Ask for API URL configuration
echo "⚙️  API Configuration"
echo "--------------------"
echo "The default API URL is: http://localhost:7979"
echo ""
echo "Do you need to change the API URL?"
echo "  - For Android Emulator: use http://10.0.2.2:7979"
echo "  - For Real Device: use http://YOUR_IP:7979"
echo "  - For iOS Simulator/macOS: use http://localhost:7979 (default)"
echo ""
read -p "Change API URL? (y/n): " change_url

if [ "$change_url" = "y" ] || [ "$change_url" = "Y" ]; then
    read -p "Enter API URL (e.g., http://10.0.2.2:7979): " api_url
    
    # Update constants.dart
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|defaultValue: 'http://localhost:7979'|defaultValue: '$api_url'|g" lib/utils/constants.dart
    else
        # Linux
        sed -i "s|defaultValue: 'http://localhost:7979'|defaultValue: '$api_url'|g" lib/utils/constants.dart
    fi
    
    echo "✅ API URL updated to: $api_url"
else
    echo "✅ Using default API URL: http://localhost:7979"
fi
echo ""

# Check if backend is running
echo "🔍 Checking if backend is running..."
if curl -s http://localhost:7979/health > /dev/null 2>&1; then
    echo "✅ Backend is running!"
else
    echo "⚠️  Warning: Backend is not responding at http://localhost:7979"
    echo "   Please start the backend before running the app:"
    echo "   cd ../back && make db-up && make migrate-up && make run"
fi
echo ""

# Platform-specific instructions
echo "🎯 Next Steps"
echo "-------------"
echo ""
echo "To run on Android:"
echo "  flutter run"
echo ""
echo "To run on iOS (macOS only):"
echo "  flutter run"
echo ""
echo "To run on macOS:"
echo "  flutter run -d macos"
echo ""
echo "To run on Windows:"
echo "  flutter run -d windows"
echo ""
echo "To run on Linux:"
echo "  flutter run -d linux"
echo ""
echo "For more information, see README.md or QUICKSTART.md"
echo ""
echo "✨ Setup complete! Happy coding!"
