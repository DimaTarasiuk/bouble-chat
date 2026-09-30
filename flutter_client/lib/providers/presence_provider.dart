import 'package:flutter/foundation.dart';

import '../services/websocket_service.dart';

class PresenceProvider with ChangeNotifier {
  final WebSocketService _wsService;
  
  Set<String> _onlineUsers = {};
  int _onlineCount = 0;
  Map<String, String> _lastSeenMap = {};

  PresenceProvider(this._wsService) {
    _wsService.messages.listen(_handleWebSocketMessage);
  }

  Set<String> get onlineUsers => _onlineUsers;
  int get onlineCount => _onlineCount;
  
  bool isUserOnline(String username) => _onlineUsers.contains(username);
  String? getLastSeen(String username) => _lastSeenMap[username];

  Future<void> connect(String token) async {
    await _wsService.connectPresence(token);
  }

  void disconnect() {
    _wsService.disconnect();
    _onlineUsers.clear();
    _onlineCount = 0;
    _lastSeenMap.clear();
    notifyListeners();
  }

  void _handleWebSocketMessage(Map<String, dynamic> data) {
    final type = data['type'] as String?;
    
    switch (type) {
      case 'presence_snapshot':
        _handlePresenceSnapshot(data);
        break;
      case 'presence':
        _handlePresenceUpdate(data);
        break;
      case 'force_logout':
        _handleForceLogout(data);
        break;
    }
  }

  void _handlePresenceSnapshot(Map<String, dynamic> data) {
    final online = data['online'] as List?;
    final onlineCount = data['online_count'] as int?;
    
    if (online != null) {
      _onlineUsers = Set<String>.from(online);
    }
    
    if (onlineCount != null) {
      _onlineCount = onlineCount;
    }
    
    notifyListeners();
  }

  void _handlePresenceUpdate(Map<String, dynamic> data) {
    final user = data['user'] as String?;
    final online = data['online'] as bool?;
    final lastSeen = data['last_seen'] as String?;
    final onlineCount = data['online_count'] as int?;
    
    if (user != null && online != null) {
      if (online) {
        _onlineUsers.add(user);
        _lastSeenMap.remove(user);
      } else {
        _onlineUsers.remove(user);
        if (lastSeen != null) {
          _lastSeenMap[user] = lastSeen;
        }
      }
    }
    
    if (onlineCount != null) {
      _onlineCount = onlineCount;
    }
    
    notifyListeners();
  }

  void _handleForceLogout(Map<String, dynamic> data) {
    final reason = data['reason'] as String?;
    print('Force logout received: $reason');
    // The auth provider will handle actual logout
    // This is just for logging/debugging
  }
}
