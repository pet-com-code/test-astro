// Astro 미들웨어에서 context.locals에 데이터를 저장하려면 먼저 타입 정의를 추가해야 합니다.
// src/env.d.ts 파일에 아래 내용을 추가해 줍니다.

/// <reference path="../.astro/types.d.ts" />

declare namespace App {
    interface Locals {
        // 이 프로젝트에는 어떤 타입의 변수들이 존재한다
        //  실제 유저 데이터나 런타임 값은 절대 여기에 담기지 않음

        user: any | null; // 인증된 사용자 정보 객체
        accessToken: string | null; // 액세스 토큰
    }
}
