import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";

type Message = {
  role: "user" | "assistant";
  text: string;
};

type ChatBoxProps = {
  messages: Message[];
  loading?: boolean;
};

export default function ChatBox({ messages, loading }: ChatBoxProps) {
  const scrollRef = useRef<KeyboardAwareScrollView | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      scrollRef.current?.scrollToEnd(true);
    }, 100);
    return () => clearTimeout(timeout);
  }, [messages, loading]);

  return (
    <KeyboardAwareScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      enableOnAndroid
      extraScrollHeight={80}
      showsVerticalScrollIndicator={false}
    >
      {messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyBadge}>
            <Text style={styles.emptyBadgeText}>P</Text>
          </View>

          <Text style={styles.emptyTitle}>How can I help you today?</Text>

          <Text style={styles.emptySubtitle}>
            Messages are saved in device storage.
          </Text>
        </View>
      ) : (
        messages.map((message, index) => (
          <View
            key={`${message.role}-${index}`}
            style={[
              styles.row,
              message.role === "user" ? styles.rowUser : styles.rowAssistant,
            ]}
          >
            {message.role === "assistant" && (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>P</Text>
              </View>
            )}

            <View
              style={[
                styles.bubble,
                message.role === "user"
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              <Text style={styles.messageText}>{message.text}</Text>
            </View>
          </View>
        ))
      )}

      {loading && (
        <View style={[styles.row, styles.rowAssistant]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>P</Text>
          </View>

          <View style={[styles.bubble, styles.assistantBubble]}>
            <Text style={styles.loadingText}>Thinking...</Text>
          </View>
        </View>
      )}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#212121",
  },
  content: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
    gap: 10,
  },
  emptyBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2e2e2e",
    borderWidth: 1,
    borderColor: "#3f3f3f",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyBadgeText: {
    color: "#e7e7e7",
    fontWeight: "700",
    fontSize: 17,
  },
  emptyTitle: {
    color: "#f0f0f0",
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  emptySubtitle: {
    color: "#9f9f9f",
    fontSize: 13,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    marginBottom: 14,
    alignItems: "flex-start",
  },
  rowUser: {
    justifyContent: "flex-end",
  },
  rowAssistant: {
    justifyContent: "flex-start",
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#2e2e2e",
    borderWidth: 1,
    borderColor: "#3f3f3f",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  avatarText: {
    color: "#f1f1f1",
    fontSize: 12,
    fontWeight: "700",
  },
  bubble: {
    maxWidth: "85%",
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: "#303030",
    borderWidth: 1,
    borderColor: "#404040",
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingHorizontal: 2,
    maxWidth: "78%",
  },
  messageText: {
    color: "#ececec",
    lineHeight: 23,
    fontSize: 16,
  },
  loadingText: {
    color: "#a9a9a9",
    fontStyle: "italic",
  },
});
