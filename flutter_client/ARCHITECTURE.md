# Flutter Client Architecture

## Overview

The Flutter chat client follows clean architecture principles with clear separation of concerns, making it maintainable, testable, and scalable.

## Architecture Layers

```
┌─────────────────────────────────────┐
│         Presentation Layer          │
│    (Screens, Widgets, UI Logic)     │
├─────────────────────────────────────┤
│       State Management Layer        │
│         (Providers/Models)          │
├─────────────────────────────────────┤
│         Business Logic Layer        │
│      (Services, Data Processing)    │
├─────────────────────────────────────┤
│          Data Layer                 │
│    (API, WebSocket, Storage)        │
└─────────────────────────────────────┘
```

## Directory Structure

### `/lib/main.dart`
Application entry point. Sets up:
- MultiProvider for state management
- Material app configuration
- Theme configuration
- Root navigation

### `/lib/models/`
Data models representing domain entities:

- **user.dart** - User entity with profile information
- **conversation.dart** - Conversation and Message entities
- **auth_response.dart** - Authentication response wrapper

All models include:
- `fromJson()` factory constructors for API deserialization
- `toJson()` methods for serialization
- Immutable properties
- Optional `copyWith()` methods for updates

### `/lib/services/`
Business logic and external communication:

#### **api_service.dart**
- REST API communication
- HTTP request/response handling
- Error mapping and transformation
- Token management
- Endpoints:
  - Authentication (login, register, getMe)
  - Conversations (list, create)
  - Messages (list, send)
  - Users (search)

#### **websocket_service.dart**
- WebSocket connection management
- Real-time message streaming
- Automatic reconnection logic
- Connection state management
- Message broadcasting to listeners

### `/lib/providers/`
State management using Provider pattern:

#### **auth_provider.dart**
Manages authentication state:
- User session persistence
- Login/register/logout operations
- Token storage and retrieval
- Session validation
- Error handling

#### **chat_provider.dart**
Manages chat-related state:
- Conversations list
- Messages by conversation
- User search results
- Message sending
- Real-time message updates
- Unread count management

#### **presence_provider.dart**
Manages user presence:
- Online/offline user tracking
- Real-time presence updates via WebSocket
- Last seen timestamps
- Force logout handling

### `/lib/screens/`
Full-screen views:

#### **auth_screen.dart**
- Login and registration forms
- Form validation
- Error display
- Mode switching (login ↔ register)

#### **chat_screen.dart**
- Conversations list
- Online user count
- Pull-to-refresh
- Navigation to conversations
- User search dialog
- Logout confirmation

#### **conversation_screen.dart**
- Message history display
- Real-time message updates
- Message input with send button
- Date separators
- Online status indicator
- Auto-scroll to bottom

### `/lib/widgets/`
Reusable UI components:

#### **conversation_list_item.dart**
- Conversation preview
- User avatar with gender-based styling
- Online indicator
- Last message preview
- Unread badge
- Smart timestamp formatting

#### **message_bubble.dart**
- Message display with sender differentiation
- Timestamp formatting
- Styled bubbles (sent vs received)
- Username display for received messages

#### **user_search_dialog.dart**
- User search interface
- Real-time search results
- User selection
- Empty state handling

### `/lib/utils/`
Constants and utilities:

#### **constants.dart**
- API configuration (base URL, WebSocket URL)
- Storage keys
- Validation rules
- Color palette
- Text strings (for easy i18n later)
- App-wide constants

## State Management Flow

### Provider Pattern

```
User Action → Provider Method → Service Call → Update State → Notify Listeners → UI Rebuilds
```

Example: Sending a message

1. User types message and taps send
2. `ConversationScreen` calls `chatProvider.sendMessage()`
3. `ChatProvider` calls `apiService.sendMessage()`
4. API service makes HTTP POST request
5. Response parsed into `Message` model
6. `ChatProvider` updates local messages list
7. `notifyListeners()` called
8. UI rebuilds with new message

### WebSocket Flow

```
WebSocket Event → Service Parses → Provider Processes → State Update → UI Update
```

Example: Receiving a message

1. WebSocket receives message event
2. `WebSocketService` parses JSON
3. Event broadcast to listeners
4. `ChatProvider` adds message to appropriate conversation
5. `notifyListeners()` called
6. UI shows new message with animation

## Data Flow

### Authentication Flow

```
┌─────────────┐
│ Auth Screen │
└──────┬──────┘
       │ login(username, password)
       ▼
┌──────────────┐
│AuthProvider  │
└──────┬───────┘
       │ apiService.login()
       ▼
┌──────────────┐
│ API Service  │
└──────┬───────┘
       │ POST /api/login
       ▼
┌──────────────┐
│   Backend    │
└──────┬───────┘
       │ {token, user}
       ▼
┌──────────────┐
│AuthProvider  │─────► Save to SharedPreferences
└──────┬───────┘       Set token in API service
       │
       ▼
┌──────────────┐
│ Chat Screen  │
└──────────────┘
```

