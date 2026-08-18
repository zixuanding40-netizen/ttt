import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

async function main() {
console.log("starting deck build");

const OUT = "D:/codes/movie/影迹_CineList_系统演示.pptx";
const PREVIEW_DIR = "D:/codes/movie/.ppt-build/rendered";

const W = 1280;
const H = 720;
const C = {
  bg: "#F6F3ED",
  paper: "#FFFEFA",
  ink: "#17211D",
  muted: "#5C6A62",
  green: "#0D6549",
  green2: "#17352D",
  line: "#DCD8CE",
  pale: "#EEF4EF",
  gold: "#C1861B",
};

function addText(slide, text, x, y, w, h, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: style.fontSize ?? 24,
    bold: style.bold ?? false,
    color: style.color ?? C.ink,
    alignment: style.alignment ?? "left",
    ...style,
  };
  return shape;
}

function addBox(slide, x, y, w, h, fill = C.paper, line = C.line) {
  return slide.shapes.add({
    geometry: "roundRect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { style: "solid", fill: line, width: 1 },
    borderRadius: "rounded-md",
  });
}

function addRule(slide, x, y, w, color = C.green) {
  slide.shapes.add({
    geometry: "rect",
    position: { left: x, top: y, width: w, height: 4 },
    fill: color,
    line: { style: "solid", fill: color, width: 0 },
  });
}

function titleSlide(p, title, subtitle) {
  const slide = p.slides.add();
  slide.background.fill = C.bg;
  addBox(slide, 76, 68, 1128, 584, C.paper, C.line);
  addText(slide, "影迹 CineList", 120, 116, 420, 42, { fontSize: 26, bold: true, color: C.green });
  addRule(slide, 120, 166, 118);
  addText(slide, title, 120, 226, 820, 174, { fontSize: 62, bold: true, color: C.ink });
  addText(slide, subtitle, 124, 438, 740, 82, { fontSize: 25, color: C.muted });
  addBox(slide, 946, 176, 156, 210, C.green2, C.green2);
  addText(slide, "影", 982, 212, 82, 86, { fontSize: 58, bold: true, color: "#FFFFFF", alignment: "center" });
  addText(slide, "片单 · 推荐 · 账号", 904, 424, 260, 34, { fontSize: 22, bold: true, color: C.green });
  addText(slide, "系统演示汇报", 904, 462, 260, 30, { fontSize: 18, color: C.muted });
}

function sectionTitle(slide, eyebrow, title, subtitle = "") {
  addText(slide, eyebrow, 72, 48, 520, 28, { fontSize: 16, bold: true, color: C.green });
  addText(slide, title, 72, 88, 940, 70, { fontSize: 42, bold: true, color: C.ink });
  if (subtitle) addText(slide, subtitle, 74, 160, 920, 40, { fontSize: 20, color: C.muted });
}

function footer(slide, n) {
  addText(slide, `影迹 CineList · ${String(n).padStart(2, "0")}`, 72, 674, 260, 24, {
    fontSize: 14,
    color: "#7A847E",
  });
}

function bullet(slide, x, y, text, highlight = false) {
  slide.shapes.add({
    geometry: "ellipse",
    position: { left: x, top: y + 8, width: 10, height: 10 },
    fill: highlight ? C.green : "#A8B3AD",
    line: { style: "solid", fill: "none", width: 0 },
  });
  addText(slide, text, x + 24, y, 430, 44, {
    fontSize: 22,
    color: highlight ? C.ink : C.muted,
    bold: highlight,
  });
}

function addNotes(slide, notes) {
  slide.notes = notes + "\n\n[Sources]\n内容来自本项目实际开发过程、部署记录与用户提供的影迹系统需求；未使用外部事实性资料。";
}

const p = Presentation.create({ slideSize: { width: W, height: H } });
console.log("presentation created");

titleSlide(
  p,
  "影迹：从个人片单到多人观影账号系统",
  "一个面向同学与个人用户的观影记录、选片推荐与账号数据保存网站。"
);
addNotes(p.slides.items[0], "开场介绍项目名称、演示目标和系统定位。");

