/**
 * Live integration test for LINE Business MCP Server.
 * Requires LINE_CHANNEL_ACCESS_TOKEN env var.
 */
import { spawn } from "child_process";

const proc = spawn("node", ["build/index.js"], {
  env: { ...process.env },
  stdio: ["pipe", "pipe", "pipe"],
});

let buffer = "";
const results = new Map();
let resolveWait;

proc.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  const lines = buffer.split("\n");
  buffer = lines.pop() || "";
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      console.error(`[recv] id=${msg.id ?? '?'} has_result=${!!msg.result}`);
      if (msg.id !== undefined) results.set(msg.id, msg);
      if (resolveWait && results.has(resolveWait.id)) {
        resolveWait.resolve(results.get(resolveWait.id));
        resolveWait = null;
      }
    } catch (e) {
      console.error(`[parse-err] ${e.message} — line: ${line.slice(0,80)}`);
    }
  }
});

proc.stderr.on("data", (d) => { process.stderr.write("[server] " + d); });
proc.on("error", (e) => { console.error("spawn error:", e); });
proc.on("exit", (code) => { console.error("server exited:", code); });

function send(msg) {
  const data = JSON.stringify(msg);
  proc.stdin.write(data + "\n");
  console.error(`[sent] id=${msg.id ?? 'notif'} method=${msg.method}`);
}

function waitFor(id, timeoutMs = 10000) {
  if (results.has(id)) return Promise.resolve(results.get(id));
  return new Promise((resolve, reject) => {
    resolveWait = { id, resolve };
    setTimeout(() => reject(new Error(`Timeout waiting for id=${id}`)), timeoutMs);
  });
}

let nextId = 1;
async function callTool(name, args = {}) {
  const id = nextId++;
  send({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: args } });
  return waitFor(id);
}

// ─── Run Tests ───────────────────────────────────────────

