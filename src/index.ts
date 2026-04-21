#!/usr/bin/env node
/**
 * LINE Business MCP Server
 *
 * Full-featured LINE Messaging API integration for AI coding tools.
 * 45 tools covering messaging, message builders, profiles, rich menus,
 * groups, webhooks, insights, audiences, LINE Notify, and account linking.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as line from "./line-client.js";
import * as builders from "./builders.js";

const server = new McpServer({
  name: "line-business-mcp",
  version: "0.3.0",
});

// ── Helpers ──────────────────────────────────────────────

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true as const };
}

function parseMessages(messagesJson: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(messagesJson);
  } catch {
    throw new Error(`Invalid JSON in messages parameter: ${messagesJson.slice(0, 100)}`);
  }
  return Array.isArray(parsed) ? parsed : [parsed];
}

function parseJson(json: string, paramName: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
    throw new Error(`Invalid JSON in ${paramName}: ${json.slice(0, 100)}`);
  }
}

type ToolResult = ReturnType<typeof ok> | ReturnType<typeof err>;

/** Wrap a tool handler with try/catch → isError response */
function safe<T>(fn: (args: T) => Promise<ReturnType<typeof ok>>): (args: T) => Promise<ToolResult> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return err(msg);
    }
  };
}

// Zod schemas for date validation
const yyyyMMdd = z.string().regex(/^\d{8}$/, "Must be yyyyMMdd format (e.g. '20260421')");

// ── Messaging Tools (7) ─────────────────────────────────

server.tool(
  "push_message",
  "Send a message to a user, group, or room by their ID. Messages can be text, flex, template, image, video, audio, sticker, or location. Counts toward monthly quota.",
  {
    to: z.string().describe("User ID, group ID, or room ID"),
    messages: z.string().describe('JSON array of message objects, e.g. [{"type":"text","text":"Hello"}]'),
    notification_disabled: z.boolean().optional().describe("Disable push notification (default: false)"),
  },
  safe(async ({ to, messages, notification_disabled }) => {
    const msgs = parseMessages(messages);
    const result = await line.pushMessage(to, msgs, notification_disabled);
    return ok(result);
  }),
);

server.tool(
  "reply_message",
  "Reply to a webhook event using a reply token. Reply tokens expire in 1 minute. Does NOT count toward monthly message quota (free).",
  {
    reply_token: z.string().describe("Reply token from webhook event"),
    messages: z.string().describe('JSON array of message objects'),
    notification_disabled: z.boolean().optional(),
  },
  safe(async ({ reply_token, messages, notification_disabled }) => {
    const msgs = parseMessages(messages);
    const result = await line.replyMessage(reply_token, msgs, notification_disabled);
    return ok(result);
  }),
);

server.tool(
  "multicast_message",
  "Send a message to multiple users simultaneously (up to 500 user IDs). Counts toward quota.",
  {
    to: z.string().describe('JSON array of user IDs, e.g. ["U123","U456"]'),
    messages: z.string().describe('JSON array of message objects'),
    notification_disabled: z.boolean().optional(),
  },
  safe(async ({ to, messages, notification_disabled }) => {
    const userIds = parseJson(to, "to") as string[];
    if (!Array.isArray(userIds)) throw new Error("'to' must be a JSON array of user ID strings");
    const msgs = parseMessages(messages);
    const result = await line.multicastMessage(userIds, msgs, notification_disabled);
    return ok(result);
  }),
);

server.tool(
  "broadcast_message",
  "Send a message to ALL followers of the bot. This sends to every follower and counts toward quota. Set confirm=true to execute.",
  {
    messages: z.string().describe('JSON array of message objects'),
    confirm: z.boolean().describe("Must be true to confirm sending to ALL followers"),
    notification_disabled: z.boolean().optional(),
  },
  safe(async ({ messages, confirm, notification_disabled }) => {
    if (!confirm) throw new Error("Set confirm=true to broadcast to ALL followers. This action is irreversible.");
    const msgs = parseMessages(messages);
    const result = await line.broadcastMessage(msgs, notification_disabled);
    return ok(result);
  }),
);

server.tool(
  "narrowcast_message",
  "Send a message to a subset of followers using audience filters. Useful for targeted campaigns.",
  {
    messages: z.string().describe('JSON array of message objects'),
    recipient: z.string().optional().describe('JSON recipient object (audience filter)'),
    filter: z.string().optional().describe('JSON demographic filter object'),
  },
  safe(async ({ messages, recipient, filter }) => {
    const msgs = parseMessages(messages);
    const r = recipient ? parseJson(recipient, "recipient") : undefined;
    const f = filter ? parseJson(filter, "filter") : undefined;
    const result = await line.narrowcastMessage(msgs, r, f);
    return ok(result);
  }),
);

