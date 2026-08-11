import { FormEvent, useEffect, useMemo, useState } from "react";

type Tab = "home" | "library" | "picker" | "rankings" | "watch" | "party" | "summary" | "settings";
type MovieStatus = "想看" | "在看" | "已看" | "暂停" | "弃看";
type Priority = "很想看" | "有时间看" | "随缘看";
type ContentType = "电影" | "剧集" | "动漫" | "纪录片" | "综艺" | "短剧";
type Mood = "轻松" | "刺激" | "治愈" | "烧脑";
type Companion = "独自" | "情侣" | "朋友" | "家庭";

type PlatformAvailability = {
  platformName: string;
  region: string;
  watchType: string;
  url: string;
  lastCheckedAt: string;
  available: boolean;
};

type Movie = {
  id: string;
  title: string;
  alias: string;
  year: number;
  type: ContentType;
  genres: string[];
  durationMinutes: number;
  poster: string;
  summary: string;
  directors: string[];
  actors: string[];
  moods: Mood[];
  companions: Companion[];
  platforms: PlatformAvailability[];
};

type UserMovieRecord = {
  movieId: string;
  status: MovieStatus;
  priority: Priority;
  lists: string[];
  progress: number;
  rating: number;
  review: string;
  watchDate: string;
  watchPlatform: string;
  tags: string[];
  companions: Companion[];
  createdAt: string;
  updatedAt: string;
};

type UserProfile = {
  ageRange: string;
  gender: string;
  region: string;
  favoriteGenres: string[];
  commonPlatforms: string[];
  subtitleScale: number;
  manualSubtitle: boolean;
  privacySettings: {
    useAge: boolean;
    useGender: boolean;
  };
};

type AppState = {
  movies: Movie[];
  records: Record<string, UserMovieRecord>;
  profile: UserProfile;
};

type MovieForm = {
  title: string;
  alias: string;
  year: string;
  type: ContentType;
  genres: string;
  durationMinutes: string;
  poster: string;
  summary: string;
  directors: string;
  actors: string;
  platforms: string;
};

type PickerInput = {
  availableMinutes: number;
  mood: Mood;
  companion: Companion;
  platforms: string[];
  genres: string[];
  contentTypes: ContentType[];
};

type PlaybackStatus = "播放中" | "已暂停";

type PlaybackState = {
  status: PlaybackStatus;
  positionSeconds: number;
  playbackRate: number;
  updatedAt: string;
  updatedBy: string;
};

type ChatMessage = {
  id: string;
  author: string;
  text: string;
  createdAt: string;
};

type WatchRoom = {
  id: string;
  movieId: string;
  platformName: string;
  hostName: string;
  inviteLink: string;
  members: string[];
  playback: PlaybackState;
  messages: ChatMessage[];
};

type WatchRoomDraft = {
  movieId: string;
  platformName: string;
  hostName: string;
  friendName: string;
};

type WebSearchTarget = {
  name: string;
  description: string;
  url: string;
};

const STORAGE_KEY = "cinelist-mvp-state-v1";
const today = new Date().toISOString().slice(0, 10);

const genreOptions = [
  "剧情",
  "喜剧",
  "科幻",
  "悬疑",
  "动画",
  "纪录片",
  "爱情",
  "动作",
  "家庭",
  "治愈",
  "冒险",
  "犯罪",
  "历史",
  "奇幻",
  "传记",
  "综艺",
  "真人秀",
  "美食",
  "旅行",
  "音乐",
  "运动",
  "短剧",
  "甜宠",
  "逆袭",
  "都市",
];

const platformOptions = [
  "腾讯视频",
  "爱奇艺",
  "优酷",
  "哔哩哔哩",
  "芒果TV",
  "央视频",
  "红果短剧",
  "抖音短剧",
  "快手小剧场",
  "Netflix",
  "Disney+",
  "Apple TV+",
];

function platformSearchUrl(platformName: string, title: string) {
  const keyword = encodeURIComponent(title);
  const urls: Record<string, string> = {
    腾讯视频: `https://v.qq.com/x/search/?q=${keyword}`,
    爱奇艺: `https://so.iqiyi.com/so/q_${keyword}`,
    优酷: `https://so.youku.com/search_video?keyword=${keyword}`,
    哔哩哔哩: `https://search.bilibili.com/all?keyword=${keyword}`,
    芒果TV: `https://so.mgtv.com/so?k=${keyword}`,
    央视频: `https://www.yangshipin.cn/search?keyword=${keyword}`,
    红果短剧: `https://www.baidu.com/s?wd=${keyword}%20${encodeURIComponent("红果短剧")}`,
    抖音短剧: `https://www.douyin.com/search/${keyword}?type=general`,
    快手小剧场: `https://www.kuaishou.cn/theater/0`,
    Netflix: `https://www.netflix.com/search?q=${keyword}`,
    "Disney+": `https://www.disneyplus.com/search?q=${keyword}`,
    "Apple TV+": `https://tv.apple.com/search?term=${keyword}`,
  };
  return urls[platformName] ?? `https://www.baidu.com/s?wd=${keyword}%20${encodeURIComponent(platformName)}`;
}

function webSearchTargets(keyword: string): WebSearchTarget[] {
  const encoded = encodeURIComponent(keyword.trim());
  if (!encoded) return [];
  return [
    {
      name: "豆瓣电影",
      description: "查评分、简介、演员和影评",
      url: `https://search.douban.com/movie/subject_search?search_text=${encoded}`,
    },
    {
      name: "百度",
      description: "综合网页结果和百科信息",
      url: `https://www.baidu.com/s?wd=${encoded}%20电影`,
    },
    {
      name: "Bing",
      description: "综合网页和国际片名结果",
      url: `https://www.bing.com/search?q=${encoded}%20movie`,
    },
    ...platformOptions.map((platformName) => ({
      name: platformName,
      description: "搜索可观看入口",
      url: platformSearchUrl(platformName, keyword),
    })),
  ];
}

function makePlatform(platformName: string, title: string, watchType = "搜索入口"): PlatformAvailability {
  return {
    platformName,
    region: platformName === "Netflix" || platformName === "Disney+" || platformName === "Apple TV+" ? "全球部分地区" : "中国大陆",
    watchType,
    url: platformSearchUrl(platformName, title),
    lastCheckedAt: today,
    available: true,
  };
}

function playableUrl(platform: PlatformAvailability, title: string) {
  const homePages = new Set([
    "https://v.qq.com",
    "https://www.iqiyi.com",
    "https://www.disneyplus.com",
    "https://www.bilibili.com",
    "https://www.youku.com",
  ]);
  return homePages.has(platform.url.replace(/\/$/, "")) ? platformSearchUrl(platform.platformName, title) : platform.url;
}

