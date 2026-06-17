/***********************************************
> 应用名称：哔哩哔哩广告净化轻量脚本
> 脚本用途：开屏、首页推荐、入口净化；过滤首页推荐中的“漫剧”卡片
***********************************************/

const body = $response.body;
const url = $request.url;
const blockedFeedKeywords = ["漫剧"];

function hasBlockedKeyword(item) {
  const text = JSON.stringify(item || {});
  return blockedFeedKeywords.some((keyword) => text.includes(keyword));
}

function cleanFeedItems(items = []) {
  return items.filter((item) => {
    if (item?.banner_item) return false;
    if (item?.ad_info) return false;
    if (item?.card_goto?.includes("ad")) return false;
    if (hasBlockedKeyword(item)) return false;
    return ["small_cover_v2", "large_cover_v1", "large_cover_single_v9"].includes(item?.card_type);
  });
}

function cleanStoryItems(items = []) {
  return items.filter((item) => {
    if (item?.ad_info) return false;
    if (item?.card_goto?.includes("ad")) return false;
    if (hasBlockedKeyword(item)) return false;
    return true;
  });
}

if (!body) {
  $done({});
} else {
  try {
    const obj = JSON.parse(body);

    if (/^https:\/\/app\.bili(bili\.com|api\.net)\/x\/v2\/splash\/list/.test(url)) {
      if (obj.data?.list) {
        for (const item of obj.data.list) {
          item.duration = 0;
          item.begin_time = 2240150400;
          item.end_time = 2240150400;
        }
      }
    } else if (/^https?:\/\/app\.bili(bili\.com|api\.net)\/x\/v2\/feed\/index\?/.test(url)) {
      if (obj.data?.items) obj.data.items = cleanFeedItems(obj.data.items);
    } else if (/^https?:\/\/app\.bili(bili\.com|api\.net)\/x\/v2\/feed\/index\/story/.test(url)) {
      if (obj.data?.items) obj.data.items = cleanStoryItems(obj.data.items);
    } else if (/^https?:\/\/app\.bilibili\.com\/x\/resource\/top\/activity/.test(url)) {
      if (obj.data) {
        obj.data.hash = "Sijiahui";
        if (obj.data.online) obj.data.online.icon = "";
      }
    } else if (/^https?:\/\/app\.bilibili\.com\/x\/resource\/show\/tab/.test(url)) {
      const bottomIds = new Set([177, 178, 179, 181, 102, 104, 106, 486, 488, 489]);
      if (obj.data?.tab) {
        const tabs = [
          { id: 39, name: "直播", uri: "bilibili://live/home", tab_id: "直播tab", pos: 1 },
          { id: 40, name: "推荐", uri: "bilibili://pegasus/promo", tab_id: "推荐tab", pos: 2, default_selected: 1 },
        ];
        if (JSON.stringify(obj.data.tab).includes("pgc/bangumi_v2")) {
          tabs.push({ id: 3502, name: "番剧", uri: "bilibili://pgc/bangumi_v2", tab_id: "bangumi", pos: 3 });
        } else {
          tabs.push({ id: 545, name: "动画", uri: "bilibili://pgc/home", tab_id: "bangumi", pos: 3 });
        }
        tabs.push(
          { id: 41, name: "热门", uri: "bilibili://pegasus/hottopic", tab_id: "hottopic", pos: 4 },
          { id: 151, name: "影视", uri: "bilibili://pgc/cinema-tab", tab_id: "film", pos: 5 },
        );
        obj.data.tab = tabs;
      }
      if (obj.data?.top) {
        obj.data.top = [{
          id: 481,
          icon: "http://i0.hdslb.com/bfs/archive/d43047538e72c9ed8fd8e4e34415fbe3a4f632cb.png",
          name: "消息",
          uri: "bilibili://link/im_home",
          tab_id: "消息Top",
          pos: 1,
        }];
      }
      if (obj.data?.bottom) obj.data.bottom = obj.data.bottom.filter((item) => bottomIds.has(item.id));
    }

    $done({ body: JSON.stringify(obj) });
  } catch (error) {
    console.log(`BiliBili.lite error: ${error}`);
    $done({});
  }
}