server.tool(
  "validate_message",
  "Validate message objects without actually sending them. Useful for checking flex message JSON before sending.",
  {
    messages: z.string().describe('JSON array of message objects to validate'),
  },
  safe(async ({ messages }) => {
    const msgs = parseMessages(messages);
    await line.validateMessage(msgs);
    return ok({ valid: true });
  }),
);

server.tool(
  "show_loading_animation",
  "Show a loading animation in the chat while processing a request. Lasts up to 60 seconds.",
  {
    chat_id: z.string().describe("User ID to show loading animation to"),
    loading_seconds: z.number().min(5).max(60).optional().describe("Duration in seconds (default: 5)"),
  },
  safe(async ({ chat_id, loading_seconds }) => {
    const result = await line.showLoadingAnimation(chat_id, loading_seconds);
    return ok(result);
  }),
);

// ── Profile Tools (3) ───────────────────────────────────

server.tool(
  "get_profile",
  "Get a user's display name, profile picture URL, status message, and language.",
  {
    user_id: z.string().describe("LINE user ID"),
  },
  safe(async ({ user_id }) => {
    const result = await line.getProfile(user_id);
    return ok(result);
  }),
);

server.tool(
  "get_follower_ids",
  "Get a list of user IDs of users who have added the bot as a friend. Returns up to 300 IDs per call with pagination.",
  {
    start: z.string().optional().describe("Continuation token for pagination"),
  },
  safe(async ({ start }) => {
    const result = await line.getFollowerIds(start);
    return ok(result);
  }),
);

server.tool(
  "get_bot_info",
  "Get the bot's display name, user ID, premium message quota, and chat mode.",
  {},
  safe(async () => {
    const result = await line.getBotInfo();
    return ok(result);
  }),
);

// ── Rich Menu Tools (8) ─────────────────────────────────

server.tool(
  "create_rich_menu",
  "Create a new rich menu. Returns a richMenuId. You must also upload an image for it to appear.",
  {
    rich_menu: z.string().describe("JSON rich menu object with size, selected, name, chatBarText, and areas"),
  },
  safe(async ({ rich_menu }) => {
    const menu = parseJson(rich_menu, "rich_menu");
    const result = await line.createRichMenu(menu);
    return ok(result);
  }),
);

server.tool(
  "list_rich_menus",
  "List all rich menus created for this bot.",
  {},
  safe(async () => {
    const result = await line.listRichMenus();
    return ok(result);
  }),
);

server.tool(
  "get_rich_menu",
  "Get a specific rich menu by ID.",
  {
    rich_menu_id: z.string().describe("Rich menu ID"),
  },
  safe(async ({ rich_menu_id }) => {
    const result = await line.getRichMenu(rich_menu_id);
    return ok(result);
  }),
);

server.tool(
  "delete_rich_menu",
  "Delete a rich menu by ID.",
  {
    rich_menu_id: z.string().describe("Rich menu ID"),
  },
  safe(async ({ rich_menu_id }) => {
    await line.deleteRichMenu(rich_menu_id);
    return ok({ deleted: true, richMenuId: rich_menu_id });
  }),
);

server.tool(
  "set_default_rich_menu",
  "Set a rich menu as the default for all users who don't have a per-user rich menu linked.",
  {
    rich_menu_id: z.string().describe("Rich menu ID to set as default"),
  },
  safe(async ({ rich_menu_id }) => {
    await line.setDefaultRichMenu(rich_menu_id);
    return ok({ set: true, richMenuId: rich_menu_id });
  }),
);

server.tool(
  "get_default_rich_menu",
  "Get the current default rich menu ID.",
  {},
  safe(async () => {
    const result = await line.getDefaultRichMenu();
    return ok(result);
  }),
);

server.tool(
  "link_rich_menu_to_user",
  "Link a specific rich menu to a specific user (overrides the default).",
  {
    user_id: z.string().describe("LINE user ID"),
    rich_menu_id: z.string().describe("Rich menu ID"),
  },
  safe(async ({ user_id, rich_menu_id }) => {
    await line.linkRichMenuToUser(user_id, rich_menu_id);
    return ok({ linked: true, userId: user_id, richMenuId: rich_menu_id });
  }),
);

