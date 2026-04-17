import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  getSimpleMessagesWithUser,
  sendSimpleDirectMessage,
  SimpleDirectMessage,
  SimpleUser,
} from "../services/api";

type Props = {
  otherUser: SimpleUser;
};

export default function DirectChat({ otherUser }: Props) {
  const [messages, setMessages] = useState<SimpleDirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    void loadMessages();
  }, [otherUser.id]);

  useEffect(() => {
    if (!loading) {
      spinValue.stopAnimation();
      spinValue.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );

    loop.start();
    return () => loop.stop();
  }, [loading, spinValue]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await getSimpleMessagesWithUser(otherUser.id);
      setMessages(data);
    } catch (err) {
      console.log("Failed to load direct chat", err);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (user: SimpleUser) => {
    return user.username || user.email.split("@")[0];
  };

  const filteredMessages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return messages;
    return messages.filter((message) =>
      message.content.toLowerCase().includes(needle),
    );
  }, [messages, query]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      const sent = await sendSimpleDirectMessage(otherUser.id, text);
      setMessages((prev) => [...prev, sent]);
      setDraft("");
    } catch (err) {
      console.log("Failed to send direct message", err);
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({
    item,
  }: {
    item: SimpleDirectMessage;
  }) => {
    const isMine = item.senderId !== otherUser.id;
    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.messageRowMine : styles.messageRowTheirs,
        ]}
      >
        <View style={[styles.bubble, isMine ? styles.mineBubble : styles.theirBubble]}>
          <Text style={styles.messageText}>{item.content}</Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingCard}>
          <Animated.View
            style={[
              styles.loadingPulse,
              {
                opacity: spinValue.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0.45, 1, 0.45],
                }),
              },
            ]}
          />
          <View style={styles.loadingLine} />
          <View style={[styles.loadingLine, styles.loadingLineShort]} />
          <Text style={styles.loadingText}>
            Loading chat with {getDisplayName(otherUser)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={styles.topBar}>
        <Pressable onPress={loadMessages}>
          <Text style={styles.cancelText}>Refresh chat</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9b9b9b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search messages..."
          placeholderTextColor="#9b9b9b"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <FlatList
        data={filteredMessages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>*</Text>
            </View>
            <Text style={styles.emptyText}>No messages yet</Text>
            <Text style={styles.emptySubText}>
              Start the conversation below.
            </Text>
          </View>
        }
      />

      <View style={styles.composer}>
        <TextInput
          style={styles.composerInput}
          placeholder="Write a message..."
          placeholderTextColor="#9b9b9b"
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <Pressable
          style={[styles.sendButton, sending && styles.sendButtonDisabled]}
          onPress={() => void handleSend()}
          disabled={sending}
        >
          <Text style={styles.sendButtonText}>
            {sending ? "Sending" : "Send"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#212121",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#212121",
  },
  loadingCard: {
    minWidth: 180,
    paddingVertical: 18,
    paddingHorizontal: 22,
    borderRadius: 20,
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "#343434",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingPulse: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#f26d5b",
    marginBottom: 6,
  },
  loadingLine: {
    width: 130,
    height: 10,
    borderRadius: 999,
    backgroundColor: "#3a3a3a",
  },
  loadingLineShort: {
    width: 96,
    marginTop: 8,
  },
  loadingText: {
    color: "#f0f0f0",
    fontSize: 13,
    textAlign: "center",
    marginTop: 10,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 8,
  },
  cancelText: {
    color: "#8fb7ff",
    fontSize: 14,
    fontWeight: "600",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#2b2b2b",
    borderWidth: 1,
    borderColor: "#3f3f3f",
  },
  searchInput: {
    flex: 1,
    color: "#f0f0f0",
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 12,
  },
  messageRow: {
    flexDirection: "row",
  },
  messageRowMine: {
    justifyContent: "flex-end",
  },
  messageRowTheirs: {
    justifyContent: "flex-start",
  },
  bubble: {
    maxWidth: "82%",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  mineBubble: {
    backgroundColor: "#303030",
    borderWidth: 1,
    borderColor: "#404040",
    borderBottomRightRadius: 6,
  },
  theirBubble: {
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "#353535",
    borderBottomLeftRadius: 6,
  },
  messageText: {
    color: "#ececec",
    lineHeight: 23,
    fontSize: 16,
  },
  emptyCard: {
    marginHorizontal: 16,
    marginTop: 18,
    paddingVertical: 28,
    paddingHorizontal: 18,
    borderRadius: 24,
    alignItems: "center",
    backgroundColor: "#262626",
    borderWidth: 1,
    borderColor: "#353535",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#313131",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyIconText: {
    color: "#f26d5b",
    fontSize: 20,
    fontWeight: "800",
  },
  emptyText: {
    color: "#f0f0f0",
    fontSize: 18,
    fontWeight: "700",
  },
  emptySubText: {
    color: "#a7a7a7",
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#f0f0f0",
    backgroundColor: "#2b2b2b",
    borderWidth: 1,
    borderColor: "#3f3f3f",
  },
  sendButton: {
    minWidth: 72,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },
  sendButtonDisabled: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: "#111111",
    fontSize: 13,
    fontWeight: "700",
  },
});
