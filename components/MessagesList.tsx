import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from "react-native";
import axios from "axios";
import { getSimpleConversations, SimpleUser, SimpleDirectMessage } from "../services/api";

type Conversation = {
  user: SimpleUser;
  lastMessage?: SimpleDirectMessage;
};

type Props = {
  onSelectUser: (user: SimpleUser) => void;
};

export default function MessagesList({ onSelectUser }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadConversations();
  }, []);

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

  const renderItem = ({ item }: { item: Conversation; index: number }) => {
    return (
      <Pressable style={styles.itemContainer} onPress={() => onSelectUser(item.user)}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item.user)}</Text>
          <View style={styles.onlineIndicator} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{getDisplayName(item.user)}</Text>
          {item.lastMessage ? (
            <Text style={styles.lastMessageText} numberOfLines={1}>
              {item.lastMessage.content}
            </Text>
          ) : (
            <Text style={styles.noMessageText}>No messages yet</Text>
          )}
        </View>
        {item.lastMessage && (
          <Text style={styles.timeText}>
            {new Date(item.lastMessage.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f5f5f5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      
      {conversations.length === 0 && !error ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>You haven't messaged anyone yet.</Text>
          <Text style={styles.emptySubText}>Share an AI response to start a chat!</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.user.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshing={loading}
          onRefresh={loadConversations}
        />
      )}
    </View>
  );
}

  const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#212121",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingVertical: 8,
  },
  itemContainer: {
    flexDirection: "row",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#2f2f2f",
    alignItems: "center",
    backgroundColor: "#212121",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
    backgroundColor: "#2e2e2e",
    borderWidth: 1,
    borderColor: "#444",
  },
  avatarText: {
    color: "#f2f2f2",
    fontSize: 20,
    fontWeight: "bold",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#f0f0f0",
    borderWidth: 2,
    borderColor: "#212121",
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  nameText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f3f3f3",
    marginBottom: 4,
  },
  lastMessageText: {
    fontSize: 14,
    color: "#b0b0b0",
  },
  noMessageText: {
    fontSize: 14,
    color: "#9d9d9d",
    fontStyle: "italic",
  },
  timeText: {
    fontSize: 12,
    color: "#8d8d8d",
    marginLeft: 8,
  },
  errorText: {
    color: "#f2f2f2",
    textAlign: "center",
    margin: 16,
  },
  emptyText: {
    color: "#f0f0f0",
    fontSize: 16,
    fontWeight: "500",
  },
  emptySubText: {
    color: "#a7a7a7",
    fontSize: 14,
    marginTop: 8,
  },
});
