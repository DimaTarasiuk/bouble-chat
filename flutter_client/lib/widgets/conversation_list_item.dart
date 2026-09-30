import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/conversation.dart';
import '../providers/presence_provider.dart';
import '../utils/constants.dart';

class ConversationListItem extends StatelessWidget {
  final Conversation conversation;
  final VoidCallback onTap;

  const ConversationListItem({
    super.key,
    required this.conversation,
    required this.onTap,
  });

  String _formatTime(String? timeStr) {
    if (timeStr == null) return '';
    
    try {
      final time = DateTime.parse(timeStr);
      final now = DateTime.now();
      final today = DateTime(now.year, now.month, now.day);
      final messageDate = DateTime(time.year, time.month, time.day);

      if (messageDate == today) {
        return DateFormat('HH:mm').format(time);
      } else if (messageDate == today.subtract(const Duration(days: 1))) {
        return 'Yesterday';
      } else if (now.difference(time).inDays < 7) {
        return DateFormat('EEE').format(time);
      } else {
        return DateFormat('MMM d').format(time);
      }
    } catch (e) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 16,
        vertical: 8,
      ),
      leading: Stack(
        children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: conversation.peerGender == 'female'
                ? Colors.pink.shade100
                : Colors.blue.shade100,
            child: Icon(
              conversation.peerGender == 'female'
                  ? Icons.person
                  : Icons.person_outline,
              size: 28,
              color: conversation.peerGender == 'female'
                  ? Colors.pink
                  : Colors.blue,
            ),
          ),
          Consumer<PresenceProvider>(
            builder: (context, presence, _) {
              final isOnline = presence.isUserOnline(conversation.peer);
              if (!isOnline) return const SizedBox.shrink();
              
              return Positioned(
                right: 0,
                bottom: 0,
                child: Container(
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    color: AppColors.onlineIndicator,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Theme.of(context).scaffoldBackgroundColor,
                      width: 2,
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
      title: Row(
        children: [
          Expanded(
            child: Text(
              conversation.peer,
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 16,
              ),
            ),
          ),
          if (conversation.lastMessage != null)
            Text(
              _formatTime(conversation.lastMessage!.time),
              style: TextStyle(
                fontSize: 12,
                color: conversation.unreadCount > 0
                    ? Theme.of(context).primaryColor
                    : AppColors.textSecondary,
              ),
            ),
        ],
      ),
      subtitle: Row(
        children: [
          Expanded(
            child: Text(
              conversation.lastMessage?.text ?? 'No messages yet',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: conversation.unreadCount > 0
                    ? AppColors.textPrimary
                    : AppColors.textSecondary,
                fontWeight: conversation.unreadCount > 0
                    ? FontWeight.w500
                    : FontWeight.normal,
              ),
            ),
          ),
          if (conversation.unreadCount > 0)
            Container(
              margin: const EdgeInsets.only(left: 8),
              padding: const EdgeInsets.symmetric(
                horizontal: 8,
                vertical: 2,
              ),
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                conversation.unreadCount.toString(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
