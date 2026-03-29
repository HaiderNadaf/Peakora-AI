import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
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
  };

  const handleSubmitEditing = (
    event: NativeSyntheticEvent<TextInputSubmitEditingEventData>
  ) => {
    if (!event.nativeEvent.text?.trim()) return;
    void submitValue();
  };

  return (
    <View style={styles.shell}>
      <Text style={styles.helperText}>
        {isRecording ? "Listening... I will send when you pause" : "Message Peakora AI"}
      </Text>

      <TextInput
        value={value}
        onChangeText={setValue}
        placeholder="Ask anything"
        placeholderTextColor="#8d8d8d"
        editable={!disabled}
        multiline
        numberOfLines={3}
        style={styles.input}
        onSubmitEditing={handleSubmitEditing}
      />

      <View style={styles.row}>
        <View style={styles.leftActions}>
          <Pressable
            disabled={disabled}
            onPress={onClear}
            style={({ pressed }) => [
              styles.newChat,
              pressed && !disabled ? styles.pressed : undefined,
              disabled ? styles.disabled : undefined,
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
              pressed && !disabled ? styles.pressed : undefined,
              disabled ? styles.disabled : undefined,
            ]}
            accessibilityLabel="Record speech"
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
            pressed && canSend ? styles.pressed : undefined,
          ]}
          accessibilityLabel="Send message"
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
    maxHeight: 180,
    minHeight: 26,
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
    backgroundColor: "transparent",
  },
  newChatText: { color: "#cfcfcf", fontSize: 12, fontWeight: "600" },
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
  sendText: { color: "#111", fontSize: 12, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
});
