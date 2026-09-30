# Quick Start Guide

Get the Flutter chat client running in 5 minutes!

## Step 1: Start the Backend

```bash
cd back
make db-up
make migrate-up
make run
```

Backend will run on `http://localhost:7979`

## Step 2: Install Flutter Dependencies

```bash
cd flutter_client
flutter pub get
```

## Step 3: Configure API URL (if needed)

### For Android Emulator:
Edit `lib/utils/constants.dart`, line 10:
```dart
defaultValue: 'http://10.0.2.2:7979',
```

### For Real Device:
Find your computer's IP address and edit `lib/utils/constants.dart`:
```dart
defaultValue: 'http://YOUR_IP:7979',  // e.g., 'http://192.168.1.100:7979'
```

### For iOS Simulator or macOS:
No changes needed! Default `http://localhost:7979` works.

## Step 4: Run the App

### Android
```bash
flutter run
```

### iOS (macOS only)
```bash
flutter run
```

### macOS
```bash
flutter run -d macos
```

### Windows
```bash
flutter run -d windows
```

### Linux
```bash
flutter run -d linux
```

## Step 5: Test the App

1. **Register** a new account (choose username, password, gender)
2. **Login** with your credentials
3. Click the **+** button to search for users
4. Start chatting!

## Common Issues

### "Network error" on login
- ✅ Check backend is running: `curl http://localhost:7979/health`
- ✅ For Android emulator, use `10.0.2.2` instead of `localhost`
- ✅ For real device, use your computer's IP address

### "No devices found"
- Android: Enable USB debugging and connect device
- iOS: Connect device and trust computer
- Desktop: Should work automatically

### Build fails
```bash
flutter clean
flutter pub get
flutter run
```

## Platform-Specific Notes

### Android
- Minimum SDK: 21 (Android 5.0)
- Target SDK: 34 (Android 14)
- Builds to APK or App Bundle

### iOS
- Minimum: iOS 12.0
- Requires Xcode (macOS only)
- Requires Apple Developer account for device deployment

### macOS
- Minimum: macOS 10.14
- Builds to .app bundle
- May need to allow in Security & Privacy settings

### Windows
- Requires Visual Studio 2022 with C++ tools
- Builds to .exe

### Linux
- Requires: clang, cmake, ninja-build, libgtk-3-dev
- Install: `sudo apt-get install clang cmake ninja-build libgtk-3-dev`

## What's Included

✅ Full authentication (login/register)  
✅ Real-time messaging via WebSocket  
✅ User presence (online/offline status)  
✅ Private 1:1 conversations  
✅ User search  
✅ Material Design 3 UI  
✅ Cross-platform (Android, iOS, macOS, Windows, Linux)  

## Next Steps

- Read full [README.md](README.md) for detailed documentation
- Check [API_SPEC.md](../API_SPEC.md) for API details
- Explore the code in `lib/` directory

## Need Help?

1. Run `flutter doctor` to check your setup
2. Check backend logs: the Go server shows all API requests
3. Enable verbose logging: `flutter run --verbose`
4. See [Troubleshooting](README.md#troubleshooting) in README

Happy coding! 🚀