{
  const slide = p.slides.add();
  slide.background.fill = C.bg;
  sectionTitle(slide, "01 / 系统定位", "影迹解决的是“想看很多，但管理很散”的问题", "把片单、进度、评分、平台入口和个人偏好收拢到一个地方。");
  addBox(slide, 80, 236, 320, 260, C.paper);
  addText(slide, "面向群体", 112, 268, 220, 32, { fontSize: 26, bold: true, color: C.green });
  bullet(slide, 112, 324, "普通观影用户", true);
  bullet(slide, 112, 374, "同学朋友群体");
  bullet(slide, 112, 424, "需要记录观影习惯的人");
  addBox(slide, 480, 236, 320, 260, C.paper);
  addText(slide, "核心问题", 512, 268, 220, 32, { fontSize: 26, bold: true, color: C.green });
  bullet(slide, 512, 324, "想看内容容易忘");
  bullet(slide, 512, 374, "进度和评分分散");
  bullet(slide, 512, 424, "不知道今晚看什么", true);
  addBox(slide, 880, 236, 320, 260, C.green2, C.green2);
  addText(slide, "系统目标", 912, 268, 220, 32, { fontSize: 26, bold: true, color: "#FFFFFF" });
  addText(slide, "让用户更快决定看什么，并长期保留自己的观影轨迹。", 912, 332, 236, 112, { fontSize: 26, bold: true, color: "#FFFFFF" });
  footer(slide, 2);
  addNotes(slide, "说明系统面向谁、痛点是什么，以及影迹要解决的核心任务。");
}

{
  const slide = p.slides.add();
  slide.background.fill = C.paper;
  sectionTitle(slide, "02 / 功能总览", "系统围绕“记录、选择、回顾、共享”组织功能", "注册用户保存到 SQL Server，游客用户可以免登录体验。");
  const items = [
    ["片单管理", "新增影片、状态、优先级、评分和短评"],
    ["快速选片", "按时间、心情、平台和类型推荐"],
    ["观看进度", "记录继续观看和播放进度"],
    ["个人总结", "统计数量、时长、评分和偏好"],
    ["账号系统", "注册登录，数据按用户保存"],
    ["游客访问", "无需登录，本机浏览器临时体验"],
  ];
  items.forEach(([h, b], i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 86 + col * 386;
    const y = 238 + row * 160;
    addBox(slide, x, y, 320, 112, i === 5 ? C.pale : "#FFFFFF");
    addText(slide, h, x + 24, y + 22, 240, 30, { fontSize: 25, bold: true, color: i === 5 ? C.green : C.ink });
    addText(slide, b, x + 24, y + 58, 260, 34, { fontSize: 17, color: C.muted });
  });
  footer(slide, 3);
  addNotes(slide, "快速扫过核心功能，突出新加入的游客访问和账号保存能力。");
}

{
  const slide = p.slides.add();
  slide.background.fill = C.bg;
  sectionTitle(slide, "03 / 演示路径", "现场实操按一条用户旅程展开", "从进入网站开始，展示游客体验和登录用户能力。");
  const steps = [
    "打开网站",
    "选择游客或登录",
    "管理我的片单",
    "快速选片推荐",
    "查看排行榜与总结",
    "账号数据保存",
  ];
  steps.forEach((s, i) => {
    const x = 96 + i * 186;
    addBox(slide, x, 308, 138, 118, i === 1 ? C.green : C.paper, i === 1 ? C.green : C.line);
    addText(slide, String(i + 1), x + 18, 326, 46, 40, { fontSize: 30, bold: true, color: i === 1 ? "#FFFFFF" : C.green });
    addText(slide, s, x + 18, 374, 102, 42, { fontSize: 19, bold: true, color: i === 1 ? "#FFFFFF" : C.ink });
    if (i < steps.length - 1) addRule(slide, x + 142, 362, 36, "#B8BCC4");
  });
  addText(slide, "演示建议：先点“跳过登录，以游客身份访问”，再展示注册登录的数据保存差异。", 110, 500, 880, 42, { fontSize: 23, bold: true, color: C.green });
  footer(slide, 4);
  addNotes(slide, "这一页作为实操前的路线图。");
}

