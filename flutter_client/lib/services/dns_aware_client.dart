import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:http/io_client.dart';

import '../utils/app_log.dart';

/// HTTP client that survives broken Android system DNS (AdGuard Private DNS, etc.).
///
/// Chrome often works because it uses its own DoH. Dart uses getaddrinfo → errno 7.
/// We resolve via Cloudflare DoH at the literal IP `1.1.1.1` (no DNS needed),
/// then open TLS to that address with the correct SNI hostname.
class DnsAwareHttpClient {
  DnsAwareHttpClient._(this._io, this._http);

  final HttpClient _io;
  final IOClient _http;

  static DnsAwareHttpClient? _instance;

  static DnsAwareHttpClient instance() {
    return _instance ??= DnsAwareHttpClient._create();
  }

  static DnsAwareHttpClient _create() {
    final io = HttpClient();
    io.connectionFactory = _connectionFactory;
    io.idleTimeout = const Duration(seconds: 30);
    io.connectionTimeout = const Duration(seconds: 20);
    return DnsAwareHttpClient._(io, IOClient(io));
  }

  http.Client get client => _http;

  void close() {
    _http.close();
    _io.close(force: true);
    _instance = null;
  }

  static final Set<String> _diagnosed = <String>{};

  /// Log what system DNS and DoH see for [host] (once per process/host).
  static Future<void> diagnose(String host) async {
    if (!_diagnosed.add(host)) return;
    AppLog.info('DNS', 'diagnose start · host=$host');

    for (final type in [
      InternetAddressType.any,
      InternetAddressType.IPv4,
      InternetAddressType.IPv6,
    ]) {
      try {
        final addrs = await InternetAddress.lookup(host, type: type)
            .timeout(const Duration(seconds: 5));
        AppLog.info(
          'DNS',
          'system lookup type=$type → ${addrs.map((a) => '${a.address}(${a.type})').join(', ')}',
        );
      } catch (e) {
        AppLog.error('DNS', 'system lookup type=$type FAILED', e);
      }
    }

    try {
      final viaDoh = await resolveViaDoh(host);
      AppLog.info('DNS', 'DoH (1.1.1.1) → ${viaDoh.map((a) => a.address).join(', ')}');
    } catch (e) {
      AppLog.error('DNS', 'DoH resolve FAILED', e);
    }
  }

  static Future<ConnectionTask<Socket>> _connectionFactory(
    Uri uri,
    String? proxyHost,
    int? proxyPort,
  ) {
    Future<Socket> open() async {
      if (proxyHost != null) {
        throw HttpException('Proxies are not supported by DnsAwareHttpClient');
      }

      final host = uri.host;
      final port = uri.hasPort ? uri.port : (uri.isScheme('https') ? 443 : 80);
      final addr = await resolveHost(host);
      AppLog.info('DNS', 'connect $host → ${addr.address}:$port scheme=${uri.scheme}');

      if (uri.isScheme('https')) {
        return SecureSocket.connect(
          addr,
          port,
          host: host,
          timeout: const Duration(seconds: 20),
        );
      }
      return Socket.connect(addr, port, timeout: const Duration(seconds: 20));
    }

    final future = open();
    return ConnectionTask.fromSocket(future, () {});
  }

  /// Prefer system IPv4, then any system address, then DoH A records.
  static Future<InternetAddress> resolveHost(String host) async {
    // Literal IP — nothing to resolve.
    final literal = InternetAddress.tryParse(host);
    if (literal != null) return literal;

    try {
      final v4 = await InternetAddress.lookup(host, type: InternetAddressType.IPv4)
          .timeout(const Duration(seconds: 3));
      if (v4.isNotEmpty) {
        AppLog.info('DNS', 'resolved via system IPv4: ${v4.first.address}');
        return v4.first;
      }
    } catch (e) {
      AppLog.error('DNS', 'system IPv4 failed, will try DoH', e);
    }

    try {
      final any = await InternetAddress.lookup(host).timeout(const Duration(seconds: 3));
      if (any.isNotEmpty) {
        AppLog.info('DNS', 'resolved via system any: ${any.first.address}');
        return any.first;
      }
    } catch (e) {
      AppLog.error('DNS', 'system any failed, will try DoH', e);
    }

    final doh = await resolveViaDoh(host);
    if (doh.isEmpty) {
      throw SocketException('DoH returned no A records for $host');
    }
    AppLog.info('DNS', 'resolved via DoH: ${doh.first.address}');
    return doh.first;
  }

  /// Cloudflare DNS-over-HTTPS against literal `1.1.1.1` (no prior DNS needed).
  static Future<List<InternetAddress>> resolveViaDoh(String host) async {
    final io = HttpClient();
    try {
      final uri = Uri.https('1.1.1.1', '/dns-query', {
        'name': host,
        'type': 'A',
      });
      final req = await io.getUrl(uri).timeout(const Duration(seconds: 10));
      req.headers.set(HttpHeaders.acceptHeader, 'application/dns-json');
      final res = await req.close().timeout(const Duration(seconds: 10));
      final body = await res.transform(utf8.decoder).join();
      AppLog.info('DNS', 'DoH HTTP ${res.statusCode} body=${body.length > 240 ? '${body.substring(0, 240)}…' : body}');
      if (res.statusCode != 200) {
        throw HttpException('DoH status ${res.statusCode}');
      }
      final json = jsonDecode(body) as Map<String, dynamic>;
      final answers = json['Answer'] as List<dynamic>? ?? const [];
      final out = <InternetAddress>[];
      for (final raw in answers) {
        if (raw is! Map<String, dynamic>) continue;
        if (raw['type'] != 1) continue; // A
        final data = raw['data'] as String?;
        if (data == null) continue;
        final parsed = InternetAddress.tryParse(data);
        if (parsed != null) out.add(parsed);
      }
      return out;
    } finally {
      io.close(force: true);
    }
  }
}