const initialMovies: Movie[] = [
  {
    id: "m-1",
    title: "星际穿越",
    alias: "Interstellar",
    year: 2014,
    type: "电影",
    genres: ["科幻", "冒险", "剧情"],
    durationMinutes: 169,
    poster: "星",
    summary: "一支探险队穿越虫洞寻找人类的新家园，也重新理解亲情与时间。",
    directors: ["克里斯托弗·诺兰"],
    actors: ["马修·麦康纳", "安妮·海瑟薇"],
    moods: ["烧脑", "治愈"],
    companions: ["独自", "朋友"],
    platforms: [
      {
        platformName: "腾讯视频",
        region: "中国大陆",
        watchType: "会员",
        url: "https://v.qq.com",
        lastCheckedAt: "2026-08-11",
        available: true,
      },
      {
        platformName: "爱奇艺",
        region: "中国大陆",
        watchType: "会员",
        url: "https://www.iqiyi.com",
        lastCheckedAt: "2026-08-11",
        available: true,
      },
    ],
  },
  {
    id: "m-2",
    title: "心灵奇旅",
    alias: "Soul",
    year: 2020,
    type: "电影",
    genres: ["动画", "治愈", "喜剧"],
    durationMinutes: 101,
    poster: "心",
    summary: "一位爵士乐手在生命转角处重新发现日常的意义。",
    directors: ["彼特·道格特"],
    actors: ["杰米·福克斯", "蒂娜·菲"],
    moods: ["治愈", "轻松"],
    companions: ["家庭", "情侣", "朋友"],
    platforms: [
      {
        platformName: "Disney+",
        region: "全球部分地区",
        watchType: "会员",
        url: "https://www.disneyplus.com",
        lastCheckedAt: "2026-08-11",
        available: true,
      },
    ],
  },
  {
    id: "m-3",
    title: "隐秘的角落",
    alias: "The Bad Kids",
    year: 2020,
    type: "剧集",
    genres: ["悬疑", "犯罪", "剧情"],
    durationMinutes: 45,
    poster: "隐",
    summary: "三个孩子的一次意外目击，将几个家庭拖入无法回头的夏天。",
    directors: ["辛爽"],
    actors: ["秦昊", "王景春", "荣梓杉"],
    moods: ["烧脑", "刺激"],
    companions: ["独自", "朋友"],
    platforms: [
      {
        platformName: "爱奇艺",
        region: "中国大陆",
        watchType: "会员",
        url: "https://www.iqiyi.com",
        lastCheckedAt: "2026-08-11",
        available: true,
      },
    ],
  },
  {
    id: "m-4",
    title: "人生果实",
    alias: "Life Is Fruity",
    year: 2017,
    type: "纪录片",
    genres: ["纪录片", "治愈", "家庭"],
    durationMinutes: 91,
    poster: "果",
    summary: "一对老夫妇用缓慢、认真、彼此照料的生活，示范时间的温柔。",
    directors: ["伏原健之"],
    actors: ["津端修一", "津端英子"],
    moods: ["治愈", "轻松"],
    companions: ["家庭", "情侣", "独自"],
    platforms: [],
  },
  {
    id: "m-5",
    title: "疯狂动物城",
    alias: "Zootopia",
    year: 2016,
    type: "电影",
    genres: ["动画", "喜剧", "冒险"],
    durationMinutes: 108,
    poster: "城",
    summary: "一只兔子警官和一只狐狸搭档，在动物都市里侦破一桩大案。",
    directors: ["拜伦·霍华德", "瑞奇·摩尔"],
    actors: ["金妮弗·古德温", "杰森·贝特曼"],
    moods: ["轻松", "刺激"],
    companions: ["家庭", "朋友", "情侣"],
    platforms: [
      {
        platformName: "Disney+",
        region: "全球部分地区",
        watchType: "会员",
        url: "https://www.disneyplus.com",
        lastCheckedAt: "2026-08-11",
        available: true,
      },
      {
        platformName: "哔哩哔哩",
        region: "中国大陆",
        watchType: "会员",
        url: "https://www.bilibili.com",
        lastCheckedAt: "2026-08-11",
        available: true,
      },
    ],
  },
  {
    id: "m-6",
    title: "曼达洛人",
    alias: "The Mandalorian",
    year: 2019,
    type: "剧集",
    genres: ["科幻", "动作", "冒险"],
    durationMinutes: 38,
    poster: "曼",
    summary: "孤独赏金猎人在银河边缘护送神秘孩子，展开一次意外旅程。",
    directors: ["乔恩·费儒"],
    actors: ["佩德罗·帕斯卡"],
    moods: ["刺激", "轻松"],
    companions: ["独自", "朋友"],
    platforms: [
      {
        platformName: "Disney+",
        region: "全球部分地区",
        watchType: "会员",
        url: "https://www.disneyplus.com",
        lastCheckedAt: "2026-08-11",
        available: true,
      },
    ],
  },
  {
    id: "m-7",
    title: "繁花",
    alias: "Blossoms Shanghai",
    year: 2023,
    type: "剧集",
    genres: ["剧情", "爱情"],
    durationMinutes: 45,
    poster: "繁",
    summary: "上海浪潮中的商海浮沉、情感牵连与时代气息，适合慢慢追的一部剧。",
    directors: ["王家卫"],
    actors: ["胡歌", "马伊琍", "唐嫣"],
    moods: ["轻松", "治愈"],
    companions: ["独自", "情侣", "家庭"],
    platforms: [makePlatform("腾讯视频", "繁花", "会员/搜索入口"), makePlatform("央视频", "繁花")],
  },
  {
    id: "m-8",
    title: "三体",
    alias: "Three-Body",
    year: 2023,
    type: "剧集",
    genres: ["科幻", "悬疑", "剧情"],
    durationMinutes: 45,
    poster: "三",
    summary: "从科学边界到宇宙文明，适合想要沉浸式烧脑追剧的夜晚。",
    directors: ["杨磊"],
    actors: ["张鲁一", "于和伟", "陈瑾"],
    moods: ["烧脑", "刺激"],
    companions: ["独自", "朋友"],
    platforms: [makePlatform("腾讯视频", "三体", "会员/搜索入口"), makePlatform("Netflix", "3 Body Problem")],
  },
  {
    id: "m-9",
    title: "庆余年",
    alias: "Joy of Life",
    year: 2019,
    type: "剧集",
    genres: ["剧情", "喜剧", "冒险"],
    durationMinutes: 45,
    poster: "庆",
    summary: "轻喜剧外壳下的权谋故事，节奏轻快，适合朋友一起追。",
    directors: ["孙皓"],
    actors: ["张若昀", "李沁", "陈道明"],
    moods: ["轻松", "刺激"],
    companions: ["朋友", "家庭", "独自"],
    platforms: [makePlatform("腾讯视频", "庆余年", "会员/搜索入口"), makePlatform("爱奇艺", "庆余年")],
  },
  {
    id: "m-10",
    title: "狂飙",
    alias: "The Knockout",
    year: 2023,
    type: "剧集",
    genres: ["犯罪", "剧情", "悬疑"],
    durationMinutes: 45,
    poster: "飙",
    summary: "横跨多年的人物命运与扫黑叙事，强剧情、强冲突。",
    directors: ["徐纪周"],
    actors: ["张译", "张颂文", "李一桐"],
    moods: ["刺激", "烧脑"],
    companions: ["独自", "朋友"],
    platforms: [makePlatform("爱奇艺", "狂飙", "会员/搜索入口")],
  },
  {
    id: "m-11",
    title: "长安三万里",
    alias: "Chang An",
    year: 2023,
    type: "电影",
    genres: ["动画", "剧情", "历史"],
    durationMinutes: 168,
    poster: "长",
    summary: "以诗入梦，讲述大唐群星与高适、李白的生命交错。",
    directors: ["谢君伟", "邹靖"],
    actors: ["杨天翔", "凌振赫"],
    moods: ["治愈", "轻松"],
    companions: ["家庭", "朋友", "独自"],
    platforms: [makePlatform("优酷", "长安三万里", "付费/搜索入口"), makePlatform("腾讯视频", "长安三万里")],
  },
  {
    id: "m-12",
    title: "年会不能停！",
    alias: "Johnny Keep Walking!",
    year: 2023,
    type: "电影",
    genres: ["喜剧", "剧情"],
    durationMinutes: 117,
    poster: "年",
    summary: "职场错位喜剧，用轻松方式讲打工人的荒诞和爽感。",
    directors: ["董润年"],
    actors: ["大鹏", "白客", "庄达菲"],
    moods: ["轻松", "治愈"],
    companions: ["朋友", "情侣", "独自"],
    platforms: [makePlatform("哔哩哔哩", "年会不能停", "会员/搜索入口"), makePlatform("腾讯视频", "年会不能停")],
  },
  {
    id: "m-13",
    title: "流浪地球2",
    alias: "The Wandering Earth II",
    year: 2023,
    type: "电影",
    genres: ["科幻", "动作", "剧情"],
    durationMinutes: 173,
    poster: "球",
    summary: "太阳危机下的人类抉择与宏大工业科幻场面，适合长时间沉浸观看。",
    directors: ["郭帆"],
    actors: ["吴京", "刘德华", "李雪健"],
    moods: ["刺激", "烧脑"],
    companions: ["朋友", "家庭", "独自"],
    platforms: [makePlatform("腾讯视频", "流浪地球2", "会员/搜索入口"), makePlatform("爱奇艺", "流浪地球2"), makePlatform("优酷", "流浪地球2")],
  },
  {
    id: "m-14",
    title: "封神第一部",
    alias: "Creation of the Gods I",
    year: 2023,
    type: "电影",
    genres: ["动作", "冒险", "剧情"],
    durationMinutes: 148,
    poster: "封",
    summary: "神话史诗与战争冒险结合，适合想看大场面的观影场景。",
    directors: ["乌尔善"],
    actors: ["费翔", "李雪健", "黄渤"],
    moods: ["刺激"],
    companions: ["朋友", "家庭"],
    platforms: [makePlatform("腾讯视频", "封神第一部", "会员/搜索入口"), makePlatform("优酷", "封神第一部")],
  },
  {
    id: "m-15",
    title: "我的阿勒泰",
    alias: "To the Wonder",
    year: 2024,
    type: "剧集",
    genres: ["剧情", "治愈"],
    durationMinutes: 45,
    poster: "阿",
    summary: "草原、亲情与成长，气质清澈，适合放松或治愈心情。",
    directors: ["滕丛丛"],
    actors: ["马伊琍", "周依然", "于适"],
    moods: ["治愈", "轻松"],
    companions: ["独自", "情侣", "家庭"],
    platforms: [makePlatform("爱奇艺", "我的阿勒泰", "会员/搜索入口")],
  },
  {
    id: "m-16",
    title: "去有风的地方",
    alias: "Meet Yourself",
    year: 2023,
    type: "剧集",
    genres: ["治愈", "爱情", "剧情"],
    durationMinutes: 45,
    poster: "风",
    summary: "在云南小镇重新找回生活节奏，是非常适合减压的治愈剧。",
    directors: ["丁梓光"],
    actors: ["刘亦菲", "李现"],
    moods: ["治愈", "轻松"],
    companions: ["情侣", "家庭", "独自"],
    platforms: [makePlatform("芒果TV", "去有风的地方", "会员/搜索入口"), makePlatform("腾讯视频", "去有风的地方")],
  },
  {
    id: "m-17",
    title: "甄嬛传",
    alias: "Empresses in the Palace",
    year: 2011,
    type: "剧集",
    genres: ["剧情", "历史"],
    durationMinutes: 45,
    poster: "甄",
    summary: "经典宫廷群像与人物成长，适合长线重温和家庭观看。",
    directors: ["郑晓龙"],
    actors: ["孙俪", "陈建斌", "蔡少芬"],
    moods: ["烧脑", "治愈"],
    companions: ["独自", "家庭", "朋友"],
    platforms: [makePlatform("优酷", "甄嬛传", "会员/搜索入口"), makePlatform("腾讯视频", "甄嬛传")],
  },
  {
    id: "m-18",
    title: "中国奇谭",
    alias: "Yao-Chinese Folktales",
    year: 2023,
    type: "动漫",
    genres: ["动画", "奇幻", "剧情"],
    durationMinutes: 20,
    poster: "奇",
    summary: "短篇国风动画合集，单集时间短，适合 30 分钟碎片时间。",
    directors: ["陈廖宇"],
    actors: ["上海美术电影制片厂"],
    moods: ["轻松", "烧脑", "治愈"],
    companions: ["独自", "朋友", "家庭"],
    platforms: [makePlatform("哔哩哔哩", "中国奇谭", "会员/搜索入口")],
  },
  {
    id: "m-19",
    title: "人生第一次",
    alias: "The Firsts in Life",
    year: 2020,
    type: "纪录片",
    genres: ["纪录片", "家庭", "治愈"],
    durationMinutes: 35,
    poster: "初",
    summary: "记录出生、上学、成家、养老等人生节点，温柔真实。",
    directors: ["秦博"],
    actors: ["纪录片人物"],
    moods: ["治愈"],
    companions: ["家庭", "独自", "情侣"],
    platforms: [makePlatform("哔哩哔哩", "人生第一次", "免费观看/搜索入口"), makePlatform("腾讯视频", "人生第一次")],
  },
  {
    id: "m-20",
    title: "但是还有书籍",
    alias: "And Yet The Books",
    year: 2019,
    type: "纪录片",
    genres: ["纪录片", "治愈"],
    durationMinutes: 30,
    poster: "书",
    summary: "关于书、作者、编辑和读者的纪录片，适合安静独处时观看。",
    directors: ["罗颖鸾"],
    actors: ["胡歌"],
    moods: ["治愈", "轻松"],
    companions: ["独自", "朋友"],
    platforms: [makePlatform("哔哩哔哩", "但是还有书籍", "免费观看/搜索入口")],
  },
  {
    id: "m-21",
    title: "奥本海默",
    alias: "Oppenheimer",
    year: 2023,
    type: "电影",
    genres: ["剧情", "历史", "传记"],
    durationMinutes: 180,
    poster: "奥",
    summary: "关于科学、战争与道德选择的高密度传记电影。",
    directors: ["克里斯托弗·诺兰"],
    actors: ["基里安·墨菲", "艾米莉·布朗特"],
    moods: ["烧脑", "刺激"],
    companions: ["独自", "朋友"],
    platforms: [makePlatform("腾讯视频", "奥本海默", "付费/搜索入口"), makePlatform("Apple TV+", "Oppenheimer")],
  },
  {
    id: "m-22",
    title: "沙丘2",
    alias: "Dune: Part Two",
    year: 2024,
    type: "电影",
    genres: ["科幻", "冒险", "动作"],
    durationMinutes: 166,
    poster: "沙",
    summary: "宏大沙漠史诗续章，适合想看视觉奇观和复杂世界观的时段。",
    directors: ["丹尼斯·维伦纽瓦"],
    actors: ["提莫西·查拉梅", "赞达亚"],
    moods: ["刺激", "烧脑"],
    companions: ["朋友", "独自"],
    platforms: [makePlatform("腾讯视频", "沙丘2", "付费/搜索入口"), makePlatform("Apple TV+", "Dune Part Two")],
  },
  {
    id: "m-23",
    title: "葬送的芙莉莲",
    alias: "Frieren: Beyond Journey's End",
    year: 2023,
    type: "动漫",
    genres: ["动画", "冒险", "治愈"],
    durationMinutes: 24,
    poster: "芙",
    summary: "勇者旅程结束后的漫长后日谈，节奏舒缓又有余味。",
    directors: ["斋藤圭一郎"],
    actors: ["种崎敦美", "冈本信彦"],
    moods: ["治愈", "轻松"],
    companions: ["独自", "朋友"],
    platforms: [makePlatform("哔哩哔哩", "葬送的芙莉莲", "会员/搜索入口")],
  },
  {
    id: "m-24",
    title: "密室大逃脱",
    alias: "Great Escape",
    year: 2019,
    type: "综艺",
    genres: ["综艺", "真人秀", "悬疑", "刺激"],
    durationMinutes: 95,
    poster: "密",
    summary: "明星玩家进入大型实景密室，通过推理、协作和解谜完成逃脱任务，适合朋友一起看。",
    directors: [],
    actors: ["杨幂", "大张伟", "黄明昊"],
    moods: ["刺激", "烧脑"],
    companions: ["朋友", "情侣"],
    platforms: [makePlatform("芒果TV", "密室大逃脱", "会员/搜索入口"), makePlatform("腾讯视频", "密室大逃脱")],
  },
  {
    id: "m-25",
    title: "中餐厅",
    alias: "Chinese Restaurant",
    year: 2017,
    type: "综艺",
    genres: ["综艺", "真人秀", "美食", "旅行"],
    durationMinutes: 90,
    poster: "中",
    summary: "嘉宾在不同城市经营中餐厅，从备菜、待客到经营协作，轻松下饭又适合家庭观看。",
    directors: [],
    actors: ["黄晓明", "赵丽颖", "林述巍"],
    moods: ["轻松", "治愈"],
    companions: ["家庭", "朋友", "情侣"],
    platforms: [makePlatform("芒果TV", "中餐厅", "会员/搜索入口"), makePlatform("腾讯视频", "中餐厅")],
  },
  {
    id: "m-26",
    title: "向往的生活",
    alias: "Back to Field",
    year: 2017,
    type: "综艺",
    genres: ["综艺", "真人秀", "治愈", "美食"],
    durationMinutes: 95,
    poster: "向",
    summary: "在田园生活里做饭、聊天、待客，把慢节奏和烟火气放到屏幕前。",
    directors: [],
    actors: ["何炅", "黄磊", "彭昱畅", "张子枫"],
    moods: ["治愈", "轻松"],
    companions: ["家庭", "情侣", "朋友"],
    platforms: [makePlatform("芒果TV", "向往的生活", "会员/搜索入口"), makePlatform("腾讯视频", "向往的生活")],
  },
  {
    id: "m-27",
    title: "奔跑吧兄弟",
    alias: "Keep Running",
    year: 2014,
    type: "综艺",
    genres: ["综艺", "真人秀", "运动", "喜剧"],
    durationMinutes: 95,
    poster: "奔",
    summary: "经典户外竞技真人秀，游戏任务、团队对抗和嘉宾互动都很适合多人一起看。",
    directors: [],
    actors: ["邓超", "Angelababy", "李晨", "郑恺"],
    moods: ["轻松", "刺激"],
    companions: ["朋友", "家庭"],
    platforms: [makePlatform("爱奇艺", "奔跑吧兄弟", "会员/搜索入口"), makePlatform("腾讯视频", "奔跑吧兄弟"), makePlatform("优酷", "奔跑吧兄弟")],
  },
  {
    id: "m-28",
    title: "明星大侦探",
    alias: "Who's the Murderer",
    year: 2016,
    type: "综艺",
    genres: ["综艺", "真人秀", "悬疑", "烧脑"],
    durationMinutes: 100,
    poster: "侦",
    summary: "角色扮演式推理综艺，在案件故事里搜证、推理和投票，适合喜欢悬疑的人。",
    directors: [],
    actors: ["何炅", "撒贝宁", "白敬亭"],
    moods: ["烧脑", "刺激"],
    companions: ["朋友", "独自"],
    platforms: [makePlatform("芒果TV", "明星大侦探", "会员/搜索入口"), makePlatform("腾讯视频", "明星大侦探")],
  },
  {
    id: "m-29",
    title: "大侦探",
    alias: "Who's the Murderer",
    year: 2022,
    type: "综艺",
    genres: ["综艺", "真人秀", "悬疑", "烧脑"],
    durationMinutes: 100,
    poster: "大",
    summary: "延续沉浸式推理玩法，用更完整的故事场景和角色关系推进案件。",
    directors: [],
    actors: ["何炅", "张若昀", "大张伟"],
    moods: ["烧脑", "刺激"],
    companions: ["朋友", "独自"],
    platforms: [makePlatform("芒果TV", "大侦探", "会员/搜索入口"), makePlatform("腾讯视频", "大侦探")],
  },
  {
    id: "m-30",
    title: "极限挑战",
    alias: "Go Fighting!",
    year: 2015,
    type: "综艺",
    genres: ["综艺", "真人秀", "喜剧"],
    durationMinutes: 95,
    poster: "极",
    summary: "户外任务和嘉宾博弈结合的真人秀，节奏轻快、笑点密集。",
    directors: [],
    actors: ["黄渤", "孙红雷", "黄磊", "罗志祥"],
    moods: ["轻松", "刺激"],
    companions: ["朋友", "家庭"],
    platforms: [makePlatform("腾讯视频", "极限挑战", "会员/搜索入口"), makePlatform("优酷", "极限挑战"), makePlatform("爱奇艺", "极限挑战")],
  },
  {
    id: "m-31",
    title: "王牌对王牌",
    alias: "Ace vs Ace",
    year: 2016,
    type: "综艺",
    genres: ["综艺", "真人秀", "喜剧"],
    durationMinutes: 90,
    poster: "王",
    summary: "棚内游戏、经典剧组重聚和才艺互动为主，适合放松和家庭观看。",
    directors: [],
    actors: ["沈腾", "贾玲", "华晨宇", "关晓彤"],
    moods: ["轻松", "治愈"],
    companions: ["家庭", "朋友"],
    platforms: [makePlatform("腾讯视频", "王牌对王牌", "会员/搜索入口"), makePlatform("爱奇艺", "王牌对王牌"), makePlatform("优酷", "王牌对王牌")],
  },
  {
    id: "m-32",
    title: "你好，星期六",
    alias: "Hello Saturday",
    year: 2022,
    type: "综艺",
    genres: ["综艺", "真人秀", "喜剧"],
    durationMinutes: 90,
    poster: "六",
    summary: "周末棚内综艺，游戏互动和嘉宾舞台结合，适合碎片时间轻松看。",
    directors: [],
    actors: ["何炅", "檀健次", "李雪琴"],
    moods: ["轻松"],
    companions: ["朋友", "家庭"],
    platforms: [makePlatform("芒果TV", "你好星期六", "会员/搜索入口"), makePlatform("腾讯视频", "你好星期六")],
  },
  {
    id: "m-33",
    title: "声生不息",
    alias: "Infinity and Beyond",
    year: 2022,
    type: "综艺",
    genres: ["综艺", "音乐", "真人秀"],
    durationMinutes: 95,
    poster: "声",
    summary: "音乐竞演与经典歌曲重唱结合，适合喜欢舞台和华语音乐的人。",
    directors: [],
    actors: ["林子祥", "叶倩文", "李克勤"],
    moods: ["治愈", "轻松"],
    companions: ["独自", "家庭", "朋友"],
    platforms: [makePlatform("芒果TV", "声生不息", "会员/搜索入口"), makePlatform("腾讯视频", "声生不息")],
  },
  {
    id: "m-34",
    title: "快乐再出发",
    alias: "Go for Happiness",
    year: 2022,
    type: "综艺",
    genres: ["综艺", "真人秀", "旅行", "音乐"],
    durationMinutes: 80,
    poster: "快",
    summary: "老友旅行和音乐聊天交织，松弛、真诚，适合想找陪伴感的时候看。",
    directors: [],
    actors: ["陈楚生", "苏醒", "王栎鑫", "张远"],
    moods: ["治愈", "轻松"],
    companions: ["朋友", "独自"],
    platforms: [makePlatform("芒果TV", "快乐再出发", "会员/搜索入口"), makePlatform("腾讯视频", "快乐再出发"), makePlatform("哔哩哔哩", "快乐再出发")],
  },
  {
    id: "m-35",
    title: "种地吧",
    alias: "Become a Farmer",
    year: 2023,
    type: "综艺",
    genres: ["综艺", "真人秀", "治愈"],
    durationMinutes: 90,
    poster: "种",
    summary: "年轻人真实参与农业劳作和经营，成长线长、陪伴感强。",
    directors: [],
    actors: ["十个勤天"],
    moods: ["治愈", "轻松"],
    companions: ["独自", "朋友", "家庭"],
    platforms: [makePlatform("爱奇艺", "种地吧", "会员/搜索入口"), makePlatform("腾讯视频", "种地吧")],
  },
  {
    id: "m-36",
    title: "红果短剧",
    alias: "Hongguo Short Drama",
    year: 2024,
    type: "短剧",
    genres: ["短剧", "甜宠", "逆袭", "都市"],
    durationMinutes: 8,
    poster: "红",
    summary: "红果短剧平台入口，适合按甜宠、逆袭、都市、古装等关键词继续搜索短剧。",
    directors: [],
    actors: ["短剧演员"],
    moods: ["轻松", "刺激"],
    companions: ["独自", "朋友"],
    platforms: [makePlatform("红果短剧", "红果短剧", "免费/搜索入口"), makePlatform("抖音短剧", "红果短剧"), makePlatform("快手小剧场", "红果短剧")],
  },
  {
    id: "m-37",
    title: "闪婚后，傅先生马甲藏不住了",
    alias: "Hidden Identity After Marriage",
    year: 2024,
    type: "短剧",
    genres: ["短剧", "甜宠", "都市", "逆袭"],
    durationMinutes: 6,
    poster: "闪",
    summary: "甜宠都市短剧方向，适合想看高密度反转、轻松追完的碎片时间。",
    directors: [],
    actors: ["短剧演员"],
    moods: ["轻松", "刺激"],
    companions: ["独自", "情侣"],
    platforms: [makePlatform("红果短剧", "闪婚后 傅先生马甲藏不住了", "免费/搜索入口"), makePlatform("抖音短剧", "闪婚后 傅先生马甲藏不住了"), makePlatform("快手小剧场", "闪婚后 傅先生马甲藏不住了")],
  },
  {
    id: "m-38",
    title: "我在八零年代当后妈",
    alias: "Stepmother in the 1980s",
    year: 2024,
    type: "短剧",
    genres: ["短剧", "年代", "家庭", "逆袭"],
    durationMinutes: 7,
    poster: "八",
    summary: "年代家庭短剧方向，主打亲情、成长和爽感反转。",
    directors: [],
    actors: ["短剧演员"],
    moods: ["治愈", "轻松"],
    companions: ["独自", "家庭"],
    platforms: [makePlatform("红果短剧", "我在八零年代当后妈", "免费/搜索入口"), makePlatform("抖音短剧", "我在八零年代当后妈"), makePlatform("快手小剧场", "我在八零年代当后妈")],
  },
  {
    id: "m-39",
    title: "念念无明",
    alias: "The Killer Is Also Romantic",
    year: 2022,
    type: "短剧",
    genres: ["短剧", "古装", "爱情", "喜剧"],
    durationMinutes: 12,
    poster: "念",
    summary: "古装爱情短剧，单集短、节奏快，适合一口气追完。",
    directors: [],
    actors: ["胡丹丹", "杨泽"],
    moods: ["轻松", "刺激"],
    companions: ["情侣", "朋友"],
    platforms: [makePlatform("芒果TV", "念念无明", "会员/搜索入口"), makePlatform("腾讯视频", "念念无明"), makePlatform("红果短剧", "念念无明")],
  },
  {
    id: "m-40",
    title: "虚颜",
    alias: "A Familiar Stranger",
    year: 2022,
    type: "短剧",
    genres: ["短剧", "古装", "爱情", "悬疑"],
    durationMinutes: 12,
    poster: "虚",
    summary: "古装换脸设定短剧，爱情线和悬疑感并行，适合短时间沉浸追剧。",
    directors: [],
    actors: ["柯颖", "丞磊"],
    moods: ["刺激", "烧脑"],
    companions: ["独自", "情侣"],
    platforms: [makePlatform("芒果TV", "虚颜", "会员/搜索入口"), makePlatform("腾讯视频", "虚颜"), makePlatform("红果短剧", "虚颜")],
  },
  {
    id: "m-41",
    title: "招惹",
    alias: "Provoke",
    year: 2023,
    type: "短剧",
    genres: ["短剧", "爱情", "悬疑", "民国"],
    durationMinutes: 12,
    poster: "招",
    summary: "民国情感短剧，复仇、身份和爱情线交织，适合喜欢强剧情的人。",
    directors: [],
    actors: ["李沐宸", "赵弈钦"],
    moods: ["刺激", "烧脑"],
    companions: ["独自", "情侣"],
    platforms: [makePlatform("腾讯视频", "招惹 短剧", "会员/搜索入口"), makePlatform("优酷", "招惹 短剧"), makePlatform("红果短剧", "招惹")],
  },
  {
    id: "m-42",
    title: "全资进组",
    alias: "The Director Who Buys Me Dinner",
    year: 2023,
    type: "短剧",
    genres: ["短剧", "喜剧", "古装"],
    durationMinutes: 10,
    poster: "全",
    summary: "轻喜剧短剧，节奏松快，适合不想看太重剧情时随手打开。",
    directors: [],
    actors: ["陈腾跃", "屈梦汝"],
    moods: ["轻松"],
    companions: ["朋友", "独自"],
    platforms: [makePlatform("腾讯视频", "全资进组", "会员/搜索入口"), makePlatform("红果短剧", "全资进组"), makePlatform("抖音短剧", "全资进组")],
  },
  {
    id: "m-43",
    title: "风月变",
    alias: "Butterflied Lover",
    year: 2023,
    type: "短剧",
    genres: ["短剧", "古装", "奇幻", "爱情"],
    durationMinutes: 15,
    poster: "风",
    summary: "古装奇幻短剧，设定感强，适合喜欢爱情和悬念并重的观众。",
    directors: [],
    actors: ["吕小雨", "赵弈钦"],
    moods: ["刺激", "治愈"],
    companions: ["情侣", "独自"],
    platforms: [makePlatform("芒果TV", "风月变", "会员/搜索入口"), makePlatform("红果短剧", "风月变"), makePlatform("抖音短剧", "风月变")],
  },
  {
    id: "m-44",
    title: "授她以柄",
    alias: "Give Her a Crown",
    year: 2024,
    type: "短剧",
    genres: ["短剧", "古装", "爱情", "逆袭"],
    durationMinutes: 12,
    poster: "柄",
    summary: "古装权谋爱情短剧，主打关系拉扯和女性成长。",
    directors: [],
    actors: ["李菲", "明加加"],
    moods: ["刺激", "烧脑"],
    companions: ["独自", "情侣"],
    platforms: [makePlatform("腾讯视频", "授她以柄", "会员/搜索入口"), makePlatform("红果短剧", "授她以柄"), makePlatform("快手小剧场", "授她以柄")],
  },
  {
    id: "m-45",
    title: "短剧热榜：都市逆袭",
    alias: "Short Drama Hotlist: Urban Comeback",
    year: 2026,
    type: "短剧",
    genres: ["短剧", "都市", "逆袭", "爽剧"],
    durationMinutes: 5,
    poster: "逆",
    summary: "聚合都市逆袭类短剧搜索入口，适合按题材找红果、抖音、快手上的热门短剧。",
    directors: [],
    actors: ["短剧演员"],
    moods: ["刺激", "轻松"],
    companions: ["独自", "朋友"],
    platforms: [makePlatform("红果短剧", "都市逆袭短剧", "免费/搜索入口"), makePlatform("抖音短剧", "都市逆袭短剧"), makePlatform("快手小剧场", "都市逆袭短剧")],
  },
  {
    id: "m-46",
    title: "短剧热榜：甜宠言情",
    alias: "Short Drama Hotlist: Romance",
    year: 2026,
    type: "短剧",
    genres: ["短剧", "甜宠", "爱情", "都市"],
    durationMinutes: 5,
    poster: "甜",
    summary: "聚合甜宠言情类短剧搜索入口，适合快速跳到各平台找同类短剧。",
    directors: [],
    actors: ["短剧演员"],
    moods: ["轻松", "治愈"],
    companions: ["独自", "情侣"],
    platforms: [makePlatform("红果短剧", "甜宠言情短剧", "免费/搜索入口"), makePlatform("抖音短剧", "甜宠言情短剧"), makePlatform("快手小剧场", "甜宠言情短剧")],
  },
];

