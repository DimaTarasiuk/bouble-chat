# Getting Started with Flutter Chat Client

Welcome! This guide will help you get the Flutter chat client up and running quickly.

## What You're Building With

This Flutter app provides a complete cross-platform chat experience that works on:
- 📱 Android (phones & tablets)
- 🍎 iOS (iPhone & iPad)
- 💻 macOS (desktop)
- 🖥️ Windows (desktop)
- 🐧 Linux (desktop)

## Prerequisites

### Required
1. **Flutter SDK** (3.0.0+)
   - Download: https://flutter.dev/docs/get-started/install
   - Verify: `flutter --version`

2. **Git**
   - Usually pre-installed on macOS/Linux
   - Windows: https://git-scm.com/download/win

### Platform-Specific

**For Android:**
- Android Studio OR Android SDK command-line tools
- Android Emulator or physical device with USB debugging

**For iOS (macOS only):**
- Xcode 14+
- CocoaPods (usually installed with Xcode)
- iOS Simulator or physical device

**For macOS:**
- macOS 10.14+
- Xcode command-line tools: `xcode-select --install`

**For Windows:**
- Visual Studio 2022 with "Desktop development with C++"
- Windows 10 SDK

**For Linux:**
```bash
sudo apt-get install clang cmake ninja-build libgtk-3-dev
```

## Quick Start (5 Minutes)

### Step 1: Verify Flutter Installation

```bash
flutter doctor
```

This command checks your Flutter setup. Fix any ❌ errors it reports.

### Step 2: Clone & Navigate

If you haven't already:
```bash
cd flutter_client
```

### Step 3: Install Dependencies

```bash
flutter pub get
```

This downloads all required packages (~30 seconds).

### Step 4: Start Backend

The Flutter app needs the backend server running:

```bash
# In a new terminal, from project root:
cd back
make db-up
make migrate-up
make run
```

Backend will run on `http://localhost:7979`

### Step 5: Configure API URL (if needed)

**For iOS Simulator or macOS:** No changes needed! ✅

**For Android Emulator:** Edit `lib/utils/constants.dart`, line 10:
```dart
defaultValue: 'http://10.0.2.2:7979',  // Instead of localhost
```

**For Real Device:** Use your computer's IP:
```bash
# Find your IP:
# macOS/Linux: ifconfig | grep "inet "
# Windows: ipconfig | findstr IPv4

# Then edit lib/utils/constants.dart:
defaultValue: 'http://192.168.1.100:7979',  # Your IP here
```

### Step 6: Run the App

```bash
flutter run
```

Flutter will:
1. Detect connected devices/emulators
2. Build the app (~2 minutes first time)
3. Install and launch it
4. Enable hot reload for instant changes

**Multiple devices?** Choose one or run on specific device:
```bash
flutter devices  # List all
flutter run -d device_id
```

### Step 7: Test It Out!

1. **Register** a new account
   - Username: `testuser`
   - Password: `test123` (min 6 chars)
   - Gender: Select one

2. **Create another user** (in browser or another device)
   - Register `testuser2`

3. **Start chatting!**
   - Tap the ➕ button
   - Search for `testuser2`
   - Send messages in real-time!

## Development Workflow

### Making Changes

1. Edit any `.dart` file
2. Press `r` in terminal (or save in IDE)
3. See changes instantly! ⚡

### Hot Reload vs Hot Restart

- **Hot Reload (`r`)**: Updates UI, keeps state (fast!)
- **Hot Restart (`R`)**: Rebuilds app, resets state
- **Full Restart (`q` → `flutter run`)**: When hot reload doesn't work

### Project Structure Tour

```
lib/
├── main.dart              👈 Start here: app entry point
├── screens/               👈 Full-screen views
│   ├── auth_screen.dart      Login/register
│   ├── chat_screen.dart      Conversations list
│   └── conversation_screen.dart  Chat messages
├── widgets/               👈 Reusable components
├── providers/             👈 State management
├── services/              👈 API & WebSocket
├── models/                👈 Data structures
└── utils/                 👈 Constants & helpers
```

