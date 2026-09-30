import 'dart:convert';
import 'dart:developer' as developer;
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../models/auth_response.dart';
import '../models/conversation.dart';
import '../models/user.dart';
import '../utils/constants.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  final Object? cause;

  ApiException(this.message, [this.statusCode, this.cause]);

  @override
  String toString() {
    final parts = <String>[message];
    if (statusCode != null) parts.add('HTTP $statusCode');
    if (cause != null) parts.add('$cause');
    return parts.join(' · ');
  }
}

class ApiService {
  final String baseUrl = AppConstants.apiUrl;
  String? _token;

  ApiService() {
    _log('ApiService ready · baseUrl=$baseUrl · wsUrl=${AppConstants.wsUrl}');
  }

  static void _log(String message, {Object? error, StackTrace? stackTrace}) {
    developer.log(
      message,
      name: 'ApiService',
      error: error,
      stackTrace: stackTrace,
    );
    // Also print so `adb logcat` / IDE console always show it in release-ish builds.
    debugPrint('[ApiService] $message');
    if (error != null) debugPrint('[ApiService] cause: $error');
  }

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

  String _describeTransportError(Object e) {
    if (e is SocketException) {
      return 'SocketException: ${e.message}'
          '${e.osError != null ? ' (os=${e.osError})' : ''}'
          '${e.address != null ? ' host=${e.address!.host}' : ''}'
          '${e.port != null ? ':${e.port}' : ''}';
    }
    if (e is HttpException) {
      return 'HttpException: ${e.message}';
    }
    if (e is HandshakeException) {
      return 'TLS/SSL HandshakeException: ${e.message}';
    }
    if (e is TlsException) {
      return 'TlsException: ${e.message}';
    }
    if (e is FormatException) {
      return 'FormatException (bad JSON?): ${e.message}';
    }
    if (e is http.ClientException) {
      return 'ClientException: ${e.message}';
    }
    return '${e.runtimeType}: $e';
  }

  Future<T> _handleResponse<T>(
    http.Response response,
    T Function(Map<String, dynamic>) parser, {
    required String label,
  }) async {
    _log(
      '$label ← ${response.statusCode} '
      'body=${response.body.length > 300 ? '${response.body.substring(0, 300)}…' : response.body}',
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = json.decode(response.body) as Map<String, dynamic>;
      return parser(data);
    }

    String errorMessage = AppStrings.errorUnknown;

    try {
      final errorData = json.decode(response.body) as Map<String, dynamic>;
      errorMessage = errorData['error'] as String? ?? errorMessage;

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
    } catch (_) {
      if (response.statusCode == 401 || response.statusCode == 403) {
        errorMessage = AppStrings.errorSessionRevoked;
      } else {
        errorMessage =
            '${AppStrings.errorNetworkError} (HTTP ${response.statusCode}, body=${response.body})';
      }
    }

    throw ApiException(errorMessage, response.statusCode);
  }

  Future<T> _request<T>(
    String label,
    Future<http.Response> Function() send,
    T Function(http.Response) onOk,
  ) async {
    try {
      final response = await send().timeout(const Duration(seconds: 20));
      return onOk(response);
    } on ApiException {
      rethrow;
    } catch (e, st) {
      final detail = _describeTransportError(e);
      _log('$label FAILED · url base=$baseUrl · $detail', error: e, stackTrace: st);
      throw ApiException(
        '${AppStrings.errorNetworkError}: $detail (api=$baseUrl)',
        null,
        e,
      );
    }
  }

  // Auth endpoints
  Future<AuthResponse> login(String username, String password) async {
    final url = '$baseUrl/api/login';
    _log('login → POST $url · user=$username');

    return _request(
      'login',
      () => http.post(
        Uri.parse(url),
        headers: _getHeaders(includeAuth: false),
        body: json.encode({
          'username': username,
          'password': password,
        }),
      ),
      (response) => _handleResponse(
        response,
        (data) => AuthResponse.fromJson(data),
        label: 'login',
      ),
    );
  }