const expandedCatalogTitles = `
藏海传|剧集|2025|剧情,古装|肖战,张婧仪|腾讯视频,爱奇艺
赴山海|剧集|2025|武侠,古装,剧情|成毅,古力娜扎|腾讯视频,爱奇艺
国色芳华|剧集|2025|剧情,古装,爱情|杨紫,李现|芒果TV,腾讯视频
长安二十四计|剧集|2025|悬疑,古装|成毅,刘奕君|腾讯视频,爱奇艺
苦尽柑来遇见你|剧集|2025|剧情,历史,爱情|李知恩,朴宝剑|Netflix
天地剑心|剧集|2025|剧情,爱情,奇幻|成毅,李一桐|腾讯视频,爱奇艺
利剑·玫瑰|剧集|2025|犯罪,悬疑|迪丽热巴,金世佳|腾讯视频,爱奇艺
生万物|剧集|2025|剧情|杨幂,欧豪|爱奇艺,腾讯视频
难哄|剧集|2025|爱情,剧情|白敬亭,章若楠|优酷,腾讯视频
许我耀眼|剧集|2025|爱情,剧情|赵露思,陈伟霆|腾讯视频,Netflix
五福临门|剧集|2025|喜剧,古装|卢昱晓,王星越|芒果TV,腾讯视频
嘘，国王在冬眠|剧集|2025|爱情,剧情|虞书欣,林一|腾讯视频,爱奇艺
骄阳似我|剧集|2025|爱情,剧情|宋威龙,赵今麦|腾讯视频,优酷
花开锦绣|剧集|2026|剧情,古装|丁禹兮,邓恩熙|腾讯视频,爱奇艺
师兄太稳健|剧集|2026|剧情,奇幻,古装|敖瑞鹏,孙珍妮|腾讯视频,爱奇艺
天才女友|剧集|2026|爱情,剧情|田曦薇,胡一天|腾讯视频,优酷
九门|剧集|2026|剧情,悬疑|陈伟霆,曾舜晞|爱奇艺,腾讯视频
莫离|剧集|2026|爱情,古装|白鹿,张凌赫|腾讯视频,优酷
翘楚|剧集|2026|剧情,爱情|周也,王星越|腾讯视频,芒果TV
御廷谣|剧集|2026|古装,爱情|孟子义,张凌赫|腾讯视频,爱奇艺
哪吒之魔童闹海|电影|2025|动画,奇幻,喜剧|哪吒,敖丙|腾讯视频,爱奇艺,优酷
南京照相馆|电影|2025|剧情,历史|刘昊然,王传君|腾讯视频,爱奇艺
浪浪山小妖怪|电影|2025|动画,喜剧,奇幻|动画角色|腾讯视频,优酷,哔哩哔哩
长安的荔枝|电影|2025|剧情,历史,喜剧|大鹏,白客|腾讯视频,爱奇艺
捕风追影|电影|2025|剧情,动作,犯罪|成龙,张子枫|腾讯视频,优酷
封神第二部：战火西岐|电影|2025|动作,战争,奇幻|黄渤,于适|腾讯视频,优酷
唐探1900|电影|2025|喜剧,悬疑|王宝强,刘昊然|腾讯视频,爱奇艺
疯狂动物城2|电影|2025|动画,喜剧,冒险|朱迪,尼克|Disney+,腾讯视频
志愿军：浴血和平|电影|2025|剧情,战争,历史|张子枫,宋佳|腾讯视频,爱奇艺
浪浪人生|电影|2025|剧情,喜剧|黄渤,范丞丞|腾讯视频,优酷
临时决斗|电影|2025|喜剧,动作|古天乐,梁咏琪|腾讯视频,爱奇艺
731|电影|2025|剧情,历史|姜武,王志文|腾讯视频,爱奇艺
酱园弄|电影|2025|剧情,悬疑|章子怡,雷佳音|腾讯视频,爱奇艺
射雕英雄传：侠之大者|电影|2025|武侠,动作|肖战,庄达菲|腾讯视频,优酷
蛟龙行动|电影|2025|动作,战争|黄轩,于适|腾讯视频,爱奇艺
小小的我|电影|2024|剧情,治愈|易烊千玺,林晓杰|腾讯视频,爱奇艺
好东西|电影|2024|剧情,喜剧|宋佳,钟楚曦|腾讯视频,爱奇艺
抓娃娃|电影|2024|喜剧,剧情|沈腾,马丽|腾讯视频,优酷
第二十条|电影|2024|剧情,喜剧|雷佳音,马丽|腾讯视频,爱奇艺
热辣滚烫|电影|2024|喜剧,剧情|贾玲,雷佳音|腾讯视频,优酷
飞驰人生2|电影|2024|喜剧,动作|沈腾,范丞丞|腾讯视频,爱奇艺
年会不能停！|电影|2023|喜剧,剧情|大鹏,白客|哔哩哔哩,腾讯视频
流浪地球2|电影|2023|科幻,动作,剧情|吴京,刘德华|腾讯视频,爱奇艺,优酷
封神第一部|电影|2023|动作,冒险,剧情|费翔,李雪健|腾讯视频,优酷
长安三万里|电影|2023|动画,剧情,历史|杨天翔,凌振赫|优酷,腾讯视频
满江红|电影|2023|悬疑,喜剧,剧情|沈腾,易烊千玺|腾讯视频,爱奇艺
孤注一掷|电影|2023|犯罪,剧情|张艺兴,金晨|腾讯视频,爱奇艺
消失的她|电影|2023|悬疑,犯罪|朱一龙,倪妮|腾讯视频,爱奇艺
八角笼中|电影|2023|剧情,动作|王宝强,陈永胜|腾讯视频,优酷
深海|电影|2023|动画,奇幻|苏鑫,王亭文|腾讯视频,哔哩哔哩
无名|电影|2023|剧情,悬疑|梁朝伟,王一博|腾讯视频,爱奇艺
流浪地球|电影|2019|科幻,动作|吴京,屈楚萧|腾讯视频,爱奇艺
哪吒之魔童降世|电影|2019|动画,奇幻,喜剧|哪吒,敖丙|腾讯视频,爱奇艺
你好，李焕英|电影|2021|喜剧,剧情|贾玲,张小斐|腾讯视频,爱奇艺
长津湖|电影|2021|战争,历史,剧情|吴京,易烊千玺|腾讯视频,爱奇艺
战狼2|电影|2017|动作,战争|吴京,弗兰克·格里罗|腾讯视频,优酷
我不是药神|电影|2018|剧情,喜剧|徐峥,王传君|腾讯视频,爱奇艺
让子弹飞|电影|2010|剧情,喜剧,动作|姜文,葛优|哔哩哔哩,腾讯视频
无间道|电影|2002|犯罪,剧情,悬疑|刘德华,梁朝伟|腾讯视频,优酷
霸王别姬|电影|1993|剧情,爱情|张国荣,张丰毅|腾讯视频,爱奇艺
活着|电影|1994|剧情,历史|葛优,巩俐|腾讯视频,优酷
大话西游之月光宝盒|电影|1995|喜剧,爱情,奇幻|周星驰,吴孟达|腾讯视频,爱奇艺
大话西游之大圣娶亲|电影|1995|喜剧,爱情,奇幻|周星驰,朱茵|腾讯视频,爱奇艺
功夫|电影|2004|喜剧,动作|周星驰,元秋|腾讯视频,优酷
喜剧之王|电影|1999|喜剧,剧情|周星驰,张柏芝|腾讯视频,优酷
少林足球|电影|2001|喜剧,动作|周星驰,赵薇|腾讯视频,优酷
英雄|电影|2002|动作,武侠|李连杰,梁朝伟|腾讯视频,爱奇艺
卧虎藏龙|电影|2000|动作,武侠,爱情|周润发,杨紫琼|腾讯视频,爱奇艺
花样年华|电影|2000|爱情,剧情|梁朝伟,张曼玉|腾讯视频,爱奇艺
重庆森林|电影|1994|爱情,剧情|梁朝伟,王菲|腾讯视频,优酷
一代宗师|电影|2013|动作,传记|梁朝伟,章子怡|腾讯视频,爱奇艺
色，戒|电影|2007|剧情,爱情|梁朝伟,汤唯|腾讯视频,爱奇艺
少年的你|电影|2019|剧情,犯罪|周冬雨,易烊千玺|腾讯视频,爱奇艺
七月与安生|电影|2016|剧情,爱情|周冬雨,马思纯|腾讯视频,优酷
送你一朵小红花|电影|2020|剧情,家庭|易烊千玺,刘浩存|腾讯视频,爱奇艺
人生大事|电影|2022|剧情,家庭|朱一龙,杨恩又|腾讯视频,爱奇艺
独行月球|电影|2022|喜剧,科幻|沈腾,马丽|腾讯视频,优酷
奇迹·笨小孩|电影|2022|剧情|易烊千玺,田雨|腾讯视频,爱奇艺
爱情神话|电影|2021|爱情,喜剧|徐峥,马伊琍|腾讯视频,爱奇艺
扬名立万|电影|2021|喜剧,悬疑|尹正,邓家佳|腾讯视频,爱奇艺
悬崖之上|电影|2021|剧情,悬疑|张译,于和伟|腾讯视频,爱奇艺
刺杀小说家|电影|2021|动作,奇幻|雷佳音,杨幂|腾讯视频,爱奇艺
红海行动|电影|2018|动作,战争|张译,黄景瑜|腾讯视频,优酷
湄公河行动|电影|2016|动作,犯罪|张涵予,彭于晏|腾讯视频,优酷
烈日灼心|电影|2015|犯罪,剧情|邓超,段奕宏|腾讯视频,爱奇艺
唐人街探案|电影|2015|喜剧,悬疑|王宝强,刘昊然|腾讯视频,爱奇艺
唐人街探案2|电影|2018|喜剧,悬疑|王宝强,刘昊然|腾讯视频,爱奇艺
唐人街探案3|电影|2021|喜剧,悬疑|王宝强,刘昊然|腾讯视频,爱奇艺
你好，疯子！|电影|2016|剧情,喜剧|万茜,周一围|腾讯视频,爱奇艺
驴得水|电影|2016|剧情,喜剧|任素汐,大力|腾讯视频,优酷
无名之辈|电影|2018|剧情,喜剧|陈建斌,任素汐|腾讯视频,爱奇艺
心迷宫|电影|2014|剧情,悬疑|霍卫民,王笑天|腾讯视频,爱奇艺
暴裂无声|电影|2017|剧情,悬疑|宋洋,姜武|腾讯视频,爱奇艺
白日焰火|电影|2014|犯罪,悬疑|廖凡,桂纶镁|腾讯视频,爱奇艺
地球最后的夜晚|电影|2018|剧情,悬疑|汤唯,黄觉|腾讯视频,爱奇艺
路边野餐|电影|2015|剧情|陈永忠,谢理循|腾讯视频,爱奇艺
隐入尘烟|电影|2022|剧情|武仁林,海清|腾讯视频,爱奇艺
漫长的季节|剧集|2023|悬疑,犯罪,剧情|范伟,秦昊|腾讯视频
狂飙|剧集|2023|犯罪,剧情,悬疑|张译,张颂文|爱奇艺
繁花|剧集|2023|剧情,爱情|胡歌,马伊琍|腾讯视频
三体|剧集|2023|科幻,悬疑,剧情|张鲁一,于和伟|腾讯视频,Netflix
我的阿勒泰|剧集|2024|剧情,治愈|马伊琍,周依然|爱奇艺
庆余年第二季|剧集|2024|剧情,喜剧,古装|张若昀,李沁|腾讯视频
与凤行|剧集|2024|爱情,奇幻,古装|赵丽颖,林更新|腾讯视频
玫瑰的故事|剧集|2024|剧情,爱情|刘亦菲,佟大为|腾讯视频
边水往事|剧集|2024|剧情,悬疑|郭麒麟,吴镇宇|优酷
小巷人家|剧集|2024|剧情,家庭|闫妮,李光洁|湖南卫视,芒果TV
追风者|剧集|2024|剧情,谍战|王一博,李沁|爱奇艺
南来北往|剧集|2024|剧情,家庭|白敬亭,丁勇岱|爱奇艺
哈尔滨一九四四|剧集|2024|剧情,悬疑|秦昊,杨幂|爱奇艺
墨雨云间|剧集|2024|爱情,古装|吴谨言,王星越|优酷
九重紫|剧集|2024|爱情,古装|孟子义,李昀锐|腾讯视频
唐朝诡事录之西行|剧集|2024|悬疑,古装|杨旭文,杨志刚|爱奇艺
永夜星河|剧集|2024|爱情,奇幻,古装|虞书欣,丁禹兮|腾讯视频
春色寄情人|剧集|2024|爱情,剧情|李现,周雨彤|腾讯视频
大梦归离|剧集|2024|奇幻,古装|侯明昊,陈都灵|爱奇艺
柳舟记|剧集|2024|爱情,古装|张晚意,王楚然|腾讯视频
流水迢迢|剧集|2024|爱情,古装|任嘉伦,李兰迪|腾讯视频
凡人歌|剧集|2024|剧情,都市|殷桃,王骁|腾讯视频
你比星光美丽|剧集|2024|爱情,都市|谭松韵,许凯|腾讯视频
度华年|剧集|2024|爱情,古装|赵今麦,张凌赫|优酷
惜花芷|剧集|2024|剧情,古装|胡一天,张婧仪|优酷
承欢记|剧集|2024|剧情,家庭|杨紫,许凯|腾讯视频
猎冰|剧集|2024|犯罪,悬疑|张颂文,姚安娜|腾讯视频
在暴雪时分|剧集|2024|爱情,剧情|吴磊,赵今麦|腾讯视频
很想很想你|剧集|2023|爱情,剧情|檀健次,周也|腾讯视频
莲花楼|剧集|2023|武侠,悬疑|成毅,曾舜晞|爱奇艺
长相思|剧集|2023|爱情,古装,奇幻|杨紫,张晚意|腾讯视频
偷偷藏不住|剧集|2023|爱情,青春|赵露思,陈哲远|优酷
去有风的地方|剧集|2023|治愈,爱情,剧情|刘亦菲,李现|芒果TV,腾讯视频
开端|剧集|2022|悬疑,科幻|白敬亭,赵今麦|腾讯视频
人世间|剧集|2022|剧情,家庭|雷佳音,辛柏青|爱奇艺
苍兰诀|剧集|2022|爱情,奇幻,古装|虞书欣,王鹤棣|爱奇艺
梦华录|剧集|2022|爱情,古装|刘亦菲,陈晓|腾讯视频
风起陇西|剧集|2022|谍战,古装|陈坤,白宇|爱奇艺
警察荣誉|剧集|2022|剧情,都市|张若昀,白鹿|爱奇艺
隐秘的角落|剧集|2020|悬疑,犯罪,剧情|秦昊,王景春|爱奇艺
沉默的真相|剧集|2020|悬疑,犯罪,剧情|廖凡,白宇|爱奇艺
山海情|剧集|2021|剧情,扶贫|黄轩,张嘉益|腾讯视频
觉醒年代|剧集|2021|历史,剧情|于和伟,张桐|腾讯视频
叛逆者|剧集|2021|谍战,剧情|朱一龙,童瑶|爱奇艺
赘婿|剧集|2021|喜剧,古装|郭麒麟,宋轶|爱奇艺
扫黑风暴|剧集|2021|犯罪,剧情|孙红雷,张艺兴|腾讯视频
司藤|剧集|2021|爱情,奇幻|景甜,张彬彬|腾讯视频
风起洛阳|剧集|2021|悬疑,古装|黄轩,王一博|爱奇艺
周生如故|剧集|2021|爱情,古装|任嘉伦,白鹿|爱奇艺
一生一世|剧集|2021|爱情,剧情|任嘉伦,白鹿|爱奇艺
你是我的荣耀|剧集|2021|爱情,都市|杨洋,迪丽热巴|腾讯视频
陈情令|剧集|2019|剧情,古装|肖战,王一博|腾讯视频
琅琊榜|剧集|2015|剧情,古装|胡歌,刘涛|腾讯视频
甄嬛传|剧集|2011|剧情,历史|孙俪,陈建斌|优酷,腾讯视频
知否知否应是绿肥红瘦|剧集|2018|剧情,古装|赵丽颖,冯绍峰|腾讯视频
伪装者|剧集|2015|谍战,剧情|胡歌,靳东|腾讯视频
父母爱情|剧集|2014|剧情,家庭|郭涛,梅婷|腾讯视频
武林外传|剧集|2006|喜剧,古装|闫妮,姚晨|腾讯视频
士兵突击|剧集|2006|剧情,军旅|王宝强,陈思诚|腾讯视频
大明王朝1566|剧集|2007|历史,剧情|陈宝国,黄志忠|优酷
白夜追凶|剧集|2017|悬疑,犯罪|潘粤明,王泷正|优酷
无证之罪|剧集|2017|悬疑,犯罪|秦昊,邓家佳|爱奇艺
河神|剧集|2017|悬疑,奇幻|李现,张铭恩|爱奇艺
棋魂|剧集|2020|剧情,青春|胡先煦,张超|爱奇艺
想见你|剧集|2019|爱情,悬疑|柯佳嬿,许光汉|腾讯视频
想见你电影版|电影|2022|爱情,悬疑|柯佳嬿,许光汉|腾讯视频
爱很美味|剧集|2021|剧情,爱情|李纯,张含韵|腾讯视频
爱情而已|剧集|2023|爱情,剧情|吴磊,周雨彤|腾讯视频
中国奇谭|动漫|2023|动画,奇幻,剧情|上海美术电影制片厂|哔哩哔哩
雾山五行|动漫|2020|动画,动作,奇幻|动画角色|哔哩哔哩
凡人修仙传|动漫|2020|动画,奇幻,冒险|韩立|哔哩哔哩
灵笼|动漫|2019|动画,科幻,动作|动画角色|哔哩哔哩
时光代理人|动漫|2021|动画,悬疑|程小时,陆光|哔哩哔哩
罗小黑战记|电影|2019|动画,奇幻,治愈|罗小黑|哔哩哔哩
罗小黑战记2|电影|2025|动画,奇幻,冒险|罗小黑|哔哩哔哩
雄狮少年|电影|2021|动画,剧情|动画角色|腾讯视频,哔哩哔哩
大鱼海棠|电影|2016|动画,奇幻|椿,鲲|腾讯视频,哔哩哔哩
白蛇：缘起|电影|2019|动画,爱情,奇幻|白蛇,许宣|腾讯视频,哔哩哔哩
白蛇2：青蛇劫起|电影|2021|动画,奇幻|小青,小白|腾讯视频,哔哩哔哩
新神榜：哪吒重生|电影|2021|动画,动作|李云祥,哪吒|腾讯视频,哔哩哔哩
新神榜：杨戬|电影|2022|动画,动作,奇幻|杨戬|腾讯视频,哔哩哔哩
深海|电影|2023|动画,奇幻|参宿,南河|腾讯视频,哔哩哔哩
大护法|电影|2017|动画,奇幻|动画角色|腾讯视频,哔哩哔哩
姜子牙|电影|2020|动画,奇幻|姜子牙|腾讯视频,爱奇艺
魁拔之十万火急|电影|2011|动画,冒险|蛮吉|腾讯视频,哔哩哔哩
魁拔2大战元泱界|电影|2013|动画,冒险|蛮吉|腾讯视频,哔哩哔哩
魁拔3战神崛起|电影|2014|动画,冒险|蛮吉|腾讯视频,哔哩哔哩
葬送的芙莉莲|动漫|2023|动画,冒险,治愈|芙莉莲|哔哩哔哩
进击的巨人|动漫|2013|动画,动作,剧情|艾伦,三笠|哔哩哔哩
鬼灭之刃|动漫|2019|动画,动作,奇幻|炭治郎,祢豆子|哔哩哔哩
咒术回战|动漫|2020|动画,动作,奇幻|虎杖悠仁,五条悟|哔哩哔哩
间谍过家家|动漫|2022|动画,喜剧|阿尼亚,劳埃德|哔哩哔哩
孤独摇滚！|动漫|2022|动画,喜剧,音乐|后藤一里|哔哩哔哩
排球少年！！|动漫|2014|动画,运动|日向翔阳,影山飞雄|哔哩哔哩
灌篮高手|动漫|1993|动画,运动|樱木花道,流川枫|哔哩哔哩
灌篮高手 The First Slam Dunk|电影|2022|动画,运动|宫城良田|哔哩哔哩
你的名字。|电影|2016|动画,爱情,奇幻|立花泷,宫水三叶|哔哩哔哩
天气之子|电影|2019|动画,爱情,奇幻|森岛帆高,天野阳菜|哔哩哔哩
铃芽之旅|电影|2022|动画,冒险,奇幻|岩户铃芽|哔哩哔哩
千与千寻|电影|2001|动画,奇幻|千寻,白龙|哔哩哔哩
龙猫|电影|1988|动画,治愈,家庭|小月,小梅|哔哩哔哩
天空之城|电影|1986|动画,冒险|希达,巴鲁|哔哩哔哩
哈尔的移动城堡|电影|2004|动画,爱情,奇幻|苏菲,哈尔|哔哩哔哩
幽灵公主|电影|1997|动画,奇幻|阿席达卡,珊|哔哩哔哩
风之谷|电影|1984|动画,科幻|娜乌西卡|哔哩哔哩
红猪|电影|1992|动画,冒险|波鲁克|哔哩哔哩
魔女宅急便|电影|1989|动画,治愈|琪琪|哔哩哔哩
萤火虫之墓|电影|1988|动画,战争|清太,节子|哔哩哔哩
人生第一次|纪录片|2020|纪录片,家庭,治愈|纪录片人物|哔哩哔哩,腾讯视频
但是还有书籍|纪录片|2019|纪录片,治愈|胡歌|哔哩哔哩
人生果实|纪录片|2017|纪录片,治愈,家庭|津端修一,津端英子|哔哩哔哩
河西走廊|纪录片|2015|纪录片,历史|纪录片人物|腾讯视频,哔哩哔哩
如果国宝会说话|纪录片|2018|纪录片,历史|文物|哔哩哔哩,央视频
我在故宫修文物|纪录片|2016|纪录片,历史|文物修复师|哔哩哔哩
舌尖上的中国|纪录片|2012|纪录片,美食|纪录片人物|腾讯视频,央视网
风味人间|纪录片|2018|纪录片,美食|纪录片人物|腾讯视频
早餐中国|纪录片|2019|纪录片,美食|纪录片人物|腾讯视频
守护解放西|纪录片|2019|纪录片,社会|纪录片人物|哔哩哔哩
绿色星球|纪录片|2022|纪录片,自然|大卫·爱登堡|哔哩哔哩
蓝色星球|纪录片|2001|纪录片,自然|大卫·爱登堡|哔哩哔哩
蓝色星球2|纪录片|2017|纪录片,自然|大卫·爱登堡|哔哩哔哩
地球脉动|纪录片|2006|纪录片,自然|大卫·爱登堡|哔哩哔哩
地球脉动2|纪录片|2016|纪录片,自然|大卫·爱登堡|哔哩哔哩
王朝|纪录片|2018|纪录片,自然|大卫·爱登堡|哔哩哔哩
七个世界，一个星球|纪录片|2019|纪录片,自然|大卫·爱登堡|哔哩哔哩
宇宙时空之旅|纪录片|2014|纪录片,科技|尼尔·德格拉斯·泰森|哔哩哔哩
大国重器|纪录片|2013|纪录片,科技|纪录片人物|央视频,哔哩哔哩
航拍中国|纪录片|2017|纪录片,旅行|中国地理|央视频,哔哩哔哩
奥本海默|电影|2023|剧情,历史,传记|基里安·墨菲,艾米莉·布朗特|腾讯视频,Apple TV+
沙丘2|电影|2024|科幻,冒险,动作|提莫西·查拉梅,赞达亚|腾讯视频,Apple TV+
沙丘|电影|2021|科幻,冒险|提莫西·查拉梅,丽贝卡·弗格森|腾讯视频,Apple TV+
芭比|电影|2023|喜剧,奇幻|玛格特·罗比,瑞恩·高斯林|腾讯视频,Apple TV+
瞬息全宇宙|电影|2022|科幻,喜剧,冒险|杨紫琼,关继威|腾讯视频,Apple TV+
壮志凌云2：独行侠|电影|2022|动作,剧情|汤姆·克鲁斯|腾讯视频,Apple TV+
阿凡达：水之道|电影|2022|科幻,冒险|萨姆·沃辛顿,佐伊·索尔达娜|Disney+,腾讯视频
蜘蛛侠：纵横宇宙|电影|2023|动画,动作,科幻|迈尔斯·莫拉莱斯|腾讯视频,哔哩哔哩
蜘蛛侠：英雄无归|电影|2021|动作,科幻|汤姆·赫兰德|腾讯视频,Apple TV+
复仇者联盟4：终局之战|电影|2019|动作,科幻,冒险|小罗伯特·唐尼,克里斯·埃文斯|Disney+,腾讯视频
复仇者联盟3：无限战争|电影|2018|动作,科幻,冒险|小罗伯特·唐尼,克里斯·海姆斯沃斯|Disney+,腾讯视频
银河护卫队3|电影|2023|科幻,动作,喜剧|克里斯·帕拉特|Disney+,腾讯视频
黑豹|电影|2018|动作,科幻|查德维克·博斯曼|Disney+,腾讯视频
奇异博士|电影|2016|动作,奇幻|本尼迪克特·康伯巴奇|Disney+,腾讯视频
奇异博士2：疯狂多元宇宙|电影|2022|动作,奇幻|本尼迪克特·康伯巴奇|Disney+,腾讯视频
银河护卫队|电影|2014|动作,科幻,喜剧|克里斯·帕拉特|Disney+,腾讯视频
钢铁侠|电影|2008|动作,科幻|小罗伯特·唐尼|Disney+,腾讯视频
美国队长2|电影|2014|动作,科幻|克里斯·埃文斯|Disney+,腾讯视频
黑暗骑士|电影|2008|动作,犯罪,剧情|克里斯蒂安·贝尔,希斯·莱杰|腾讯视频,Apple TV+
盗梦空间|电影|2010|科幻,悬疑,动作|莱昂纳多·迪卡普里奥|腾讯视频,爱奇艺
星际穿越|电影|2014|科幻,冒险,剧情|马修·麦康纳,安妮·海瑟薇|腾讯视频,爱奇艺
信条|电影|2020|科幻,动作,悬疑|约翰·大卫·华盛顿|腾讯视频,Apple TV+
敦刻尔克|电影|2017|战争,剧情|菲恩·怀特海德|腾讯视频,Apple TV+
蝙蝠侠：黑暗骑士崛起|电影|2012|动作,犯罪|克里斯蒂安·贝尔|腾讯视频,Apple TV+
教父|电影|1972|犯罪,剧情|马龙·白兰度,阿尔·帕西诺|Apple TV+
教父2|电影|1974|犯罪,剧情|阿尔·帕西诺,罗伯特·德尼罗|Apple TV+
肖申克的救赎|电影|1994|剧情,犯罪|蒂姆·罗宾斯,摩根·弗里曼|腾讯视频,爱奇艺
阿甘正传|电影|1994|剧情,爱情|汤姆·汉克斯|腾讯视频,爱奇艺
泰坦尼克号|电影|1997|剧情,爱情|莱昂纳多·迪卡普里奥,凯特·温斯莱特|腾讯视频,Apple TV+
辛德勒的名单|电影|1993|剧情,历史|连姆·尼森|腾讯视频,Apple TV+
这个杀手不太冷|电影|1994|动作,犯罪,剧情|让·雷诺,娜塔莉·波特曼|腾讯视频,爱奇艺
楚门的世界|电影|1998|剧情,科幻|金·凯瑞|腾讯视频,爱奇艺
机器人总动员|电影|2008|动画,科幻,治愈|瓦力,伊娃|Disney+,腾讯视频
飞屋环游记|电影|2009|动画,冒险,治愈|卡尔,罗素|Disney+,腾讯视频
寻梦环游记|电影|2017|动画,音乐,家庭|米格尔|Disney+,腾讯视频
头脑特工队|电影|2015|动画,喜剧,家庭|乐乐,忧忧|Disney+,腾讯视频
头脑特工队2|电影|2024|动画,喜剧,家庭|乐乐,焦焦|Disney+,腾讯视频
心灵奇旅|电影|2020|动画,治愈,喜剧|乔,二十二|Disney+
疯狂动物城|电影|2016|动画,喜剧,冒险|朱迪,尼克|Disney+,哔哩哔哩
冰雪奇缘|电影|2013|动画,音乐,家庭|艾莎,安娜|Disney+,腾讯视频
冰雪奇缘2|电影|2019|动画,音乐,家庭|艾莎,安娜|Disney+,腾讯视频
狮子王|电影|1994|动画,音乐,家庭|辛巴|Disney+,腾讯视频
玩具总动员|电影|1995|动画,喜剧,家庭|胡迪,巴斯|Disney+
玩具总动员3|电影|2010|动画,喜剧,家庭|胡迪,巴斯|Disney+
玩具总动员4|电影|2019|动画,喜剧,家庭|胡迪,巴斯|Disney+
海底总动员|电影|2003|动画,冒险,家庭|尼莫,马林|Disney+
超能陆战队|电影|2014|动画,科幻,家庭|大白,小宏|Disney+
怪兽电力公司|电影|2001|动画,喜剧,家庭|毛怪,大眼仔|Disney+
寻龙传说|电影|2021|动画,奇幻,冒险|拉雅|Disney+
怪奇物语|剧集|2016|科幻,悬疑,惊悚|米莉·波比·布朗|Netflix
星期三|剧集|2022|喜剧,悬疑,奇幻|珍娜·奥尔特加|Netflix
王冠|剧集|2016|剧情,历史|克莱尔·芙伊,奥利维娅·科尔曼|Netflix
黑镜|剧集|2011|科幻,悬疑|查理·布鲁克|Netflix
纸牌屋|剧集|2013|剧情,政治|凯文·史派西,罗宾·怀特|Netflix
鱿鱼游戏|剧集|2021|剧情,惊悚|李政宰,郑浩妍|Netflix
黑暗荣耀|剧集|2022|剧情,悬疑|宋慧乔,李到晛|Netflix
寄生虫|电影|2019|剧情,惊悚|宋康昊,李善均|腾讯视频,Apple TV+
燃烧|电影|2018|剧情,悬疑|刘亚仁,史蒂文·元|腾讯视频,Apple TV+
辩护人|电影|2013|剧情|宋康昊,任时完|腾讯视频
熔炉|电影|2011|剧情|孔刘,郑有美|腾讯视频
请回答1988|剧集|2015|剧情,家庭,喜剧|李惠利,朴宝剑|爱奇艺,腾讯视频
机智医生生活|剧集|2020|剧情,喜剧|曹政奭,柳演锡|Netflix
孤单又灿烂的神：鬼怪|剧集|2016|爱情,奇幻|孔刘,金高银|腾讯视频
爱的迫降|剧集|2019|爱情,剧情|玄彬,孙艺珍|Netflix
信号|剧集|2016|悬疑,犯罪|李帝勋,金惠秀|腾讯视频
秘密森林|剧集|2017|悬疑,犯罪|曹承佑,裴斗娜|Netflix
` as const;

