import axios from "axios";

const envBaseURL = process.env.EXPO_PUBLIC_API_URL;

if (!envBaseURL) {
  throw new Error("Missing EXPO_PUBLIC_API_URL in frontend env");
}

const baseURL = envBaseURL.replace(/\/+$/, "").replace(/\/api$/, "");

const api = axios.create({
  baseURL,
});

let authToken: string | null = null;
let tokenProvider: (() => Promise<string | null>) | null = null;

export function setTokenProvider(
  provider: (() => Promise<string | null>) | null,
) {
  tokenProvider = provider;
}

api.interceptors.request.use(async (config) => {
  const token = (tokenProvider ? await tokenProvider() : null) ?? authToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  } else if (config.headers?.Authorization) {
    delete config.headers.Authorization;
  }

  return config;
});

export function setAuthToken(token: string | null) {
  authToken = token;
  if (!token) {
    delete api.defaults.headers.common.Authorization;
    return;
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`;
}

export async function signup(email: string, password: string) {
  const { data } = await api.post<{ token: string; userId: string }>(
    "/api/auth/signup",
    {
      email,
      password,
    },
  );
  return data;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ token: string; userId: string }>(
    "/api/auth/login",
    {
      email,
      password,
    },
  );
  return data;
}

export async function getMe() {
  const { data } = await api.get<{
    id: string;
    email: string;
    createdAt: string;
  }>("/api/auth/me");
  return data;
}

export async function getChatHistory() {
  const { data } = await api.get<{
    messages: Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      createdAt: string;
    }>;
  }>("/api/chat/history");
  return data.messages;
}

export async function sendChatMessage(message: string) {
  const { data } = await api.post<{ reply: string }>("/api/chat", { message });
  return data.reply;
}

export type CollabUser = {
  id: string;
  email: string;
};

export type SessionMessage = {
  id: string;
  content: string;
  kind: "note" | "research_request" | "research_result";
  createdAt: string;
  author: CollabUser;
};

export type DirectMessage = {
  id: string;
  content?: string | null;
  kind: "text" | "tagged_research";
  createdAt: string;
  sender: CollabUser;
  sourceSessionMessage?: SessionMessage | null;
};

export type DirectConversation = {
  id: string;
  sessionId: string;
  participantA: CollabUser;
  participantB: CollabUser;
  messages: DirectMessage[];
};

export type CollabSession = {
  id: string;
  title: string;
  topic?: string | null;
  ownerId: string;
  participants: Array<{
    userId: string;
    user: CollabUser;
  }>;
  messages?: SessionMessage[];
};

export async function listCollabUsers() {
  const { data } = await api.get<{ users: CollabUser[] }>("/api/collab/users");
  return data.users;
}

export async function listCollabSessions() {
  const { data } = await api.get<{ sessions: CollabSession[] }>(
    "/api/collab/sessions",
  );
  return data.sessions;
}

export async function createCollabSession(payload: {
  title: string;
  topic?: string;
  participantIds?: string[];
}) {
  const { data } = await api.post<{ session: CollabSession }>(
    "/api/collab/sessions",
    payload,
  );
  return data.session;
}

export async function getCollabSession(sessionId: string) {
  const { data } = await api.get<{
    session: CollabSession & { messages: SessionMessage[] };
    directChats: Array<{
      id: string;
      participantA: CollabUser;
      participantB: CollabUser;
    }>;
  }>(`/api/collab/sessions/${sessionId}`);
  return data;
}

export async function researchInSession(sessionId: string, query: string) {
  const { data } = await api.post<{
    requestMessage: SessionMessage;
    resultMessage: SessionMessage;
  }>(`/api/collab/sessions/${sessionId}/research`, { query });
  return data;
}

export async function getDirectConversation(sessionId: string, userId: string) {
  const { data } = await api.get<{ conversation: DirectConversation }>(
    `/api/collab/sessions/${sessionId}/direct/${userId}`,
  );
  return data.conversation;
}

export async function sendDirectMessage(
  conversationId: string,
  content: string,
) {
  const { data } = await api.post<{ message: DirectMessage }>(
    `/api/collab/direct/${conversationId}/messages`,
    { content },
  );
  return data.message;
}

export async function tagResearchToUser(payload: {
  sessionId: string;
  targetUserId: string;
  sessionMessageId: string;
  note?: string;
}) {
  const { data } = await api.post<{
    conversationId: string;
    message: DirectMessage;
  }>(`/api/collab/sessions/${payload.sessionId}/tag`, payload);
  return data;
}

export function getRealtimeSocketUrl(token: string) {
  const wsBase = baseURL.replace(/^http/i, "ws");
  return `${wsBase}/ws?token=${encodeURIComponent(token)}`;
}

export async function generateVoice(text: string) {
  const { data } = await api.post<ArrayBuffer>(
    "/api/voice/tts",
    { text },
    {
      responseType: "arraybuffer",
    },
  );
  return data;
}

export async function generateVoiceBase64(text: string) {
  const { data } = await api.post<{ audioBase64: string; mimeType: string }>(
    "/api/voice/tts-base64",
    { text },
  );
  return data;
}

export async function transcribeAudio(uri: string, token?: string | null) {
  const formData = new FormData();
  formData.append("audio", {
    uri,
    name: "recording.m4a",
    type: "audio/x-m4a",
  } as unknown as Blob);

  const doRequest = async (auth?: string | null) =>
    fetch(`${baseURL}/api/voice/stt`, {
      method: "POST",
      headers: auth ? { Authorization: `Bearer ${auth}` } : undefined,
      body: formData,
    });

  const liveToken =
    (tokenProvider ? await tokenProvider() : null) ?? token ?? authToken;

  let response = await doRequest(liveToken);

  // Some deployments reject auth headers on this endpoint even when chat auth works.
  if (response.status === 401 && liveToken) {
    response = await doRequest(null);
  }

  const data = (await response.json().catch(() => ({}))) as {
    text?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `STT failed with status ${response.status}`);
  }

  return data.text ?? "";
}