### Message Flow

```
┌────────────────────┐
│ConversationScreen  │
└─────────┬──────────┘
          │ sendMessage(text)
          ▼
┌──────────────────┐
│  Chat Provider   │
└─────────┬────────┘
          │ apiService.sendMessage()
          ▼
┌──────────────────┐     POST /api/conversations/{id}/messages
│   API Service    │────────────────────────────────────────────►
└─────────┬────────┘                                              │
          │                                                       │
          │ {id, from, text, time}                              ▼
          │                                                  ┌────────┐
          │◄─────────────────────────────────────────────────│Backend │
          ▼                                                  └────┬───┘
┌──────────────────┐                                            │
│  Chat Provider   │                                            │ WebSocket broadcast
│  - Add to local  │                                            ▼
│  - Update convo  │                                    ┌────────────────┐
│  - Notify        │                                    │ Other clients  │
└─────────┬────────┘                                    └────────────────┘
          │
          ▼
┌────────────────────┐
│ConversationScreen  │
│  - Show message    │
│  - Scroll to bottom│
└────────────────────┘
```

## Key Design Decisions

### 1. Provider over Bloc/Riverpod
- **Why**: Simpler learning curve, official Flutter recommendation
- **Trade-off**: Less boilerplate, but manual notifyListeners() calls
- **Alternative**: Could migrate to Riverpod for better testing

### 2. Single WebSocket Service
- **Why**: Centralized connection management, easier reconnection logic
- **Trade-off**: All providers share one service instance
- **Note**: Separate connections for presence vs conversation messages

### 3. No Local Database (Yet)
- **Why**: Simpler initial implementation, always fresh data
- **Trade-off**: No offline support, requires connection
- **Future**: Add SQLite/Hive for offline messages and caching

### 4. Token-based Auth (No Refresh Token)
- **Why**: Backend uses 24-hour JWT tokens
- **Trade-off**: Need to re-login after expiry
- **Backend behavior**: Returns new token with extended TTL on /api/me

### 5. JSON Serialization (Manual)
- **Why**: Full control, no code generation
- **Trade-off**: More manual work, but simpler for small app
- **Alternative**: Could use json_serializable for larger scale

## Error Handling

### Levels of Error Handling

1. **Service Layer**: Catch network errors, parse API errors
2. **Provider Layer**: Transform to user-friendly messages
3. **UI Layer**: Display via SnackBar or dialog

### Error Flow

```
API Error → ApiException → Provider catches → Set error state → UI shows SnackBar
```

Example from `api_service.dart`:
```dart
try {
  final response = await http.post(...);
  return _handleResponse(response, parser);
} catch (e) {
  if (e is ApiException) rethrow;
  throw ApiException(AppStrings.errorNetworkError);
}
```

## Performance Considerations

### Memory Management
- WebSocket listeners properly disposed
- Controllers disposed in widget dispose()
- Streams closed when no longer needed

### Network Efficiency
- Only load messages when opening conversation
- WebSocket for real-time updates (no polling)
- Token stored locally to avoid re-auth

### UI Performance
- ListView.builder for efficient list rendering
- No unnecessary rebuilds (Consumer widgets scope)
- Const constructors where possible

## Testing Strategy (Future)

### Unit Tests
- Model serialization/deserialization
- Service API calls (mocked HTTP)
- Provider state changes

### Widget Tests
- Screen rendering
- User interactions
- Navigation flows

### Integration Tests
- End-to-end flows
- API integration
- WebSocket communication

## Security Considerations

### Token Storage
- JWT token in SharedPreferences (encrypted on device)
- No password storage
- Token cleared on logout

### Network Security
- HTTPS required for production
- WSS (WebSocket Secure) for real-time
- No sensitive data in logs

### Input Validation
- Client-side validation (UX)
- Server-side validation (security)
- Sanitized error messages

## Future Enhancements

### Planned Improvements
1. **Offline Support**: Local database with sync
2. **Push Notifications**: FCM integration
3. **Image Sharing**: File upload and display
4. **Message Pagination**: Load older messages on scroll
5. **Typing Indicators**: Real-time "user is typing..."
6. **Read Receipts**: Message seen status
7. **User Profiles**: View and edit profile
8. **Group Chats**: Multi-user conversations
9. **End-to-End Encryption**: Client-side encryption

### Architecture Evolution
- Consider migrating to Riverpod for better DI
- Add repository layer for data source abstraction
- Implement use cases for complex business logic
- Add caching layer for performance
- Implement proper logging and analytics

## Resources

- [Flutter Documentation](https://flutter.dev/docs)
- [Provider Package](https://pub.dev/packages/provider)
- [Clean Architecture in Flutter](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Flutter Best Practices](https://docs.flutter.dev/development/best-practices)

## Contributing

When adding new features:
1. Follow existing architecture patterns
2. Keep layers separated
3. Add proper error handling
4. Document complex logic
5. Update this architecture doc if needed
