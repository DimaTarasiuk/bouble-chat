import 'package:flutter/foundation.dart';

/// In-memory ring buffer of debug lines for on-device copy.
class AppLog {
  AppLog._();

  static const int maxLines = 200;
  static final List<String> _lines = <String>[];

  static List<String> get lines => List.unmodifiable(_lines);

  static String dump() {
    if (_lines.isEmpty) return '(no logs yet)';
    return _lines.join('\n');
  }

  static void clear() => _lines.clear();

  static void info(String tag, String message) {
    _append('I', tag, message);
  }

  static void error(String tag, String message, [Object? error, StackTrace? st]) {
    _append('E', tag, message);
    if (error != null) _append('E', tag, 'cause: $error');
    if (st != null) {
      final short = st.toString().split('\n').take(8).join('\n');
      _append('E', tag, 'stack:\n$short');
    }
  }

  static void _append(String level, String tag, String message) {
    final ts = DateTime.now().toIso8601String().substring(11, 23);
    final line = '[$ts] $level/$tag $message';
    _lines.add(line);
    while (_lines.length > maxLines) {
      _lines.removeAt(0);
    }
    debugPrint(line);
  }
}
