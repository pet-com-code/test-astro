import type { APIRoute } from "astro";
import { z } from "zod";

export const prerender = false;

// 프런트엔드 요청 형식 검증

const signupRequestSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1),
    username: z.string().trim().min(1)
});

// 백엔드 오류 응답 형식
const backendErrorSchema = z.object({
    error: z.string().optional()
});

export const POST: APIRoute = async ({ request }) => {
    // 1. 백엔드 URL 확인
    // 예: HONO_SIGNUP_URL=http://127.0.0.1:3000/api/signup
    const honoSignupUrl = import.meta.env.HONO_SIGNUP_URL;

    if (!honoSignupUrl) {
        console.error("HONO_SIGNUP_URL 환경 변수가 설정되지 않았습니다.");

        return Response.json(
            { success: false, error: "회원가입 서비스를 사용할 수 없습니다." },
            { status: 500 }
        );
    }

    // 2. 요청 본문 파싱
    let rawBody: unknown;

    try {
        rawBody = await request.json();
    } catch {
        return Response.json(
            { success: false, error: "잘못된 요청 형식입니다." },
            { status: 400 }
        );
    }

    // 3. 요청 형식 검증
    const parsedBody = signupRequestSchema.safeParse(rawBody);

    if (!parsedBody.success) {
        return Response.json(
            { success: false, error: "입력 정보를 확인해주세요." },
            { status: 400 }
        );
    }

    try {
        // 4. Hono 백엔드로 전달
        const honoResponse = await fetch(honoSignupUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json"
            },
            body: JSON.stringify(parsedBody.data)
        });

        // 5. 백엔드 응답을 안전하게 파싱
        let backendBody: unknown = null;

        try {
            backendBody = await honoResponse.json();
        } catch {
            // 백엔드가 JSON이 아닌 응답을 반환할 수 있음
        }

        if (!honoResponse.ok) {
            const parsedError = backendErrorSchema.safeParse(backendBody);
            const backendMessage =
                parsedError.success && parsedError.data.error;

            // 5xx 내부 오류 메시지는 사용자에게 그대로 노출하지 않음
            const safeMessage =
                honoResponse.status >= 500
                    ? "회원가입 처리 중 서버 오류가 발생했습니다."
                    : backendMessage || "회원가입 요청을 처리할 수 없습니다.";

            return Response.json(
                { success: false, error: safeMessage },
                { status: honoResponse.status }
            );
        }

        // 성공 상태 코드여도 응답 본문이 유효한 JSON인지 확인
        if (backendBody === null) {
            return Response.json(
                {
                    success: false,
                    error: "백엔드 응답 형식이 올바르지 않습니다."
                },
                { status: 502 }
            );
        }

        // 6. 프런트엔드가 기대하는 응답 형식으로 통일
        return Response.json({ success: true }, { status: 200 });
    } catch (error: unknown) {
        // 서버 로그에만 상세 오류를 기록
        console.error("회원가입 백엔드 요청 실패:", error);

        return Response.json(
            {
                success: false,
                error: "회원가입 서비스를 일시적으로 사용할 수 없습니다."
            },
            { status: 502 }
        );
    }
};
