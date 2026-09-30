import 'package:flutter/material.dart';

class AppConstants {
  // API Configuration
  // For Android Emulator use: http://10.0.2.2:7979
  // For iOS Simulator use: http://localhost:7979
  // For real device use your computer's IP: http://192.168.x.x:7979
  // For production use your deployed URL
  static const String baseUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://localhost:7979',
  );
  
  static String get apiUrl => baseUrl;
  static String get wsUrl => baseUrl.replaceFirst('http', 'ws');
  
  // Storage Keys
  static const String tokenKey = 'chat_token';
  static const String usernameKey = 'chat_username';
  static const String roleKey = 'chat_role';
  
  // Validation
  static const int minPasswordLength = 6;
  
  // WebSocket
  static const Duration reconnectDelay = Duration(seconds: 3);
  static const int maxReconnectAttempts = 5;
}

class AppColors {
  static const Color primary = Color(0xFF2196F3);
  static const Color secondary = Color(0xFF03A9F4);
  static const Color error = Color(0xFFF44336);
  static const Color success = Color(0xFF4CAF50);
  static const Color warning = Color(0xFFFF9800);
  
  static const Color textPrimary = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color divider = Color(0xFFBDBDBD);
  
  static const Color messageBubbleSent = Color(0xFFE3F2FD);
  static const Color messageBubbleReceived = Color(0xFFF5F5F5);
  
  static const Color onlineIndicator = Color(0xFF4CAF50);
  static const Color offlineIndicator = Color(0xFF9E9E9E);
}

class AppStrings {
  // Auth
  static const String appName = 'Chat App';
  static const String login = 'Login';
  static const String register = 'Register';
  static const String username = 'Username';
  static const String password = 'Password';
  static const String confirmPassword = 'Confirm Password';
  static const String gender = 'Gender';
  static const String male = 'Male';
  static const String female = 'Female';
  static const String loginButton = 'Sign In';
  static const String registerButton = 'Sign Up';
  static const String switchToRegister = 'Don\'t have an account? Register';
  static const String switchToLogin = 'Already have an account? Login';
  
  // Chat
  static const String conversations = 'Conversations';
  static const String searchUsers = 'Search users...';
  static const String typeMessage = 'Type a message...';
  static const String send = 'Send';
  static const String logout = 'Logout';
  static const String online = 'Online';
  static const String offline = 'Offline';
  static const String noConversations = 'No conversations yet';
  static const String startNewChat = 'Search for users to start chatting';
  
  // Errors
  static const String errorInvalidCredentials = 'Invalid username or password';
  static const String errorUsernameTaken = 'Username already taken';
  static const String errorPasswordsDontMatch = 'Passwords don\'t match';
  static const String errorPasswordTooShort = 'Password must be at least 6 characters';
  static const String errorFieldRequired = 'This field is required';
  static const String errorNetworkError = 'Network error. Please try again.';
  static const String errorUnknown = 'An error occurred. Please try again.';
  static const String errorBanned = 'Account has been banned';
  static const String errorTooManyRequests = 'Too many requests. Please try later.';
  static const String errorSessionRevoked = 'Session expired. Please login again.';
  
  // Success
  static const String successLogout = 'Logged out successfully';
}
