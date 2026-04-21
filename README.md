# LINE Business MCP Server

The most complete LINE Messaging API server for the Model Context Protocol (MCP). **45 tools** — use LINE's entire Business API directly from Claude, Cursor, Windsurf, and other AI coding tools.

No need to write raw Flex JSON. The high-level message builders let you create rich messages from simple parameters.

## Why this over the official server?

| Feature | Official (12 tools) | This server (45 tools) |
|---------|:---:|:---:|
| Push/Broadcast message | Yes | Yes |
| Reply message | **No** | Yes |
| Multicast / Narrowcast | **No** | Yes |
| Validate message | **No** | Yes |
| Loading animation | **No** | Yes |
| **Flex Message builder** | **No** | Yes (no raw JSON needed) |
| **Carousel builder** | **No** | Yes |
| **Quick Reply builder** | **No** | Yes |
| **Confirm dialog builder** | **No** | Yes |
| **Image carousel builder** | **No** | Yes |
| **Notification card builder** | **No** | Yes |
| Rich menu CRUD | Partial | Full (8 tools) |
| Group management | **No** | Yes (4 tools) |
| Webhook management | **No** | Yes (3 tools) |
| Insights & analytics | **No** | Yes (5 tools + range aggregation) |
| Audience management | **No** | Yes (4 tools) |
| Auto-paginate followers | **No** | Yes |
| LINE Notify | **No** | Yes |
| Broadcast safety guard | **No** | Yes (requires confirm=true) |
| 30s request timeout | **No** | Yes |
| Date format validation | **No** | Yes (yyyyMMdd) |

## Quick Start

### Claude Desktop / Claude Code

```json
{
  "mcpServers": {
    "line-business": {
      "command": "npx",
      "args": ["-y", "line-business-mcp"],
      "env": {
        "LINE_CHANNEL_ACCESS_TOKEN": "your-channel-access-token"
      }
    }
  }
}
```

### Cursor / Windsurf

Add to `.cursor/mcp.json` or equivalent:

```json
{
  "mcpServers": {
    "line-business": {
      "command": "npx",
      "args": ["-y", "line-business-mcp"],
      "env": {
        "LINE_CHANNEL_ACCESS_TOKEN": "your-channel-access-token"
      }
    }
  }
}
```

## Getting Your Channel Access Token

1. Go to [LINE Developers Console](https://developers.line.biz/console/)
2. Create or select a Messaging API channel
3. Under "Messaging API", issue a **Channel access token (long-lived)**
4. Set it as `LINE_CHANNEL_ACCESS_TOKEN`

## Tools Reference

### Message Builders (6 tools) — The Killer Feature

Build and send rich LINE messages without writing any JSON. Just describe what you want.

| Tool | What it does |
|------|-------------|
| `build_and_send_flex_bubble` | Rich card with title, body, image, buttons |
| `build_and_send_carousel` | Swipeable multi-card carousel |
| `build_and_send_quick_reply` | Message with tappable quick reply buttons |
| `build_and_send_confirm` | Yes/No confirmation dialog |
| `build_and_send_image_carousel` | Scrollable tappable image carousel |
| `build_and_send_notification` | Status card with key-value pairs |

**Example — send a rich card:**
```
Use build_and_send_flex_bubble to send user U123 a card with:
- title "Order Confirmed"
- body "Your order #4521 has been placed"
- image https://example.com/order.png
- a "Track Order" button linking to https://example.com/track/4521
```

**Example — send a notification card:**
```
Use build_and_send_notification to send user U123:
- heading "Weekly Report"
- items: Revenue $12,340 (green), Users 1,205, Churn 2.1% (red)
```

### Core Messaging (7 tools)

| Tool | Description |
|------|-------------|
| `push_message` | Send raw message to a user/group/room |
| `reply_message` | Reply to webhook event (free, no quota) |
| `multicast_message` | Send to multiple users (up to 500) |
| `broadcast_message` | Send to ALL followers (requires confirm=true) |
| `narrowcast_message` | Send to audience segment with filters |
| `validate_message` | Validate message JSON without sending |
| `show_loading_animation` | Show typing indicator |

### Profile (3 tools)

| Tool | Description |
|------|-------------|
| `get_profile` | User's display name, picture, status |
| `get_follower_ids` | List follower IDs (one page) |
| `get_bot_info` | Bot name, ID, quota, chat mode |

### Rich Menu (8 tools)

`create_rich_menu`, `list_rich_menus`, `get_rich_menu`, `delete_rich_menu`, `set_default_rich_menu`, `get_default_rich_menu`, `link_rich_menu_to_user`, `unlink_rich_menu_from_user`

### Group (4 tools)

`get_group_summary`, `get_group_member_ids`, `get_group_member_profile`, `leave_group`

### Webhook (3 tools)

`set_webhook_url`, `get_webhook_info`, `test_webhook`

### Quota & Insights (5 tools)

`get_quota`, `get_quota_consumption`, `get_follower_stats`, `get_message_delivery_stats`, `get_message_event_stats`

### Audience (4 tools)

`create_audience`, `list_audiences`, `get_audience`, `delete_audience`

### High-Level Tools (4 tools)

| Tool | Description |
|------|-------------|
| `get_all_follower_ids` | Auto-paginate to get ALL followers |
| `get_follower_count` | Current follower count (yesterday's stats) |
| `get_insight_range` | Aggregate stats across a date range |
| `send_line_notify` | Send via LINE Notify (separate token) |

### Account Link (1 tool)

`issue_link_token` — Issue token for account linking flow

## Safety Features

- **Broadcast guard**: `broadcast_message` requires `confirm=true` to prevent accidental mass sends
- **Request timeout**: All API calls have a 30-second timeout
- **Error handling**: Every tool returns `isError: true` with clear messages on failure
- **Input validation**: Date format, JSON parsing, and required parameter checks
- **No token leakage**: Tokens are read from env vars and never included in responses

## Architecture

```
src/
├── index.ts         # MCP server + 45 tool definitions
├── line-client.ts   # LINE API HTTP client (zero dependencies)
└── builders.ts      # High-level message builders
```

Zero runtime dependencies beyond the MCP SDK and Zod. No LINE SDK needed — uses native `fetch`.

## License

MIT