{
  const slide = p.slides.add();
  slide.background.fill = C.paper;
  sectionTitle(slide, "04 / 关键页面", "首页承担“快速决策”的入口角色", "用户可以搜索影片、继续观看、进入片单管理或快速选片。");
  addBox(slide, 90, 226, 700, 330, C.pale);
  addText(slide, "今晚看什么，交给一张会记忆的片单。", 132, 268, 560, 116, { fontSize: 46, bold: true, color: C.ink });
  addBox(slide, 132, 418, 420, 48, "#FFFFFF");
  addText(slide, "搜索影片、类型或英文名", 154, 431, 250, 24, { fontSize: 18, color: C.muted });
  addBox(slide, 568, 418, 58, 48, C.green, C.green);
  addText(slide, "搜", 583, 426, 30, 24, { fontSize: 20, bold: true, color: "#FFFFFF", alignment: "center" });
  addBox(slide, 850, 226, 300, 330, C.paper);
  addText(slide, "首页展示重点", 884, 260, 220, 32, { fontSize: 27, bold: true, color: C.green });
  bullet(slide, 884, 326, "继续观看进度");
  bullet(slide, 884, 376, "评分与热度榜");
  bullet(slide, 884, 426, "快速选片入口", true);
  footer(slide, 5);
  addNotes(slide, "用抽象界面块展示首页，不依赖截图也能讲清功能。");
}

{
  const slide = p.slides.add();
  slide.background.fill = C.bg;
  sectionTitle(slide, "05 / 数据保存", "登录用户和游客用户的数据边界清晰", "这让临时体验和长期使用可以同时存在。");
  addBox(slide, 112, 236, 456, 300, C.paper);
  addText(slide, "注册 / 登录用户", 152, 274, 300, 36, { fontSize: 30, bold: true, color: C.green });
  bullet(slide, 152, 340, "JWT 保持登录状态", true);
  bullet(slide, 152, 390, "数据同步到 SQL Server");
  bullet(slide, 152, 440, "不同用户数据互不影响");
  addBox(slide, 712, 236, 456, 300, C.paper);
  addText(slide, "游客访问", 752, 274, 300, 36, { fontSize: 30, bold: true, color: C.gold });
  bullet(slide, 752, 340, "无需注册，直接体验", true);
  bullet(slide, 752, 390, "数据只保存在当前浏览器");
  bullet(slide, 752, 440, "适合演示和临时使用");
  footer(slide, 6);
  addNotes(slide, "解释为什么要加游客模式，以及和登录模式的数据保存差异。");
}

{
  const slide = p.slides.add();
  slide.background.fill = C.paper;
  sectionTitle(slide, "06 / 技术架构", "前端、后端、数据库由 Nginx 串联成公网服务", "本地开发验证后，再把发布物部署到 Windows Server。");
  const nodes = [
    ["用户浏览器", "访问公网 IP"],
    ["Nginx", "托管 dist / 代理 API"],
    ["Express API", "注册登录 / 状态读写"],
    ["SQL Server", "Users / UserAppStates"],
  ];
  nodes.forEach(([h, b], i) => {
    const x = 88 + i * 292;
    addBox(slide, x, 292, 220, 124, i === 1 ? C.green : C.pale, i === 1 ? C.green : C.line);
    addText(slide, h, x + 24, 318, 170, 30, { fontSize: 25, bold: true, color: i === 1 ? "#FFFFFF" : C.ink });
    addText(slide, b, x + 24, 360, 170, 36, { fontSize: 17, color: i === 1 ? "#EAF4EE" : C.muted });
    if (i < nodes.length - 1) addText(slide, "→", x + 236, 330, 48, 50, { fontSize: 40, bold: true, color: C.green });
  });
  addText(slide, "核心技术：React + TypeScript + Vite / Node.js + Express / SQL Server / Nginx", 104, 500, 920, 36, { fontSize: 23, bold: true, color: C.ink });
  footer(slide, 7);
  addNotes(slide, "讲解系统组件和部署关系。");
}

