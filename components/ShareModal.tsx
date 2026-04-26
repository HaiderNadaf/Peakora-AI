import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, FlatList, TextInput, Pressable, ActivityIndicator, Platform } from "react-native";
import { getUsers, sendSimpleDirectMessage, SimpleUser } from "../services/api";

type Props = {
  visible: boolean;
  contentToShare: string;
  onClose: () => void;
  onShared?: () => void;
};

export default function ShareModal({ visible, contentToShare, onClose, onShared }: Props) {
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<SimpleUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingUserId, setSendingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadUsers();
    }
  }, [visible]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
      setFilteredUsers(data);
    } catch {
      // Error handling
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text: string) => {
    setSearch(text);
    if (!text.trim()) {
      setFilteredUsers(users);
      return;
    }
    const lower = text.toLowerCase();
    setFilteredUsers(
      users.filter(u => 
        (u.username && u.username.toLowerCase().includes(lower)) || 
        u.email.toLowerCase().includes(lower)
      )
    );
  };

  const handleSend = async (user: SimpleUser) => {
    if (sendingUserId) return;
    try {
      setSendingUserId(user.id);
      await sendSimpleDirectMessage(user.id, contentToShare);
      onShared?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to send message");
    } finally {
      setSendingUserId(null);
    }
  };

  const getInitials = (user: SimpleUser) => {
    if (user.username) return user.username.charAt(0).toUpperCase();
    return user.email.charAt(0).toUpperCase();
  };

  const getDisplayName = (user: SimpleUser) => {
    return user.username || user.email.split("@")[0];
  };

  const renderItem = ({ item }: { item: SimpleUser }) => {
    const isSending = sendingUserId === item.id;
    return (
      <View style={styles.userItem}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(item)}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{getDisplayName(item)}</Text>
          <Text style={styles.userStatus}>Active now</Text>
        </View>
        <Pressable 
          style={[styles.sendButton, isSending && styles.sendingButton]} 
          onPress={() => handleSend(item)}
          disabled={isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#555" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </Pressable>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Send to</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Cancel</Text>
          </Pressable>
        </View>
        
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={handleSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.sectionTitle}>ALL FRIENDS</Text>
            <FlatList
              data={filteredUsers}
              keyExtractor={item => item.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 24 }}
            />
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: Platform.OS === "ios" ? 60 : 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    color: "#0084ff",
    fontSize: 16,
  },
  searchContainer: {
    padding: 16,
  },
  searchInput: {
    backgroundColor: "#f0f2f5",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#8a8d91",
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 8,
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#5f87d8",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  userStatus: {
    fontSize: 13,
    color: "#8a8d91",
    marginTop: 2,
  },
  sendButton: {
    backgroundColor: "#f0f2f5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendingButton: {
    backgroundColor: "#e0e2e5",
  },
  sendButtonText: {
    fontWeight: "bold",
    color: "#050505",
  },
});
