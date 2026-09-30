import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../providers/auth_provider.dart';
import '../utils/constants.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isLogin = true;
  final _formKey = GlobalKey<FormState>();
  
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  
  String _selectedGender = 'male';
  bool _isLoading = false;

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final authProvider = context.read<AuthProvider>();
    bool success;

    if (_isLogin) {
      success = await authProvider.login(
        _usernameController.text.trim(),
        _passwordController.text,
      );
    } else {
      success = await authProvider.register(
        username: _usernameController.text.trim(),
        password: _passwordController.text,
        passwordConfirm: _confirmPasswordController.text,
        gender: _selectedGender,
      );
    }

    setState(() => _isLoading = false);

    if (!success && mounted) {
      final msg = authProvider.error ?? AppStrings.errorUnknown;
      debugPrint('[AuthScreen] submit failed: $msg');
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            msg,
            maxLines: 6,
            overflow: TextOverflow.ellipsis,
          ),
          backgroundColor: AppColors.error,
          duration: const Duration(seconds: 8),
          action: SnackBarAction(
            label: 'OK',
            textColor: Colors.white,
            onPressed: () {},
          ),
        ),
      );
    }
  }

  void _toggleMode() {
    setState(() {
      _isLogin = !_isLogin;
      _formKey.currentState?.reset();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Form(
                key: _formKey,
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Logo/Title
                    Icon(
                      Icons.chat_bubble_outline,
                      size: 80,
                      color: Theme.of(context).primaryColor,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      AppStrings.appName,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isLogin ? AppStrings.login : AppStrings.register,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'API: ${AppConstants.apiUrl}',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                            fontFamily: 'monospace',
                          ),
                    ),
                    const SizedBox(height: 32),

                    // Username
                    TextFormField(
                      controller: _usernameController,
                      decoration: const InputDecoration(
                        labelText: AppStrings.username,
                        prefixIcon: Icon(Icons.person_outline),
                      ),
                      textInputAction: TextInputAction.next,
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return AppStrings.errorFieldRequired;
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Password
                    TextFormField(
                      controller: _passwordController,
                      decoration: const InputDecoration(
                        labelText: AppStrings.password,
                        prefixIcon: Icon(Icons.lock_outline),
                      ),
                      obscureText: true,
                      textInputAction: _isLogin ? TextInputAction.done : TextInputAction.next,
                      onFieldSubmitted: _isLogin ? (_) => _submit() : null,
                      validator: (value) {
                        if (value == null || value.isEmpty) {
                          return AppStrings.errorFieldRequired;
                        }
                        if (!_isLogin && value.length < AppConstants.minPasswordLength) {
                          return AppStrings.errorPasswordTooShort;
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Registration-only fields
                    if (!_isLogin) ...[
                      TextFormField(
                        controller: _confirmPasswordController,
                        decoration: const InputDecoration(
                          labelText: AppStrings.confirmPassword,
                          prefixIcon: Icon(Icons.lock_outline),
                        ),
                        obscureText: true,
                        textInputAction: TextInputAction.done,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return AppStrings.errorFieldRequired;
                          }
                          if (value != _passwordController.text) {
                            return AppStrings.errorPasswordsDontMatch;
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 16),

                      // Gender selection
                      DropdownButtonFormField<String>(
                        value: _selectedGender,
                        decoration: const InputDecoration(
                          labelText: AppStrings.gender,
                          prefixIcon: Icon(Icons.people_outline),
                        ),
                        items: const [
                          DropdownMenuItem(
                            value: 'male',
                            child: Text(AppStrings.male),
                          ),
                          DropdownMenuItem(
                            value: 'female',
                            child: Text(AppStrings.female),
                          ),
                        ],
                        onChanged: (value) {
                          if (value != null) {
                            setState(() => _selectedGender = value);
                          }
                        },
                      ),
                      const SizedBox(height: 24),
                    ] else
                      const SizedBox(height: 24),

                    // Submit button
                    ElevatedButton(
                      onPressed: _isLoading ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        backgroundColor: Theme.of(context).primaryColor,
                        foregroundColor: Colors.white,
                      ),
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : Text(
                              _isLogin ? AppStrings.loginButton : AppStrings.registerButton,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                    const SizedBox(height: 16),

                    // Toggle mode
                    TextButton(
                      onPressed: _toggleMode,
                      child: Text(
                        _isLogin
                            ? AppStrings.switchToRegister
                            : AppStrings.switchToLogin,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
