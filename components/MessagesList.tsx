import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import {
  getSimpleConversations,
  SimpleDirectMessage,
  SimpleUser,
} from "../services/api";

type Conversation = {
  user: SimpleUser;
  lastMessage?: SimpleDirectMessage;
};

type Props = {
  onSelectUser: (user: SimpleUser) => void;
  currentUserId: string;
  seenUserIds: string[];
};

export default function MessagesList({
  onSelectUser,
  currentUserId,
  seenUserIds,
}: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadConversations();
  }, []);

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

  const loadConversations = async () => {
    try {
      setError("");
      setLoading(true);
      const data = await getSimpleConversations();
      setConversations(data);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? (err.response?.data as { error?: string } | undefined)?.error ||
          err.message
        : err instanceof Error
          ? err.message
          : "Unknown error";
      setError(`Failed to load messages: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (user: SimpleUser) => {
    if (user.username) return user.username.charAt(0).toUpperCase();
    return user.email.charAt(0).toUpperCase();
  };

  const getDisplayName = (user: SimpleUser) => {
    return user.username || user.email.split("@")[0];
  };

  const filteredConversations = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((conversation) => {
      const name = getDisplayName(conversation.user).toLowerCase();
      const email = conversation.user.email.toLowerCase();
      return name.includes(needle) || email.includes(needle);
    });
  }, [conversations, query]);

  const renderItem = ({ item }: { item: Conversation }) => {
    const isUnread =
      !!currentUserId &&
      !!item.lastMessage &&
      item.lastMessage.senderId !== currentUserId &&
      !seenUserIds.includes(item.user.id);

    return (
      <Pressable
        style={styles.row}
        onPress={() => onSelectUser(item.user)}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.user)}</Text>
        </View>

        <View style={styles.rowText}>
          <View style={styles.rowTitleLine}>
            <Text style={styles.nameText}>{getDisplayName(item.user)}</Text>
            {isUnread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>1</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.statusText}>
            {item.lastMessage?.content?.slice(0, 42) || "Tap to open chat"}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color="#8f8f8f" />
      </Pressable>
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
          <Text style={styles.loadingText}>Loading conversations</Text>
        </View>
      </View>
    );
  }

  return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable onPress={loadConversations}>
            <Text style={styles.cancelText}>Refresh</Text>
          </Pressable>
        </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={16} color="#9b9b9b" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search chats..."
          placeholderTextColor="#9b9b9b"
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <Text style={styles.sectionLabel}>YOUR CHATS</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.user.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadConversations}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>*</Text>
            </View>
            <Text style={styles.emptyText}>No chats found</Text>
            <Text style={styles.emptySubText}>
              Start a conversation or refresh to load your chats.
            </Text>
          </View>
        }
      />
    </View>
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
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
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
  sectionLabel: {
    color: "#8e8e8e",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginHorizontal: 18,
    marginBottom: 10,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#2f2f2f",
    borderRadius: 18,
    backgroundColor: "#262626",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f26d5b",
  },
  avatarText: {
    color: "#f2f2f2",
    fontSize: 18,
    fontWeight: "bold",
  },
  rowText: {
    flex: 1,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  nameText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#f3f3f3",
  },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f26d5b",
  },
  unreadBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
  },
  statusText: {
    fontSize: 13,
    color: "#a7a7a7",
    marginTop: 2,
  },
  errorText: {
    color: "#ff9a9a",
    marginHorizontal: 16,
    marginBottom: 10,
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
});