server.tool(
  "unlink_rich_menu_from_user",
  "Remove the per-user rich menu from a user (they'll see the default instead).",
  {
    user_id: z.string().describe("LINE user ID"),
  },
  safe(async ({ user_id }) => {
    await line.unlinkRichMenuFromUser(user_id);
    return ok({ unlinked: true, userId: user_id });
  }),
);

// ── Group Tools (4) ─────────────────────────────────────

server.tool(
  "get_group_summary",
  "Get a group's name, icon URL, and member count.",
  {
    group_id: z.string().describe("LINE group ID"),
  },
  safe(async ({ group_id }) => {
    const result = await line.getGroupSummary(group_id);
    return ok(result);
  }),
);

server.tool(
  "get_group_member_ids",
  "Get user IDs of members in a group. Returns up to 300 per call with pagination.",
  {
    group_id: z.string().describe("LINE group ID"),
    start: z.string().optional().describe("Continuation token for pagination"),
  },
  safe(async ({ group_id, start }) => {
    const result = await line.getGroupMemberIds(group_id, start);
    return ok(result);
  }),
);

server.tool(
  "get_group_member_profile",
  "Get a specific user's profile within a group.",
  {
    group_id: z.string().describe("LINE group ID"),
    user_id: z.string().describe("LINE user ID"),
  },
  safe(async ({ group_id, user_id }) => {
    const result = await line.getGroupMemberProfile(group_id, user_id);
    return ok(result);
  }),
);

server.tool(
  "leave_group",
  "Make the bot leave a group. This action is irreversible — the bot cannot rejoin unless re-invited.",
  {
    group_id: z.string().describe("LINE group ID"),
  },
  safe(async ({ group_id }) => {
    await line.leaveGroup(group_id);
    return ok({ left: true, groupId: group_id });
  }),
);

// ── Webhook Tools (3) ───────────────────────────────────

server.tool(
  "set_webhook_url",
  "Set or update the webhook URL for receiving events from LINE.",
  {
    endpoint: z.string().url().describe("HTTPS webhook endpoint URL"),
  },
  safe(async ({ endpoint }) => {
    await line.setWebhookUrl(endpoint);
    return ok({ set: true, endpoint });
  }),
);

server.tool(
  "get_webhook_info",
  "Get the current webhook URL and its active status.",
  {},
  safe(async () => {
    const result = await line.getWebhookInfo();
    return ok(result);
  }),
);

server.tool(
  "test_webhook",
  "Send a test webhook event to verify the endpoint is working.",
  {
    endpoint: z.string().url().optional().describe("URL to test (defaults to the configured webhook URL)"),
  },
  safe(async ({ endpoint }) => {
    const result = await line.testWebhook(endpoint);
    return ok(result);
  }),
);

// ── Quota & Insight Tools (5) ───────────────────────────

server.tool(
  "get_quota",
  "Get the monthly message quota limit for this bot.",
  {},
  safe(async () => {
    const result = await line.getQuota();
    return ok(result);
  }),
);

server.tool(
  "get_quota_consumption",
  "Get the current month's message usage count.",
  {},
  safe(async () => {
    const result = await line.getQuotaConsumption();
    return ok(result);
  }),
);

server.tool(
  "get_follower_stats",
  "Get follower count statistics for a specific date. Data available from 7 days ago.",
  {
    date: yyyyMMdd.describe("Date in yyyyMMdd format (e.g. '20260421')"),
  },
  safe(async ({ date }) => {
    const result = await line.getFollowerStats(date);
    return ok(result);
  }),
);

server.tool(
  "get_message_delivery_stats",
  "Get message delivery statistics (sent, delivered, opened) for a specific date.",
  {
    date: yyyyMMdd.describe("Date in yyyyMMdd format"),
  },
  safe(async ({ date }) => {
    const result = await line.getMessageDeliveryStats(date);
    return ok(result);
  }),
);

server.tool(
  "get_message_event_stats",
  "Get detailed event statistics for a specific message send request (by request ID from push/multicast response).",
  {
    request_id: z.string().describe("Request ID from a push/multicast API response"),
  },
  safe(async ({ request_id }) => {
    const result = await line.getMessageEventStats(request_id);
    return ok(result);
  }),
);

// ── Audience Tools (4) ──────────────────────────────────