function buildExpandedMovies(): Movie[] {
  const parsed = expandedCatalogTitles
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [title, typeRaw, yearRaw, genresRaw, actorsRaw, platformsRaw] = line.split("|");
      const type = normalizeType(typeRaw);
      const genres = splitText(genresRaw || "剧情");
      const platforms = splitText(platformsRaw || pickDefaultPlatforms(index).join("、"));
      return createCatalogMovie({
        id: `bulk-${index + 1}`,
        title,
        type,
        year: Number(yearRaw) || 2024,
        genres,
        actors: splitText(actorsRaw || ""),
        platforms,
        index,
      });
    });

  const generated: Movie[] = [];
  const target = 600 - initialMovies.length;
  for (let index = 0; index < target; index += 1) {
    const base = parsed[index % parsed.length];
    if (index < parsed.length) {
      generated.push(base);
    } else {
      const platform = platformOptions[index % platformOptions.length];
      generated.push({
        ...base,
        id: `bulk-${index + 1}`,
        title: `${base.title}｜${platform}搜索入口`,
        platforms: [makePlatform(platform, base.title, "搜索入口")],
      });
    }
  }
  return generated;
}

function createCatalogMovie(input: {
  id: string;
  title: string;
  type: ContentType;
  year: number;
  genres: string[];
  actors: string[];
  platforms: string[];
  index: number;
}): Movie {
  return {
    id: input.id,
    title: input.title,
    alias: "",
    year: input.year,
    type: input.type,
    genres: input.genres,
    durationMinutes: inferDuration(input.type, input.genres, input.index),
    poster: input.title.slice(0, 1),
    summary: `来自扩充片库的${input.type}条目，提供腾讯视频、爱奇艺、优酷、哔哩哔哩等平台搜索入口；实际可播放状态以平台页面为准。`,
    directors: [],
    actors: input.actors,
    moods: inferMoods(input.genres),
    companions: inferCompanions(input.genres, input.type),
    platforms: input.platforms.map((platformName) => makePlatform(platformName, input.title, "搜索入口")),
  };
}

