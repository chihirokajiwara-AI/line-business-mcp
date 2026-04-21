/**
 * High-level message builders.
 * These generate LINE message JSON from simple parameters,
 * so users don't need to know the raw Flex/Template spec.
 */

// ── Text with Quick Reply ────────────────────────────────

export interface QuickReplyItem {
  label: string;
  text?: string;
  type?: "message" | "uri" | "postback";
  uri?: string;
  data?: string;
}

export function buildTextWithQuickReply(text: string, items: QuickReplyItem[]) {
  return {
    type: "text",
    text,
    quickReply: {
      items: items.map((item) => {
        if (item.type === "uri" && item.uri) {
          return {
            type: "action",
            action: { type: "uri", label: item.label, uri: item.uri },
          };
        }
        if (item.type === "postback" && item.data) {
          return {
            type: "action",
            action: {
              type: "postback",
              label: item.label,
              data: item.data,
              displayText: item.text || item.label,
            },
          };
        }
        return {
          type: "action",
          action: { type: "message", label: item.label, text: item.text || item.label },
        };
      }),
    },
  };
}

// ── Flex Bubble ──────────────────────────────────────────

export interface FlexBubbleParams {
  title: string;
  subtitle?: string;
  body_text: string;
  image_url?: string;
  footer_buttons?: Array<{
    label: string;
    type: "uri" | "message" | "postback";
    value: string;
    style?: "primary" | "secondary" | "link";
    color?: string;
  }>;
  header_color?: string;
}

export function buildFlexBubble(params: FlexBubbleParams) {
  const bubble: Record<string, unknown> = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: params.title,
          weight: "bold",
          size: "xl",
          wrap: true,
        },
        ...(params.subtitle
          ? [{
              type: "text",
              text: params.subtitle,
              size: "sm",
              color: "#999999",
              wrap: true,
              margin: "sm",
            }]
          : []),
        {
          type: "text",
          text: params.body_text,
          size: "md",
          wrap: true,
          margin: "lg",
        },
      ],
    },
  };

  if (params.image_url) {
    bubble.hero = {
      type: "image",
      url: params.image_url,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    };
  }

  if (params.header_color) {
    (bubble.body as Record<string, unknown>).backgroundColor = params.header_color;
  }

  if (params.footer_buttons?.length) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: params.footer_buttons.map((btn) => {
        const action =
          btn.type === "uri"
            ? { type: "uri", label: btn.label, uri: btn.value }
            : btn.type === "postback"
              ? { type: "postback", label: btn.label, data: btn.value, displayText: btn.label }
              : { type: "message", label: btn.label, text: btn.value };
        return {
          type: "button",
          action,
          style: btn.style || "primary",
          ...(btn.color ? { color: btn.color } : {}),
        };
      }),
    };
  }

  return { type: "flex", altText: params.title, contents: bubble };
}

// ── Flex Carousel ────────────────────────────────────────

export function buildFlexCarousel(bubbles: FlexBubbleParams[]) {
  const contents = bubbles.map((b) => {
    const msg = buildFlexBubble(b);
    return msg.contents;
  });
  return {
    type: "flex",
    altText: bubbles[0]?.title || "Carousel",
    contents: { type: "carousel", contents },
  };
}

// ── Confirm Template ─────────────────────────────────────

export function buildConfirmMessage(
  text: string,
  yesLabel: string,
  noLabel: string,
  yesData?: string,
  noData?: string,
) {
  return {
    type: "template",
    altText: text,
    template: {
      type: "confirm",
      text,
      actions: [
        yesData
          ? { type: "postback", label: yesLabel, data: yesData, displayText: yesLabel }
          : { type: "message", label: yesLabel, text: yesLabel },
        noData
          ? { type: "postback", label: noLabel, data: noData, displayText: noLabel }
          : { type: "message", label: noLabel, text: noLabel },
      ],
    },
  };
}

// ── Image Carousel ───────────────────────────────────────

export interface ImageCarouselColumn {
  image_url: string;
  label: string;
  action_type: "uri" | "message" | "postback";
  action_value: string;
}

export function buildImageCarousel(columns: ImageCarouselColumn[]) {
  return {
    type: "template",
    altText: "Image carousel",
    template: {
      type: "image_carousel",
      columns: columns.map((col) => ({
        imageUrl: col.image_url,
        action:
          col.action_type === "uri"
            ? { type: "uri", label: col.label, uri: col.action_value }
            : col.action_type === "postback"
              ? { type: "postback", label: col.label, data: col.action_value, displayText: col.label }
              : { type: "message", label: col.label, text: col.action_value },
      })),
    },
  };
}

// ── Notification Summary (multi-item flex) ───────────────

export interface NotificationItem {
  title: string;
  value: string;
  color?: string;
}

export function buildNotificationSummary(
  heading: string,
  items: NotificationItem[],
  footer_text?: string,
) {
  return {
    type: "flex",
    altText: heading,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: heading,
            weight: "bold",
            size: "lg",
            color: "#1DB446",
          },
          { type: "separator", margin: "lg" },
          ...items.map((item) => ({
            type: "box",
            layout: "horizontal",
            margin: "md",
            contents: [
              { type: "text", text: item.title, size: "sm", color: "#555555", flex: 0 },
              {
                type: "text",
                text: item.value,
                size: "sm",
                color: item.color || "#111111",
                align: "end",
              },
            ],
          })),
          ...(footer_text
            ? [
                { type: "separator", margin: "lg" },
                {
                  type: "text",
                  text: footer_text,
                  size: "xs",
                  color: "#aaaaaa",
                  margin: "lg",
                  wrap: true,
                },
              ]
            : []),
        ],
      },
    },
  };
}