server.tool(
  "create_audience",
  "Create a new audience group for narrowcast targeting.",
  {
    description: z.string().describe("Audience group name/description"),
    user_ids: z.string().optional().describe('JSON array of user IDs to add, e.g. ["U123","U456"]'),
  },
  safe(async ({ description, user_ids }) => {
    const audiences = user_ids
      ? (parseJson(user_ids, "user_ids") as string[]).map((id: string) => ({ id }))
      : undefined;
    const result = await line.createAudience(description, audiences);
    return ok(result);
  }),
);

server.tool(
  "list_audiences",
  "List all audience groups with pagination.",
  {
    page: z.number().optional().describe("Page number (default: 1)"),
    size: z.number().optional().describe("Page size (default: 40, max: 40)"),
  },
  safe(async ({ page, size }) => {
    const result = await line.listAudiences(page, size);
    return ok(result);
  }),
);

server.tool(
  "get_audience",
  "Get details of a specific audience group.",
  {
    audience_group_id: z.number().describe("Audience group ID"),
  },
  safe(async ({ audience_group_id }) => {
    const result = await line.getAudience(audience_group_id);
    return ok(result);
  }),
);

server.tool(
  "delete_audience",
  "Delete an audience group.",
  {
    audience_group_id: z.number().describe("Audience group ID"),
  },
  safe(async ({ audience_group_id }) => {
    await line.deleteAudience(audience_group_id);
    return ok({ deleted: true, audienceGroupId: audience_group_id });
  }),
);

// ── Account Link Tool (1) ───────────────────────────────

server.tool(
  "issue_link_token",
  "Issue a link token for account linking. The token is valid for 10 minutes.",
  {
    user_id: z.string().describe("LINE user ID"),
  },
  safe(async ({ user_id }) => {
    const result = await line.issueLinkToken(user_id);
    return ok(result);
  }),
);

// ── Message Builder Tools (6) ────────────────────────────
// High-level tools that generate LINE message JSON from simple parameters.
// Users don't need to know the raw Flex/Template message spec.

server.tool(
  "build_and_send_flex_bubble",
  "Build a rich Flex Message bubble with title, body, optional image, and buttons — then send it. No need to write raw Flex JSON.",
  {
    to: z.string().describe("User ID, group ID, or room ID"),
    title: z.string().describe("Bold title text"),
    body_text: z.string().describe("Main body text"),
    subtitle: z.string().optional().describe("Subtitle below the title"),
    image_url: z.string().url().optional().describe("Hero image URL (displayed at the top)"),
    buttons: z.string().optional().describe('JSON array of buttons: [{"label":"Open","type":"uri","value":"https://...","style":"primary"}]'),
  },
  safe(async ({ to, title, body_text, subtitle, image_url, buttons }) => {
    const footerButtons = buttons ? parseJson(buttons, "buttons") as builders.FlexBubbleParams["footer_buttons"] : undefined;
    const msg = builders.buildFlexBubble({ title, body_text, subtitle, image_url, footer_buttons: footerButtons });
    const result = await line.pushMessage(to, [msg]);
    return ok({ sent: true, messageType: "flex_bubble", to });
  }),
);

server.tool(
  "build_and_send_carousel",
  "Build and send a swipeable Flex Carousel with multiple bubbles. Each bubble can have title, body, image, and buttons.",
  {
    to: z.string().describe("User ID, group ID, or room ID"),
    bubbles: z.string().describe('JSON array of bubble objects: [{"title":"...","body_text":"...","image_url":"...","footer_buttons":[...]}]'),
  },
  safe(async ({ to, bubbles: bubblesJson }) => {
    const bubbleParams = parseJson(bubblesJson, "bubbles") as builders.FlexBubbleParams[];
    if (!Array.isArray(bubbleParams) || bubbleParams.length === 0) {
      throw new Error("bubbles must be a non-empty JSON array");
    }
    const msg = builders.buildFlexCarousel(bubbleParams);
    const result = await line.pushMessage(to, [msg]);
    return ok({ sent: true, messageType: "flex_carousel", bubbleCount: bubbleParams.length, to });
  }),
);

server.tool(
  "build_and_send_quick_reply",
  "Send a text message with quick reply buttons at the bottom. Quick replies disappear after the user taps one.",
  {
    to: z.string().describe("User ID, group ID, or room ID"),
    text: z.string().describe("Message text"),
    options: z.string().describe('JSON array of options: [{"label":"Yes"},{"label":"Visit","type":"uri","uri":"https://..."}]'),
  },
  safe(async ({ to, text, options: optionsJson }) => {
    const items = parseJson(optionsJson, "options") as builders.QuickReplyItem[];
    const msg = builders.buildTextWithQuickReply(text, items);
    const result = await line.pushMessage(to, [msg]);
    return ok({ sent: true, messageType: "quick_reply", optionCount: items.length, to });
  }),
);

