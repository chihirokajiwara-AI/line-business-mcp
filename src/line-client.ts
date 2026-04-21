/**
 * LINE Messaging API HTTP client.
 * Thin wrapper — no SDK dependency, just fetch + types.
 */

const API_BASE = "https://api.line.me/v2/bot";
const API_DATA = "https://api-data.line.me/v2/bot";
const API_INSIGHT = "https://api.line.me/v2/bot/insight";
const API_AUDIENCE = "https://api.line.me/v2/bot/audienceGroup";

export class LineApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(`LINE API ${status}: ${JSON.stringify(body)}`);
    this.name = "LineApiError";
  }
}

function getToken(): string {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error(
      "LINE_CHANNEL_ACCESS_TOKEN not set. Provide it as an environment variable.",
    );
  }
  return token;
}

async function request(
  url: string,
  options: RequestInit = {},
): Promise<unknown> {
  const token = getToken();
  const isGet = !options.method || options.method === "GET";
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    ...options.headers as Record<string, string>,
  };
  if (!isGet) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    ...options,
    headers,
    signal: AbortSignal.timeout(30_000),
  });

  // 204 or empty body
  const text = await res.text();
  if (!res.ok) {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    throw new LineApiError(res.status, body);
  }

  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// ─── Messaging ───────────────────────────────────────────

export async function pushMessage(
  to: string,
  messages: unknown[],
  notificationDisabled = false,
) {
  return request(`${API_BASE}/message/push`, {
    method: "POST",
    body: JSON.stringify({ to, messages, notificationDisabled }),
  });
}

export async function replyMessage(
  replyToken: string,
  messages: unknown[],
  notificationDisabled = false,
) {
  return request(`${API_BASE}/message/reply`, {
    method: "POST",
    body: JSON.stringify({ replyToken, messages, notificationDisabled }),
  });
}

export async function multicastMessage(
  to: string[],
  messages: unknown[],
  notificationDisabled = false,
) {
  return request(`${API_BASE}/message/multicast`, {
    method: "POST",
    body: JSON.stringify({ to, messages, notificationDisabled }),
  });
}

export async function broadcastMessage(
  messages: unknown[],
  notificationDisabled = false,
) {
  return request(`${API_BASE}/message/broadcast`, {
    method: "POST",
    body: JSON.stringify({ messages, notificationDisabled }),
  });
}

export async function narrowcastMessage(
  messages: unknown[],
  recipient?: unknown,
  filter?: unknown,
) {
  return request(`${API_BASE}/message/narrowcast`, {
    method: "POST",
    body: JSON.stringify({ messages, recipient, filter }),
  });
}

export async function validateMessage(messages: unknown[]) {
  return request(`${API_BASE}/message/validate/push`, {
    method: "POST",
    body: JSON.stringify({ messages }),
  });
}

export async function showLoadingAnimation(chatId: string, loadingSeconds = 5) {
  return request(`${API_BASE}/chat/loading/start`, {
    method: "POST",
    body: JSON.stringify({ chatId, loadingSeconds }),
  });
}

// ─── Profile ─────────────────────────────────────────────

export async function getProfile(userId: string) {
  return request(`${API_BASE}/profile/${userId}`);
}

export async function getFollowerIds(start?: string) {
  const params = start ? `?start=${start}` : "";
  return request(`${API_BASE}/followers/ids${params}`);
}

export async function getBotInfo() {
  return request(`${API_BASE}/info`);
}

// ─── Rich Menu ───────────────────────────────────────────

export async function createRichMenu(richMenu: unknown) {
  return request(`${API_BASE}/richmenu`, {
    method: "POST",
    body: JSON.stringify(richMenu),
  });
}

export async function listRichMenus() {
  return request(`${API_BASE}/richmenu/list`);
}

export async function getRichMenu(richMenuId: string) {
  return request(`${API_BASE}/richmenu/${richMenuId}`);
}

export async function deleteRichMenu(richMenuId: string) {
  return request(`${API_BASE}/richmenu/${richMenuId}`, { method: "DELETE" });
}

export async function setDefaultRichMenu(richMenuId: string) {
  return request(`${API_BASE}/user/all/richmenu/${richMenuId}`, {
    method: "POST",
  });
}

