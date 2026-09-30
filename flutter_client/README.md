# Flutter Chat Client

Cross-platform Flutter client for the Chat application, supporting Android, iOS, macOS, Windows, and Linux.

## Features

- ✅ User authentication (login/register)
- ✅ Real-time messaging via WebSocket
- ✅ User presence tracking (online/offline status)
- ✅ Private 1:1 conversations
- ✅ User search functionality
- ✅ Material Design 3 UI
- ✅ Cross-platform support (Android, iOS, macOS, Windows, Linux)

## Screenshots

The app features:
- Clean, modern UI with Material Design 3
- Real-time message delivery
- User presence indicators
- Unread message badges
- Responsive design for all screen sizes

## Prerequisites

- [Flutter SDK](https://flutter.dev/docs/get-started/install) (3.0.0 or higher)
- Dart SDK (included with Flutter)
- For Android: Android Studio or Android SDK
- For iOS/macOS: Xcode (macOS only)
- For Windows: Visual Studio 2022 with C++ desktop development
- For Linux: Required dependencies (see Flutter docs)

## Backend Setup

This Flutter client connects to the Go backend. Make sure the backend is running first:

1. Start the backend server (from the project root):
   ```bash
   cd back
   make db-up
   make migrate-up
   make run
   ```

2. The backend will run on `http://localhost:7979` by default.

## Installation

1. Navigate to the Flutter client directory:
   ```bash
   cd flutter_client
   ```

2. Get Flutter dependencies:
   ```bash
   flutter pub get
   ```

3. Check Flutter setup for your platform:
   ```bash
   flutter doctor
   ```

## Configuration

### API URL Configuration

The app needs to know where your backend server is running. The default is `http://localhost:7979`.

#### For Development:

**Android Emulator:**
- Use `http://10.0.2.2:7979` (special address that points to host machine)
- Edit `lib/utils/constants.dart` and change `baseUrl`

**iOS Simulator:**
- Use `http://localhost:7979` (works by default)

**Real Device (Phone/Tablet):**
- Find your computer's IP address:
  - macOS/Linux: `ifconfig` or `ip addr`
  - Windows: `ipconfig`
- Use `http://YOUR_IP:7979` (e.g., `http://192.168.1.100:7979`)
- Edit `lib/utils/constants.dart` and change `baseUrl`

#### For Production:

Set the API URL at build time:
```bash
flutter build apk --dart-define=API_URL=https://your-api.com
```

Or edit `lib/utils/constants.dart` and change the `defaultValue`.

## Running the App

### Android

**Emulator:**
```bash
flutter run
```

**Physical Device:**
1. Enable USB debugging on your device
2. Connect via USB
3. Run: `flutter run`

**Build APK:**
```bash
flutter build apk
# Output: build/app/outputs/flutter-apk/app-release.apk
```

### iOS (macOS only)

**Simulator:**
```bash
flutter run
```

**Physical Device:**
1. Set up code signing in Xcode
2. Run: `flutter run`

**Build IPA:**
```bash
flutter build ios
```

### macOS (macOS only)

```bash
flutter run -d macos
```

**Build macOS App:**
```bash
flutter build macos
# Output: build/macos/Build/Products/Release/chat_flutter.app
```

### Windows

```bash
flutter run -d windows
```

**Build Windows EXE:**
```bash
flutter build windows
# Output: build\windows\runner\Release\
```

### Linux

```bash
flutter run -d linux
```

**Build Linux App:**
```bash
flutter build linux
# Output: build/linux/x64/release/bundle/
```

### Web (Experimental)

```bash
flutter run -d chrome
```

**Build for Web:**
```bash
flutter build web
# Output: build/web/
```

## Project Structure

```
flutter_client/
├── lib/
│   ├── main.dart              # App entry point
│   ├── models/                # Data models
│   │   ├── user.dart
│   │   ├── conversation.dart
│   │   └── auth_response.dart
│   ├── services/              # API & WebSocket services
│   │   ├── api_service.dart
│   │   └── websocket_service.dart
│   ├── providers/             # State management (Provider)
│   │   ├── auth_provider.dart
│   │   ├── chat_provider.dart
│   │   └── presence_provider.dart
│   ├── screens/               # UI screens
│   │   ├── auth_screen.dart
│   │   ├── chat_screen.dart
│   │   └── conversation_screen.dart
│   ├── widgets/               # Reusable widgets
│   │   ├── conversation_list_item.dart
│   │   ├── message_bubble.dart
│   │   └── user_search_dialog.dart
│   └── utils/                 # Constants & utilities
│       └── constants.dart
├── android/                   # Android-specific files
├── ios/                       # iOS-specific files
├── macos/                     # macOS-specific files
├── windows/                   # Windows-specific files
├── linux/                     # Linux-specific files
└── pubspec.yaml              # Flutter dependencies
```

## API Integration

The Flutter client connects to the following backend endpoints:

### Authentication
- `POST /api/login` - User login
- `POST /api/register` - User registration
- `GET /api/me` - Get current user info

### Conversations
- `GET /api/conversations` - List user's conversations
- `POST /api/conversations` - Create/get conversation with user

### Messages
- `GET /api/conversations/{id}/messages` - Get messages
- `POST /api/conversations/{id}/messages` - Send message

### Users
- `GET /api/users?q={query}` - Search users

### WebSocket
- `GET /ws/presence` - Real-time presence updates
- `GET /ws?conversation_id={id}` - Real-time messages for conversation

## State Management

The app uses the **Provider** package for state management:

- **AuthProvider**: Manages authentication state, login, logout
- **ChatProvider**: Manages conversations, messages, user search
- **PresenceProvider**: Manages user online/offline status via WebSocket

## Dependencies

Key dependencies used in this project:

- `provider` - State management
- `http` - HTTP requests
- `web_socket_channel` - WebSocket connections
- `shared_preferences` - Local data persistence
- `flutter_secure_storage` - Secure token storage
- `intl` - Date/time formatting

See `pubspec.yaml` for the complete list.

## Troubleshooting

### Connection Issues

**"Network error" when logging in:**
- Check if the backend server is running
- Verify the API URL in `lib/utils/constants.dart`
- For Android Emulator, use `10.0.2.2` instead of `localhost`
- For real devices, use your computer's IP address
- Check firewall settings

**WebSocket not connecting:**
- Ensure the backend supports WebSocket connections
- Check CORS settings on the backend
- Verify the WebSocket URL format (should use `ws://` or `wss://`)

### Build Issues

**Android build fails:**
- Run `flutter clean && flutter pub get`
- Check Android SDK is properly installed
- Ensure `ANDROID_HOME` environment variable is set

**iOS/macOS build fails:**
- Update Xcode to the latest version
- Run `pod install` in the `ios/` or `macos/` directory
- Check code signing settings

**Windows build fails:**
- Ensure Visual Studio 2022 with C++ desktop development is installed
- Run as administrator if permission issues occur

### Runtime Issues

**App crashes on startup:**
- Check Flutter and Dart SDK versions
- Run `flutter doctor` to diagnose issues
- Clear app data and reinstall

**Messages not updating in real-time:**
- Check WebSocket connection status
- Verify backend WebSocket implementation
- Check network connectivity

## Development Tips

### Hot Reload

During development, use hot reload to see changes instantly:
- Press `r` in the terminal running `flutter run`
- Or save files in your IDE (most IDEs support auto hot reload)

### Debugging

Enable debugging output:
```bash
flutter run --verbose
```

Use Flutter DevTools:
```bash
flutter pub global activate devtools
flutter pub global run devtools
```

### Testing on Multiple Devices

Run on specific device:
```bash
flutter devices  # List available devices
flutter run -d device_id
```

## Building for Release

### Android

**APK (for direct installation):**
```bash
flutter build apk --release
```

**App Bundle (for Play Store):**
```bash
flutter build appbundle --release
```

### iOS

```bash
flutter build ios --release
```
Then archive and upload via Xcode.

### Desktop Platforms

**macOS:**
```bash
flutter build macos --release
```

**Windows:**
```bash
flutter build windows --release
```

**Linux:**
```bash
flutter build linux --release
```

## Environment Variables

You can configure the app using build-time variables:

```bash
flutter run --dart-define=API_URL=https://your-api.com
```

## Contributing

When contributing to this Flutter client:

1. Follow Flutter style guide
2. Run `flutter analyze` before committing
3. Format code with `flutter format .`
4. Test on multiple platforms if possible

## License

Same license as the main project.

## Support

For issues related to:
- Backend API: See main project README
- Flutter client: Check Flutter doctor and troubleshooting section above
- Platform-specific issues: Refer to Flutter documentation

## Links

- [Flutter Documentation](https://flutter.dev/docs)
- [Dart Documentation](https://dart.dev/guides)
- [Provider Package](https://pub.dev/packages/provider)
- [Main Project Repository](../README.md)
