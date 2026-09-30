import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/chat_provider.dart';
import '../utils/constants.dart';

class UserSearchDialog extends StatefulWidget {
  const UserSearchDialog({super.key});

  @override
  State<UserSearchDialog> createState() => _UserSearchDialogState();
}

class _UserSearchDialogState extends State<UserSearchDialog> {
  final _searchController = TextEditingController();
  
  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    final chatProvider = context.read<ChatProvider>();
    chatProvider.searchUsers(query);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      child: Container(
        constraints: const BoxConstraints(maxHeight: 500, maxWidth: 400),
        child: Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Search Users',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () {
                      final chatProvider = context.read<ChatProvider>();
                      chatProvider.clearSearchResults();
                      Navigator.pop(context);
                    },
                  ),
                ],
              ),
            ),
            const Divider(height: 1),

            // Search field
            Padding(
              padding: const EdgeInsets.all(16),
              child: TextField(
                controller: _searchController,
                decoration: InputDecoration(
                  hintText: AppStrings.searchUsers,
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _searchController.text.isNotEmpty
                      ? IconButton(
                          icon: const Icon(Icons.clear),
                          onPressed: () {
                            _searchController.clear();
                            _onSearchChanged('');
                          },
                        )
                      : null,
                ),
                onChanged: _onSearchChanged,
                autofocus: true,
              ),
            ),

            // Results
            Expanded(
              child: Consumer<ChatProvider>(
                builder: (context, chatProvider, _) {
                  if (chatProvider.isSearching) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  if (_searchController.text.isEmpty) {
                    return Center(
                      child: Text(
                        'Start typing to search users',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    );
                  }

                  if (chatProvider.searchResults.isEmpty) {
                    return Center(
                      child: Text(
                        'No users found',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                        ),
                      ),
                    );
                  }

                  return ListView.separated(
                    itemCount: chatProvider.searchResults.length,
                    separatorBuilder: (context, index) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final user = chatProvider.searchResults[index];
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: user.gender == 'female'
                              ? Colors.pink.shade100
                              : Colors.blue.shade100,
                          child: Icon(
                            user.gender == 'female'
                                ? Icons.person
                                : Icons.person_outline,
                            color: user.gender == 'female'
                                ? Colors.pink
                                : Colors.blue,
                          ),
                        ),
                        title: Text(user.username),
                        subtitle: Text(
                          user.role,
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                        onTap: () {
                          chatProvider.clearSearchResults();
                          Navigator.pop(context, user.username);
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