{
  const slide = p.slides.add();
  slide.background.fill = C.bg;
  sectionTitle(slide, "07 / 当前成果", "影迹已经从静态页面升级为可多人使用的网站", "系统完成了公网访问、账号保存和游客体验三条关键链路。");
  const metrics = [
    ["公网访问", "已完成"],
    ["注册登录", "已接入"],
    ["SQL 保存", "已验证"],
    ["游客访问", "已新增"],
  ];
  metrics.forEach(([h, v], i) => {
    const x = 104 + i * 282;
    addBox(slide, x, 278, 220, 150, C.paper);
    addText(slide, v, x + 26, 308, 150, 54, { fontSize: 38, bold: true, color: C.green });
    addText(slide, h, x + 26, 376, 150, 30, { fontSize: 22, color: C.muted });
  });
  addText(slide, "从“本机 localStorage 原型”到“服务器数据库保存”，系统边界已经完成一次关键升级。", 112, 512, 900, 42, { fontSize: 25, bold: true, color: C.ink });
  footer(slide, 8);
  addNotes(slide, "总结已经完成的功能成果。");
}

{
  const slide = p.slides.add();
  slide.background.fill = C.paper;
  sectionTitle(slide, "08 / 仍然不足", "系统可用，但还不是完整的产品级平台", "当前短板集中在账号能力、数据模型、实时协作和部署自动化。");
  const gaps = [
    "游客数据不能跨设备保存",
    "缺少找回密码和修改密码",
    "用户状态仍以 JSON 整体保存",
    "一起看还没有 WebSocket 实时同步",
    "缺少管理员后台和自动化部署",
  ];
  gaps.forEach((g, i) => bullet(slide, 126, 236 + i * 62, g, i === 2));
  addBox(slide, 778, 256, 330, 230, C.green2, C.green2);
  addText(slide, "判断", 814, 292, 150, 34, { fontSize: 28, bold: true, color: "#FFFFFF" });
  addText(slide, "现在适合课程演示和小范围试用，下一步要补齐长期运营能力。", 814, 350, 250, 94, { fontSize: 24, bold: true, color: "#FFFFFF" });
  footer(slide, 9);
  addNotes(slide, "客观说明不足，避免只展示优点。");
}

{
  const slide = p.slides.add();
  slide.background.fill = C.bg;
  sectionTitle(slide, "09 / 优化计划", "下一阶段把影迹从可用推向更稳定、更智能", "优先处理账号完整性、数据结构和多人协作。");
  const roadmap = [
    ["近期", "完善密码修改、找回密码、游客数据导入账号"],
    ["中期", "拆分电影、评分、记录等业务表，支持更细统计"],
    ["后期", "WebSocket 共看房间、管理员后台、自动化部署"],
  ];
  roadmap.forEach(([h, b], i) => {
    const y = 240 + i * 120;
    addText(slide, h, 116, y + 18, 110, 34, { fontSize: 28, bold: true, color: C.green });
    addBox(slide, 248, y, 820, 78, C.paper);
    addText(slide, b, 282, y + 22, 720, 30, { fontSize: 23, color: C.ink });
  });
  footer(slide, 10);
  addNotes(slide, "展示后续工作计划。");
}

{
  const slide = p.slides.add();
  slide.background.fill = C.green2;
  addText(slide, "结论", 86, 74, 240, 38, { fontSize: 25, bold: true, color: "#BFE4D5" });
  addText(slide, "影迹已经具备完整演示闭环", 86, 156, 760, 80, { fontSize: 54, bold: true, color: "#FFFFFF" });
  addText(slide, "它能展示一个观影管理系统如何从个人片单工具，逐步演进为支持账号、数据库和公网访问的多人网站。", 90, 270, 820, 86, { fontSize: 26, color: "#EAF4EE" });
  addBox(slide, 90, 430, 300, 84, "#FFFFFF", "#FFFFFF");
  addText(slide, "立即演示", 120, 452, 200, 30, { fontSize: 26, bold: true, color: C.green });
  addText(slide, "http://8.210.26.129", 120, 486, 220, 22, { fontSize: 18, color: C.muted });
  footer(slide, 11);
  addNotes(slide, "收束演示，给出访问地址。");
}

await fs.mkdir(PREVIEW_DIR, { recursive: true });
console.log("slides created", p.slides.items.length);
const pptx = await PresentationFile.exportPptx(p);
await pptx.save(OUT);
console.log(OUT);
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
