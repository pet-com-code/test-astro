// vite.config.ts
import { defineConfig } from "vite-plus";

export default defineConfig({
    // 1. Oxlint (ESLint 대체) 규칙 설정
    lint: {
        // 빌드 결과물이나 Astro 내부 임시 캐시 폴더는 제외
        ignorePatterns: ["dist/**", ".astro/**", "node_modules/**"],
        // 기본 추천 규칙 적용
        recommended: true
    },

    // 2. Oxfmt (Prettier 대체) 포맷 스타일 설정
    fmt: {
        semi: true, // 문장 끝에 세미콜론 사용
        singleQuote: true, // 힉따옴표(') 사용
        trailingComma: "es5", // 후행 콤마 설정
        tabWidth: 2 // 들여쓰기 공백 수
    }
});
