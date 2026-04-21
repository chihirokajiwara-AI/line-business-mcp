# LINE Business MCP Server

Full-featured LINE Messaging API server for the Model Context Protocol (MCP). Use LINE's entire Business API directly from Claude, Cursor, Windsurf, and other AI coding tools.

**32 tools** covering messaging, profiles, rich menus, groups, webhooks, insights, audiences, and account linking — vs. the official `@line/line-bot-mcp-server`'s 12 tools.

## Why this over the official server?

| Feature | Official (12 tools) | This server (32 tools) |
|---------|:---:|:---:|
| Push message | Yes | Yes |
| Reply message | **No** | Yes |
| Multicast | **No** | Yes |
| Broadcast | Yes | Yes |
| Narrowcast | **No** | Yes |
| Validate message | **No** | Yes |
| Loading animation | **No** | Yes |
| Rich menu CRUD | Partial | Full (8 tools) |
| Group management | **No** | Yes (4 tools) |
| Webhook management | **No** | Yes (3 tools) |
| Follower/delivery insights | **No** | Yes (3 tools) |
| Audience management | **No** | Yes (4 tools) |
| Account linking | **No** | Yes |

## Quick Start

### Claude Desktop / Claude Code

Add to your MCP config (`~/.claude/settings.json` or Claude Desktop config):

```json
{
  "mcpServers": {
    "line-business": {
      "command": "npx",
      "args": ["-y", "@anthropic-tools/line-business-mcp"],
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
      "args": ["-y", "@anthropic-tools/line-business-mcp"],
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

### Messaging (7 tools)

| Tool | Description |
|------|-------------|
| `push_message` | Send message to a user/group/room (counts toward quota) |
| `reply_message` | Reply to webhook event (free, no quota cost) |
| `multicast_message` | Send to multiple users at once (up to 500) |
| `broadcast_message` | Send to ALL followers |
| `narrowcast_message` | Send to audience segment with filters |
| `validate_message` | Validate message JSON without sending |
| `show_loading_animation` | Show typing indicator (5-60 seconds) |

### Profile (3 tools)

| Tool | Description |
|------|-------------|
| `get_profile` | Get user's display name, picture, status, language |
| `get_follower_ids` | List all follower user IDs (paginated) |
| `get_bot_info` | Get bot's name, ID, quota, chat mode |

### Rich Menu (8 tools)

| Tool | Description |
|------|-------------|
| `create_rich_menu` | Create a new rich menu |
| `list_rich_menus` | List all rich menus |
| `get_rich_menu` | Get rich menu by ID |
| `delete_rich_menu` | Delete a rich menu |
| `set_default_rich_menu` | Set default for all users |
| `get_default_rich_menu` | Get current default |
| `link_rich_menu_to_user` | Assign per-user rich menu |
| `unlink_rich_menu_from_user` | Remove per-user assignment |

### Group (4 tools)

| Tool | Description |
|------|-------------|
| `get_group_summary` | Get group name, icon, member count |
| `get_group_member_ids` | List group member IDs (paginated) |
| `get_group_member_profile` | Get user profile within a group |
| `leave_group` | Make bot leave a group (irreversible) |

### Webhook (3 tools)

| Tool | Description |
|------|-------------|
| `set_webhook_url` | Set/update webhook endpoint URL |
| `get_webhook_info` | Get current webhook URL and status |
| `test_webhook` | Send test event to verify endpoint |

### Quota & Insights (5 tools)

| Tool | Description |
|------|-------------|
| `get_quota` | Get monthly message limit |
| `get_quota_consumption` | Get current month's usage |
| `get_follower_stats` | Follower count for a date |
| `get_message_delivery_stats` | Delivery stats for a date |
| `get_message_event_stats` | Event stats for a request ID |

### Audience (4 tools)

| Tool | Description |
|------|-------------|
| `create_audience` | Create audience group for targeting |
| `list_audiences` | List all audience groups |
| `get_audience` | Get audience details |
| `delete_audience` | Delete audience group |

### Account Link (1 tool)

| Tool | Description |
|------|-------------|
| `issue_link_token` | Issue token for account linking flow |

## Examples

### Send a text message

```
Use push_message to send "Hello from Claude!" to user U1234567890
```

### Send a flex message

```
Use push_message to send a flex message bubble with a hero image and two buttons to user U1234567890
```

### Check quota usage

```
Use get_quota_consumption to see how many messages we've sent this month
```

### Manage rich menus

```
List all rich menus, then set the one named "Main Menu" as the default
```

## License

MIT