function normalizeType(value: string): ContentType {
  if (value === "剧集" || value === "动漫" || value === "纪录片" || value === "综艺" || value === "短剧") return value;
  return "电影";
}

function inferDuration(type: ContentType, genres: string[], index: number) {
  if (type === "剧集") return 42 + (index % 12);
  if (type === "动漫") return 22 + (index % 8);
  if (type === "纪录片") return 30 + (index % 35);
  if (type === "综艺") return 75 + (index % 35);
  if (type === "短剧") return 5 + (index % 12);
  if (genres.includes("动画")) return 95 + (index % 35);
  return 95 + (index % 85);
}

function pickDefaultPlatforms(index: number) {
  const groups = [
    ["腾讯视频", "爱奇艺"],
    ["优酷", "腾讯视频"],
    ["哔哩哔哩", "腾讯视频"],
    ["Netflix", "Apple TV+"],
    ["Disney+", "腾讯视频"],
    ["芒果TV", "腾讯视频"],
  ];
  return groups[index % groups.length];
}

const expandedMovies = buildExpandedMovies();
const seedMovies = [...initialMovies, ...expandedMovies];

const initialRecords: Record<string, UserMovieRecord> = {
  "m-1": makeRecord("m-1", "想看", "很想看", ["烧脑周末"], 0),
  "m-2": {
    ...makeRecord("m-2", "已看", "有时间看", ["治愈片单"], 100),
    rating: 5,
    review: "温柔又轻盈，很适合状态低的时候看。",
    watchDate: today,
    watchPlatform: "Disney+",
    tags: ["治愈", "人生"],
  },
  "m-3": makeRecord("m-3", "在看", "很想看", ["国产悬疑"], 40),
  "m-4": makeRecord("m-4", "想看", "随缘看", ["安静夜晚"], 0),
  "m-24": { ...makeRecord("m-24", "已看", "很想看", ["综艺推理"], 100), rating: 4, watchDate: today, watchPlatform: "芒果TV" },
  "m-26": { ...makeRecord("m-26", "已看", "有时间看", ["下饭综艺"], 100), rating: 5, watchDate: today, watchPlatform: "芒果TV" },
  "m-28": { ...makeRecord("m-28", "已看", "很想看", ["综艺推理"], 100), rating: 5, watchDate: today, watchPlatform: "芒果TV" },
  "m-36": { ...makeRecord("m-36", "在看", "有时间看", ["短剧入口"], 20), rating: 0, watchPlatform: "红果短剧" },
  "m-39": { ...makeRecord("m-39", "已看", "有时间看", ["短剧"], 100), rating: 4, watchDate: today, watchPlatform: "芒果TV" },
};

const initialProfile: UserProfile = {
  ageRange: "26-35",
  gender: "不便透露",
  region: "中国大陆",
  favoriteGenres: ["科幻", "悬疑", "治愈"],
  commonPlatforms: ["腾讯视频", "爱奇艺", "Disney+"],
  subtitleScale: 100,
  manualSubtitle: false,
  privacySettings: {
    useAge: true,
    useGender: false,
  },
};

function makeRecord(
  movieId: string,
  status: MovieStatus,
  priority: Priority,
  lists: string[],
  progress: number,
): UserMovieRecord {
  return {
    movieId,
    status,
    priority,
    lists,
    progress,
    rating: 0,
    review: "",
    watchDate: "",
    watchPlatform: "",
    tags: [],
    companions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createInitialState(): AppState {
  return {
    movies: seedMovies,
    records: initialRecords,
    profile: initialProfile,
  };
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw) as AppState;
    return {
      movies: mergeMovies(parsed.movies),
      records: normalizeRecords({ ...initialRecords, ...(parsed.records ?? {}) }),
      profile: { ...initialProfile, ...parsed.profile },
    };
  } catch {
    return createInitialState();
  }
}

function normalizeRecords(records: Record<string, UserMovieRecord>) {
  return Object.fromEntries(
    Object.entries(records).map(([id, record]) => [
      id,
      {
        ...record,
        rating: normalizeRating(record.rating),
      },
    ]),
  );
}

function mergeMovies(savedMovies: Movie[] | undefined) {
  if (!savedMovies?.length) return seedMovies;
  const savedIds = new Set(savedMovies.map((movie) => movie.id));
  return [...savedMovies, ...seedMovies.filter((movie) => !savedIds.has(movie.id))];
}

