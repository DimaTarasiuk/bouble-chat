# Changelog

All notable changes to the Flutter chat client will be documented in this file.

## [1.0.0] - 2024

### Added
- Initial release of Flutter chat client
- User authentication (login and registration)
- Real-time messaging via WebSocket
- User presence tracking (online/offline status)
- Private 1:1 conversations
- User search functionality
- Conversation list with unread counts
- Message history loading
- Material Design 3 UI with dark/light theme support
- Cross-platform support:
  - ✅ Android (API 21+)
  - ✅ iOS (12.0+)
  - ✅ macOS (10.14+)
  - ✅ Windows (10+)
  - ✅ Linux
  - ✅ Web (experimental)

### Features
- Secure token-based authentication
- Real-time message delivery
- Automatic reconnection on connection loss
- Pull-to-refresh conversations
- Message timestamps with smart formatting
- User avatars based on gender
- Online status indicators
- Unread message badges
- Search users by username
- Create conversations on-the-fly

### Technical
- Provider for state management
- HTTP package for REST API calls
- WebSocket for real-time updates
- SharedPreferences for local storage
- Flutter Secure Storage for sensitive data
- Clean architecture with separation of concerns
- Responsive UI for all screen sizes

### API Integration
- Full integration with Go backend
- REST API for CRUD operations
- WebSocket for real-time features
- Proper error handling and user feedback
- Token refresh mechanism

## Future Enhancements

### Planned Features
- [ ] Push notifications
- [ ] Image/file sharing
- [ ] Voice messages
- [ ] Group chats
- [ ] Message read receipts
- [ ] Typing indicators
- [ ] Message reactions (emoji)
- [ ] User profile editing
- [ ] Settings screen
- [ ] Dark theme toggle
- [ ] Multiple languages support
- [ ] Message search
- [ ] Delete messages
- [ ] Edit messages
- [ ] Block/report users

### Technical Improvements
- [ ] Offline support with local database
- [ ] Message caching
- [ ] Pagination for large conversation lists
- [ ] Image compression and optimization
- [ ] End-to-end encryption
- [ ] Biometric authentication
- [ ] Unit and integration tests
- [ ] CI/CD pipeline
- [ ] Performance optimizations
- [ ] Accessibility improvements

## Known Issues

- WebSocket may disconnect on poor network (auto-reconnects)
- No offline message queue (requires connection)
- Large message lists may need pagination
- Web version has limited functionality

## Migration Guide

This is the initial release. For future versions, migration guides will be provided here.

## Support

For issues, feature requests, or contributions, please refer to the main project repository.
