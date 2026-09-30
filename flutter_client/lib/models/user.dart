class User {
  final int id;
  final String username;
  final String role;
  final String? firstName;
  final String? lastName;
  final String? birthDate;
  final String gender;
  final String? lastSeen;
  final String? bannedAt;
  final String? banReason;
  final String createdAt;

  User({
    required this.id,
    required this.username,
    required this.role,
    this.firstName,
    this.lastName,
    this.birthDate,
    required this.gender,
    this.lastSeen,
    this.bannedAt,
    this.banReason,
    required this.createdAt,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as int,
      username: json['username'] as String,
      role: json['role'] as String? ?? 'user',
      firstName: json['first_name'] as String?,
      lastName: json['last_name'] as String?,
      birthDate: json['birth_date'] as String?,
      gender: json['gender'] as String,
      lastSeen: json['last_seen'] as String?,
      bannedAt: json['banned_at'] as String?,
      banReason: json['ban_reason'] as String?,
      createdAt: json['created_at'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'role': role,
      'first_name': firstName,
      'last_name': lastName,
      'birth_date': birthDate,
      'gender': gender,
      'last_seen': lastSeen,
      'banned_at': bannedAt,
      'ban_reason': banReason,
      'created_at': createdAt,
    };
  }

  bool get isBanned => bannedAt != null;
}