export async function getDefaultRichMenu() {
  return request(`${API_BASE}/user/all/richmenu`);
}

export async function deleteDefaultRichMenu() {
  return request(`${API_BASE}/user/all/richmenu`, { method: "DELETE" });
}

export async function linkRichMenuToUser(userId: string, richMenuId: string) {
  return request(`${API_BASE}/user/${userId}/richmenu/${richMenuId}`, {
    method: "POST",
  });
}

export async function unlinkRichMenuFromUser(userId: string) {
  return request(`${API_BASE}/user/${userId}/richmenu`, { method: "DELETE" });
}

export async function uploadRichMenuImage(
  richMenuId: string,
  imageBuffer: Uint8Array,
  contentType: string,
) {
  const token = getToken();
  const res = await fetch(
    `${API_DATA}/richmenu/${richMenuId}/content`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: imageBuffer as unknown as BodyInit,
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new LineApiError(res.status, body);
  }
  return {};
}

// ─── Group ───────────────────────────────────────────────

export async function getGroupSummary(groupId: string) {
  return request(`${API_BASE}/group/${groupId}/summary`);
}

export async function getGroupMemberIds(groupId: string, start?: string) {
  const params = start ? `?start=${start}` : "";
  return request(`${API_BASE}/group/${groupId}/members/ids${params}`);
}

export async function getGroupMemberProfile(
  groupId: string,
  userId: string,
) {
  return request(`${API_BASE}/group/${groupId}/member/${userId}`);
}

export async function leaveGroup(groupId: string) {
  return request(`${API_BASE}/group/${groupId}/leave`, { method: "POST" });
}

// ─── Room ────────────────────────────────────────────────

export async function getRoomMemberIds(roomId: string, start?: string) {
  const params = start ? `?start=${start}` : "";
  return request(`${API_BASE}/room/${roomId}/members/ids${params}`);
}

export async function getRoomMemberProfile(roomId: string, userId: string) {
  return request(`${API_BASE}/room/${roomId}/member/${userId}`);
}

export async function leaveRoom(roomId: string) {
  return request(`${API_BASE}/room/${roomId}/leave`, { method: "POST" });
}

// ─── Webhook ─────────────────────────────────────────────

export async function setWebhookUrl(endpoint: string) {
  return request(`${API_BASE}/channel/webhook/endpoint`, {
    method: "PUT",
    body: JSON.stringify({ endpoint }),
  });
}

export async function getWebhookInfo() {
  return request(`${API_BASE}/channel/webhook/endpoint`);
}

export async function testWebhook(endpoint?: string) {
  return request(`${API_BASE}/channel/webhook/test`, {
    method: "POST",
    body: JSON.stringify(endpoint ? { endpoint } : {}),
  });
}

// ─── Quota & Insight ─────────────────────────────────────

export async function getQuota() {
  return request(`${API_BASE}/message/quota`);
}

export async function getQuotaConsumption() {
  return request(`${API_BASE}/message/quota/consumption`);
}

export async function getFollowerStats(date: string) {
  return request(`${API_INSIGHT}/followers?date=${date}`);
}

export async function getMessageDeliveryStats(date: string) {
  return request(`${API_INSIGHT}/message/delivery?date=${date}`);
}

export async function getMessageEventStats(requestId: string) {
  return request(`${API_INSIGHT}/message/event?requestId=${requestId}`);
}

// ─── Audience ────────────────────────────────────────────

export async function createAudience(
  description: string,
  audiences?: Array<{ id: string }>,
) {
  return request(`${API_AUDIENCE}/upload`, {
    method: "POST",
    body: JSON.stringify({
      description,
      uploadDescription: description,
      audiences,
    }),
  });
}

export async function listAudiences(page = 1, size = 40) {
  return request(`${API_AUDIENCE}/list?page=${page}&size=${size}`);
}

export async function getAudience(audienceGroupId: number) {
  return request(`${API_AUDIENCE}/${audienceGroupId}`);
}

export async function deleteAudience(audienceGroupId: number) {
  return request(`${API_AUDIENCE}/${audienceGroupId}`, { method: "DELETE" });
}

// ─── Account Link ────────────────────────────────────────

export async function issueLinkToken(userId: string) {
  return request(`${API_BASE}/user/${userId}/linkToken`, { method: "POST" });
}
