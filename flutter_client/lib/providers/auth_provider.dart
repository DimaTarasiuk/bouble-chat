import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models/user.dart';
import '../services/api_service.dart';
import '../utils/constants.dart';

class AuthProvider with ChangeNotifier {
  final ApiService _apiService;
  final SharedPreferences _prefs;

  User? _user;
  bool _isLoading = true;
  String? _error;

  AuthProvider(this._apiService, this._prefs) {
    _loadSession();
  }

  User? get user => _user;
  bool get isAuthenticated => _user != null;
  bool get isLoading => _isLoading;
  String? get error => _error;
  String? get username => _user?.username;
  String? get role => _user?.role;

  Future<void> _loadSession() async {
    _isLoading = true;
    notifyListeners();

    try {
      final token = _prefs.getString(AppConstants.tokenKey);
      
      if (token != null) {
        _apiService.setToken(token);
        
        // Verify token and get user info
        final authResponse = await _apiService.getMe();
        _user = authResponse.user;
        
        // Update token (backend returns new token with extended TTL)
        await _saveSession(authResponse.token, authResponse.user);
      }
    } catch (e) {
      print('Session load error: $e');
      await clearSession();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> login(String username, String password) async {
    _error = null;
    notifyListeners();

    try {
      debugPrint('[AuthProvider] login start · api=${AppConstants.apiUrl} · user=$username');
      final authResponse = await _apiService.login(username, password);
      _user = authResponse.user;
      await _saveSession(authResponse.token, authResponse.user);

      debugPrint('[AuthProvider] login ok · user=${_user?.username} · role=${_user?.role}');
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[AuthProvider] login failed: $e');
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> register({
    required String username,
    required String password,
    required String passwordConfirm,
    required String gender,
  }) async {
    _error = null;
    notifyListeners();

    try {
      debugPrint('[AuthProvider] register start · api=${AppConstants.apiUrl} · user=$username');
      final authResponse = await _apiService.register(
        username: username,
        password: password,
        passwordConfirm: passwordConfirm,
        gender: gender,
      );

      _user = authResponse.user;
      await _saveSession(authResponse.token, authResponse.user);

      debugPrint('[AuthProvider] register ok · user=${_user?.username}');
      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[AuthProvider] register failed: $e');
      _error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<void> _saveSession(String token, User user) async {
    await _prefs.setString(AppConstants.tokenKey, token);
    await _prefs.setString(AppConstants.usernameKey, user.username);
    await _prefs.setString(AppConstants.roleKey, user.role);
    _apiService.setToken(token);
  }

  Future<void> clearSession() async {
    await _prefs.remove(AppConstants.tokenKey);
    await _prefs.remove(AppConstants.usernameKey);
    await _prefs.remove(AppConstants.roleKey);
    _apiService.setToken(null);
    _user = null;
    notifyListeners();
  }

  Future<void> logout() async {
    await clearSession();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }
}
