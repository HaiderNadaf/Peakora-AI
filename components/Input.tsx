import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Keyboard,
  Platform,
  type NativeSyntheticEvent,
  type TextInputSubmitEditingEventData,
} from "react-native";

type InputProps = {
  disabled?: boolean;
  onSubmit: (value: string) => Promise<void> | void;
  onClear?: () => void;
  onMicPress?: () => void;
  isRecording?: boolean;
};

export default function Input({
  disabled,
  onSubmit,
  onClear,
  onMicPress,
  isRecording,
}: InputProps) {
  const [value, setValue] = useState("");

  const canSend = !disabled && value.trim().length > 0;

  const submitValue = async () => {
    const trimmed = value.trim();
    if (!trimmed) return;

    await onSubmit(trimmed);
    setValue("");
    Keyboard.dismiss(); // 👈 closes keyboard after send
  };

  const handleSubmitEditing = (
    event: NativeSyntheticEvent<TextInputSubmitEditingEventData>,
  ) => {
    if (!event.nativeEvent.text?.trim()) return;
    void submitValue();
  };

  return (
    <View style={styles.shell}>
      <Text style={styles.helperText}>
        {isRecording
          ? "Listening... I will send when you pause"
          : "Message Peakora AI"}
      </Text>

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Ask anything"
        placeholderTextColor="#8d8d8d"
        editable={!disabled}
        multiline
        style={styles.input}
        textAlignVertical="top" // 👈 FIX for multiline UI
        returnKeyType="send"
        blurOnSubmit={false} // 👈 important for multiline
        onSubmitEditing={
          Platform.OS === "ios" ? handleSubmitEditing : undefined
        }
      />

      <View style={styles.row}>
        <View style={styles.leftActions}>
          <Pressable
            disabled={disabled}
            onPress={onClear}
            style={({ pressed }) => [
              styles.newChat,
              pressed && !disabled && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={styles.newChatText}>New</Text>
          </Pressable>

          <Pressable
            disabled={disabled}
            onPress={onMicPress}
            style={({ pressed }) => [
              styles.mic,
              isRecording ? styles.micActive : styles.micIdle,
              pressed && !disabled && styles.pressed,
              disabled && styles.disabled,
            ]}
          >
            <Text style={styles.micText}>Mic</Text>
          </Pressable>
        </View>

        <Pressable
          disabled={!canSend}
          onPress={() => void submitValue()}
          style={({ pressed }) => [
            styles.send,
            canSend ? styles.sendEnabled : styles.sendDisabled,
            pressed && canSend && styles.pressed,
          ]}
        >
          <Text style={styles.sendText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    gap: 8,
    borderWidth: 1,
    borderColor: "#3f3f3f",
    borderRadius: 24,
    backgroundColor: "#2b2b2b",
    padding: 12,
  },
  helperText: {
    color: "#9d9d9d",
    fontSize: 12,
    paddingHorizontal: 4,
  },
  input: {
    color: "#ececec",
    fontSize: 16,
    lineHeight: 22,
    maxHeight: 150,
    minHeight: 40,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  newChat: {
    borderWidth: 1,
    borderColor: "#4e4e4e",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  newChatText: {
    color: "#cfcfcf",
    fontSize: 12,
    fontWeight: "600",
  },
  mic: {
    width: 42,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  micIdle: {
    backgroundColor: "#343434",
    borderColor: "#4e4e4e",
  },
  micActive: {
    backgroundColor: "#a32525",
    borderColor: "#cf4b4b",
  },
  micText: {
    color: "#f1f1f1",
    fontSize: 11,
    fontWeight: "600",
  },
  send: {
    minWidth: 54,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  sendEnabled: { backgroundColor: "#ececec" },
  sendDisabled: { backgroundColor: "#3a3a3a" },
  sendText: {
    color: "#111",
    fontSize: 12,
    fontWeight: "700",
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
