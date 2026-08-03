import { createRequire } from "module";
import { mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
let playwrightCore;
try {
  playwrightCore = require.resolve("playwright-core");
} catch {
  playwrightCore = process.env.PLAYWRIGHT_CORE;
}
if (!playwrightCore) {
  console.error("playwright-core not found. Install it or set PLAYWRIGHT_CORE to its module path.");
  process.exit(1);
}
const { chromium } = require(playwrightCore);

const OUT_DIR = process.env.STYLE_SHOT_OUT || "docs/style-iter/history";
mkdirSync(OUT_DIR, { recursive: true });

const TITLES = [
  "【命运石之门】牧濑红莉栖的 1000 次时间跳跃",
  "B站UP主年度总结：2025 我们看过的那些视频",
  "如何用一台旧电脑搭建未来的时间机器实验室",
  "命运石之门 0 剧情解析：β世界线的选择",
  "Steins;Gate 世界线收束理论全解读",
  "未来道具研究所日常：香蕉微波炉实验",
  "El Psy Kongroo：那些年我们追过的番剧",
  "从零开始制作 CRT 显示器的辉光管时钟",
  "动画中的科学：时间旅行真的可能吗？",
  "Lab Mem 001 的观测日志：Reading Steiner 记录",
  "B站收藏夹整理技巧：从 2000 条到 200 条",
  "AI 视角看老番：为什么经典永远值得重看",
  "深夜电台：聊聊那些改变世界线的瞬间",
  "穿越世界线的少女：剧场版观影笔记",
  "打工战士的笔记本：时间悖论入门",
  "世界线变动率 1.048596 的日常",
  "关于我转生成时间机器这件事",
  "Steins;Gate 系列音乐赏析：Hacking to the Gate",
  "命运石之门：比翼恋理之爱人设解析",
  "用 Python 复刻 Phone Microwave 的实验",
  "阿万音铃羽的打工日常 Vlog",
  "未来道具研究所年表：2009-2025",
  "红莉栖的咖啡机改造指南",
  "冈部伦太郎中二病语录合集",
  "世界线观测仪 DIY：自制 divergence meter",
  "Time Leap 实验记录：跳过失败的一天",
  "B站历史记录清理大作战",
  "从零认识 CRT 扫描线效果",
  "秋叶原电器街散步：寻找时间机器的零件",
  "命运石之门精选壁纸与封面合集",
];

const SOURCES = ["url", "fav", "local"];

function makeEntries() {
  const now = Date.now();
  return TITLES.map((title, i) => {
    const source = SOURCES[i % 3];
    return {
      id: String(1000 + i),
      created_at: now - i * 36e5 * 7 - (i % 5) * 36e5,
      source,
      url: "https://www.bilibili.com/video/BV1xx411c7mD",
      title,
      bvid: "BV1xx411c7mD",
      uploader: "未来道具研究所",
      duration: 842,
      cover: `https://picsum.photos/seed/bili-${i}/320/180`,
      summary: "",
      elapsed_ms: 82300 + i * 1234,
      template_name: "默认分析",
      status: "done",
      error_msg: "",
      starred: i % 7 === 0,
    };
  });
}

const MOCK = {
  invoke: async (cmd, args) => {
    if (cmd === "history_list") {
      return {
        entries: makeEntries(),
        total: 128,
        page: args?.page ?? 1,
        page_size: 30,
        total_pages: 5,
      };
    }
    if (cmd === "get_cookies_path") return "cookies.json";
    if (cmd === "read_cookies_file") return null;
    if (cmd === "plugin:event|listen") return 1;
    if (cmd === "plugin:event|unlisten") return null;
    return null;
  },
  transformCallback: () => 1,
  convertFileSrc: (p) => p,
};

const launchOptions = { headless: true };
if (process.env.CHROME_PATH) {
  launchOptions.executablePath = process.env.CHROME_PATH;
} else {
  launchOptions.channel = process.env.CHROME_CHANNEL || "chrome";
}
const browser = await chromium.launch(launchOptions);

for (const theme of ["dark", "light"]) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("console", (msg) => {
    const text = msg.text();
    if (text.includes("error") || text.includes("Error") || text.includes("invoke")) {
      console.log(`[console:${msg.type()}]`, text.slice(0, 300));
    }
  });
  page.on("pageerror", (err) => console.log("[pageerror]", String(err).slice(0, 500)));
  await page.addInitScript((theme) => {
    localStorage.setItem("theme", theme);
    const TITLES = [
      "【命运石之门】牧濑红莉栖的 1000 次时间跳跃",
      "B站UP主年度总结：2025 我们看过的那些视频",
      "如何用一台旧电脑搭建未来的时间机器实验室",
      "命运石之门 0 剧情解析：β世界线的选择",
      "Steins;Gate 世界线收束理论全解读",
      "未来道具研究所日常：香蕉微波炉实验",
      "El Psy Kongroo：那些年我们追过的番剧",
      "从零开始制作 CRT 显示器的辉光管时钟",
      "动画中的科学：时间旅行真的可能吗？",
      "Lab Mem 001 的观测日志：Reading Steiner 记录",
      "B站收藏夹整理技巧：从 2000 条到 200 条",
      "AI 视角看老番：为什么经典永远值得重看",
      "深夜电台：聊聊那些改变世界线的瞬间",
      "穿越世界线的少女：剧场版观影笔记",
      "打工战士的笔记本：时间悖论入门",
      "世界线变动率 1.048596 的日常",
      "关于我转生成时间机器这件事",
      "Steins;Gate 系列音乐赏析：Hacking to the Gate",
      "命运石之门：比翼恋理之爱人设解析",
      "用 Python 复刻 Phone Microwave 的实验",
      "阿万音铃羽的打工日常 Vlog",
      "未来道具研究所年表：2009-2025",
      "红莉栖的咖啡机改造指南",
      "冈部伦太郎中二病语录合集",
      "世界线观测仪 DIY：自制 divergence meter",
      "Time Leap 实验记录：跳过失败的一天",
      "B站历史记录清理大作战",
      "从零认识 CRT 扫描线效果",
      "秋叶原电器街散步：寻找时间机器的零件",
      "命运石之门精选壁纸与封面合集",
    ];
    const SOURCES = ["url", "fav", "local"];
    const now = Date.now();
    const entries = TITLES.map((title, i) => ({
      id: String(1000 + i),
      created_at: now - i * 36e5 * 7 - (i % 5) * 36e5,
      source: SOURCES[i % 3],
      url: "https://www.bilibili.com/video/BV1xx411c7mD",
      title,
      bvid: "BV1xx411c7mD",
      uploader: "未来道具研究所",
      duration: 842,
      cover: `https://picsum.photos/seed/bili-${i}/320/180`,
      summary: "",
      elapsed_ms: 82300 + i * 1234,
      template_name: "默认分析",
      status: "done",
      error_msg: "",
      starred: i % 7 === 0,
    }));
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        if (cmd === "history_list") {
          return {
            entries,
            total: 128,
            page: args?.page ?? 1,
            page_size: 30,
            total_pages: 5,
          };
        }
        if (cmd === "get_cookies_path") return "cookies.json";
        if (cmd === "read_cookies_file") return null;
        if (cmd === "plugin:event|listen") return 1;
        if (cmd === "plugin:event|unlisten") return null;
        return null;
      },
      transformCallback: () => 1,
      convertFileSrc: (p) => p,
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, theme);
  const devPort = process.env.DEV_PORT || "1420";
  await page.goto(`http://localhost:${devPort}/history`, { waitUntil: "networkidle" });
  try {
    await page.waitForSelector(".h-card", { timeout: 10000 });
  } catch (e) {
    console.log("[no cards]", await page.evaluate(() => document.body.innerText.slice(0, 800)));
    console.log("[tauri]", await page.evaluate(() => Object.keys(window.__TAURI_INTERNALS__ || {})));
    await page.screenshot({ path: path.join(OUT_DIR, `history-${theme}-fail.png`) });
    await page.close();
    continue;
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT_DIR, `history-${theme}-top.png`) });

  // Refresh micro-interaction: hold the request open to capture both states.
  await page.evaluate(() => {
    const orig = window.__TAURI_INTERNALS__.invoke;
    window.__TAURI_INTERNALS__.invoke = async (cmd, args) => {
      if (cmd === "history_list") await new Promise((r) => setTimeout(r, 1200));
      return orig(cmd, args);
    };
  });
  await page.locator(".refresh-btn").click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT_DIR, `history-${theme}-refreshing.png`) });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(OUT_DIR, `history-${theme}-refreshed.png`) });

  const scrollBox = await page.locator(".history-root").boundingBox();
  if (scrollBox) {
    await page.mouse.move(scrollBox.x + scrollBox.width - 5, scrollBox.y + 26);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, `history-${theme}-scrollbar.png`) });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(200);
  }
  await page.evaluate(() => {
    const el = document.querySelector(".history-root");
    if (el) el.scrollTop = el.scrollHeight;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, `history-${theme}-scroll.png`) });
  await page.close();
}

await browser.close();
console.log("screenshots done");
