import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/auth_response.dart';
import '../models/conversation.dart';
import '../models/user.dart';
import '../utils/constants.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;

  ApiException(this.message, [this.statusCode]);

  @override
  String toString() => message;
}

class ApiService {
  final String baseUrl = AppConstants.apiUrl;
  String? _token;

  void setToken(String? token) {
    _token = token;
  }

  Map<String, String> _getHeaders({bool includeAuth = true}) {
    final headers = {
      'Content-Type': 'application/json',
    };

    if (includeAuth && _token != null) {
      headers['Authorization'] = 'Bearer $_token';
    }

    return headers;
  }

  Future<T> _handleResponse<T>(
    http.Response response,
    T Function(Map<String, dynamic>) parser,
  ) async {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = json.decode(response.body) as Map<String, dynamic>;
      return parser(data);
    }

    // Handle errors
    String errorMessage = AppStrings.errorUnknown;
    
    try {
      final errorData = json.decode(response.body) as Map<String, dynamic>;
      errorMessage = errorData['error'] as String? ?? errorMessage;
      
      // Map backend errors to user-friendly messages
      switch (errorMessage) {
        case 'invalid credentials':
          errorMessage = AppStrings.errorInvalidCredentials;
          break;
        case 'username already taken':
          errorMessage = AppStrings.errorUsernameTaken;
          break;
        case 'passwords do not match':
          errorMessage = AppStrings.errorPasswordsDontMatch;
          break;
        case 'password too short':
          errorMessage = AppStrings.errorPasswordTooShort;
          break;
        case 'banned':
          errorMessage = AppStrings.errorBanned;
          break;
        case 'too many requests':
          errorMessage = AppStrings.errorTooManyRequests;
          break;
        case 'session revoked':
        case 'unauthorized':
          errorMessage = AppStrings.errorSessionRevoked;
          break;
      }
    } catch (e) {
      // If can't parse error, use status code
      if (response.statusCode == 401 || response.statusCode == 403) {
        errorMessage = AppStrings.errorSessionRevoked;
      }
    }

    throw ApiException(errorMessage, response.statusCode);
  }

  // Auth endpoints
  Future<AuthResponse> login(String username, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/login'),
        headers: _getHeaders(includeAuth: false),
        body: json.encode({
          'username': username,
          'password': password,
        }),
      );

      return _handleResponse(response, (data) => AuthResponse.fromJson(data));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(AppStrings.errorNetworkError);
    }
  }

  Future<AuthResponse> register({
    required String username,
    required String password,
    required String passwordConfirm,
    required String gender,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/register'),
        headers: _getHeaders(includeAuth: false),
        body: json.encode({
          'username': username,
          'password': password,
          'password_confirm': passwordConfirm,
          'gender': gender,
        }),
      );

      return _handleResponse(response, (data) => AuthResponse.fromJson(data));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(AppStrings.errorNetworkError);
    }
  }

  Future<AuthResponse> getMe() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/me'),
        headers: _getHeaders(),
      );

      return _handleResponse(response, (data) => AuthResponse.fromJson(data));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(AppStrings.errorNetworkError);
    }
  }

  // Conversations
  Future<List<Conversation>> getConversations() async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/conversations'),
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body) as List;
        return data.map((json) => Conversation.fromJson(json as Map<String, dynamic>)).toList();
      }

      throw ApiException(AppStrings.errorNetworkError, response.statusCode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(AppStrings.errorNetworkError);
    }
  }

  Future<Conversation> createConversation(String username) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/conversations'),
        headers: _getHeaders(),
        body: json.encode({'username': username}),
      );

      return _handleResponse(response, (data) => Conversation.fromJson(data));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(AppStrings.errorNetworkError);
    }
  }

  // Messages
  Future<List<Message>> getMessages(int conversationId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/conversations/$conversationId/messages'),
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body) as List;
        return data.map((json) => Message.fromJson(json as Map<String, dynamic>)).toList();
      }

      throw ApiException(AppStrings.errorNetworkError, response.statusCode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(AppStrings.errorNetworkError);
    }
  }

  Future<Message> sendMessage(int conversationId, String text) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/conversations/$conversationId/messages'),
        headers: _getHeaders(),
        body: json.encode({'text': text}),
      );

      return _handleResponse(response, (data) => Message.fromJson(data));
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(AppStrings.errorNetworkError);
    }
  }

  // Users
  Future<List<User>> searchUsers(String query) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/api/users?q=$query'),
        headers: _getHeaders(),
      );

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body) as List;
        return data.map((json) => User.fromJson(json as Map<String, dynamic>)).toList();
      }

      throw ApiException(AppStrings.errorNetworkError, response.statusCode);
    } catch (e) {
      if (e is ApiException) rethrow;
      throw ApiException(AppStrings.errorNetworkError);
    }
  }
}
