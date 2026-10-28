import { z } from "zod";

/**
 * 1. 테마 스키마 정의 (global.css 및 기존 설정 연동)
 */
export const themeEnum = z.enum(["general", "dog", "cat"]);
export type Theme = z.infer<typeof themeEnum>;

/**
 * 2. Site Config Zod Schema Definition
 * 기존 SITE_CONFIG의 모든 구조와 데이터를 수용할 수 있도록 확장 설계
 */
export const siteConfigSchema = z.object({
  brand: z.string().min(1, "브랜드명은 필수입니다."),
  description: z.string(),
  url: z.string().url("올바른 URL 형식이어야 합니다."),
  author: z.string(),
  defaultImage: z.string(),
  keywords: z.array(z.string()).default([]),

  /**
   * 소셜 미디어 & OpenGraph/Twitter 연동 설정
   */
  social: z.object({
    locale: z.string().default("ko_KR"),
    twitter: z.string().startsWith("@").optional(),
    channels: z.object({
      instagram: z.string().url().optional(),
      youtube: z.string().url().optional(),
      github: z.string().url().optional(),
      x: z.string().url().optional()
    }),
    ogImage: z
      .object({
        width: z.number().default(1200),
        height: z.number().default(630),
        alt: z.string().optional()
      })
      .default({ width: 1200, height: 630 })
  }),

  /**
   * 테마 시스템 설정 (Multi-theme & System Preference)
   */
  theme: z.object({
    themes: z.array(themeEnum).default(["general", "dog", "cat"]),
    defaultTheme: themeEnum.default("general"),
    attribute: z.string().default("data-theme"),
    cookieKey: z.string().default("theme"),
    storageKey: z.string().default("theme"),
    useSystemPreference: z.boolean().default(true),
    metaColor: z.record(themeEnum, z.string()) // 테마별 모바일 브라우저 헤더 색상
  }),

  /**
   * 페이지네이션 & 디스플레이 설정
   */
  pagination: z.object({
    pageSize: z.number().int().positive().default(12)
  })
});

export type SiteConfig = z.infer<typeof siteConfigSchema>;

/**
 * 3. Configuration Instance (기존 값 변환 적용)
 */
export const siteConfig: SiteConfig = siteConfigSchema.parse({
  brand: "펫.닷컴",
  description:
    "실종 반려동물 찾기, 유기동물 제보 및 입양/분양, 프리미엄 반려동물 용품 쇼핑몰 플랫폼",
  url: "https://xn--te8b.xn--mk1bu44c", // 한글 도메인 퓨니코드
  author: "펫.닷컴",
  defaultImage: "/default-og-image.png",
  keywords: [
    "반려동물",
    "유기동물 제보",
    "실종동물 찾기",
    "강아지 용품",
    "고양이 용품"
  ],

  social: {
    locale: "ko_KR",
    twitter: "@pet_dot_com",
    channels: {
      instagram: "https://instagram.com",
      youtube: "https://youtube.com"
    },
    ogImage: {
      width: 1200,
      height: 630,
      alt: "펫.닷컴 메인 대표 이미지"
    }
  },

  theme: {
    themes: ["general", "dog", "cat"],
    defaultTheme: "general",
    attribute: "data-theme",
    cookieKey: "theme",
    storageKey: "theme",
    useSystemPreference: true,
    metaColor: {
      general: "#7f8c8d",
      dog: "#4a90e2",
      cat: "#ffa6c9"
    }
  },

  pagination: {
    pageSize: 12
  }
});

/*
    1. cookieKey (서버-클라이언트 동기화용) 
    • 역할: 브라우저 쿠키에 테마를 저장할 때 사용할 쿠키의 이름(예: "theme")입니다.
    • 이유: Astro는 서버 사이드 렌더링(SSR)을 지원합니다. 사용자가 페이지를 요청했을 때,
        서버가 사용자의 테마를 미리 알아채고 HTML을 완성해서 보내주려면 브라우저가 자동으로 
        서버에 전송해 주는 '쿠키'가 반드시 필요합니다. 이때 어떤 쿠키 이름을 읽을지 지정하는 
        값입니다.
    2. storageKey (클라이언트 저장용 백업)
    • 역할: 브라우저의 로컬 스토리지(LocalStorage)에 테마를 저장할 때 사용할 키 이름입니다.
    • 이유: 쿠키가 만료되거나 지워졌을 때를 대비한 백업 저장소입니다. 프론트엔드 자바스크립트
        환경에서 사용자의 테마 설정을 가장 빠르고 안정적으로 유지하기 위해 쿠키와 함께 쌍으로 
        관리됩니다. 
    3. defaultTheme (기본값 설정)
    • 역할: 유저가 사이트에 처음 방문해서 쿠키나 로컬 스토리지에 아무런 테마 기록이 없을 때 
        적용할 기본 테마(예: "general" 또는 "dog")입니다.
    • 이유: 이 값이 없으면 첫 방문자에게 어떤 색상을 보여줘야 할지 기준이 없어지므로 
        대체(Fallback) 값으로서 무조건 존재해야 합니다. 
    4. attribute (DOM 적용 위치 지정)
    • 역할: HTML 태그의 어떤 속성에 테마 이름을 주입할지 결정하는 변수(예: "data-theme")입니다.
    • 이유: 현재 코드 하단 스크립트를 보면 document.documentElement.setAttribute(attribute,
        currentTheme); 구조로 테마를 적용하고 있습니다. 즉, HTML을
        <html data-theme="dark"> 형태로 변환하여 CSS가 이를 감지하게 만듭니다. 
        만약 이 변수가 없다면 스크립트가 어디에 테마 스타일을 입혀야 할지 알 수 없습니다.
</html>
*/
