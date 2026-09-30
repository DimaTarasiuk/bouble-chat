import 'package:flutter/foundation.dart';

import '../models/conversation.dart';
import '../models/user.dart';
import '../services/api_service.dart';

class ChatProvider with ChangeNotifier {
  final ApiService _apiService;

  List<Conversation> _conversations = [];
  List<User> _searchResults = [];
  Map<int, List<Message>> _messages = {};
  
  bool _isLoadingConversations = false;
  bool _isLoadingMessages = false;
  bool _isSearching = false;
  String? _error;

  ChatProvider(this._apiService);

  List<Conversation> get conversations => _conversations;
  List<User> get searchResults => _searchResults;
  List<Message> messagesFor(int conversationId) => _messages[conversationId] ?? [];
  
  bool get isLoadingConversations => _isLoadingConversations;
  bool get isLoadingMessages => _isLoadingMessages;
  bool get isSearching => _isSearching;
  String? get error => _error;

  Future<void> loadConversations() async {
    _isLoadingConversations = true;
    _error = null;
    notifyListeners();

    try {
      _conversations = await _apiService.getConversations();
    } catch (e) {
      _error = e.toString();
      print('Error loading conversations: $e');
    } finally {
      _isLoadingConversations = false;
      notifyListeners();
    }
  }

  Future<Conversation?> createConversation(String username) async {
    _error = null;
    notifyListeners();

    try {
      final conversation = await _apiService.createConversation(username);
      
      // Check if conversation already exists in list
      final existingIndex = _conversations.indexWhere((c) => c.id == conversation.id);
      if (existingIndex != -1) {
        _conversations[existingIndex] = conversation;
      } else {
        _conversations.insert(0, conversation);
      }
      
      notifyListeners();
      return conversation;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    }
  }

  Future<void> loadMessages(int conversationId) async {
    _isLoadingMessages = true;
    _error = null;
    notifyListeners();

    try {
      final messages = await _apiService.getMessages(conversationId);
      _messages[conversationId] = messages;
    } catch (e) {
      _error = e.toString();
      print('Error loading messages: $e');
    } finally {
      _isLoadingMessages = false;
      notifyListeners();
    }
  }

  Future<Message?> sendMessage(int conversationId, String text) async {
    _error = null;

    try {
      final message = await _apiService.sendMessage(conversationId, text);
      
      // Add message to local list
      if (_messages[conversationId] == null) {
        _messages[conversationId] = [];
      }
      _messages[conversationId]!.add(message);
      
      // Update conversation last message
      final convIndex = _conversations.indexWhere((c) => c.id == conversationId);
      if (convIndex != -1) {
        _conversations[convIndex] = _conversations[convIndex].copyWith(
          lastMessage: message,
        );
      }
      
      notifyListeners();
      return message;
    } catch (e) {
      _error = e.toString();
      notifyListeners();
      return null;
    }
  }

  Future<void> searchUsers(String query) async {
    if (query.isEmpty) {
      _searchResults = [];
      notifyListeners();
      return;
    }

    _isSearching = true;
    _error = null;
    notifyListeners();

    try {
      _searchResults = await _apiService.searchUsers(query);
    } catch (e) {
      _error = e.toString();
      print('Error searching users: $e');
    } finally {
      _isSearching = false;
      notifyListeners();
    }
  }

  void addMessageFromWebSocket(Message message) {
    if (message.conversationId == null) return;
    
    final conversationId = message.conversationId!;
    
    // Add to messages list
    if (_messages[conversationId] == null) {
      _messages[conversationId] = [];
    }
    
    // Check if message already exists
    final exists = _messages[conversationId]!.any((m) => m.id == message.id);
    if (!exists) {
      _messages[conversationId]!.add(message);
    }
    
    // Update conversation
    final convIndex = _conversations.indexWhere((c) => c.id == conversationId);
    if (convIndex != -1) {
      final oldUnread = _conversations[convIndex].unreadCount;
      _conversations[convIndex] = _conversations[convIndex].copyWith(
        lastMessage: message,
        unreadCount: oldUnread + 1,
      );
    }
    
    notifyListeners();
  }

  void markConversationAsRead(int conversationId) {
    final convIndex = _conversations.indexWhere((c) => c.id == conversationId);
    if (convIndex != -1) {
      _conversations[convIndex] = _conversations[convIndex].copyWith(
        unreadCount: 0,
      );
      notifyListeners();
    }
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  void clearSearchResults() {
    _searchResults = [];
    notifyListeners();
  }

  void clear() {
    _conversations = [];
    _searchResults = [];
    _messages = {};
    _error = null;
    notifyListeners();
  }
}
