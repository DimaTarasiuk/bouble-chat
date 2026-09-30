class Conversation {
  final int id;
  final int peerId;
  final String peer;
  final String peerGender;
  final int unreadCount;
  final String createdAt;
  final Message? lastMessage;

  Conversation({
    required this.id,
    required this.peerId,
    required this.peer,
    required this.peerGender,
    this.unreadCount = 0,
    required this.createdAt,
    this.lastMessage,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['id'] as int,
      peerId: json['peer_id'] as int,
      peer: json['peer'] as String,
      peerGender: json['peer_gender'] as String? ?? 'male',
      unreadCount: json['unread_count'] as int? ?? 0,
      createdAt: json['created_at'] as String,
      lastMessage: json['last_message'] != null
          ? Message.fromJson(json['last_message'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'peer_id': peerId,
      'peer': peer,
      'peer_gender': peerGender,
      'unread_count': unreadCount,
      'created_at': createdAt,
      'last_message': lastMessage?.toJson(),
    };
  }

  Conversation copyWith({
    int? unreadCount,
    Message? lastMessage,
  }) {
    return Conversation(
      id: id,
      peerId: peerId,
      peer: peer,
      peerGender: peerGender,
      unreadCount: unreadCount ?? this.unreadCount,
      createdAt: createdAt,
      lastMessage: lastMessage ?? this.lastMessage,
    );
  }
}

class Message {
  final int id;
  final String from;
  final String text;
  final String time;
  final int? conversationId;

  Message({
    required this.id,
    required this.from,
    required this.text,
    required this.time,
    this.conversationId,
  });

  factory Message.fromJson(Map<String, dynamic> json) {
    return Message(
      id: json['id'] as int,
      from: json['from'] as String,
      text: json['text'] as String,
      time: json['time'] as String,
      conversationId: json['conversation_id'] as int?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'from': from,
      'text': text,
      'time': time,
      'conversation_id': conversationId,
    };
  }

  DateTime get dateTime => DateTime.parse(time);
}
