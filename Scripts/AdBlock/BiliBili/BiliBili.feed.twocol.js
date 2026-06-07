// ==UserScript==
// @ScriptName        BiliBili.feed.twocol
// @Author            @Sijiahui
// @Function          去除哔哩哔哩手机版首页推荐顶部大卡片，尽量保留双栏视频推荐
// @TargetURL         https://app.bilibili.com/x/v2/feed/index
// @UpdateTime        2026-06-07
// ==/UserScript==

/**
 * 说明：
 * 这个脚本专门处理 Bilibili 首页推荐接口：
 * https://app.bilibili.com/x/v2/feed/index
 *
 * 目标：
 * 1. 去掉首页推荐顶部那种横向大视频卡片；
 * 2. 去掉 large_cover / banner / ad / cm 等疑似非双栏卡片；
 * 3. 尽量保留普通双栏视频推荐。
 */

let body = $response.body;

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

function stringifyValues(obj) {
  const keys = [
    "card_type",
    "card_goto",
    "goto",
    "uri",
    "param",
    "title",
    "desc",
    "name",
    "cover",
    "cover_left_text_1",
    "cover_left_text_2",
    "cover_left_text_3",
    "cover_right_text",
    "rcmd_reason_style",
    "track_id"
  ];

  let values = [];

  for (const key of keys) {
    const value = obj?.[key];
    if (typeof value === "string" || typeof value === "number") {
      values.push(String(value));
    } else if (value && typeof value === "object") {
      try {
        values.push(JSON.stringify(value));
      } catch (_) {}
    }
  }

  return values.join(" ").toLowerCase();
}

function isAdLikeItem(item) {
  if (!item || typeof item !== "object") return false;

  // 常见广告字段
  if (item.ad_info) return true;
  if (item.ad) return true;
  if (item.cm) return true;
  if (item.creative_id) return true;
  if (item.creative_type) return true;
  if (item.card_goto === "ad") return true;
  if (item.goto === "ad") return true;

  const text = stringifyValues(item);

  // 常见广告 / 商业推广关键词
  const adKeywords = [
    "ad",
    "cm",
    "creative",
    "advertisement",
    "sponsor",
    "sponsored",
    "banner",
    "activity",
    "campaign",
    "mall",
    "shopping",
    "game_center",
    "vip"
  ];

  return adKeywords.some(keyword => text.includes(keyword));
}

function isLargeCoverItem(item, index) {
  if (!item || typeof item !== "object") return false;

  const text = stringifyValues(item);

  // B站首页大卡片常见类型
  const largeKeywords = [
    "large_cover",
    "large_cover_v1",
    "large_cover_v2",
    "large_cover_v3",
    "large_cover_v4",
    "large_cover_single",
    "large_cover_inline",
    "large_cover_ogv",
    "large_cover_autoplay",
    "large_cover_ugc"
  ];

  if (largeKeywords.some(keyword => text.includes(keyword))) {
    return true;
  }

  // 部分版本的大卡片可能用 banner / av / player 组合
  if (index === 0) {
    if (text.includes("banner")) return true;
    if (text.includes("inline") && text.includes("player")) return true;
    if (text.includes("autoplay")) return true;
  }

  return false;
}

function isTopFullWidthCard(item, index) {
  if (!item || typeof item !== "object") return false;

  // 只对前几条做更激进判断，避免误删后面的正常推荐
  if (index > 5) return false;

  const text = stringifyValues(item);

  // 顶部大卡片通常不是普通 small_cover，而是 large / banner / inline / autoplay
  if (text.includes("large_cover")) return true;
  if (text.includes("banner")) return true;
  if (text.includes("autoplay")) return true;
  if (text.includes("inline") && text.includes("player")) return true;

  return false;
}

function shouldRemoveFeedItem(item, index) {
  if (!item || typeof item !== "object") return false;

  if (isAdLikeItem(item)) return true;
  if (isLargeCoverItem(item, index)) return true;
  if (isTopFullWidthCard(item, index)) return true;

  return false;
}

function cleanFeedItems(items) {
  if (!Array.isArray(items)) return items;

  const originalLength = items.length;

  let cleaned = items.filter((item, index) => {
    return !shouldRemoveFeedItem(item, index);
  });

  // 保护逻辑：如果误删过多，就只执行最保守的 large_cover 删除
  if (originalLength > 0 && cleaned.length < Math.max(3, Math.floor(originalLength * 0.5))) {
    cleaned = items.filter((item) => {
      const text = stringifyValues(item);
      return !text.includes("large_cover");
    });
  }

  return cleaned;
}

function cleanObject(obj) {
  if (!obj || typeof obj !== "object") return obj;

  // 常见结构：obj.data.items
  if (Array.isArray(obj?.data?.items)) {
    obj.data.items = cleanFeedItems(obj.data.items);
  }

  // 兼容结构：obj.data.item
  if (Array.isArray(obj?.data?.item)) {
    obj.data.item = cleanFeedItems(obj.data.item);
  }

  // 兼容结构：obj.items
  if (Array.isArray(obj?.items)) {
    obj.items = cleanFeedItems(obj.items);
  }

  return obj;
}

try {
  let obj = safeParseJSON(body);

  if (obj) {
    obj = cleanObject(obj);
    body = JSON.stringify(obj);
  }
} catch (e) {
  console.log("BiliBili.feed.twocol error: " + e);
}

$done({ body });
