import 'dart:async';
import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';

import '../utils/constants.dart';

enum WebSocketConnectionState {
  disconnected,
  connecting,
  connected,
  error,
}

class WebSocketService {
  WebSocketChannel? _channel;
  WebSocketConnectionState _state = WebSocketConnectionState.disconnected;
  String? _token;
  int? _conversationId;
  
  final _messageController = StreamController<Map<String, dynamic>>.broadcast();
  final _stateController = StreamController<WebSocketConnectionState>.broadcast();
  
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;

  Stream<Map<String, dynamic>> get messages => _messageController.stream;
  Stream<WebSocketConnectionState> get connectionState => _stateController.stream;
  WebSocketConnectionState get currentState => _state;

  void setToken(String? token) {
    _token = token;
  }

  Future<void> connectPresence(String token) async {
    _token = token;
    await _connect('/ws/presence');
  }

  Future<void> connectConversation(String token, int conversationId) async {
    _token = token;
    _conversationId = conversationId;
    await _connect('/ws?conversation_id=$conversationId');
  }

  Future<void> _connect(String path) async {
    if (_state == WebSocketConnectionState.connecting || 
        _state == WebSocketConnectionState.connected) {
      return;
    }

    _updateState(WebSocketConnectionState.connecting);

    try {
      final wsUrl = '${AppConstants.wsUrl}$path';
      print('Connecting to WebSocket: $wsUrl');

      // According to API_SPEC, we use subprotocol: ["bearer", token]
      _channel = WebSocketChannel.connect(
        Uri.parse(wsUrl),
        protocols: ['bearer', _token ?? ''],
      );

      _channel!.stream.listen(
        _onMessage,
        onError: _onError,
        onDone: _onDone,
        cancelOnError: false,
      );

      _updateState(WebSocketConnectionState.connected);
      _reconnectAttempts = 0;
      print('WebSocket connected successfully');
    } catch (e) {
      print('WebSocket connection error: $e');
      _updateState(WebSocketConnectionState.error);
      _scheduleReconnect();
    }
  }

  void _onMessage(dynamic message) {
    try {
      final data = json.decode(message as String) as Map<String, dynamic>;
      print('WebSocket message received: ${data['type']}');
      _messageController.add(data);
    } catch (e) {
      print('Error parsing WebSocket message: $e');
    }
  }

  void _onError(dynamic error) {
    print('WebSocket error: $error');
    _updateState(WebSocketConnectionState.error);
    _scheduleReconnect();
  }

  void _onDone() {
    print('WebSocket connection closed');
    _updateState(WebSocketConnectionState.disconnected);
    _scheduleReconnect();
  }

  void _scheduleReconnect() {
    if (_reconnectAttempts >= AppConstants.maxReconnectAttempts) {
      print('Max reconnect attempts reached');
      return;
    }

    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(AppConstants.reconnectDelay, () {
      _reconnectAttempts++;
      print('Reconnecting... Attempt $_reconnectAttempts');
      
      if (_conversationId != null) {
        _connect('/ws?conversation_id=$_conversationId');
      } else {
        _connect('/ws/presence');
      }
    });
  }

  void _updateState(WebSocketConnectionState newState) {
    _state = newState;
    _stateController.add(newState);
  }

  void disconnect() {
    print('Disconnecting WebSocket');
    _reconnectTimer?.cancel();
    _channel?.sink.close();
    _channel = null;
    _updateState(WebSocketConnectionState.disconnected);
    _reconnectAttempts = 0;
  }

  void dispose() {
    disconnect();
    _messageController.close();
    _stateController.close();
  }
}
