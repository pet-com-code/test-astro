// 프론트엔드 자바스크립트가 직접 Hono 백엔드로 쏘면 도메인이 달라 쿠키가 구워지지 않으므로,
// Astro 서버가 대신 통신하고 안전한 httpOnly 쿠키를 세팅해 주는 API를 개설

// Astro 서버에서 Hono 서버로 직접 요청하면 CORS 설정을 Hono 서버에서 일일이 풀어줘야 하고,
// 토큰을 자사 도메인 쿠키에 안전한 httpOnly 옵션으로 굽기가 까다롭습니다.
// Astro 서버가 중간에서 받아주면 브라우저 입장에서는 자사 API 통신처럼 안전하고 간편합니다.

import type { APIRoute } from "astro";
import { z } from "zod";

export const prerender = false; // 이 API를 빌드 시점의 정적 파일로 만들지 않고, 요청이 들어올 때 서버에서 처리하도록 합니다.

const loginRequestSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1)
});

const honoLoginResponseSchema = z.object({
    token: z.string().min(1).optional(),
    refreshToken: z.string().min(1).optional(),
    user: z
        .object({
            id: z.string().optional(),
            email: z.string().optional(),
            username: z.string().optional(),
            roles: z.string().optional(),
            phoneNumber: z.string().nullable().optional()
        })
        .optional(),
    error: z.string().optional()
});

export const POST: APIRoute = async ({ request, cookies }) => {
    const targetUrl = import.meta.env.HONO_LOGIN_URL;

    if (!targetUrl) {
        console.error("HONO_LOGIN_URL 환경 변수가 설정되지 않았습니다.");

        return Response.json(
            { success: false, error: "로그인 서비스를 사용할 수 없습니다." },
            { status: 500 }
        );
    }

    let rawBody: unknown;

    try {
        rawBody = await request.json();
    } catch {
        return Response.json(
            { success: false, error: "잘못된 요청 형식입니다." },
            { status: 400 }
        );
    }

    const requestResult = loginRequestSchema.safeParse(rawBody);

    if (!requestResult.success) {
        return Response.json(
            { success: false, error: "이메일과 비밀번호를 확인해주세요." },
            { status: 400 }
        );
    }

    try {
        const honoResponse = await fetch(targetUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify(requestResult.data)
        });

        let rawResponse: unknown;

        try {
            rawResponse = await honoResponse.json();
        } catch {
            rawResponse = null;
        }

        const result = honoLoginResponseSchema.safeParse(rawResponse);

        if (!honoResponse.ok) {
            const errorMessage = result.success && result.data.error;

            const status =
                honoResponse.status >= 400 && honoResponse.status < 500
                    ? honoResponse.status
                    : 502;

            return Response.json(
                {
                    success: false,
                    error: errorMessage || "로그인 요청을 처리할 수 없습니다."
                },
                { status }
            );
        }

        if (!result.success || !result.data.token) {
            console.error("Hono 로그인 응답 형식이 올바르지 않습니다.");

            return Response.json(
                {
                    success: false,
                    error: "로그인 서버의 응답을 확인할 수 없습니다."
                },
                { status: 502 }
            );
        }

        const { token, refreshToken, user } = result.data;

        // access token의 실제 만료 시간은 Supabase 설정과 일치시켜야 합니다.
        cookies.set("sb-access-token", token, {
            path: "/",
            httpOnly: true,
            secure: import.meta.env.PROD,
            sameSite: "lax",
            maxAge: 60 * 60
        });

        if (refreshToken) {
            cookies.set("sb-refresh-token", refreshToken, {
                path: "/",
                httpOnly: true,
                secure: import.meta.env.PROD,
                sameSite: "lax",
                maxAge: 60 * 60 * 24 * 30
            });
        } else {
            // 이전 세션의 refresh token이 남지 않도록 정리
            cookies.delete("sb-refresh-token", { path: "/" });
        }

        return Response.json(
            {
                success: true,
                user: user ?? null
            },
            { status: 200 }
        );
    } catch (error: unknown) {
        console.error("Hono 로그인 요청 실패:", error);

        return Response.json(
            {
                success: false,
                error: "로그인 서비스를 일시적으로 사용할 수 없습니다."
            },
            { status: 502 }
        );
    }
};