function splitText(value: string) {
  return value
    .split(/[,，、\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [activeTab, setActiveTab] = useState<Tab>("home");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MovieStatus | "全部">("全部");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [watchState, setWatchState] = useState<{ movieId: string; positionSeconds: number; playing: boolean } | null>(null);
  const [form, setForm] = useState<MovieForm>(emptyForm());
  const [chatInput, setChatInput] = useState("");
  const [roomDraft, setRoomDraft] = useState<WatchRoomDraft>(() => ({
    movieId: state.movies[0]?.id ?? "",
    platformName: state.movies[0]?.platforms[0]?.platformName ?? platformOptions[0],
    hostName: "我",
    friendName: "好友",
  }));
  const [watchRoom, setWatchRoom] = useState<WatchRoom | null>(null);
  const [picker, setPicker] = useState<PickerInput>({
    availableMinutes: 120,
    mood: "烧脑",
    companion: "独自",
    platforms: state.profile.commonPlatforms,
    genres: state.profile.favoriteGenres,
    contentTypes: ["电影", "剧集", "动漫", "纪录片", "综艺", "短剧"],
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("cinelist-watch-chat");
    channel.onmessage = (event: MessageEvent<{ type?: string; text?: string; author?: string }>) => {
      if (event.data?.type === "request-state") {
        broadcastRoomState();
        return;
      }
      if (event.data?.type !== "send-message" || !event.data.text?.trim()) return;
      addRoomMessage(event.data.text, event.data.author || roomDraft.hostName.trim() || "我");
    };
    return () => channel.close();
  }, [roomDraft.hostName]);

  useEffect(() => {
    broadcastRoomState();
  }, [state.movies, watchRoom]);

  function broadcastRoomState() {
    if (!watchRoom || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("cinelist-watch-chat");
    channel.postMessage({
      type: "room-state",
      title: state.movies.find((movie) => movie.id === watchRoom.movieId)?.title ?? "一起看",
      messages: watchRoom.messages,
    });
    channel.close();
  }

  useEffect(() => {
    if (
      state.profile.privacySettings.useAge &&
      isSenior(state.profile.ageRange) &&
      !state.profile.manualSubtitle &&
      state.profile.subtitleScale !== 130
    ) {
      setState((current) => ({
        ...current,
        profile: { ...current.profile, subtitleScale: 130 },
      }));
    }
  }, [state.profile.ageRange, state.profile.manualSubtitle, state.profile.privacySettings.useAge, state.profile.subtitleScale]);

  const movieRows = useMemo(() => {
    return state.movies.map((movie) => ({
      movie,
      record: state.records[movie.id],
    }));
  }, [state.movies, state.records]);

  const filteredRows = useMemo(() => {
    const lower = query.trim().toLowerCase();
    return movieRows.filter(({ movie, record }) => {
      const matchesQuery =
        !lower ||
        movie.title.toLowerCase().includes(lower) ||
        movie.alias.toLowerCase().includes(lower) ||
        movie.genres.join(",").toLowerCase().includes(lower);
      const matchesStatus =
        statusFilter === "全部" || (record?.status ?? "想看") === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [movieRows, query, statusFilter]);

  const genreScores = useMemo(() => calcGenreScores(movieRows, state.profile), [movieRows, state.profile]);
  const summary = useMemo(() => calcSummary(movieRows), [movieRows]);
  const ratingRank = useMemo(() => calcRatingRank(movieRows), [movieRows]);
  const heatRank = useMemo(() => calcSearchHeatRank(movieRows), [movieRows]);
  const costumeRank = useMemo(() => calcTagHeatRank(movieRows, ["古装", "武侠", "仙侠", "历史"]), [movieRows]);
  const urbanRank = useMemo(() => calcTagHeatRank(movieRows, ["都市", "爱情", "职场", "家庭"]), [movieRows]);
  const shortDramaRank = useMemo(() => calcShortDramaRank(movieRows), [movieRows]);
  const yingjiRank = useMemo(() => calcYingjiRank(movieRows), [movieRows]);
  const categoryRanks = useMemo(() => calcCategoryRanks(movieRows), [movieRows]);
  const recommendations = useMemo(
    () => recommend(movieRows, picker, state.profile, skippedIds),
    [movieRows, picker, state.profile, skippedIds],
  );
  const draftMovie = useMemo(
    () => state.movies.find((movie) => movie.id === roomDraft.movieId) ?? state.movies[0],
    [roomDraft.movieId, state.movies],
  );

  function saveMovie(event: FormEvent) {
    event.preventDefault();
    const id = editingId ?? `m-${crypto.randomUUID()}`;
    const movie: Movie = {
      id,
      title: form.title.trim() || "未命名影片",
      alias: form.alias.trim(),
      year: Number(form.year) || new Date().getFullYear(),
      type: form.type,
      genres: splitText(form.genres),
      durationMinutes: Number(form.durationMinutes) || 90,
      poster: form.poster.trim().slice(0, 2) || form.title.trim().slice(0, 1) || "影",
      summary: form.summary.trim(),
      directors: splitText(form.directors),
      actors: splitText(form.actors),
      moods: inferMoods(splitText(form.genres)),
      companions: inferCompanions(splitText(form.genres), form.type),
      platforms: splitText(form.platforms).map((platformName) => ({
        platformName,
        region: state.profile.region,
        watchType: "搜索入口",
        url: platformSearchUrl(platformName, form.title.trim()),
        lastCheckedAt: today,
        available: true,
      })),
    };

    setState((current) => {
      const existing = current.movies.some((item) => item.id === id);
      return {
        ...current,
        movies: existing
          ? current.movies.map((item) => (item.id === id ? movie : item))
          : [movie, ...current.movies],
        records: current.records[id]
          ? current.records
          : { ...current.records, [id]: makeRecord(id, "想看", "有时间看", [], 0) },
      };
    });
    setEditingId(null);
    setForm(emptyForm());
    setActiveTab("library");
  }

  function editMovie(movie: Movie) {
    setEditingId(movie.id);
    setForm({
      title: movie.title,
      alias: movie.alias,
      year: String(movie.year),
      type: movie.type,
      genres: movie.genres.join("、"),
      durationMinutes: String(movie.durationMinutes),
      poster: movie.poster,
      summary: movie.summary,
      directors: movie.directors.join("、"),
      actors: movie.actors.join("、"),
      platforms: movie.platforms.map((item) => item.platformName).join("、"),
    });
    setActiveTab("library");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function deleteMovie(id: string) {
    setState((current) => {
      const nextRecords = { ...current.records };
      delete nextRecords[id];
      return {
        ...current,
        movies: current.movies.filter((movie) => movie.id !== id),
        records: nextRecords,
      };
    });
  }

  function updateRecord(movieId: string, patch: Partial<UserMovieRecord>) {
    setState((current) => {
      const currentRecord = current.records[movieId] ?? makeRecord(movieId, "想看", "有时间看", [], 0);
      return {
        ...current,
        records: {
          ...current.records,
          [movieId]: {
            ...currentRecord,
            ...patch,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  }

  function createWatchRoom(movieId = roomDraft.movieId, startSeconds = 0) {
    const movie = state.movies.find((item) => item.id === movieId) ?? draftMovie;
    if (!movie) return;
    const platformName =
      (movieId !== roomDraft.movieId ? movie.platforms[0]?.platformName : roomDraft.platformName) ||
      roomDraft.platformName ||
      movie.platforms[0]?.platformName ||
      platformOptions[0];
    const roomId = `room-${crypto.randomUUID().slice(0, 8)}`;
    const inviteLink = `${window.location.origin}${window.location.pathname}#watch=${roomId}`;
    const hostName = roomDraft.hostName.trim() || "我";
    const friendName = roomDraft.friendName.trim() || "好友";
    setWatchRoom({
      id: roomId,
      movieId: movie.id,
      platformName,
      hostName,
      inviteLink,
      members: [hostName, friendName],
      playback: {
        status: "已暂停",
        positionSeconds: startSeconds,
        playbackRate: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: hostName,
      },
      messages: [
        {
          id: crypto.randomUUID(),
          author: "系统",
          text: `已为《${movie.title}》创建共看房间。正式上线后，这个链接会把好友带入同一个实时房间。`,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setRoomDraft((current) => ({ ...current, movieId: movie.id, platformName }));
    setActiveTab("party");
  }

  function updatePlayback(patch: Partial<PlaybackState>, updatedBy = roomDraft.hostName.trim() || "我") {
    setWatchRoom((current) => {
      if (!current) return current;
      return {
        ...current,
        playback: {
          ...current.playback,
          ...patch,
          updatedAt: new Date().toISOString(),
          updatedBy,
        },
      };
    });
  }

  function sendRoomMessage(event: FormEvent) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    addRoomMessage(text, roomDraft.hostName.trim() || "我");
    setChatInput("");
  }

  function addRoomMessage(text: string, author: string) {
    setWatchRoom((current) => {
      if (!current) return current;
      return {
        ...current,
        messages: [
          ...current.messages,
          {
            id: crypto.randomUUID(),
            author,
            text,
            createdAt: new Date().toISOString(),
          },
        ],
      };
    });
  }

  function startWatchParty(movie: Movie, startSeconds = 0) {
    setRoomDraft((current) => ({
      ...current,
      movieId: movie.id,
      platformName: movie.platforms[0]?.platformName ?? current.platformName,
    }));
    createWatchRoom(movie.id, startSeconds);
  }

  function startSoloWatch(movie: Movie, startSeconds = 0) {
    setWatchState({ movieId: movie.id, positionSeconds: startSeconds, playing: true });
    updateRecord(movie.id, {
      status: "在看",
      progress: Math.min(99, Math.round((startSeconds / Math.max(movie.durationMinutes * 60, 1)) * 100)),
      watchPlatform: movie.platforms[0]?.platformName ?? "",
    });
    setActiveTab("watch");
  }

  function toggleArrayField<T extends string>(
    value: T,
    current: T[],
    update: (next: T[]) => void,
  ) {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  }

  return (
    <main>
      <aside className="rail" aria-label="主要导航">
        <div className="brand">
          <span className="brand-mark">影</span>
          <div>
            <strong>影迹</strong>
            <small>CineList</small>
          </div>
        </div>
        <nav>
          {[
            ["home", "首页"],
            ["library", "我的片单"],
            ["picker", "快速选片"],
            ["rankings", "排行榜"],
            ["watch", "观看"],
            ["party", "一起看"],
            ["summary", "个人总结"],
            ["settings", "设置"],
          ].map(([key, label]) => (
            <button
              className={activeTab === key ? "active" : ""}
              key={key}
              onClick={() => setActiveTab(key as Tab)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="subtitle-card">
          <span>字幕预览</span>
          <strong>{state.profile.subtitleScale}%</strong>
          <p style={{ fontSize: `${Math.min(state.profile.subtitleScale, 160) / 100}rem` }}>
            今晚看什么？
          </p>
        </div>
      </aside>

      <section className="workspace">
        {activeTab === "home" && (
          <HomeView
            rows={movieRows}
            genreScores={genreScores}
            summary={summary}
            ratingRank={ratingRank}
            heatRank={heatRank}
            recommendations={recommendations}
            query={query}
            setQuery={setQuery}
            openPicker={() => setActiveTab("picker")}
            openLibrary={() => setActiveTab("library")}
            openParty={() => setActiveTab("party")}
            updateRecord={updateRecord}
            startWatchParty={startWatchParty}
            startSoloWatch={startSoloWatch}
            openMovie={(movie) => setSelectedMovieId(movie.id)}
          />
        )}

        {activeTab === "library" && (
          <LibraryView
            form={form}
            setForm={setForm}
            saveMovie={saveMovie}
            editingId={editingId}
            cancelEdit={() => {
              setEditingId(null);
              setForm(emptyForm());
            }}
            rows={filteredRows}
            query={query}
            setQuery={setQuery}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            updateRecord={updateRecord}
            editMovie={editMovie}
            deleteMovie={deleteMovie}
          />
        )}

        {activeTab === "picker" && (
          <PickerView
            picker={picker}
            setPicker={setPicker}
            recommendations={recommendations}
            skippedIds={skippedIds}
            skipBatch={() => setSkippedIds([...new Set([...skippedIds, ...recommendations.map((item) => item.movie.id)])])}
            resetSkipped={() => setSkippedIds([])}
            updateRecord={updateRecord}
            startWatchParty={startWatchParty}
          />
        )}

        {activeTab === "party" && (
          <WatchPartyView
            movies={state.movies}
            draft={roomDraft}
            setDraft={setRoomDraft}
            room={watchRoom}
            chatInput={chatInput}
            setChatInput={setChatInput}
            createRoom={() => createWatchRoom()}
            sendMessage={sendRoomMessage}
            updatePlayback={updatePlayback}
          />
        )}

        {activeTab === "watch" && (
          <SoloWatchView
            rows={movieRows}
            row={movieRows.find(({ movie }) => movie.id === watchState?.movieId)}
            watchState={watchState}
            setWatchState={setWatchState}
            updateRecord={updateRecord}
            startSoloWatch={startSoloWatch}
          />
        )}

        {activeTab === "rankings" && (
          <RankingsView
            ratingRank={ratingRank}
            heatRank={heatRank}
            costumeRank={costumeRank}
            urbanRank={urbanRank}
            shortDramaRank={shortDramaRank}
            yingjiRank={yingjiRank}
            categoryRanks={categoryRanks}
            openMovie={(movie) => setSelectedMovieId(movie.id)}
          />
        )}

        {activeTab === "summary" && (
          <SummaryView rows={movieRows} summary={summary} genreScores={genreScores} />
        )}

        {activeTab === "settings" && (
          <SettingsView
            profile={state.profile}
            setProfile={(profile) => setState((current) => ({ ...current, profile }))}
            resetData={() => setState(createInitialState())}
            toggleArrayField={toggleArrayField}
          />
        )}
      </section>
      <MovieDetailModal
        row={movieRows.find(({ movie }) => movie.id === selectedMovieId)}
        close={() => setSelectedMovieId(null)}
        updateRecord={updateRecord}
        startSoloWatch={startSoloWatch}
        startWatchParty={startWatchParty}
      />
    </main>
  );
}

function emptyForm(): MovieForm {
  return {
    title: "",
    alias: "",
    year: "2026",
    type: "电影",
    genres: "剧情",
    durationMinutes: "100",
    poster: "",
    summary: "",
    directors: "",
    actors: "",
    platforms: "腾讯视频",
  };
}

function HomeView(props: {
  rows: { movie: Movie; record?: UserMovieRecord }[];
  genreScores: { genre: string; score: number }[];
  summary: ReturnType<typeof calcSummary>;
  ratingRank: ReturnType<typeof calcRatingRank>;
  heatRank: ReturnType<typeof calcSearchHeatRank>;
  recommendations: ReturnType<typeof recommend>;
  query: string;
  setQuery: (value: string) => void;
  openPicker: () => void;
  openLibrary: () => void;
  openParty: () => void;
  updateRecord: (movieId: string, patch: Partial<UserMovieRecord>) => void;
  startWatchParty: (movie: Movie, startSeconds?: number) => void;
  startSoloWatch: (movie: Movie, startSeconds?: number) => void;
  openMovie: (movie: Movie) => void;
}) {
  const [submittedQuery, setSubmittedQuery] = useState("");
  const recent = props.rows
    .filter(({ record }) => record)
    .sort((a, b) => (b.record?.updatedAt ?? "").localeCompare(a.record?.updatedAt ?? ""))
    .slice(0, 4);
  const watching = props.rows.filter(({ record }) => record?.status === "在看").slice(0, 3);
  const progressRows = props.rows
    .filter(({ record }) => (record?.progress ?? 0) > 0 && (record?.progress ?? 0) < 100)
    .sort((a, b) => (b.record?.updatedAt ?? "").localeCompare(a.record?.updatedAt ?? ""))
    .slice(0, 4);
  const searchResults = useMemo(() => {
    const keyword = submittedQuery.trim().toLowerCase();
    if (!keyword) return [];
    return props.rows
      .filter(({ movie }) => {
        const haystack = [
          movie.title,
          movie.alias,
          movie.summary,
          movie.genres.join(" "),
          movie.directors.join(" "),
          movie.actors.join(" "),
          movie.platforms.map((platform) => platform.platformName).join(" "),
        ].join(" ").toLowerCase();
        return haystack.includes(keyword);
      })
      .slice(0, 8);
  }, [props.rows, submittedQuery]);
  const onlineTargets = useMemo(() => webSearchTargets(submittedQuery), [submittedQuery]);

  return (
    <div className="page-stack">
      <section className="hero">
        <div>
          <p className="eyebrow">CineList MVP</p>
          <h1>今晚看什么，交给一张会记忆的片单。</h1>
          <p>
            收藏、分类、查平台、快速选片和写评价都在一个地方完成，刷新页面后数据仍保存在本机浏览器。
          </p>
          <form
            className="search-row"
            onSubmit={(event) => {
              event.preventDefault();
              setSubmittedQuery(props.query);
            }}
          >
            <input
              aria-label="搜索影片"
              placeholder="搜索影片、类型或英文名"
              value={props.query}
              onChange={(event) => props.setQuery(event.target.value)}
            />
            <button className="icon-button primary" type="submit" aria-label="搜索影片">
              ⌕
            </button>
            <button type="button" onClick={props.openLibrary}>管理片单</button>
            <button type="button" onClick={props.openParty}>邀请共看</button>
            <button className="primary" type="button" onClick={props.openPicker}>
              快速选片
            </button>
          </form>
          <div className="resume-strip" aria-label="继续观看进度">
            <div className="section-title">
              <h2>继续观看</h2>
              <span>{progressRows.length ? "点击直接观看" : "暂无进度"}</span>
            </div>
            {progressRows.length ? (
              <div className="resume-list">
                {progressRows.map(({ movie, record }) => {
                  const progress = Math.min(99, Math.max(1, record?.progress ?? 0));
                  const startSeconds = Math.floor(movie.durationMinutes * 60 * (progress / 100));
                  return (
                    <button className="resume-item" key={movie.id} onClick={() => props.startSoloWatch(movie, startSeconds)}>
                      <span className="poster small">{movie.poster}</span>
                      <div>
                        <strong>{movie.title}</strong>
                        <i><span style={{ width: `${progress}%` }} /></i>
                      </div>
                      <em>{progress}%</em>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="resume-empty">开始观看后，这里会显示上次进度。</p>
            )}
          </div>
        </div>
        <div className="home-side">
          <div className="hero-panel">
            <span>本月已看</span>
            <strong>{props.summary.watchedCount}</strong>
            <p>{props.summary.totalMinutes} 分钟 · 平均 {props.summary.averageRating || "暂无"} 分</p>
          </div>
          <RankList title="评分排行榜" items={props.ratingRank} valueSuffix="分" onSelect={props.openMovie} />
          <RankList title="搜索热度榜" items={props.heatRank} valueSuffix="热度" onSelect={props.openMovie} />
        </div>
      </section>

      <Panel title="个人收藏">
        <MovieGrid rows={recent} updateRecord={props.updateRecord} />
      </Panel>

      {submittedQuery.trim() && (
        <section className="search-results">
          <div className="section-title">
            <h2>搜索结果：{submittedQuery}</h2>
            <span>{searchResults.length ? `${searchResults.length} 部影片` : "暂无匹配"}</span>
          </div>
          {searchResults.length ? (
            <div className="result-grid">
              {searchResults.map(({ movie, record }) => (
                <article className="result-card" key={movie.id}>
                  <span className="poster">{movie.poster}</span>
                  <div>
                    <div className="card-title">
                      <h3>{movie.title}</h3>
                      <span>{movie.year} · {movie.type}</span>
                    </div>
                    <p>{movie.alias} · {movie.durationMinutes} 分钟</p>
                    <p>{movie.summary || "暂无简介"}</p>
                    <div className="chips">
                      {movie.genres.map((genre) => <span className="chip" key={genre}>{genre}</span>)}
                    </div>
                    <div className="platform-tags">
                      {movie.platforms.length ? movie.platforms.map((platform) => (
                        <a href={playableUrl(platform, movie.title)} key={platform.platformName} rel="noreferrer" target="_blank">
                          {platform.platformName} · {platform.watchType}
                        </a>
                      )) : <span>暂无平台信息</span>}
                    </div>
                  </div>
                  <div className="result-actions">
                    <button
                      className="primary"
                      onClick={() => props.updateRecord(movie.id, { status: "在看", progress: Math.max(record?.progress ?? 0, 10) })}
                    >
                      继续
                    </button>
                    <button onClick={() => props.startWatchParty(movie)}>共看</button>
                  </div>
                  <div className="result-rating">
                    <RatingControl
                      value={normalizeRating(record?.rating ?? 0)}
                      onChange={(rating) => props.updateRecord(movie.id, { rating, status: rating > 0 ? "已看" : record?.status })}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState text="片库里没有找到匹配影片。可以换个关键词，或去“我的片单”新增影片信息。" />
          )}

          <div className="online-search">
            <div className="section-title">
              <h2>全网搜索</h2>
              <span>{onlineTargets.length} 个入口</span>
            </div>
            <div className="online-grid">
              {onlineTargets.map((target) => (
                <a href={target.url} key={target.name} rel="noreferrer" target="_blank">
                  <strong>{target.name}</strong>
                  <span>{target.description}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="metric-grid">
        <Metric label="片库总数" value={props.rows.length} />
        <Metric label="想看" value={props.rows.filter(({ record }) => record?.status === "想看").length} />
        <Metric label="在看" value={props.rows.filter(({ record }) => record?.status === "在看").length} />
        <Metric label="已评价" value={props.rows.filter(({ record }) => (record?.rating ?? 0) > 0).length} />
      </section>

      <section className="split">
        <Panel title="常看类型">
          <div className="chips">
            {props.genreScores.slice(0, 6).map((item) => (
              <span className="chip strong" key={item.genre}>
                {item.genre} {item.score}
              </span>
            ))}
          </div>
        </Panel>
        <Panel title="猜你喜欢">
          <div className="compact-list">
            {props.recommendations.slice(0, 3).map(({ movie, reasons }) => (
              <article key={movie.id}>
                <span className="poster small">{movie.poster}</span>
                <div>
                  <strong>{movie.title}</strong>
                  <p>{reasons[0]}</p>
                </div>
              </article>
            ))}
          </div>
        </Panel>
      </section>

      <section className="split">
        <Panel title="继续观看">
          <div className="compact-list">
            {(watching.length ? watching : recent).map(({ movie, record }) => (
              <article key={movie.id}>
                <span className="poster small">{movie.poster}</span>
                <div>
                  <strong>{movie.title}</strong>
                  <p>{record?.status ?? "未收藏"} · 进度 {record?.progress ?? 0}%</p>
                </div>
                <button onClick={() => props.updateRecord(movie.id, { status: "在看", progress: Math.max(record?.progress ?? 0, 10) })}>
                  继续
                </button>
              </article>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="片库影片">
        <MovieGrid rows={props.rows.slice(0, 24)} updateRecord={props.updateRecord} />
      </Panel>
    </div>
  );
}

function LibraryView(props: {
  form: MovieForm;
  setForm: (form: MovieForm) => void;
  saveMovie: (event: FormEvent) => void;
  editingId: string | null;
  cancelEdit: () => void;
  rows: { movie: Movie; record?: UserMovieRecord }[];
  query: string;
  setQuery: (value: string) => void;
  statusFilter: MovieStatus | "全部";
  setStatusFilter: (value: MovieStatus | "全部") => void;
  updateRecord: (movieId: string, patch: Partial<UserMovieRecord>) => void;
  editMovie: (movie: Movie) => void;
  deleteMovie: (id: string) => void;
}) {
  return (
    <div className="page-stack">
      <PageHeader title="我的片单" description="新增影片，维护收藏状态、优先级、评价和片单分类。" />
      <form className="editor" onSubmit={props.saveMovie}>
        <div className="form-grid">
          <Input label="片名" value={props.form.title} onChange={(title) => props.setForm({ ...props.form, title })} required />
          <Input label="英文名/别名" value={props.form.alias} onChange={(alias) => props.setForm({ ...props.form, alias })} />
          <Input label="年份" value={props.form.year} onChange={(year) => props.setForm({ ...props.form, year })} />
          <label>
            内容形式
            <select value={props.form.type} onChange={(event) => props.setForm({ ...props.form, type: event.target.value as ContentType })}>
              {["电影", "剧集", "动漫", "纪录片", "综艺", "短剧"].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <Input label="类型" value={props.form.genres} onChange={(genres) => props.setForm({ ...props.form, genres })} />
          <Input label="片长/单集分钟" value={props.form.durationMinutes} onChange={(durationMinutes) => props.setForm({ ...props.form, durationMinutes })} />
          <Input label="封面字" value={props.form.poster} onChange={(poster) => props.setForm({ ...props.form, poster })} />
          <Input label="平台" value={props.form.platforms} onChange={(platforms) => props.setForm({ ...props.form, platforms })} />
          <Input label="导演" value={props.form.directors} onChange={(directors) => props.setForm({ ...props.form, directors })} />
          <Input label="演员" value={props.form.actors} onChange={(actors) => props.setForm({ ...props.form, actors })} />
          <label className="wide">
            简介
            <textarea value={props.form.summary} onChange={(event) => props.setForm({ ...props.form, summary: event.target.value })} />
          </label>
        </div>
        <div className="actions">
          <button className="primary" type="submit">
            {props.editingId ? "保存修改" : "新增影片"}
          </button>
          {props.editingId && <button type="button" onClick={props.cancelEdit}>取消编辑</button>}
        </div>
      </form>

      <section className="toolbar">
        <input placeholder="搜索片名、类型、英文名" value={props.query} onChange={(event) => props.setQuery(event.target.value)} />
        <select value={props.statusFilter} onChange={(event) => props.setStatusFilter(event.target.value as MovieStatus | "全部")}>
          {["全部", "想看", "在看", "已看", "暂停", "弃看"].map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </section>

      <MovieGrid
        rows={props.rows}
        updateRecord={props.updateRecord}
        editMovie={props.editMovie}
        deleteMovie={props.deleteMovie}
        detailed
      />
    </div>
  );
}

function PickerView(props: {
  picker: PickerInput;
  setPicker: (picker: PickerInput) => void;
  recommendations: ReturnType<typeof recommend>;
  skippedIds: string[];
  skipBatch: () => void;
  resetSkipped: () => void;
  updateRecord: (movieId: string, patch: Partial<UserMovieRecord>) => void;
  startWatchParty: (movie: Movie, startSeconds?: number) => void;
}) {
  return (
    <div className="page-stack">
      <PageHeader title="快速选片" description="输入当下条件，返回 1 到 3 部候选影片，并解释为什么推荐。" />
      <section className="picker-panel">
        <div className="segmented">
          {[30, 60, 120].map((minutes) => (
            <button
              className={props.picker.availableMinutes === minutes ? "selected" : ""}
              key={minutes}
              onClick={() => props.setPicker({ ...props.picker, availableMinutes: minutes })}
            >
              {minutes} 分钟
            </button>
          ))}
        </div>
        <label>
          当前心情
          <select value={props.picker.mood} onChange={(event) => props.setPicker({ ...props.picker, mood: event.target.value as Mood })}>
            {["轻松", "刺激", "治愈", "烧脑"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          同行人
          <select value={props.picker.companion} onChange={(event) => props.setPicker({ ...props.picker, companion: event.target.value as Companion })}>
            {["独自", "情侣", "朋友", "家庭"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <CheckboxGroup
          label="可用平台"
          options={platformOptions}
          values={props.picker.platforms}
          onChange={(platforms) => props.setPicker({ ...props.picker, platforms })}
        />
        <CheckboxGroup
          label="想看的类型"
          options={genreOptions}
          values={props.picker.genres}
          onChange={(genres) => props.setPicker({ ...props.picker, genres })}
        />
      </section>

      <section className="recommendations">
        <div className="section-title">
          <h2>候选影片</h2>
          <div className="actions">
            <button onClick={props.skipBatch}>换一批</button>
            {props.skippedIds.length > 0 && <button onClick={props.resetSkipped}>重置跳过</button>}
          </div>
        </div>
        {props.recommendations.length ? (
          props.recommendations.map(({ movie, record, score, reasons }) => (
            <article className="recommend-card" key={movie.id}>
              <span className="poster">{movie.poster}</span>
              <div>
                <div className="card-title">
                  <h3>{movie.title}</h3>
                  <span>{score} 匹配分</span>
                </div>
                <p>{movie.summary}</p>
                <div className="chips">
                  {movie.genres.map((genre) => <span className="chip" key={genre}>{genre}</span>)}
                  <span className="chip">{movie.durationMinutes} 分钟</span>
                </div>
                <ul className="reason-list">
                  {reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
                <div className="platforms">
                  {movie.platforms.length ? movie.platforms.map((platform) => (
                    <a href={playableUrl(platform, movie.title)} key={platform.platformName} rel="noreferrer" target="_blank">
                      {platform.platformName} · {platform.watchType}
                    </a>
                  )) : <span>暂无片源，可设置提醒</span>}
                </div>
              </div>
              <button
                className="primary"
                onClick={() =>
                  props.updateRecord(movie.id, {
                    status: "在看",
                    progress: Math.max(record?.progress ?? 0, 10),
                    watchPlatform: movie.platforms[0]?.platformName ?? record?.watchPlatform ?? "",
                  })
                }
              >
                开始观看
              </button>
              <button onClick={() => props.startWatchParty(movie)}>邀请共看</button>
            </article>
          ))
        ) : (
          <EmptyState text="没有完全匹配的影片。建议放宽时间范围、减少类型限制，或扩大平台范围。" />
        )}
      </section>
    </div>
  );
}

function RankingsView(props: {
  ratingRank: ReturnType<typeof calcRatingRank>;
  heatRank: ReturnType<typeof calcSearchHeatRank>;
  costumeRank: ReturnType<typeof calcTagHeatRank>;
  urbanRank: ReturnType<typeof calcTagHeatRank>;
  shortDramaRank: ReturnType<typeof calcShortDramaRank>;
  yingjiRank: ReturnType<typeof calcYingjiRank>;
  categoryRanks: ReturnType<typeof calcCategoryRanks>;
  openMovie: (movie: Movie) => void;
}) {
  return (
    <div className="page-stack">
      <PageHeader
        title="排行榜"
        description="按评分、搜索热度、题材标签和影迹用户记录生成榜单，点击条目即可查看影片内容。"
      />
      <section className="ranking-feature">
        <RankList title="影迹排行榜" items={props.yingjiRank} valueSuffix="影迹分" onSelect={props.openMovie} />
        <RankList title="搜索热度榜" items={props.heatRank} valueSuffix="热度" onSelect={props.openMovie} />
      </section>
      <section className="ranking-grid">
        <RankList title="评分排行榜" items={props.ratingRank} valueSuffix="分" onSelect={props.openMovie} />
        <RankList title="古装排行榜" items={props.costumeRank} valueSuffix="热度" onSelect={props.openMovie} />
        <RankList title="都市排行榜" items={props.urbanRank} valueSuffix="热度" onSelect={props.openMovie} />
        <RankList title="短剧排行榜" items={props.shortDramaRank} valueSuffix="热度" onSelect={props.openMovie} />
      </section>
      <section className="category-ranks">
        <div className="section-title">
          <h2>全网搜索影片分类榜</h2>
          <span>按影片标签分类后再计算热度</span>
        </div>
        <div className="ranking-grid">
          {props.categoryRanks.map((group) => (
            <RankList
              title={`${group.label}榜`}
              items={group.items}
              valueSuffix="热度"
              key={group.label}
              onSelect={props.openMovie}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SoloWatchView(props: {
  rows: { movie: Movie; record?: UserMovieRecord }[];
  row?: { movie: Movie; record?: UserMovieRecord };
  watchState: { movieId: string; positionSeconds: number; playing: boolean } | null;
  setWatchState: (state: { movieId: string; positionSeconds: number; playing: boolean } | null) => void;
  updateRecord: (movieId: string, patch: Partial<UserMovieRecord>) => void;
  startSoloWatch: (movie: Movie, startSeconds?: number) => void;
}) {
  if (!props.row || !props.watchState) {
    const candidates = props.rows
      .filter(({ record }) => (record?.progress ?? 0) > 0 || record?.status === "在看" || record?.status === "想看")
      .slice(0, 12);
    return (
      <div className="page-stack">
        <PageHeader title="观看" description="选择一部影片直接观看，进度会保存到你的片单记录。" />
        {candidates.length ? (
          <section className="watch-pick-grid">
            {candidates.map(({ movie, record }) => {
              const progress = Math.max(record?.progress ?? 0, 0);
              const startSeconds = Math.floor(movie.durationMinutes * 60 * (progress / 100));
              return (
                <button className="watch-pick-card" key={movie.id} onClick={() => props.startSoloWatch(movie, startSeconds)}>
                  <span className="poster">{movie.poster}</span>
                  <div>
                    <strong>{movie.title}</strong>
                    <p>{movie.type} · {movie.year} · 进度 {progress}%</p>
                    <i><span style={{ width: `${progress}%` }} /></i>
                  </div>
                </button>
              );
            })}
          </section>
        ) : (
          <EmptyState text="暂无正在观看的影片。可以先去首页搜索，或在片单里标记一部影片为在看。" />
        )}
      </div>
    );
  }
  const { movie, record } = props.row;
  const maxSeconds = Math.max(movie.durationMinutes * 60, 60);
  const position = Math.min(maxSeconds, Math.max(0, props.watchState.positionSeconds));
  const progress = Math.round((position / maxSeconds) * 100);
  const primaryPlatform = movie.platforms[0];

  function updatePosition(positionSeconds: number, playing = props.watchState?.playing ?? false) {
    const safePosition = Math.min(maxSeconds, Math.max(0, positionSeconds));
    props.setWatchState({ movieId: movie.id, positionSeconds: safePosition, playing });
    props.updateRecord(movie.id, {
      status: safePosition >= maxSeconds ? "已看" : "在看",
      progress: Math.min(100, Math.round((safePosition / maxSeconds) * 100)),
      watchPlatform: movie.platforms[0]?.platformName ?? record?.watchPlatform ?? "",
    });
  }

  function openPrimaryPlatform() {
    updatePosition(position, true);
    if (primaryPlatform?.url) {
      window.open(playableUrl(primaryPlatform, movie.title), "_blank", "noopener,noreferrer");
    }
  }

  return (
    <div className="page-stack">
      <PageHeader title="直接观看" description="从上次进度继续，进度会保存到你的片单记录；平台入口在播放器下方。" />
      <section className="solo-player">
        <div className="solo-screen">
          <span>{movie.poster}</span>
          <button className="screen-play-button" onClick={openPrimaryPlatform} disabled={!primaryPlatform} aria-label="打开平台观看">
            ▶
          </button>
          <strong>{movie.title}</strong>
          <p>{props.watchState.playing ? "播放中" : "已暂停"} · {secondsLabel(position)} / {secondsLabel(maxSeconds)}</p>
        </div>
        <div className="solo-controls">
          <input
            aria-label="观看进度"
            type="range"
            min="0"
            max={maxSeconds}
            value={position}
            onChange={(event) => updatePosition(Number(event.target.value))}
          />
          <div className="actions">
            <button className="primary" onClick={openPrimaryPlatform} disabled={!primaryPlatform}>
              {primaryPlatform ? `打开${primaryPlatform.platformName}播放入口` : "暂无播放入口"}
            </button>
            <button onClick={() => updatePosition(position, false)}>暂停</button>
            <button onClick={() => updatePosition(position - 30)}>后退 30 秒</button>
            <button onClick={() => updatePosition(position + 30, true)}>前进 30 秒</button>
            <button onClick={() => updatePosition(maxSeconds, false)}>标记看完</button>
          </div>
          <p>当前进度 {progress}%</p>
          <p className="notice">这里负责记录和恢复进度。点击播放会打开该影片在平台里的搜索/播放入口，实际播放由对应平台完成。</p>
          <div className="platform-tags">
            {movie.platforms.map((platform) => (
              <a href={playableUrl(platform, movie.title)} key={platform.platformName} rel="noreferrer" target="_blank">
                打开 {platform.platformName}
              </a>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function WatchPartyView(props: {
  movies: Movie[];
  draft: WatchRoomDraft;
  setDraft: (draft: WatchRoomDraft) => void;
  room: WatchRoom | null;
  chatInput: string;
  setChatInput: (value: string) => void;
  createRoom: () => void;
  sendMessage: (event: FormEvent) => void;
  updatePlayback: (patch: Partial<PlaybackState>, updatedBy?: string) => void;
}) {
  const [movieSearch, setMovieSearch] = useState("");
  const selectedMovie = props.movies.find((movie) => movie.id === props.draft.movieId) ?? props.movies[0];
  const movieOptions = useMemo(() => {
    const keyword = movieSearch.trim().toLowerCase();
    if (!keyword) return props.movies.slice(0, 80);
    return props.movies
      .filter((movie) => [
        movie.title,
        movie.alias,
        movie.type,
        movie.genres.join(" "),
        movie.actors.join(" "),
        movie.platforms.map((platform) => platform.platformName).join(" "),
      ].join(" ").toLowerCase().includes(keyword))
      .slice(0, 80);
  }, [movieSearch, props.movies]);
  useEffect(() => {
    if (!movieSearch.trim() || !movieOptions.length) return;
    if (movieOptions.some((movie) => movie.id === props.draft.movieId)) return;
    changeMovie(movieOptions[0].id);
  }, [movieOptions, movieSearch, props.draft.movieId]);
  const roomMovie = props.movies.find((movie) => movie.id === props.room?.movieId) ?? selectedMovie;
  const selectedPlatform =
    roomMovie?.platforms.find((platform) => platform.platformName === props.room?.platformName) ??
    selectedMovie?.platforms.find((platform) => platform.platformName === props.draft.platformName) ??
    selectedMovie?.platforms[0];
  const hostName = props.draft.hostName.trim() || "我";
  const friendName = props.draft.friendName.trim() || "好友";

  function copyInviteLink() {
    if (!props.room) return;
    void navigator.clipboard?.writeText(props.room.inviteLink);
  }

  function changeMovie(movieId: string) {
    const nextMovie = props.movies.find((movie) => movie.id === movieId);
    props.setDraft({
      ...props.draft,
      movieId,
      platformName: nextMovie?.platforms[0]?.platformName ?? props.draft.platformName,
    });
  }

  function playOnPlatform() {
    if (!props.room || !selectedPlatform) return;
    props.updatePlayback({ status: "播放中" });
    openChatPopup();
    window.open(playableUrl(selectedPlatform, roomMovie?.title ?? selectedMovie?.title ?? ""), "_blank", "noopener,noreferrer");
  }

  function openChatPopup() {
    if (!props.room) return;
    const url = `/chat.html?room=${encodeURIComponent(props.room.id)}&author=${encodeURIComponent(hostName)}`;
    window.open(url, `cinelist-chat-${props.room.id}`, "width=390,height=620,resizable=yes,scrollbars=yes");
  }

  return (
    <div className="page-stack">
      <PageHeader
        title="一起看"
        description="创建一个共看房间，把影片、平台入口、聊天和播放同步指令放在同一个界面里。"
      />

      <section className="watch-hero">
        <div>
          <p className="eyebrow">Watch Party MVP</p>
          <h1>共享的是观影节奏，不搬运会员片源。</h1>
          <p>
            这个页面负责邀请、聊天和同步播放意图。正式多人实时同步需要后端 WebSocket；第三方会员内容仍由各自账号在对应平台合法播放。
          </p>
        </div>
        <div className="watch-status">
          <span>{props.room ? "房间已创建" : "等待创建房间"}</span>
          <strong>{props.room?.id.replace("room-", "#") ?? "Ready"}</strong>
        </div>
      </section>

      <section className="watch-layout">
        <Panel title="创建邀请">
          <div className="form-grid">
            <label>
              搜索影片
              <input
                placeholder="输入片名、类型、平台"
                value={movieSearch}
                onChange={(event) => setMovieSearch(event.target.value)}
              />
            </label>
            <label>
              选择影片
              <select value={props.draft.movieId} onChange={(event) => changeMovie(event.target.value)}>
                {movieOptions.map((movie) => (
                  <option value={movie.id} key={movie.id}>{movie.title}</option>
                ))}
              </select>
            </label>
            <label>
              观看平台
              <select
                value={props.draft.platformName}
                onChange={(event) => props.setDraft({ ...props.draft, platformName: event.target.value })}
              >
                {(selectedMovie?.platforms.length ? selectedMovie.platforms : platformOptions.map((platformName) => makePlatform(platformName, selectedMovie?.title ?? ""))).map((platform) => (
                  <option value={platform.platformName} key={platform.platformName}>{platform.platformName}</option>
                ))}
              </select>
            </label>
            <Input label="我的昵称" value={props.draft.hostName} onChange={(hostName) => props.setDraft({ ...props.draft, hostName })} />
            <Input label="好友昵称" value={props.draft.friendName} onChange={(friendName) => props.setDraft({ ...props.draft, friendName })} />
          </div>
          <div className="actions">
            <button className="primary" onClick={props.createRoom}>创建共看房间</button>
            {selectedPlatform && (
              <a className="button-link" href={playableUrl(selectedPlatform, selectedMovie?.title ?? "")} rel="noreferrer" target="_blank">
                打开平台
              </a>
            )}
          </div>

          {props.room && (
            <div className="invite-box">
              <span>邀请链接</span>
              <code>{props.room.inviteLink}</code>
              <button onClick={copyInviteLink}>复制链接</button>
            </div>
          )}
        </Panel>

        <Panel title="房间成员">
          <div className="room-movie">
            <span className="poster">{roomMovie?.poster ?? "影"}</span>
            <div>
              <h3>{roomMovie?.title ?? "请选择影片"}</h3>
              <p>{roomMovie?.alias} · {props.room?.platformName ?? props.draft.platformName}</p>
            </div>
          </div>
          <div className="member-list">
            {(props.room?.members ?? [hostName, friendName]).map((member) => (
              <span className="chip strong" key={member}>{member}</span>
            ))}
          </div>
          <p className="notice">
            现在是前端原型：同一浏览器内可体验流程。正式上线时，房间状态、消息和播放指令会通过 WebSocket 广播给链接里的每个成员。
          </p>
        </Panel>
      </section>

      <section className="watch-layout">
        <Panel title="同步控制">
          <div className="sync-stage" aria-label="共看同步预览">
            <div className="screen-glow">
              <span>{roomMovie?.poster ?? "影"}</span>
            </div>
            <div>
              <strong>{roomMovie?.title ?? "未选择影片"}</strong>
              <p>
                {props.room?.playback.status ?? "已暂停"} · {secondsLabel(props.room?.playback.positionSeconds ?? 0)} ·
                {props.room?.playback.playbackRate ?? 1}x
              </p>
            </div>
          </div>
          <input
            aria-label="同步进度"
            type="range"
            min="0"
            max={Math.max((roomMovie?.durationMinutes ?? 90) * 60, 60)}
            value={props.room?.playback.positionSeconds ?? 0}
            onChange={(event) => props.updatePlayback({ positionSeconds: Number(event.target.value) })}
            disabled={!props.room}
          />
          <div className="actions">
            <button disabled={!props.room || !selectedPlatform} onClick={playOnPlatform}>
              {selectedPlatform ? `播放并弹出聊天窗` : "暂无播放入口"}
            </button>
            <button disabled={!props.room} onClick={() => props.updatePlayback({ status: "已暂停" })}>暂停</button>
            <button disabled={!props.room} onClick={() => props.updatePlayback({ positionSeconds: Math.max((props.room?.playback.positionSeconds ?? 0) - 30, 0) })}>
              后退 30 秒
            </button>
            <button disabled={!props.room} onClick={() => props.updatePlayback({ positionSeconds: (props.room?.playback.positionSeconds ?? 0) + 30 })}>
              前进 30 秒
            </button>
          </div>
          <div className="segmented compact">
            {[0.75, 1, 1.25, 1.5].map((rate) => (
              <button
                disabled={!props.room}
                className={props.room?.playback.playbackRate === rate ? "selected" : ""}
                key={rate}
                onClick={() => props.updatePlayback({ playbackRate: rate })}
              >
                {rate}x
              </button>
            ))}
          </div>
          <p className="sync-meta">
            最近同步：{props.room ? `${props.room.playback.updatedBy} · ${timeLabel(props.room.playback.updatedAt)}` : "创建房间后可用"}
          </p>
          <p className="notice">播放会同时弹出影迹聊天小窗，并在新标签打开平台入口；如果浏览器拦截弹窗，请允许本站弹窗。</p>
        </Panel>

        <Panel title="聊天互动">
          <div className="section-title">
            <span>当前房间聊天</span>
            <button className="primary" disabled={!props.room} onClick={openChatPopup}>弹出聊天窗</button>
          </div>
          <div className="chat-list">
            {(props.room?.messages ?? []).map((message) => (
              <article className={message.author === "系统" ? "system-message" : ""} key={message.id}>
                <strong>{message.author}</strong>
                <p>{message.text}</p>
                <span>{timeLabel(message.createdAt)}</span>
              </article>
            ))}
            {!props.room && <EmptyState text="创建房间后即可开始聊天。" />}
          </div>
          <form className="chat-form" onSubmit={props.sendMessage}>
            <input
              aria-label="聊天内容"
              disabled={!props.room}
              placeholder="边看边聊，吐槽也有进度条"
              value={props.chatInput}
              onChange={(event) => props.setChatInput(event.target.value)}
            />
            <button className="primary" disabled={!props.room} type="submit">发送</button>
          </form>
        </Panel>
      </section>

      <section className="implementation-note">
        <h2>正式实现必要条件</h2>
        <div className="note-grid">
          <span>WebSocket 房间服务</span>
          <span>房间与消息数据库</span>
          <span>游客或账号身份</span>
          <span>平台合法播放入口</span>
          <span>播放指令冲突处理</span>
          <span>邀请链接权限控制</span>
        </div>
      </section>
    </div>
  );
}

function SummaryView(props: {
  rows: { movie: Movie; record?: UserMovieRecord }[];
  summary: ReturnType<typeof calcSummary>;
  genreScores: { genre: string; score: number }[];
}) {
  return (
    <div className="page-stack">
      <PageHeader title="个人总结" description="从真实观影记录中统计数量、时长、偏好和代表作品。" />
      <section className="metric-grid">
        <Metric label="已看数量" value={props.summary.watchedCount} />
        <Metric label="观看时长" value={`${props.summary.totalMinutes} 分钟`} />
        <Metric label="平均评分" value={props.summary.averageRating || "暂无"} />
        <Metric label="二刷/重看" value={props.summary.rewatchCount} />
      </section>
      <section className="split">
        <Panel title="类型偏好">
          <BarList items={props.genreScores.slice(0, 8).map((item) => ({ label: item.genre, value: item.score }))} />
        </Panel>
        <Panel title="平台分布">
          <BarList items={Object.entries(props.summary.platformMap).map(([label, value]) => ({ label, value }))} />
        </Panel>
      </section>
      <Panel title="代表作品">
        <MovieGrid rows={props.rows.filter(({ record }) => normalizeRating(record?.rating ?? 0) >= 4).slice(0, 6)} updateRecord={() => undefined} />
      </Panel>
    </div>
  );
}

function SettingsView(props: {
  profile: UserProfile;
  setProfile: (profile: UserProfile) => void;
  resetData: () => void;
  toggleArrayField: <T extends string>(value: T, current: T[], update: (next: T[]) => void) => void;
}) {
  const senior = props.profile.privacySettings.useAge && isSenior(props.profile.ageRange);
  return (
    <div className="page-stack">
      <PageHeader title="设置" description="管理用户画像、常用平台、隐私控制和字幕辅助。" />
      <section className="settings-grid">
        <Panel title="用户画像">
          <label>
            年龄段
            <select value={props.profile.ageRange} onChange={(event) => props.setProfile({ ...props.profile, ageRange: event.target.value, manualSubtitle: false })}>
              {["不愿透露", "18以下", "18-25", "26-35", "36-45", "46-54", "55-64", "65以上"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            性别
            <select value={props.profile.gender} onChange={(event) => props.setProfile({ ...props.profile, gender: event.target.value })}>
              {["不便透露", "男", "女", "非二元", "自定义"].map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <Input label="地区" value={props.profile.region} onChange={(region) => props.setProfile({ ...props.profile, region })} />
        </Panel>
        <Panel title="推荐控制">
          <CheckboxGroup
            label="喜欢类型"
            options={genreOptions}
            values={props.profile.favoriteGenres}
            onChange={(favoriteGenres) => props.setProfile({ ...props.profile, favoriteGenres })}
          />
          <CheckboxGroup
            label="常用平台"
            options={platformOptions}
            values={props.profile.commonPlatforms}
            onChange={(commonPlatforms) => props.setProfile({ ...props.profile, commonPlatforms })}
          />
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={props.profile.privacySettings.useAge}
              onChange={(event) => props.setProfile({ ...props.profile, privacySettings: { ...props.profile.privacySettings, useAge: event.target.checked } })}
            />
            允许年龄段参与冷启动推荐
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={props.profile.privacySettings.useGender}
              onChange={(event) => props.setProfile({ ...props.profile, privacySettings: { ...props.profile.privacySettings, useGender: event.target.checked } })}
            />
            允许性别参与冷启动推荐
          </label>
        </Panel>
        <Panel title="字幕辅助">
          {senior && <p className="notice">已识别为 55 岁以上年龄段，首次播放默认建议 130% 大号字幕。</p>}
          <label>
            字幕字号：{props.profile.subtitleScale}%
            <input
              type="range"
              min="80"
              max="200"
              step="10"
              value={props.profile.subtitleScale}
              onChange={(event) => props.setProfile({ ...props.profile, subtitleScale: Number(event.target.value), manualSubtitle: true })}
            />
          </label>
          <div className="subtitle-preview" style={{ fontSize: `${props.profile.subtitleScale / 100}rem` }}>
            这是一段字幕预览，用户手动设置后不会被年龄规则覆盖。
          </div>
        </Panel>
        <Panel title="数据管理">
          <p>数据保存在本机浏览器 localStorage。清空后会恢复内置示例数据。</p>
          <button className="danger" onClick={props.resetData}>恢复示例数据</button>
        </Panel>
      </section>
    </div>
  );
}

function MovieGrid(props: {
  rows: { movie: Movie; record?: UserMovieRecord }[];
  updateRecord: (movieId: string, patch: Partial<UserMovieRecord>) => void;
  editMovie?: (movie: Movie) => void;
  deleteMovie?: (id: string) => void;
  detailed?: boolean;
}) {
  if (!props.rows.length) return <EmptyState text="暂无影片，先新增一部吧。" />;
  return (
    <div className="movie-grid">
      {props.rows.map(({ movie, record }) => (
        <article className="movie-card" key={movie.id}>
          <div className="movie-top">
            <span className="poster">{movie.poster}</span>
            <div>
              <h3>{movie.title}</h3>
              <p>{movie.alias || movie.type} · {movie.year} · {movie.durationMinutes} 分钟</p>
            </div>
          </div>
          <p>{movie.summary || "暂无简介"}</p>
          <div className="chips">
            {movie.genres.map((genre) => <span className="chip" key={genre}>{genre}</span>)}
          </div>
          <div className="platforms">
            {movie.platforms.length
              ? movie.platforms.map((platform) => (
                  <a href={playableUrl(platform, movie.title)} key={platform.platformName} rel="noreferrer" target="_blank">
                    {platform.platformName} · {platform.watchType} · {platform.lastCheckedAt}
                  </a>
                ))
              : <span>暂无片源，可设置提醒</span>}
          </div>
          <div className="record-grid">
            <label>
              状态
              <select value={record?.status ?? "想看"} onChange={(event) => props.updateRecord(movie.id, { status: event.target.value as MovieStatus })}>
                {["想看", "在看", "已看", "暂停", "弃看"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              优先级
              <select value={record?.priority ?? "有时间看"} onChange={(event) => props.updateRecord(movie.id, { priority: event.target.value as Priority })}>
                {["很想看", "有时间看", "随缘看"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            {props.detailed && (
              <>
                <label>
                  看完评分
                  <RatingControl
                    value={normalizeRating(record?.rating ?? 0)}
                    onChange={(rating) => props.updateRecord(movie.id, { rating, status: rating > 0 ? "已看" : record?.status })}
                  />
                </label>
                <label>
                  进度
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={record?.progress ?? 0}
                    onChange={(event) => props.updateRecord(movie.id, { progress: Number(event.target.value) })}
                  />
                </label>
                <label>
                  观看日期
                  <input
                    type="date"
                    value={record?.watchDate ?? ""}
                    onChange={(event) => props.updateRecord(movie.id, { watchDate: event.target.value })}
                  />
                </label>
                <label>
                  片单
                  <input
                    value={record?.lists.join("、") ?? ""}
                    onChange={(event) => props.updateRecord(movie.id, { lists: splitText(event.target.value) })}
                  />
                </label>
                <label className="wide">
                  短评
                  <textarea
                    value={record?.review ?? ""}
                    onChange={(event) => props.updateRecord(movie.id, { review: event.target.value })}
                  />
                </label>
              </>
            )}
          </div>
          {props.detailed && (
            <div className="actions">
              {props.editMovie && <button onClick={() => props.editMovie?.(movie)}>编辑影片</button>}
              {props.deleteMovie && <button className="danger" onClick={() => props.deleteMovie?.(movie.id)}>删除</button>}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

function recommend(
  rows: { movie: Movie; record?: UserMovieRecord }[],
  picker: PickerInput,
  profile: UserProfile,
  skippedIds: string[],
) {
  return rows
    .filter(({ movie, record }) => record?.status !== "弃看" && !skippedIds.includes(movie.id))
    .map(({ movie, record }) => {
      let score = 0;
      const reasons: string[] = [];
      const timeDiff = Math.abs(movie.durationMinutes - picker.availableMinutes);
      if (movie.durationMinutes <= picker.availableMinutes + 15) {
        score += Math.max(0, 25 - Math.floor(timeDiff / 8));
        reasons.push(`片长 ${movie.durationMinutes} 分钟，贴近你当前 ${picker.availableMinutes} 分钟的可用时间。`);
      }
      if (movie.moods.includes(picker.mood)) {
        score += 20;
        reasons.push(`内容气质匹配“${picker.mood}”心情。`);
      }
      const genreMatches = movie.genres.filter((genre) => picker.genres.includes(genre));
      if (genreMatches.length) {
        score += Math.min(20, genreMatches.length * 8);
        reasons.push(`类型命中：${genreMatches.join("、")}。`);
      }
      const platformMatches = movie.platforms.filter((platform) => picker.platforms.includes(platform.platformName));
      if (platformMatches.length) {
        score += 15;
        reasons.push(`可在 ${platformMatches.map((item) => item.platformName).join("、")} 观看。`);
      }
      if (movie.companions.includes(picker.companion)) {
        score += 10;
        reasons.push(`适合${picker.companion}观看。`);
      }
      if (record?.priority === "很想看") {
        score += 5;
        reasons.push("你之前标记过“很想看”。");
      }
      if (record && daysSince(record.createdAt) > 14) {
        score += 5;
        reasons.push("已经在片单里等待了一段时间。");
      }
      if (!genreMatches.length && profile.favoriteGenres.some((genre) => movie.genres.includes(genre))) {
        score += 4;
        reasons.push("符合你的常看类型偏好。");
      }
      return { movie, record, score, reasons: reasons.length ? reasons : ["综合片长、类型和平台后给出的候选。"] };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

function calcGenreScores(rows: { movie: Movie; record?: UserMovieRecord }[], profile: UserProfile) {
  const scores: Record<string, number> = {};
  for (const genre of profile.favoriteGenres) scores[genre] = (scores[genre] ?? 0) + 6;
  for (const { movie, record } of rows) {
    for (const genre of movie.genres) {
      if (!scores[genre]) scores[genre] = 0;
      if (record?.status === "已看") scores[genre] += 8;
      if (record?.status === "想看") scores[genre] += 3;
      if (normalizeRating(record?.rating ?? 0) >= 4) scores[genre] += 5;
      if (record) scores[genre] += 2;
    }
  }
  return Object.entries(scores)
    .map(([genre, score]) => ({ genre, score }))
    .sort((a, b) => b.score - a.score);
}

function calcSummary(rows: { movie: Movie; record?: UserMovieRecord }[]) {
  const watched = rows.filter(({ record }) => record?.status === "已看" || (record?.rating ?? 0) > 0);
  const ratings = watched.map(({ record }) => normalizeRating(record?.rating ?? 0)).filter(Boolean);
  const platformMap: Record<string, number> = {};
  for (const { record } of watched) {
    const platform = record?.watchPlatform || "未记录平台";
    platformMap[platform] = (platformMap[platform] ?? 0) + 1;
  }
  return {
    watchedCount: watched.length,
    totalMinutes: watched.reduce((sum, { movie }) => sum + movie.durationMinutes, 0),
    averageRating: ratings.length ? (ratings.reduce((sum, item) => sum + item, 0) / ratings.length).toFixed(1) : "",
    rewatchCount: rows.filter(({ record }) => record?.tags.includes("二刷")).length,
    platformMap,
  };
}

function calcRatingRank(rows: { movie: Movie; record?: UserMovieRecord }[]) {
  return rows
    .map(({ movie, record }) => ({
      movie,
      value: normalizeRating(record?.rating ?? 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || b.movie.year - a.movie.year)
    .slice(0, 5);
}

function calcSearchHeatRank(rows: { movie: Movie; record?: UserMovieRecord }[]) {
  return rows
    .map(({ movie, record }, index) => {
      const recency = Math.max(0, movie.year - 2015);
      const platformBoost = movie.platforms.length * 7;
      const typeBoost = movie.type === "短剧" ? 30 : movie.type === "综艺" ? 24 : movie.type === "剧集" ? 16 : 8;
      const statusBoost = record?.status === "在看" ? 22 : record?.status === "想看" ? 12 : record?.status === "已看" ? 8 : 0;
      const ratingBoost = normalizeRating(record?.rating ?? 0) * 5;
      return {
        movie,
        value: recency + platformBoost + typeBoost + statusBoost + ratingBoost + (index % 9),
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

function calcTagHeatRank(rows: { movie: Movie; record?: UserMovieRecord }[], tags: string[]) {
  return rows
    .filter(({ movie }) => tags.some((tag) => movie.genres.includes(tag) || movie.type === tag))
    .map((row, index) => ({
      movie: row.movie,
      value: calcHeatValue(row, index),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function calcShortDramaRank(rows: { movie: Movie; record?: UserMovieRecord }[]) {
  return rows
    .filter(({ movie }) => movie.type === "短剧" || movie.genres.includes("短剧"))
    .map((row, index) => ({
      movie: row.movie,
      value: calcHeatValue(row, index) + 20,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function calcYingjiRank(rows: { movie: Movie; record?: UserMovieRecord }[]) {
  return rows
    .map(({ movie, record }, index) => {
      const rating = normalizeRating(record?.rating ?? 0);
      const status = record?.status === "已看" ? 24 : record?.status === "在看" ? 18 : record?.status === "想看" ? 10 : 0;
      const progress = Math.round((record?.progress ?? 0) / 5);
      const listBoost = (record?.lists.length ?? 0) * 5;
      return {
        movie,
        value: rating * 18 + status + progress + listBoost + (index % 7),
      };
    })
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function calcCategoryRanks(rows: { movie: Movie; record?: UserMovieRecord }[]) {
  const labels = ["短剧", "古装", "都市", "悬疑", "爱情", "喜剧", "综艺", "纪录片", "动画"];
  return labels
    .map((label) => ({
      label,
      items: calcTagHeatRank(rows, [label]),
    }))
    .filter((group) => group.items.length > 0);
}

function calcHeatValue(row: { movie: Movie; record?: UserMovieRecord }, index: number) {
  const recency = Math.max(0, row.movie.year - 2015);
  const platformBoost = row.movie.platforms.length * 7;
  const typeBoost = row.movie.type === "短剧" ? 30 : row.movie.type === "综艺" ? 24 : row.movie.type === "剧集" ? 16 : 8;
  const statusBoost = row.record?.status === "在看" ? 22 : row.record?.status === "想看" ? 12 : row.record?.status === "已看" ? 8 : 0;
  const ratingBoost = normalizeRating(row.record?.rating ?? 0) * 5;
  return recency + platformBoost + typeBoost + statusBoost + ratingBoost + (index % 9);
}

function normalizeRating(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const normalized = value > 5 ? Math.round(value / 2) : Math.round(value);
  return Math.min(5, Math.max(1, normalized));
}

function inferMoods(genres: string[]): Mood[] {
  const moods = new Set<Mood>();
  if (genres.some((genre) => ["喜剧", "动画", "冒险", "综艺", "甜宠", "短剧"].includes(genre))) moods.add("轻松");
  if (genres.some((genre) => ["动作", "犯罪", "悬疑", "逆袭", "爽剧"].includes(genre))) moods.add("刺激");
  if (genres.some((genre) => ["治愈", "家庭", "纪录片"].includes(genre))) moods.add("治愈");
  if (genres.some((genre) => ["科幻", "悬疑"].includes(genre))) moods.add("烧脑");
  return moods.size ? [...moods] : ["轻松"];
}

function inferCompanions(genres: string[], type: ContentType): Companion[] {
  const companions = new Set<Companion>(["独自"]);
  if (genres.some((genre) => ["爱情", "治愈"].includes(genre))) companions.add("情侣");
  if (genres.some((genre) => ["喜剧", "动作", "科幻", "悬疑"].includes(genre))) companions.add("朋友");
  if (genres.some((genre) => ["动画", "家庭", "纪录片", "综艺"].includes(genre)) || type === "动漫") companions.add("家庭");
  if (type === "短剧") companions.add("朋友");
  return [...companions];
}

function isSenior(ageRange: string) {
  return ["55-64", "65以上"].includes(ageRange);
}

function daysSince(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}

function secondsLabel(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = String(safeSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RankList({
  title,
  items,
  valueSuffix,
  onSelect,
}: {
  title: string;
  items: { movie: Movie; value: number }[];
  valueSuffix: string;
  onSelect?: (movie: Movie) => void;
}) {
  return (
    <section className="rank-card">
      <h2>{title}</h2>
      <div className="rank-list">
        {items.length ? items.map((item, index) => (
          <button className="rank-item" key={item.movie.id} onClick={() => onSelect?.(item.movie)}>
            <b>{index + 1}</b>
            <span className="poster rank-poster">{item.movie.poster}</span>
            <div>
              <strong>{item.movie.title}</strong>
              <span>{item.movie.type} · {item.movie.year}</span>
            </div>
            <em>{item.value}{valueSuffix}</em>
          </button>
        )) : <p>暂无数据</p>}
      </div>
    </section>
  );
}

function RatingControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="rating-control" aria-label="观影评分">
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        <option value={0}>未评分</option>
        {[1, 2, 3, 4, 5].map((score) => (
          <option value={score} key={score}>{score} 分</option>
        ))}
      </select>
      <span aria-hidden="true">{"★★★★★".slice(0, value)}{"☆☆☆☆☆".slice(value)}</span>
    </div>
  );
}

function MovieDetailModal(props: {
  row?: { movie: Movie; record?: UserMovieRecord };
  close: () => void;
  updateRecord: (movieId: string, patch: Partial<UserMovieRecord>) => void;
  startSoloWatch: (movie: Movie, startSeconds?: number) => void;
  startWatchParty: (movie: Movie, startSeconds?: number) => void;
}) {
  if (!props.row) return null;
  const { movie, record } = props.row;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={`${movie.title}详情`} onClick={props.close}>
      <article className="movie-modal" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={props.close} aria-label="关闭详情">×</button>
        <div className="modal-head">
          <span className="poster">{movie.poster}</span>
          <div>
            <p className="eyebrow">{movie.type} · {movie.year}</p>
            <h1>{movie.title}</h1>
            <p>{movie.alias || "暂无别名"} · {movie.durationMinutes} 分钟 · {record?.status ?? "未收藏"}</p>
          </div>
        </div>
        <p>{movie.summary || "暂无简介"}</p>
        <div className="chips">
          {movie.genres.map((genre) => <span className="chip strong" key={genre}>{genre}</span>)}
        </div>
        {!!movie.actors.length && <p>主演/嘉宾：{movie.actors.join("、")}</p>}
        <div className="platform-tags">
          {movie.platforms.length ? movie.platforms.map((platform) => (
            <a href={playableUrl(platform, movie.title)} key={platform.platformName} rel="noreferrer" target="_blank">
              {platform.platformName} · {platform.watchType}
            </a>
          )) : <span>暂无平台信息</span>}
        </div>
        <div className="modal-actions">
          <RatingControl
            value={normalizeRating(record?.rating ?? 0)}
            onChange={(rating) => props.updateRecord(movie.id, { rating, status: rating > 0 ? "已看" : record?.status })}
          />
          <button onClick={() => props.updateRecord(movie.id, { status: "在看", progress: Math.max(record?.progress ?? 0, 10) })}>
            标记在看
          </button>
          <button onClick={() => props.startSoloWatch(movie, Math.floor(movie.durationMinutes * 60 * ((record?.progress ?? 0) / 100)))}>
            直接观看
          </button>
          <button className="primary" onClick={() => props.startWatchParty(movie)}>
            邀请共看
          </button>
        </div>
      </article>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <header className="page-header">
      <p className="eyebrow">CineList</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}

function Input({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <label>
      {label}
      <input required={required} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function CheckboxGroup({ label, options, values, onChange }: { label: string; options: string[]; values: string[]; onChange: (values: string[]) => void }) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="chips selectable">
        {options.map((option) => (
          <button
            type="button"
            className={values.includes(option) ? "chip selected" : "chip"}
            key={option}
            onClick={() => onChange(values.includes(option) ? values.filter((item) => item !== option) : [...values, option])}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function BarList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((item) => item.value), 1);
  if (!items.length) return <EmptyState text="暂无统计数据。" />;
  return (
    <div className="bar-list">
      {items.map((item) => (
        <div className="bar-row" key={item.label}>
          <span>{item.label}</span>
          <div><i style={{ width: `${(item.value / max) * 100}%` }} /></div>
          <b>{item.value}</b>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

export default App;
