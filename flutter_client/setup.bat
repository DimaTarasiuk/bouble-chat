@echo off
REM Flutter Chat Client Setup Script for Windows
REM This script helps set up the Flutter client for first-time use

echo.
echo Flutter Chat Client Setup
echo ==========================
echo.

REM Check if Flutter is installed
where flutter >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Flutter is not installed!
    echo Please install Flutter from: https://flutter.dev/docs/get-started/install
    pause
    exit /b 1
)

echo [OK] Flutter found
flutter --version | findstr /C:"Flutter"
echo.

REM Run Flutter doctor
echo Checking Flutter setup...
flutter doctor
echo.

REM Get dependencies
echo Installing dependencies...
flutter pub get
echo.

REM Check for available devices
echo Available devices:
flutter devices
echo.

REM API URL configuration
echo API Configuration
echo -----------------
echo The default API URL is: http://localhost:7979
echo.
echo Do you need to change the API URL?
echo   - For Android Emulator: use http://10.0.2.2:7979
echo   - For Real Device: use http://YOUR_IP:7979
echo   - For Windows: use http://localhost:7979 (default)
echo.

set /p change_url="Change API URL? (y/n): "

if /i "%change_url%"=="y" (
    set /p api_url="Enter API URL (e.g., http://10.0.2.2:7979): "
    
    REM Note: For Windows, manual edit recommended due to sed complexity
    echo.
    echo Please manually edit lib\utils\constants.dart
    echo Change line 10 to: defaultValue: '!api_url!'
    echo.
    pause
) else (
    echo [OK] Using default API URL: http://localhost:7979
)
echo.

REM Check if backend is running
echo Checking if backend is running...
curl -s http://localhost:7979/health >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Backend is running!
) else (
    echo [WARNING] Backend is not responding at http://localhost:7979
    echo    Please start the backend before running the app
)
echo.

REM Next steps
echo Next Steps
echo ----------
echo.
echo To run on Android:
echo   flutter run
echo.
echo To run on Windows:
echo   flutter run -d windows
echo.
echo For more information, see README.md or QUICKSTART.md
echo.
echo Setup complete! Happy coding!
echo.
pause
