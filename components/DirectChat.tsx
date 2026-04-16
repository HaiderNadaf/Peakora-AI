import React, { useEffect, useRef, useState } from "react";
import { 
  View, Text, StyleSheet, FlatList, TextInput, Pressable, 
  KeyboardAvoidingView, Platform, ActivityIndicator 
} from "react-native";
import { getSimpleMessagesWithUser, sendSimpleDirectMessage, SimpleUser, SimpleDirectMessage, getMe } from "../services/api";

type Props = {
  otherUser: SimpleUser;
};

export default function DirectChat({ otherUser }: Props) {
  const [messages, setMessages] = useState<SimpleDirectMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    loadMyId();
    loadMessages();
  }, [otherUser.id]);

  const loadMyId = async () => {
    try {
      const me = await getMe();
      setMyUserId(me.id);
    } catch {}
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      const data = await getSimpleMessagesWithUser(otherUser.id);
      setMessages(data);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;

    const textPayload = inputText.trim();
    setInputText("");
    
    try {
      setSending(true);
      const newMessage = await sendSimpleDirectMessage(otherUser.id, textPayload);
      setMessages(prev => [...prev, newMessage]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: SimpleDirectMessage }) => {
    const isMine = item.senderId === myUserId;

    return (
      <View style={[styles.messageWrapper, isMine ? styles.messageMineWrapper : styles.messageTheirsWrapper]}>
        <View style={[styles.messageBubble, isMine ? styles.messageMine : styles.messageTheirs]}>
          <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextTheirs]}>
            {item.content}
          </Text>
        </View>
        <Text style={styles.timeText}>
          {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    );
  };

  if (loading && messages.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f26d5b" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
      />
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          value={inputText}
          onChangeText={setInputText}
          multiline
        />
        <Pressable 
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]} 
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          <Text style={styles.sendButtonText}>Send</Text>
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
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: "80%",
  },
  messageMineWrapper: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  messageTheirsWrapper: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  messageMine: {
    backgroundColor: "#303030",
    borderWidth: 1,
    borderColor: "#444",
    borderBottomRightRadius: 4,
  },
  messageTheirs: {
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#343434",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  messageTextMine: {
    color: "#f2f2f2",
  },
  messageTextTheirs: {
    color: "#ededed",
  },
  timeText: {
    fontSize: 11,
    color: "#9a9a9a",
    marginTop: 4,
    marginHorizontal: 4,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#212121",
    borderTopWidth: 1,
    borderTopColor: "#343434",
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    backgroundColor: "#1b1b1b",
    borderWidth: 1,
    borderColor: "#3a3a3a",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    maxHeight: 100,
    fontSize: 16,
    color: "#f2f2f2",
  },
  sendButton: {
    marginLeft: 12,
    marginBottom: 4,
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  sendButtonDisabled: {
    backgroundColor: "#6d6d6d",
  },
  sendButtonText: {
    color: "#111111",
    fontWeight: "bold",
    fontSize: 16,
  },
});
