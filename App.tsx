import {
  ClerkProvider,
  useAuth,
  useClerk,
  useSignIn,
  useSignUp,
} from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import { StatusBar } from "expo-status-bar";
import axios from "axios";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import ChatBox from "./components/ChatBox";
import Input from "./components/Input";
import {
  generateVoiceBase64,
  getMe,
  getChatHistory,
  sendChatMessage,
  setAuthToken,
  setTokenProvider,
  transcribeAudio,
} from "./services/api";

type Message = {
  role: "user" | "assistant";
  text: string;
};

const SILENCE_THRESHOLD_DB = -45;
const SILENCE_TIMEOUT_MS = 1600;
const MIN_RECORDING_MS = 1200;
const MAX_RECORDING_MS = 12000;
const METERING_POLL_MS = 250;
const CLERK_CLIENT_JWT_KEY = "__clerk_client_jwt";
const clerkPublishableKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!clerkPublishableKey) {
  throw new Error(
    "Missing Clerk publishable key in frontend env. Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY or NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.",
  );
}

function AppContent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [voiceStatus, setVoiceStatus] = useState("Ready");
  const [voiceSessionOpen, setVoiceSessionOpen] = useState(false);
  const [voiceLevel, setVoiceLevel] = useState(0.12);
  const recordingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const playbackResolveRef = useRef<(() => void) | null>(null);
  const lastSpeechAtRef = useRef<number>(0);
  const stopInFlightRef = useRef(false);
  const voiceLoopEnabledRef = useRef(false);

  const { isLoaded: isClerkLoaded, isSignedIn, getToken } = useAuth();
  const { signOut, setActive } = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [token, setToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [authStep, setAuthStep] = useState<"credentials" | "verify-email">(
    "credentials",
  );
  const [authError, setAuthError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const resetAuthState = () => {
    setAuthToken(null);
    setToken(null);
    setMessages([]);
    setEmail("");
    setPassword("");
    setVerificationCode("");
    setAuthError("");
    setAuthMode("login");
    setAuthStep("credentials");
    setTokenProvider(null);
  };

  useEffect(() => {
    if (!isClerkLoaded) {
      return;
    }

    setTokenProvider(() => getToken({ skipCache: true }));

    return () => {
      setTokenProvider(null);
    };
  }, [getToken, isClerkLoaded, isSignedIn]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!isClerkLoaded) {
        return;
      }

      if (!cancelled) {
        setAuthLoading(true);
      }
      try {
        if (!isSignedIn) {
          setAuthToken(null);
          if (!cancelled) {
            setToken(null);
            setMessages([]);
            setAuthStep("credentials");
          }
          return;
        }

        const sessionToken = await getToken({ skipCache: true });
        if (!sessionToken) {
          setAuthToken(null);
          if (!cancelled) {
            setToken(null);
            setMessages([]);
            setAuthError(
              "Signed in, but Clerk did not provide a valid session token. Please logout and sign in again.",
            );
          }
          return;
        }

        setAuthToken(sessionToken);
        if (!cancelled) {
          setToken(sessionToken);
        }

        try {
          await getMe();
          if (!cancelled) {
            await loadHistory();
          }
        } catch (error) {
          if (!cancelled) {
            const message = getClerkErrorMessage(
              error,
              "Signed in, but failed to load profile data.",
            );
            setAuthError(message);
          }
        }
      } catch {
        setAuthToken(null);
        if (!cancelled) {
          setToken(null);
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [isClerkLoaded, isSignedIn]);

  const loadHistory = async () => {
    const history = await getChatHistory();
    setMessages(
      history.map((item) => ({ role: item.role, text: item.content })),
    );
  };

  const playReplyAudio = async (text: string) => {
    if (!voiceLoopEnabledRef.current) {
      return;
    }

    const { audioBase64 } = await generateVoiceBase64(text);
    if (!voiceLoopEnabledRef.current) {
      return;
    }

    if (!audioBase64) {
      throw new Error("No audio generated from ElevenLabs");
    }

    const outputPath = `${FileSystem.cacheDirectory}peakora-reply-${Date.now()}.mp3`;

    await FileSystem.writeAsStringAsync(outputPath, audioBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
    });

    const sound = new Audio.Sound();
    soundRef.current = sound;
    await sound.loadAsync(
      { uri: outputPath },
      { shouldPlay: true, volume: 1.0, progressUpdateIntervalMillis: 250 },
    );
    const playback = await sound.getStatusAsync();
    if (!playback.isLoaded) {
      throw new Error("Reply audio could not be loaded for playback");
    }

    await new Promise<void>((resolve) => {
      playbackResolveRef.current = resolve;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          playbackResolveRef.current = null;
          void sound.unloadAsync();
          if (soundRef.current === sound) {
            soundRef.current = null;
          }
          resolve();
        }
      });
    });
  };

  const clearRecordingPoll = () => {
    if (recordingPollRef.current) {
      clearInterval(recordingPollRef.current);
      recordingPollRef.current = null;
    }
  };

  const cleanupRecorder = async () => {
    clearRecordingPoll();
    setRecording(null);
    setIsRecording(false);
    setVoiceLevel(0.12);
    stopInFlightRef.current = false;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    });
  };

  const processUserText = async (text: string, speakReply = false) => {
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", text }]);

    try {
      const reply = await sendChatMessage(text);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
      if (speakReply) {
        try {
          await playReplyAudio(reply);
        } catch (voiceError) {
          const voiceMessage =
            voiceError instanceof Error
              ? voiceError.message
              : "Voice playback failed";
          setMessages((prev) => [
            ...prev,
            { role: "assistant", text: `Voice error: ${voiceMessage}` },
          ]);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (text: string) => {
    await processUserText(text, false);
  };

  const getVoiceErrorMessage = (error: unknown) => {
    const rawMessage =
      error instanceof Error ? error.message : "Failed to process speech";
    const lowered = rawMessage.toLowerCase();

    if (lowered.includes("unauthorized") || lowered.includes("invalid token")) {
      return "Session expired. Please login again.";
    }

    if (lowered.includes("permission")) {
      return "Microphone permission denied.";
    }

    return rawMessage;
  };

  const closeVoiceSession = async () => {
    voiceLoopEnabledRef.current = false;
    setVoiceSessionOpen(false);
    setVoiceStatus("Ready");
    setVoiceLevel(0.12);
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    if (playbackResolveRef.current) {
      playbackResolveRef.current();
      playbackResolveRef.current = null;
    }
    if (isRecording || recording) {
      await cleanupRecorder();
    }
  };

  const startListening = async () => {
    setVoiceStatus("Requesting mic...");
    const permission = await Audio.requestPermissionsAsync();
    if (!permission.granted) {
      setVoiceStatus("Mic permission denied");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Microphone permission is required." },
      ]);
      voiceLoopEnabledRef.current = false;
      return;
    }

    setVoiceStatus("Starting microphone...");
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recordingOptions: Audio.RecordingOptions = {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    };
    const recorder = new Audio.Recording();
    await recorder.prepareToRecordAsync(recordingOptions);
    await recorder.startAsync();
    setRecording(recorder);
    setIsRecording(true);
    lastSpeechAtRef.current = Date.now();
    setVoiceStatus("Listening... speak now");

    recordingPollRef.current = setInterval(() => {
      void (async () => {
        if (stopInFlightRef.current) {
          return;
        }

        const status = await recorder.getStatusAsync();
        if (!status.canRecord) {
          return;
        }

        const elapsed = status.durationMillis ?? 0;
        const metering = status.metering ?? -160;
        const now = Date.now();
        const normalizedLevel = Math.min(
          1,
          Math.max(0.12, (metering + 60) / 60),
        );
        setVoiceLevel(normalizedLevel);

        if (metering > SILENCE_THRESHOLD_DB) {
          lastSpeechAtRef.current = now;
          setVoiceStatus("Listening... speak now");
          return;
        }

        if (elapsed >= MAX_RECORDING_MS) {
          setVoiceStatus("Sending...");
          await finishRecording(recorder);
          return;
        }

        if (
          elapsed >= MIN_RECORDING_MS &&
          now - lastSpeechAtRef.current >= SILENCE_TIMEOUT_MS
        ) {
          setVoiceStatus("Sending...");
          await finishRecording(recorder);
        }
      })();
    }, METERING_POLL_MS);
  };

  const finishRecording = async (activeRecording?: Audio.Recording | null) => {
    const recorder = activeRecording ?? recording;
    if (!recorder || stopInFlightRef.current) {
      return;
    }

    stopInFlightRef.current = true;
    setVoiceStatus("Processing speech...");

    try {
      await recorder.stopAndUnloadAsync();
      const uri = recorder.getURI();

      if (!uri) {
        throw new Error("Recorded audio URI not found");
      }

      await cleanupRecorder();

      const transcript = await transcribeAudio(uri, token);
      if (!transcript.trim()) {
        setVoiceStatus("No speech detected");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            text: "I could not detect speech. Please try again.",
          },
        ]);
        if (voiceLoopEnabledRef.current) {
          await startListening();
        }
        return;
      }

      setVoiceStatus("Thinking...");
      setVoiceLevel(0.42);
      await processUserText(transcript, true);
      if (voiceLoopEnabledRef.current) {
        await startListening();
      } else {
        setVoiceStatus("Ready");
      }
    } catch (error) {
      await cleanupRecorder();
      const message = getVoiceErrorMessage(error);
      setVoiceStatus(message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${message}` },
      ]);
    }
  };

  const handleMicPress = async () => {
    try {
      if (!voiceSessionOpen) {
        setVoiceSessionOpen(true);
      }
      voiceLoopEnabledRef.current = true;

      if (loading || isRecording) {
        return;
      }

      await startListening();
    } catch (error) {
      await cleanupRecorder();
      const message = getVoiceErrorMessage(error);
      setVoiceStatus(message);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Error: ${message}` },
      ]);
    } finally {
      if (!loading && !recording && !isRecording) {
        setVoiceStatus("Ready");
      }
    }
  };

  useEffect(
    () => () => {
      clearRecordingPoll();
      if (soundRef.current) {
        void soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    },
    [],
  );

  const handleAuth = async () => {
    try {
      setAuthSubmitting(true);
      setAuthError("");
      if (!email.trim() || password.length < 6) {
        setAuthError("Enter a valid email and password (min 6 chars).");
        setAuthSubmitting(false);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (authMode === "signup") {
        if (!signUp) {
          throw new Error("Clerk sign up is not ready yet.");
        }

        const result = await signUp.password({
          emailAddress: normalizedEmail,
          password,
        });

        if (result.error) {
          throw result.error;
        }

        if (signUp.status === "complete" && signUp.createdSessionId) {
          await setActive({ session: signUp.createdSessionId });
          const sessionToken = await getToken({ skipCache: true });
          setTokenProvider(() => getToken({ skipCache: true }));
          setAuthToken(sessionToken ?? null);
          setToken(sessionToken ?? null);
          return;
        }

        const emailCodeResult = await signUp.verifications.sendEmailCode();
        if (emailCodeResult.error) {
          throw emailCodeResult.error;
        }

        setAuthStep("verify-email");
        return;
      }

      if (!signIn) {
        throw new Error("Clerk sign in is not ready yet.");
      }

      const signInResult = await signIn.password({
        emailAddress: normalizedEmail,
        password,
      });

      if (signInResult.error) {
        throw signInResult.error;
      }

      if (signIn.status === "complete" && signIn.createdSessionId) {
        await setActive({
          session: signIn.createdSessionId,
        });
        const sessionToken = await getToken({ skipCache: true });
        setTokenProvider(() => getToken({ skipCache: true }));
        setAuthToken(sessionToken ?? null);
        setToken(sessionToken ?? null);
        return;
      }

      const sendCodeResult = await signIn.emailCode.sendCode();
      if (sendCodeResult.error) {
        throw sendCodeResult.error;
      }

      setAuthStep("verify-email");
      return;
    } catch (error) {
      const message = getClerkErrorMessage(error, "Auth failed");
      setAuthError(message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleVerifySignup = async () => {
    try {
      setAuthSubmitting(true);
      setAuthError("");

      if (!verificationCode.trim()) {
        setAuthError("Enter the verification code from Clerk.");
        return;
      }

      if (authMode === "signup") {
        if (!signUp) {
          throw new Error("Clerk sign up is not ready yet.");
        }

        const result = await signUp.verifications.verifyEmailCode({
          code: verificationCode.trim(),
        });
        if (result.error) {
          throw result.error;
        }

        if (signUp.status !== "complete" || !signUp.createdSessionId) {
          throw new Error("Email verification is not complete yet.");
        }

        await setActive({
          session: signUp.createdSessionId,
        });
      } else {
        if (!signIn) {
          throw new Error("Clerk sign in is not ready yet.");
        }

        const result = await signIn.emailCode.verifyCode({
          code: verificationCode.trim(),
        });
        if (result.error) {
          throw result.error;
        }

        if (signIn.status !== "complete" || !signIn.createdSessionId) {
          throw new Error("Email verification is not complete yet.");
        }

        await setActive({
          session: signIn.createdSessionId,
        });
      }

      const sessionToken = await getToken({ skipCache: true });
      setTokenProvider(() => getToken({ skipCache: true }));
      setAuthToken(sessionToken ?? null);
      setToken(sessionToken ?? null);
    } catch (error) {
      const message = getClerkErrorMessage(error, "Verification failed");
      setAuthError(message);
    } finally {
      setAuthSubmitting(false);
    }
  };

  const getClerkErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      return (
        ((error.response?.data as { error?: string } | undefined)?.error ??
          error.message) ||
        fallback
      );
    }

    if (error && typeof error === "object" && "errors" in error) {
      const maybeErrors = (
        error as { errors?: Array<{ longMessage?: string; message?: string }> }
      ).errors;
      const firstMessage =
        maybeErrors?.[0]?.longMessage ?? maybeErrors?.[0]?.message;
      if (firstMessage) {
        return firstMessage;
      }
    }

    return error instanceof Error ? error.message : fallback;
  };

  const handleLogout = async () => {
    await signOut();
    tokenCache?.clearToken?.(CLERK_CLIENT_JWT_KEY);
    resetAuthState();
  };

  const clearMessages = async () => {
    setMessages([]);
  };

  if (authLoading || (isSignedIn && !token)) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color="#f5f5f5" />
            <Text style={styles.loaderText}>
              {isSignedIn ? "Opening Peakora AI..." : "Loading Peakora AI..."}
            </Text>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!isSignedIn) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
          >
            <View style={styles.authCenter}>
              <View style={styles.authCard}>
                <Text style={styles.authTitle}>Peakora AI</Text>

                <Text style={styles.authSubtitle}>
                  {authStep === "verify-email"
                    ? "Enter the verification code from your email"
                    : authMode === "login"
                      ? "Login with Clerk"
                      : "Create your account with Clerk"}
                </Text>

                <TextInput
                  style={styles.authInput}
                  placeholder="Email"
                  placeholderTextColor="#8f8f8f"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  editable={!authSubmitting}
                />

                <TextInput
                  style={styles.authInput}
                  placeholder="Password"
                  placeholderTextColor="#8f8f8f"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  editable={!authSubmitting && authStep === "credentials"}
                />

                {authStep === "verify-email" && (
                  <TextInput
                    style={styles.authInput}
                    placeholder="Verification code"
                    placeholderTextColor="#8f8f8f"
                    value={verificationCode}
                    onChangeText={setVerificationCode}
                    editable={!authSubmitting}
                    keyboardType="number-pad"
                  />
                )}

                {!!authError && (
                  <Text style={styles.authError}>{authError}</Text>
                )}

                <Pressable
                  disabled={authSubmitting}
                  onPress={() =>
                    void (authStep === "verify-email"
                      ? handleVerifySignup()
                      : handleAuth())
                  }
                  style={[
                    styles.authButton,
                    authSubmitting && styles.authButtonDisabled,
                  ]}
                >
                  {authSubmitting ? (
                    <View style={styles.authButtonLoader}>
                      <ActivityIndicator size="small" color="#1b1b1b" />
                      <Text style={styles.authButtonText}>
                        {authStep === "verify-email"
                          ? "Verifying..."
                          : authMode === "login"
                            ? "Logging in..."
                            : "Signing up..."}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.authButtonText}>
                      {authStep === "verify-email"
                        ? "Verify email"
                        : authMode === "login"
                          ? "Login"
                          : "Sign up"}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  disabled={authSubmitting}
                  onPress={() => {
                    setVerificationCode("");
                    setAuthMode((prev) =>
                      prev === "login" ? "signup" : "login",
                    );
                    setAuthStep("credentials");
                    setAuthError("");
                  }}
                >
                  <Text style={styles.switchModeText}>
                    {authStep === "verify-email"
                      ? "Back to sign up"
                      : authMode === "login"
                        ? "No account? Sign up"
                        : "Already have an account? Login"}
                  </Text>
                </Pressable>

                {authStep === "verify-email" && (
                  <Pressable
                    disabled={authSubmitting}
                    onPress={() => {
                      setAuthStep("credentials");
                      setVerificationCode("");
                      setAuthError("");
                    }}
                  >
                    <Text style={styles.switchModeText}>
                      Change email or password
                    </Text>
                  </Pressable>
                )}

                {authMode === "signup" && <View nativeID="clerk-captcha" />}
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Peakora AI</Text>
            <View style={styles.headerRight}>
              <Text style={styles.status}>
                {isRecording
                  ? "Listening..."
                  : loading
                    ? "Thinking..."
                    : voiceStatus}
              </Text>
              <Pressable onPress={() => void handleLogout()}>
                <Text style={styles.logoutText}>Logout</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.chatArea}>
            <ChatBox messages={messages} loading={loading} />
          </View>

          <View style={{ paddingBottom: 4 }}>
            <Input
              onSubmit={handleSubmit}
              onClear={() => void clearMessages()}
              onMicPress={() => void handleMicPress()}
              isRecording={isRecording}
              disabled={loading}
            />
          </View>

          <Modal
            visible={voiceSessionOpen}
            transparent
            animationType="fade"
            onRequestClose={() => void closeVoiceSession()}
          >
            <View style={styles.voiceModalBackdrop}>
              <View style={styles.voiceModalCard}>
                <Text style={styles.voiceModalTitle}>Voice Conversation</Text>
                <Text style={styles.voiceModalStatus}>
                  {isRecording
                    ? "Listening..."
                    : loading
                      ? "Responding..."
                      : voiceStatus}
                </Text>
                <Text style={styles.voiceModalHint}>
                  Speak naturally. I will listen, answer, then listen again
                  until you close this.
                </Text>
                <View style={styles.voiceVisualizer}>
                  {[0.55, 0.85, 1, 0.8, 0.6].map((multiplier, index) => (
                    <View
                      key={`voice-bar-${index}`}
                      style={[
                        styles.voiceBar,
                        isRecording
                          ? styles.voiceBarActive
                          : styles.voiceBarIdle,
                        { height: 18 + voiceLevel * 82 * multiplier },
                      ]}
                    />
                  ))}
                </View>
                <View style={styles.voiceChipRow}>
                  <View
                    style={[
                      styles.voiceChip,
                      isRecording ? styles.voiceChipLive : styles.voiceChipIdle,
                    ]}
                  >
                    <Text style={styles.voiceChipText}>
                      {isRecording
                        ? "Mic live"
                        : loading
                          ? "Speaking"
                          : "Waiting"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => void closeVoiceSession()}
                  style={styles.voiceCloseButton}
                >
                  <Text style={styles.voiceCloseText}>Close Voice</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey} tokenCache={tokenCache}>
      <AppContent />
    </ClerkProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#212121" },
  loaderWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  authCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  loaderText: { color: "#f5f5f5" },
  authContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    backgroundColor: "#212121",
  },
  authCard: {
    width: "100%",
    maxWidth: 400,
    borderWidth: 1,
    borderColor: "#3a3a3a",
    backgroundColor: "#2a2a2a",
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  authTitle: { color: "#f2f2f2", fontSize: 24, fontWeight: "700" },
  authSubtitle: { color: "#a8a8a8", marginBottom: 6 },
  authInput: {
    borderWidth: 1,
    borderColor: "#414141",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#efefef",
    backgroundColor: "#1f1f1f",
  },
  authError: { color: "#ff8b8b", fontSize: 13, marginTop: 2 },
  authButton: {
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 6,
  },
  authButtonDisabled: { opacity: 0.75 },
  authButtonLoader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  authButtonText: { color: "#1b1b1b", fontWeight: "700" },
  switchModeText: { color: "#d0d0d0", textAlign: "center", marginTop: 10 },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 12,
    gap: 8,
    backgroundColor: "#212121",
    maxWidth: 900,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#2f2f2f",
    paddingBottom: 12,
    paddingHorizontal: 2,
  },
  headerRight: { alignItems: "flex-end", gap: 3 },
  title: { color: "#f2f2f2", fontSize: 19, fontWeight: "700" },
  status: { color: "#a7a7a7", fontSize: 13 },
  logoutText: { color: "#d7d7d7", fontSize: 12 },
  modeTabs: {
    flexDirection: "row",
    gap: 8,
  },
  modeTab: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#404040",
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modeTabActive: {
    borderColor: "#ef8b6b",
    backgroundColor: "#3a2a26",
  },
  modeTabText: {
    color: "#efefef",
    fontSize: 12,
    fontWeight: "600",
  },
  chatArea: { flex: 1, paddingHorizontal: 2 },
  voiceModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.58)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  voiceModalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 14,
    backgroundColor: "#252525",
    borderWidth: 1,
    borderColor: "#3e3e3e",
  },
  voiceModalTitle: {
    color: "#f2f2f2",
    fontSize: 22,
    fontWeight: "700",
  },
  voiceModalStatus: {
    color: "#d8d8d8",
    fontSize: 16,
    fontWeight: "600",
  },
  voiceModalHint: {
    color: "#aaaaaa",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  voiceVisualizer: {
    width: "100%",
    height: 120,
    borderRadius: 22,
    marginVertical: 8,
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: "#1d1d1d",
    borderWidth: 1,
    borderColor: "#363636",
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 10,
  },
  voiceBar: {
    width: 18,
    borderRadius: 999,
  },
  voiceBarIdle: {
    backgroundColor: "#565656",
  },
  voiceBarActive: {
    backgroundColor: "#f26d5b",
  },
  voiceChipRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  voiceChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  voiceChipIdle: {
    backgroundColor: "#303030",
    borderColor: "#484848",
  },
  voiceChipLive: {
    backgroundColor: "#40201d",
    borderColor: "#f26d5b",
  },
  voiceChipText: {
    color: "#f2f2f2",
    fontSize: 12,
    fontWeight: "600",
  },
  voiceCloseButton: {
    marginTop: 4,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: "#f0f0f0",
  },
  voiceCloseText: {
    color: "#111",
    fontWeight: "700",
  },
});
