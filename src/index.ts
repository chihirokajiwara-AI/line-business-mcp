#!/usr/bin/env node
/**
 * LINE Business MCP Server
 *
 * Full-featured LINE Messaging API integration for AI coding tools.
 * 32 tools covering messaging, profiles, rich menus, groups, webhooks,
 * insights, audiences, and account linking.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as line from "./line-client.js";

const server = new McpServer({
  name: "line-business-mcp",
  version: "0.1.0",
});

// ── Helpers ──────────────────────────────────────────────

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function parseMessages(messagesJson: string): unknown[] {
  const parsed = JSON.parse(messagesJson);
  return Array.isArray(parsed) ? parsed : [parsed];
}

// ── Messaging Tools (7) ─────────────────────────────────

server.tool(
  "push_message",
  "Send a message to a user, group, or room by their ID. Messages can be text, flex, template, image, video, audio, sticker, or location. Counts toward monthly quota.",
  {
    to: z.string().describe("User ID, group ID, or room ID"),
    messages: z.string().describe('JSON array of message objects, e.g. [{"type":"text","text":"Hello"}]'),
    notification_disabled: z.boolean().optional().describe("Disable push notification (default: false)"),
  },
  async ({ to, messages, notification_disabled }) => {
    const msgs = parseMessages(messages);
    const result = await line.pushMessage(to, msgs, notification_disabled);
    return ok(result);
  },
);

server.tool(
  "reply_message",
  "Reply to a webhook event using a reply token. Reply tokens expire in 1 minute. Does NOT count toward monthly message quota (free).",
  {
    reply_token: z.string().describe("Reply token from webhook event"),
    messages: z.string().describe('JSON array of message objects'),
    notification_disabled: z.boolean().optional(),
  },
  async ({ reply_token, messages, notification_disabled }) => {
    const msgs = parseMessages(messages);
    const result = await line.replyMessage(reply_token, msgs, notification_disabled);
    return ok(result);
  },
);

server.tool(
  "multicast_message",
  "Send a message to multiple users simultaneously (up to 500 user IDs). Counts toward quota.",
  {
    to: z.string().describe('JSON array of user IDs, e.g. ["U123","U456"]'),
    messages: z.string().describe('JSON array of message objects'),
    notification_disabled: z.boolean().optional(),
  },
  async ({ to, messages, notification_disabled }) => {
    const userIds = JSON.parse(to);
    const msgs = parseMessages(messages);
    const result = await line.multicastMessage(userIds, msgs, notification_disabled);
    return ok(result);
  },
);

server.tool(
  "broadcast_message",
  "Send a message to ALL followers of the bot. Use with caution — counts toward quota for every follower.",
  {
    messages: z.string().describe('JSON array of message objects'),
    notification_disabled: z.boolean().optional(),
  },
  async ({ messages, notification_disabled }) => {
    const msgs = parseMessages(messages);
    const result = await line.broadcastMessage(msgs, notification_disabled);
    return ok(result);
  },
);

server.tool(
  "narrowcast_message",
  "Send a message to a subset of followers using audience filters. Useful for targeted campaigns.",
  {
    messages: z.string().describe('JSON array of message objects'),
    recipient: z.string().optional().describe('JSON recipient object (audience filter)'),
    filter: z.string().optional().describe('JSON demographic filter object'),
  },
  async ({ messages, recipient, filter }) => {
    const msgs = parseMessages(messages);
    const r = recipient ? JSON.parse(recipient) : undefined;
    const f = filter ? JSON.parse(filter) : undefined;
    const result = await line.narrowcastMessage(msgs, r, f);
    return ok(result);
  },
);

server.tool(
  "validate_message",
  "Validate message objects without actually sending them. Useful for checking flex message JSON before sending.",
  {
    messages: z.string().describe('JSON array of message objects to validate'),
  },
  async ({ messages }) => {
    const msgs = parseMessages(messages);
    const result = await line.validateMessage(msgs);
    return ok({ valid: true, ...result as object });
  },
);

server.tool(
  "show_loading_animation",
  "Show a loading animation in the chat while processing a request. Lasts up to 60 seconds.",
  {
    chat_id: z.string().describe("User ID to show loading animation to"),
    loading_seconds: z.number().min(5).max(60).optional().describe("Duration in seconds (default: 5)"),
  },
  async ({ chat_id, loading_seconds }) => {
    const result = await line.showLoadingAnimation(chat_id, loading_seconds);
    return ok(result);
  },
);

// ── Profile Tools (3) ───────────────────────────────────

server.tool(
  "get_profile",
  "Get a user's display name, profile picture URL, status message, and language.",
  {
    user_id: z.string().describe("LINE user ID"),
  },
  async ({ user_id }) => {
    const result = await line.getProfile(user_id);
    return ok(result);
  },
);

server.tool(
  "get_follower_ids",
  "Get a list of user IDs of users who have added the bot as a friend. Returns up to 300 IDs per call with pagination.",
  {
    start: z.string().optional().describe("Continuation token for pagination"),
  },
  async ({ start }) => {
    const result = await line.getFollowerIds(start);
    return ok(result);
  },
);

server.tool(
  "get_bot_info",
  "Get the bot's display name, user ID, premium message quota, and chat mode.",
  {},
  async () => {
    const result = await line.getBotInfo();
    return ok(result);
  },
);

// ── Rich Menu Tools (8) ─────────────────────────────────

server.tool(
  "create_rich_menu",
  "Create a new rich menu. Returns a richMenuId. You must also upload an image for it to appear.",
  {
    rich_menu: z.string().describe("JSON rich menu object with size, selected, name, chatBarText, and areas"),
  },
  async ({ rich_menu }) => {
    const menu = JSON.parse(rich_menu);
    const result = await line.createRichMenu(menu);
    return ok(result);
  },
);

server.tool(
  "list_rich_menus",
  "List all rich menus created for this bot.",
  {},
  async () => {
    const result = await line.listRichMenus();
    return ok(result);
  },
);

server.tool(
  "get_rich_menu",
  "Get a specific rich menu by ID.",
  {
    rich_menu_id: z.string().describe("Rich menu ID"),
  },
  async ({ rich_menu_id }) => {
    const result = await line.getRichMenu(rich_menu_id);
    return ok(result);
  },
);

server.tool(
  "delete_rich_menu",
  "Delete a rich menu by ID.",
  {
    rich_menu_id: z.string().describe("Rich menu ID"),
  },
  async ({ rich_menu_id }) => {
    const result = await line.deleteRichMenu(rich_menu_id);
    return ok({ deleted: true, richMenuId: rich_menu_id });
  },
);

server.tool(
  "set_default_rich_menu",
  "Set a rich menu as the default for all users who don't have a per-user rich menu linked.",
  {
    rich_menu_id: z.string().describe("Rich menu ID to set as default"),
  },
  async ({ rich_menu_id }) => {
    const result = await line.setDefaultRichMenu(rich_menu_id);
    return ok({ set: true, richMenuId: rich_menu_id, ...result as object });
  },
);

server.tool(
  "get_default_rich_menu",
  "Get the current default rich menu ID.",
  {},
  async () => {
    const result = await line.getDefaultRichMenu();
    return ok(result);
  },
);

server.tool(
  "link_rich_menu_to_user",
  "Link a specific rich menu to a specific user (overrides the default).",
  {
    user_id: z.string().describe("LINE user ID"),
    rich_menu_id: z.string().describe("Rich menu ID"),
  },
  async ({ user_id, rich_menu_id }) => {
    const result = await line.linkRichMenuToUser(user_id, rich_menu_id);
    return ok({ linked: true, userId: user_id, richMenuId: rich_menu_id, ...result as object });
  },
);

server.tool(
  "unlink_rich_menu_from_user",
  "Remove the per-user rich menu from a user (they'll see the default instead).",
  {
    user_id: z.string().describe("LINE user ID"),
  },
  async ({ user_id }) => {
    const result = await line.unlinkRichMenuFromUser(user_id);
    return ok({ unlinked: true, userId: user_id, ...result as object });
  },
);

// ── Group Tools (4) ─────────────────────────────────────

server.tool(
  "get_group_summary",
  "Get a group's name, icon URL, and member count.",
  {
    group_id: z.string().describe("LINE group ID"),
  },
  async ({ group_id }) => {
    const result = await line.getGroupSummary(group_id);
    return ok(result);
  },
);

server.tool(
  "get_group_member_ids",
  "Get user IDs of members in a group. Returns up to 300 per call with pagination.",
  {
    group_id: z.string().describe("LINE group ID"),
    start: z.string().optional().describe("Continuation token for pagination"),
  },
  async ({ group_id, start }) => {
    const result = await line.getGroupMemberIds(group_id, start);
    return ok(result);
  },
);

server.tool(
  "get_group_member_profile",
  "Get a specific user's profile within a group.",
  {
    group_id: z.string().describe("LINE group ID"),
    user_id: z.string().describe("LINE user ID"),
  },
  async ({ group_id, user_id }) => {
    const result = await line.getGroupMemberProfile(group_id, user_id);
    return ok(result);
  },
);

server.tool(
  "leave_group",
  "Make the bot leave a group. This action is irreversible — the bot cannot rejoin unless re-invited.",
  {
    group_id: z.string().describe("LINE group ID"),
  },
  async ({ group_id }) => {
    const result = await line.leaveGroup(group_id);
    return ok({ left: true, groupId: group_id, ...result as object });
  },
);

// ── Webhook Tools (3) ───────────────────────────────────

server.tool(
  "set_webhook_url",
  "Set or update the webhook URL for receiving events from LINE.",
  {
    endpoint: z.string().url().describe("HTTPS webhook endpoint URL"),
  },
  async ({ endpoint }) => {
    const result = await line.setWebhookUrl(endpoint);
    return ok({ set: true, endpoint, ...result as object });
  },
);

server.tool(
  "get_webhook_info",
  "Get the current webhook URL and its active status.",
  {},
  async () => {
    const result = await line.getWebhookInfo();
    return ok(result);
  },
);

server.tool(
  "test_webhook",
  "Send a test webhook event to verify the endpoint is working.",
  {
    endpoint: z.string().url().optional().describe("URL to test (defaults to the configured webhook URL)"),
  },
  async ({ endpoint }) => {
    const result = await line.testWebhook(endpoint);
    return ok(result);
  },
);

// ── Quota & Insight Tools (5) ───────────────────────────

server.tool(
  "get_quota",
  "Get the monthly message quota limit for this bot.",
  {},
  async () => {
    const result = await line.getQuota();
    return ok(result);
  },
);

server.tool(
  "get_quota_consumption",
  "Get the current month's message usage count.",
  {},
  async () => {
    const result = await line.getQuotaConsumption();
    return ok(result);
  },
);

server.tool(
  "get_follower_stats",
  "Get follower count statistics for a specific date. Data available from 7 days ago.",
  {
    date: z.string().describe("Date in yyyyMMdd format (e.g. '20260421')"),
  },
  async ({ date }) => {
    const result = await line.getFollowerStats(date);
    return ok(result);
  },
);

server.tool(
  "get_message_delivery_stats",
  "Get message delivery statistics (sent, delivered, opened) for a specific date.",
  {
    date: z.string().describe("Date in yyyyMMdd format"),
  },
  async ({ date }) => {
    const result = await line.getMessageDeliveryStats(date);
    return ok(result);
  },
);

server.tool(
  "get_message_event_stats",
  "Get detailed event statistics for a specific message send request (by request ID from push/multicast response).",
  {
    request_id: z.string().describe("Request ID from a push/multicast API response"),
  },
  async ({ request_id }) => {
    const result = await line.getMessageEventStats(request_id);
    return ok(result);
  },
);

// ── Audience Tools (4) ──────────────────────────────────

server.tool(
  "create_audience",
  "Create a new audience group for narrowcast targeting.",
  {
    description: z.string().describe("Audience group name/description"),
    user_ids: z.string().optional().describe('JSON array of user IDs to add, e.g. ["U123","U456"]'),
  },
  async ({ description, user_ids }) => {
    const audiences = user_ids
      ? JSON.parse(user_ids).map((id: string) => ({ id }))
      : undefined;
    const result = await line.createAudience(description, audiences);
    return ok(result);
  },
);

server.tool(
  "list_audiences",
  "List all audience groups with pagination.",
  {
    page: z.number().optional().describe("Page number (default: 1)"),
    size: z.number().optional().describe("Page size (default: 40, max: 40)"),
  },
  async ({ page, size }) => {
    const result = await line.listAudiences(page, size);
    return ok(result);
  },
);

server.tool(
  "get_audience",
  "Get details of a specific audience group.",
  {
    audience_group_id: z.number().describe("Audience group ID"),
  },
  async ({ audience_group_id }) => {
    const result = await line.getAudience(audience_group_id);
    return ok(result);
  },
);

server.tool(
  "delete_audience",
  "Delete an audience group.",
  {
    audience_group_id: z.number().describe("Audience group ID"),
  },
  async ({ audience_group_id }) => {
    const result = await line.deleteAudience(audience_group_id);
    return ok({ deleted: true, audienceGroupId: audience_group_id });
  },
);

// ── Account Link Tool (1) ───────────────────────────────

server.tool(
  "issue_link_token",
  "Issue a link token for account linking. The token is valid for 10 minutes.",
  {
    user_id: z.string().describe("LINE user ID"),
  },
  async ({ user_id }) => {
    const result = await line.issueLinkToken(user_id);
    return ok(result);
  },
);

// ── Start Server ─────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("LINE Business MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