  Future<AuthResponse> register({
    required String username,
    required String password,
    required String passwordConfirm,
    required String gender,
  }) async {
    final url = '$baseUrl/api/register';
    _log('register → POST $url · user=$username · gender=$gender');

    return _request(
      'register',
      () => http.post(
        Uri.parse(url),
        headers: _getHeaders(includeAuth: false),
        body: json.encode({
          'username': username,
          'password': password,
          'password_confirm': passwordConfirm,
          'gender': gender,
        }),
      ),
      (response) => _handleResponse(
        response,
        (data) => AuthResponse.fromJson(data),
        label: 'register',
      ),
    );
  }

  Future<AuthResponse> getMe() async {
    final url = '$baseUrl/api/me';
    _log('me → GET $url');

    return _request(
      'me',
      () => http.get(Uri.parse(url), headers: _getHeaders()),
      (response) => _handleResponse(
        response,
        (data) => AuthResponse.fromJson(data),
        label: 'me',
      ),
    );
  }

  // Conversations
  Future<List<Conversation>> getConversations() async {
    final url = '$baseUrl/api/conversations';
    _log('conversations → GET $url');

    return _request(
      'conversations',
      () => http.get(Uri.parse(url), headers: _getHeaders()),
      (response) {
        _log('conversations ← ${response.statusCode}');
        if (response.statusCode == 200) {
          final List<dynamic> data = json.decode(response.body) as List;
          return data
              .map((json) => Conversation.fromJson(json as Map<String, dynamic>))
              .toList();
        }
        throw ApiException(AppStrings.errorNetworkError, response.statusCode);
      },
    );
  }

  Future<Conversation> createConversation(String username) async {
    final url = '$baseUrl/api/conversations';
    _log('createConversation → POST $url · peer=$username');

    return _request(
      'createConversation',
      () => http.post(
        Uri.parse(url),
        headers: _getHeaders(),
        body: json.encode({'username': username}),
      ),
      (response) => _handleResponse(
        response,
        (data) => Conversation.fromJson(data),
        label: 'createConversation',
      ),
    );
  }

  // Messages
  Future<List<Message>> getMessages(int conversationId) async {
    final url = '$baseUrl/api/conversations/$conversationId/messages';
    _log('messages → GET $url');

    return _request(
      'messages',
      () => http.get(Uri.parse(url), headers: _getHeaders()),
      (response) {
        _log('messages ← ${response.statusCode}');
        if (response.statusCode == 200) {
          final List<dynamic> data = json.decode(response.body) as List;
          return data
              .map((json) => Message.fromJson(json as Map<String, dynamic>))
              .toList();
        }
        throw ApiException(AppStrings.errorNetworkError, response.statusCode);
      },
    );
  }

  Future<Message> sendMessage(int conversationId, String text) async {
    final url = '$baseUrl/api/conversations/$conversationId/messages';
    _log('sendMessage → POST $url');

    return _request(
      'sendMessage',
      () => http.post(
        Uri.parse(url),
        headers: _getHeaders(),
        body: json.encode({'text': text}),
      ),
      (response) => _handleResponse(
        response,
        (data) => Message.fromJson(data),
        label: 'sendMessage',
      ),
    );
  }

  // Users
  Future<List<User>> searchUsers(String query) async {
    final url = '$baseUrl/api/users?q=$query';
    _log('searchUsers → GET $url');

    return _request(
      'searchUsers',
      () => http.get(Uri.parse(url), headers: _getHeaders()),
      (response) {
        _log('searchUsers ← ${response.statusCode}');
        if (response.statusCode == 200) {
          final List<dynamic> data = json.decode(response.body) as List;
          return data
              .map((json) => User.fromJson(json as Map<String, dynamic>))
              .toList();
        }
        throw ApiException(AppStrings.errorNetworkError, response.statusCode);
      },
    );
  }
}