async function main() {
  // Initialize
  send({ jsonrpc: "2.0", id: 0, method: "initialize", params: {
    protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1.0" }
  }});
  await waitFor(0);
  send({ jsonrpc: "2.0", method: "notifications/initialized" });

  const pass = [];
  const fail = [];

  async function test(name, toolName, args, validate) {
    try {
      const res = await callTool(toolName, args);
      const content = res.result?.content?.[0]?.text;
      const isError = res.result?.isError;
      if (isError) {
        fail.push(`${name}: isError=true — ${content?.slice(0, 100)}`);
        return;
      }
      const parsed = JSON.parse(content);
      const valid = validate(parsed);
      if (valid === true) {
        pass.push(name);
      } else {
        fail.push(`${name}: validation failed — ${valid}`);
      }
    } catch (e) {
      fail.push(`${name}: ${e.message}`);
    }
  }

  // ─── Read-only tool tests ───
  await test("get_bot_info", "get_bot_info", {}, (d) =>
    d.userId && d.displayName ? true : `missing userId or displayName`
  );

  await test("get_quota", "get_quota", {}, (d) =>
    d.type !== undefined ? true : `missing type field`
  );

  await test("get_quota_consumption", "get_quota_consumption", {}, (d) =>
    d.totalUsage !== undefined ? true : `missing totalUsage`
  );

  await test("get_webhook_info", "get_webhook_info", {}, (d) =>
    d.endpoint !== undefined ? true : `missing endpoint`
  );

  await test("list_rich_menus", "list_rich_menus", {}, (d) =>
    d.richmenus !== undefined ? true : `missing richmenus array`
  );

  await test("get_follower_ids", "get_follower_ids", {}, (d) =>
    d.userIds !== undefined ? true : `missing userIds`
  );

  await test("validate_message_valid", "validate_message", {
    messages: '[{"type":"text","text":"hello"}]'
  }, (d) => d.valid === true ? true : `expected valid=true`);

  // This SHOULD return an error from LINE API (missing text field)
  {
    const res = await callTool("validate_message", { messages: '[{"type":"text"}]' });
    if (res.result?.isError) {
      pass.push("validate_message_invalid (correctly returns API error)");
    } else {
      fail.push("validate_message_invalid: should have returned isError");
    }
  }

  await test("get_follower_stats", "get_follower_stats", { date: "20260414" }, (d) =>
    d.status !== undefined || d.followers !== undefined ? true : `unexpected response shape`
  );

  await test("list_audiences", "list_audiences", {}, (d) =>
    d.audienceGroups !== undefined || d.message !== undefined ? true : `unexpected response`
  );

  // ─── Error handling tests ───
  {
    const res = await callTool("get_profile", { user_id: "INVALID" });
    if (res.result?.isError) {
      pass.push("get_profile_invalid_id (correctly returns API error)");
    } else {
      fail.push("get_profile_invalid_id: should have returned isError for invalid user");
    }
  }

  // ─── Schema validation tests (no API call needed) ───
  const badRes = await callTool("push_message", { to: "U123" }); // missing messages
  if (badRes.result?.isError) {
    pass.push("schema_validation_missing_required");
  } else {
    fail.push("schema_validation_missing_required: should have rejected missing 'messages'");
  }

  // ─── New v0.3 high-level tool tests ───

  await test("get_follower_count", "get_follower_count", {}, (d) =>
    d.status !== undefined || d.followers !== undefined ? true : `unexpected shape`
  );

  await test("get_all_follower_ids", "get_all_follower_ids", {}, (d) =>
    d.totalFollowers !== undefined && Array.isArray(d.userIds) ? true : `missing totalFollowers or userIds`
  );

  await test("get_insight_range", "get_insight_range", { start_date: "20260414", end_date: "20260416" }, (d) =>
    Array.isArray(d.dates) && d.dates.length === 3 ? true : `expected 3 dates, got ${d.dates?.length}`
  );

  // ─── Builder validation tests (don't actually send — test JSON parse errors) ───
  {
    const res = await callTool("build_and_send_flex_bubble", {
      to: "FAKE_USER",
      title: "Test",
      body_text: "Test body",
    });
    // Should fail with LINE API error (invalid user ID) but NOT a JSON/builder error
    if (res.result?.isError && res.result.content[0].text.includes("LINE API")) {
      pass.push("build_and_send_flex_bubble (builder works, API correctly rejects fake user)");
    } else if (res.result?.isError) {
      fail.push(`build_and_send_flex_bubble: unexpected error — ${res.result.content[0].text.slice(0, 80)}`);
    } else {
      fail.push("build_and_send_flex_bubble: should have failed for FAKE_USER");
    }
  }

  {
    const res = await callTool("build_and_send_quick_reply", {
      to: "FAKE_USER",
      text: "Choose one",
      options: '[{"label":"Yes"},{"label":"No"}]',
    });
    if (res.result?.isError && res.result.content[0].text.includes("LINE API")) {
      pass.push("build_and_send_quick_reply (builder works, API correctly rejects)");
    } else if (res.result?.isError) {
      fail.push(`build_and_send_quick_reply: unexpected error — ${res.result.content[0].text.slice(0, 80)}`);
    } else {
      fail.push("build_and_send_quick_reply: should have failed for FAKE_USER");
    }
  }

  {
    const res = await callTool("build_and_send_confirm", {
      to: "FAKE_USER",
      text: "Are you sure?",
      yes_label: "Yes",
      no_label: "No",
    });
    if (res.result?.isError && res.result.content[0].text.includes("LINE API")) {
      pass.push("build_and_send_confirm (builder works, API correctly rejects)");
    } else if (res.result?.isError) {
      fail.push(`build_and_send_confirm: unexpected error — ${res.result.content[0].text.slice(0, 80)}`);
    } else {
      fail.push("build_and_send_confirm: should have failed for FAKE_USER");
    }
  }

  {
    const res = await callTool("build_and_send_notification", {
      to: "FAKE_USER",
      heading: "Report",
      items: '[{"title":"Status","value":"OK"}]',
    });
    if (res.result?.isError && res.result.content[0].text.includes("LINE API")) {
      pass.push("build_and_send_notification (builder works, API correctly rejects)");
    } else if (res.result?.isError) {
      fail.push(`build_and_send_notification: unexpected error — ${res.result.content[0].text.slice(0, 80)}`);
    } else {
      fail.push("build_and_send_notification: should have failed for FAKE_USER");
    }
  }

  // ─── Bad JSON in builder params ───
  {
    const res = await callTool("build_and_send_flex_bubble", {
      to: "U123",
      title: "Test",
      body_text: "Test",
      buttons: "NOT VALID JSON{{{",
    });
    if (res.result?.isError && res.result.content[0].text.includes("Invalid JSON")) {
      pass.push("builder_bad_json (correctly catches malformed JSON)");
    } else {
      fail.push("builder_bad_json: should have caught invalid JSON in buttons param");
    }
  }

  // ─── Broadcast safety guard ───
  {
    const res = await callTool("broadcast_message", {
      messages: '[{"type":"text","text":"test"}]',
      confirm: false,
    });
    if (res.result?.isError && res.result.content[0].text.includes("confirm")) {
      pass.push("broadcast_safety_guard (blocks without confirm=true)");
    } else {
      fail.push("broadcast_safety_guard: should block when confirm=false");
    }
  }

  // ─── Date format validation ───
  {
    const res = await callTool("get_follower_stats", { date: "2026-04-14" });
    if (res.result?.isError) {
      pass.push("date_format_validation (rejects ISO format)");
    } else {
      fail.push("date_format_validation: should reject non-yyyyMMdd format");
    }
  }

  // ─── send_line_notify without token ───
  {
    const res = await callTool("send_line_notify", { message: "test" });
    if (res.result?.isError && res.result.content[0].text.includes("LINE_NOTIFY_TOKEN")) {
      pass.push("line_notify_missing_token (clear error message)");
    } else {
      fail.push("line_notify_missing_token: should error about missing token");
    }
  }

  // ─── Summary ───
  console.log("\n══════════════════════════════");
  console.log("  LINE Business MCP — Test Results");
  console.log("══════════════════════════════");
  console.log(`  PASS: ${pass.length}`);
  for (const p of pass) console.log(`    ✅ ${p}`);
  console.log(`  FAIL: ${fail.length}`);
  for (const f of fail) console.log(`    ❌ ${f}`);
  console.log(`══════════════════════════════`);
  console.log(`  Total: ${pass.length + fail.length} | Pass rate: ${Math.round(pass.length / (pass.length + fail.length) * 100)}%`);
  console.log(`══════════════════════════════\n`);

  proc.kill();
  process.exit(fail.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