**Where to make common changes:**
- UI colors/theme: `utils/constants.dart` → `AppColors`
- API endpoint: `utils/constants.dart` → `baseUrl`
- Screen layouts: `screens/*.dart`
- Business logic: `providers/*.dart`

## Common Tasks

### Adding a New Feature

1. **Model** (if data structure needed): `models/`
2. **Service** (if API call needed): `services/`
3. **Provider** (for state management): `providers/`
4. **Screen/Widget** (UI): `screens/` or `widgets/`
5. **Wire up** in `main.dart` if new provider

### Debugging

**Print statements:**
```dart
print('Debug: $variable');
```

**Debugger:**
```dart
debugger();  // Breakpoint in VS Code/Android Studio
```

**Flutter DevTools:**
```bash
flutter pub global activate devtools
flutter pub global run devtools
```
Then click the link shown after `flutter run --verbose`

### Common Issues & Fixes

**"No devices found"**
```bash
# Android:
flutter emulators  # List emulators
flutter emulators --launch <emulator_id>

# iOS:
open -a Simulator
```

**"Build failed"**
```bash
flutter clean
flutter pub get
flutter run
```

**"Package version conflicts"**
```bash
flutter pub upgrade
```

**"WebSocket not connecting"**
- Check backend is running: `curl http://localhost:7979/health`
- Check API URL in `lib/utils/constants.dart`
- For Android emulator, use `10.0.2.2` not `localhost`

## Building for Production

### Android APK
```bash
flutter build apk --release
# Output: build/app/outputs/flutter-apk/app-release.apk
```

### iOS IPA (macOS only)
```bash
flutter build ios --release
# Then archive in Xcode
```

### Desktop Apps
```bash
flutter build macos --release  # macOS
flutter build windows --release  # Windows
flutter build linux --release  # Linux
```

## Next Steps

### Learn More
- 📖 [Full README](README.md) - Detailed documentation
- 🏗️ [Architecture](ARCHITECTURE.md) - How it's built
- 📝 [API Spec](../API_SPEC.md) - Backend API details

### Customize
- Change app name: `pubspec.yaml` → `name`
- Change colors: `lib/utils/constants.dart` → `AppColors`
- Add features: Follow architecture patterns

### Deploy
- Android: Google Play Store
- iOS: Apple App Store
- Desktop: Direct distribution or app stores

## Getting Help

**Flutter Issues:**
- Run `flutter doctor`
- Check [Flutter docs](https://flutter.dev/docs)
- Search [StackOverflow](https://stackoverflow.com/questions/tagged/flutter)

**App-Specific Issues:**
- Check [ARCHITECTURE.md](ARCHITECTURE.md)
- Review [API_SPEC.md](../API_SPEC.md)
- Enable verbose logging: `flutter run --verbose`

**Backend Issues:**
- Check backend logs in terminal
- Verify database is running
- Test API: `curl http://localhost:7979/health`

## Tips for Success

1. **Use hot reload** - It's Flutter's superpower! ⚡
2. **Read error messages** - They're usually helpful
3. **Check Flutter doctor** - Keeps your tooling healthy
4. **Use const constructors** - Better performance
5. **Follow existing patterns** - Consistency is key
6. **Test on real devices** - Emulators aren't perfect
7. **Version control** - Commit working code often

## Keyboard Shortcuts (in terminal)

- `r` - Hot reload
- `R` - Hot restart  
- `h` - Help
- `c` - Clear console
- `q` - Quit

## Resources

- [Flutter Cookbook](https://docs.flutter.dev/cookbook)
- [Widget Catalog](https://docs.flutter.dev/development/ui/widgets)
- [Provider Tutorial](https://docs.flutter.dev/development/data-and-backend/state-mgmt/simple)
- [Debugging Guide](https://docs.flutter.dev/testing/debugging)

## Welcome to Flutter! 🎉

You're now ready to build amazing cross-platform apps. The Flutter community is friendly and helpful - don't hesitate to ask questions!

Happy coding! 🚀
