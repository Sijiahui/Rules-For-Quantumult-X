// ==UserScript==
// @ScriptName        BiliBili.feed.twocol
// @Author            @Sijiahui
// @Function          去除哔哩哔哩首页推荐顶部大卡片/轮播卡片，尽量保留双栏视频推荐
// @TargetURL         https://app.bilibili.com/x/v2/feed/index
// @UpdateTime        2026-06-07
// @Version           2.0
// ==/UserScript==

let body = $response.body;

function parseJSON(str) {
  try {
    return JSON.parse(str);
  } catch (_) {
    return null;
  }
}

function toText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase();
  }
  try {
    return JSON.stringify(value).toLowerCase();
  } catch (_) {
    return "";
  }
}

function collectItemText(item) {
  if (!item || typeof item !== "object") return "";

  const fields = [
    "card_type",
    "card_goto",
    "goto",
    "type",
    "uri",
    "param",
    "title",
    "desc",
    "cover",
    "track_id",
    "from_type",
    "source",
    "style",
    "pos_rec_unique_id"
  ];

  let arr = [];

  for (const key of fields) {
    if (item[key] !== undefined) arr.push(toText(item[key]));
  }

  if (item.args) arr.push(toText(item.args));
  if (item.ad_info) arr.push(toText(item.ad_info));
  if (item.banner_item) arr.push(toText(item.banner_item));
  if (item.banner) arr.push(toText(item.banner));
  if (item.rcmd_reason_style) arr.push(toText(item.rcmd_reason_style));

  return arr.join(" ");
}

function isNormalSmallVideo(item) {
  if (!item || typeof item !== "object") return false;

  const cardType = toText(item.card_type);
  const cardGoto = toText(item.card_goto);
  const gotoValue = toText(item.goto);

  // 普通双栏视频常见形态
  if (cardType.includes("small_cover") && !cardType.includes("large")) return true;

  // 有些版本 card_type 不稳定，但普通视频一般是 av / video
  if ((cardGoto === "av" || cardGoto === "video") && !collectItemText(item).includes("large_cover")) {
    return true;
  }

  if ((gotoValue === "av" || gotoValue === "video") && !collectItemText(item).includes("large_cover")) {
    return true;
  }

  return false;
}

function isTopLargeOrCarousel(item, index) {
  if (!item || typeof item !== "object") return false;

  const text = collectItemText(item);
  const cardType = toText(item.card_type);
  const cardGoto = toText(item.card_goto);
  const gotoValue = toText(item.goto);

  // 明确的大卡片 / 轮播 / 横幅
  const badTypes = [
    "large_cover",
    "large_cover_v1",
    "large_cover_v2",
    "large_cover_v3",
    "large_cover_v4",
    "large_cover_single",
    "large_cover_inline",
    "large_cover_autoplay",
    "large_cover_ogv",
    "large_cover_ugc",
    "banner",
    "carousel",
    "inline_av",
    "player",
    "live_rcmd",
    "storys",
    "rank",
    "special",
    "activity"
  ];

  if (badTypes.some(k => cardType.includes(k))) return true;
  if (badTypes.some(k => cardGoto.includes(k))) return true;
  if (badTypes.some(k => gotoValue.includes(k))) return true;
  if (badTypes.some(k => text.includes(k))) return true;

  // 截图里这种顶部横向大卡片通常只出现在前几项
  if (index <= 3) {
    if (!isNormalSmallVideo(item)) return true;
    if (text.includes("autoplay")) return true;
    if (text.includes("inline") && text.includes("player")) return true;
  }

  return false;
}

function isAdItem(item) {
  if (!item || typeof item !== "object") return false;

  if (item.ad_info) return true;
  if (item.ad) return true;
  if (item.cm) return true;
  if (item.creative_id) return true;
  if (item.creative_type) return true;
  if (item.card_goto === "ad") return true;
  if (item.goto === "ad") return true;

  const text = collectItemText(item);

  const adWords = [
    "advertisement",
    "sponsor",
    "sponsored",
    "creative",
    "campaign",
    "shopping",
    "mall",
    "game_center"
  ];

  return adWords.some(k => text.includes(k));
}

function shouldRemove(item, index) {
  if (!item || typeof item !== "object") return false;

  // 首页大卡片/轮播优先删
  if (isTopLargeOrCarousel(item, index)) return true;

  // 广告项删除
  if (isAdItem(item)) return true;

  return false;
}

function cleanItems(items) {
  if (!Array.isArray(items)) return items;

  const original = items.slice();

  let cleaned = original.filter((item, index) => !shouldRemove(item, index));

  // 如果第一项仍然不是普通双栏视频，继续删前置异常卡片
  while (cleaned.length > 0 && !isNormalSmallVideo(cleaned[0])) {
    const firstText = collectItemText(cleaned[0]);

    if (
      firstText.includes("large_cover") ||
      firstText.includes("banner") ||
      firstText.includes("carousel") ||
      firstText.includes("autoplay") ||
      firstText.includes("inline") ||
      firstText.includes("activity") ||
      firstText.includes("special")
    ) {
      cleaned.shift();
    } else {
      break;
    }
  }

  // 保护：如果误删超过一半，只执行最保守删除
  if (original.length >= 6 && cleaned.length < Math.floor(original.length * 0.5)) {
    cleaned = original.filter((item, index) => {
      const text = collectItemText(item);
      if (index <= 3 && text.includes("large_cover")) return false;
      if (index <= 3 && text.includes("banner")) return false;
      if (index <= 3 && text.includes("carousel")) return false;
      if (isAdItem(item)) return false;
      return true;
    });
  }

  return cleaned;
}

function cleanDataObject(obj) {
  if (!obj || typeof obj !== "object") return obj;

  // B站首页推荐常见结构
  if (Array.isArray(obj?.data?.items)) {
    obj.data.items = cleanItems(obj.data.items);
  }

  if (Array.isArray(obj?.data?.item)) {
    obj.data.item = cleanItems(obj.data.item);
  }

  if (Array.isArray(obj?.data?.cards)) {
    obj.data.cards = cleanItems(obj.data.cards);
  }

  if (Array.isArray(obj?.items)) {
    obj.items = cleanItems(obj.items);
  }

  if (Array.isArray(obj?.item)) {
    obj.item = cleanItems(obj.item);
  }

  return obj;
}

try {
  const obj = parseJSON(body);

  if (obj) {
    const cleaned = cleanDataObject(obj);
    body = JSON.stringify(cleaned);
  }
} catch (e) {
  console.log("[BiliBili.feed.twocol] error: " + e);
}

$done({ body });