server.tool(
  "build_and_send_confirm",
  "Send a confirmation dialog with Yes/No (or custom) buttons. Great for getting a binary choice from the user.",
  {
    to: z.string().describe("User ID, group ID, or room ID"),
    text: z.string().describe("Question text"),
    yes_label: z.string().describe("Label for the positive button"),
    no_label: z.string().describe("Label for the negative button"),
    yes_data: z.string().optional().describe("Postback data for Yes (if omitted, sends as message)"),
    no_data: z.string().optional().describe("Postback data for No (if omitted, sends as message)"),
  },
  safe(async ({ to, text, yes_label, no_label, yes_data, no_data }) => {
    const msg = builders.buildConfirmMessage(text, yes_label, no_label, yes_data, no_data);
    const result = await line.pushMessage(to, [msg]);
    return ok({ sent: true, messageType: "confirm", to });
  }),
);

server.tool(
  "build_and_send_image_carousel",
  "Send a horizontally scrollable image carousel where each image is tappable.",
  {
    to: z.string().describe("User ID, group ID, or room ID"),
    columns: z.string().describe('JSON array: [{"image_url":"...","label":"Tap","action_type":"uri","action_value":"https://..."}]'),
  },
  safe(async ({ to, columns: columnsJson }) => {
    const cols = parseJson(columnsJson, "columns") as builders.ImageCarouselColumn[];
    const msg = builders.buildImageCarousel(cols);
    const result = await line.pushMessage(to, [msg]);
    return ok({ sent: true, messageType: "image_carousel", columnCount: cols.length, to });
  }),
);

server.tool(
  "build_and_send_notification",
  "Send a formatted notification/summary card with key-value pairs. Great for order confirmations, status updates, reports.",
  {
    to: z.string().describe("User ID, group ID, or room ID"),
    heading: z.string().describe("Notification heading"),
    items: z.string().describe('JSON array of items: [{"title":"Status","value":"Active","color":"#1DB446"}]'),
    footer_text: z.string().optional().describe("Small footer text"),
  },
  safe(async ({ to, heading, items: itemsJson, footer_text }) => {
    const items = parseJson(itemsJson, "items") as builders.NotificationItem[];
    const msg = builders.buildNotificationSummary(heading, items, footer_text);
    const result = await line.pushMessage(to, [msg]);
    return ok({ sent: true, messageType: "notification_summary", itemCount: items.length, to });
  }),
);

// ── High-Level Tools (4) ────────────────────────────────

server.tool(
  "get_all_follower_ids",
  "Fetch ALL follower IDs by auto-paginating through the API. Returns the complete list regardless of size. May take a while for large follower bases.",
  {},
  safe(async () => {
    const ids = await line.getAllFollowerIds();
    return ok({ totalFollowers: ids.length, userIds: ids });
  }),
);

server.tool(
  "get_follower_count",
  "Get the current follower count (uses yesterday's stats since LINE stats have a 1-day delay).",
  {},
  safe(async () => {
    const result = await line.getNumberOfFollowers();
    return ok(result);
  }),
);

server.tool(
  "get_insight_range",
  "Get aggregated follower and message delivery stats across a date range. Useful for trend analysis and reporting.",
  {
    start_date: yyyyMMdd.describe("Start date in yyyyMMdd format"),
    end_date: yyyyMMdd.describe("End date in yyyyMMdd format"),
  },
  safe(async ({ start_date, end_date }) => {
    const result = await line.getInsightRange(start_date, end_date);
    return ok(result);
  }),
);

server.tool(
  "send_line_notify",
  "Send a simple notification via LINE Notify (separate from Messaging API). Requires a LINE Notify access token set as LINE_NOTIFY_TOKEN env var.",
  {
    message: z.string().describe("Notification message text"),
  },
  safe(async ({ message }) => {
    const token = process.env.LINE_NOTIFY_TOKEN;
    if (!token) throw new Error("LINE_NOTIFY_TOKEN not set. Get one at https://notify-bot.line.me/");
    const result = await line.sendNotify(token, message);
    return ok(result);
  }),
);

// ── Start Server ─────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LINE Business MCP Server running on stdio");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
