import { useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createCollabSession,
  getCollabSession,
  getDirectConversation,
  getRealtimeSocketUrl,
  listCollabSessions,
  listCollabUsers,
  researchInSession,
  sendDirectMessage,
  tagResearchToUser,
  type CollabSession,
  type CollabUser,
  type DirectConversation,
} from "../services/api";

type Props = {
  token: string;
  currentUserId: string;
};

export default function CollabHub({ token, currentUserId }: Props) {
  const [users, setUsers] = useState<CollabUser[]>([]);
  const [sessions, setSessions] = useState<CollabSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetail, setSessionDetail] = useState<{
    session: CollabSession & { messages: any[] };
    directChats: Array<{ id: string; participantA: CollabUser; participantB: CollabUser }>;
  } | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionTopic, setSessionTopic] = useState("");
  const [query, setQuery] = useState("");
  const [activePeerId, setActivePeerId] = useState<string | null>(null);
  const [directConversation, setDirectConversation] = useState<DirectConversation | null>(null);
  const [directText, setDirectText] = useState("");
  const [shareNote, setShareNote] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  const loadBase = async () => {
    const [nextUsers, nextSessions] = await Promise.all([listCollabUsers(), listCollabSessions()]);
    setUsers(nextUsers);
    setSessions(nextSessions);
  };

  const loadSession = async (sessionId: string) => {
    const detail = await getCollabSession(sessionId);
    setSessionDetail(detail);
    setSelectedSessionId(sessionId);
  };

  const loadDirectConversation = async (peerId: string) => {
    if (!selectedSessionId) return;
    const conversation = await getDirectConversation(selectedSessionId, peerId);
    setActivePeerId(peerId);
    setDirectConversation(conversation);
  };

  useEffect(() => {
    void loadBase();
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = new WebSocket(getRealtimeSocketUrl(token));
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data) as
        | { type: "session.updated"; payload: { sessionId: string } }
        | { type: "direct.updated"; payload: { conversationId: string; sessionId: string } };

      if (data.type === "session.updated") {
        void loadBase();
        if (selectedSessionId === data.payload.sessionId) {
          void loadSession(data.payload.sessionId);
        }
      }

      if (data.type === "direct.updated" && selectedSessionId === data.payload.sessionId) {
        if (activePeerId) {
          void loadDirectConversation(activePeerId);
        }
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [activePeerId, selectedSessionId, token]);

  const peers = useMemo(() => {
    if (!sessionDetail) return [];
    return sessionDetail.session.participants
      .map((participant) => participant.user)
      .filter((user) => user.id !== currentUserId);
  }, [currentUserId, sessionDetail]);

  const toggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleCreateSession = async () => {
    if (!sessionTitle.trim()) return;
    const session = await createCollabSession({
      title: sessionTitle.trim(),
      topic: sessionTopic.trim(),
      participantIds: selectedUserIds,
    });
    setSessionTitle("");
    setSessionTopic("");
    setSelectedUserIds([]);
    await loadBase();
    await loadSession(session.id);
  };

  const handleResearch = async () => {
    if (!selectedSessionId || !query.trim()) return;
    await researchInSession(selectedSessionId, query.trim());
    setQuery("");
    await loadSession(selectedSessionId);
  };

  const handleSendDirect = async () => {
    if (!directConversation || !directText.trim()) return;
    await sendDirectMessage(directConversation.id, directText.trim());
    setDirectText("");
    if (activePeerId) {
      await loadDirectConversation(activePeerId);
    }
  };

  const handleTag = async (sessionMessageId: string) => {
    if (!selectedSessionId || !activePeerId) return;
    await tagResearchToUser({
      sessionId: selectedSessionId,
      targetUserId: activePeerId,
      sessionMessageId,
      note: shareNote.trim(),
    });
    setShareNote("");
    await loadDirectConversation(activePeerId);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Research Session</Text>
      <Text style={styles.subtitle}>
        Create one shared room, research there, then tag useful answers into personal chat.
      </Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Create Session</Text>
        <TextInput
          style={styles.input}
          placeholder="Session title"
          placeholderTextColor="#8b8b8b"
          value={sessionTitle}
          onChangeText={setSessionTitle}
        />
        <TextInput
          style={styles.input}
          placeholder="Topic"
          placeholderTextColor="#8b8b8b"
          value={sessionTopic}
          onChangeText={setSessionTopic}
        />
        <Text style={styles.helper}>Invite people</Text>
        <View style={styles.chipWrap}>
          {users.map((user) => (
            <Pressable
              key={user.id}
              onPress={() => toggleUser(user.id)}
              style={[styles.chip, selectedUserIds.includes(user.id) ? styles.chipActive : undefined]}
            >
              <Text style={styles.chipText}>{user.email}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => void handleCreateSession()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Create Shared Session</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your Sessions</Text>
        {sessions.map((session) => (
          <Pressable
            key={session.id}
            onPress={() => void loadSession(session.id)}
            style={[
              styles.sessionRow,
              selectedSessionId === session.id ? styles.sessionRowActive : undefined,
            ]}
          >
            <Text style={styles.sessionTitle}>{session.title}</Text>
            <Text style={styles.sessionMeta}>
              {session.topic || "No topic"} • {session.participants.length} users
            </Text>
          </Pressable>
        ))}
      </View>

      {sessionDetail ? (
        <>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{sessionDetail.session.title}</Text>
            <Text style={styles.sessionMeta}>{sessionDetail.session.topic || "No topic yet"}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Ask the room to research something"
              placeholderTextColor="#8b8b8b"
              value={query}
              onChangeText={setQuery}
              multiline
            />
            <Pressable onPress={() => void handleResearch()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Research In Session</Text>
            </Pressable>

            <View style={styles.messageList}>
              {sessionDetail.session.messages?.map((message) => (
                <View key={message.id} style={styles.messageCard}>
                  <Text style={styles.messageMeta}>
                    {message.author.email} • {message.kind.replace(/_/g, " ")}
                  </Text>
                  <Text style={styles.messageText}>{message.content}</Text>
                  {message.kind === "research_result" && activePeerId ? (
                    <Pressable
                      onPress={() => void handleTag(message.id)}
                      style={styles.secondaryButton}
                    >
                      <Text style={styles.secondaryButtonText}>Tag To Personal Chat</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Personal Chats</Text>
            <View style={styles.chipWrap}>
              {peers.map((peer) => (
                <Pressable
                  key={peer.id}
                  onPress={() => void loadDirectConversation(peer.id)}
                  style={[styles.chip, activePeerId === peer.id ? styles.chipActive : undefined]}
                >
                  <Text style={styles.chipText}>{peer.email}</Text>
                </Pressable>
              ))}
            </View>

            {activePeerId ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Optional note when tagging research"
                  placeholderTextColor="#8b8b8b"
                  value={shareNote}
                  onChangeText={setShareNote}
                />

                <View style={styles.messageList}>
                  {directConversation?.messages.map((message) => (
                    <View key={message.id} style={styles.messageCard}>
                      <Text style={styles.messageMeta}>{message.sender.email}</Text>
                      {message.kind === "tagged_research" && message.sourceSessionMessage ? (
                        <>
                          {!!message.content && <Text style={styles.messageText}>{message.content}</Text>}
                          <View style={styles.tagCard}>
                            <Text style={styles.tagLabel}>Tagged research</Text>
                            <Text style={styles.messageText}>{message.sourceSessionMessage.content}</Text>
                          </View>
                        </>
                      ) : (
                        <Text style={styles.messageText}>{message.content}</Text>
                      )}
                    </View>
                  ))}
                </View>

                <TextInput
                  style={styles.input}
                  placeholder="Send a personal message"
                  placeholderTextColor="#8b8b8b"
                  value={directText}
                  onChangeText={setDirectText}
                />
                <Pressable onPress={() => void handleSendDirect()} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Send Personal Message</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.helper}>Select one user to open personal chat.</Text>
            )}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#212121" },
  content: { paddingBottom: 32, gap: 14 },
  title: { color: "#f3f3f3", fontSize: 24, fontWeight: "700" },
  subtitle: { color: "#adadad", lineHeight: 20, marginBottom: 2 },
  card: {
    backgroundColor: "#2a2a2a",
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 18,
    padding: 14,
    gap: 10,
  },
  sectionTitle: { color: "#f1f1f1", fontSize: 18, fontWeight: "700" },
  input: {
    borderWidth: 1,
    borderColor: "#414141",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#efefef",
    backgroundColor: "#1f1f1f",
  },
  textArea: { minHeight: 88, textAlignVertical: "top" },
  helper: { color: "#a6a6a6", fontSize: 13 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#484848",
    backgroundColor: "#323232",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipActive: {
    backgroundColor: "#55372f",
    borderColor: "#ef8b6b",
  },
  chipText: { color: "#efefef", fontSize: 12 },
  primaryButton: {
    backgroundColor: "#efefef",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  primaryButtonText: { color: "#151515", fontWeight: "700" },
  secondaryButton: {
    alignSelf: "flex-start",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#5c5c5c",
    backgroundColor: "#303030",
  },
  secondaryButtonText: { color: "#f0f0f0", fontWeight: "600", fontSize: 12 },
  sessionRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3c3c3c",
    padding: 12,
    backgroundColor: "#262626",
  },
  sessionRowActive: {
    borderColor: "#ef8b6b",
    backgroundColor: "#332521",
  },
  sessionTitle: { color: "#f3f3f3", fontWeight: "700", fontSize: 15 },
  sessionMeta: { color: "#a8a8a8", fontSize: 12 },
  messageList: { gap: 10, marginTop: 6 },
  messageCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#3f3f3f",
    backgroundColor: "#262626",
    padding: 12,
    gap: 7,
  },
  messageMeta: { color: "#9f9f9f", fontSize: 12 },
  messageText: { color: "#ececec", lineHeight: 20, fontSize: 14 },
  tagCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#4a4a4a",
    backgroundColor: "#1d1d1d",
    padding: 10,
    gap: 6,
  },
  tagLabel: { color: "#f39f80", fontSize: 12, fontWeight: "700" },
});
