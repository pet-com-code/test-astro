import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { zValidator } from "@hono/zod-validator";
import { createClient } from "@supabase/supabase-js";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import { eq } from "drizzle-orm";
import type { HonoEnv } from "@/types"; // 공통 타입 임포트

// 파일 분석을 바탕으로 profiles와 insertProfileSchema 임포트
import { profiles, insertProfileSchema } from "@/db/schema";
import { requireAuth } from "@/mw/authMiddleware";

const auth = new Hono<HonoEnv>();

// 1. 공통 스키마 정의 (중복 제거)
export const loginSchema = z.object({
    email: z.string().email({ message: "올바른 이메일 형식이 아닙니다." }),
    password: z
        .string()
        .min(6, { message: "비밀번호는 최소 6자리 이상이어야 합니다." })
});

// 2. 파일의 insertProfileSchema 정보를 확장하여 회원가입 요청 스키마 빌드
//    - Supabase 가입을 위해 email, password가 필요하며
//    - D1 profiles 테이블 검증 규칙(insertProfileSchema)의 username과 phoneNumber를 그대로 연결합니다.
export const signUpSchema = loginSchema.extend({
    username: insertProfileSchema.shape.username,
    // 필요 시 클라이언트가 핸드폰 번호도 함께 보낼 수 있도록 선택 플래그 추가
    phoneNumber: insertProfileSchema.shape.phoneNumber
});

// 로그인 (Flutter / Astro에서 호출하여 JWT 토큰 발급)
auth.post("/login", zValidator("json", loginSchema), async (c) => {
    // 검증된 안전한 데이터 가져오기
    const { email, password } = c.req.valid("json");
    console.log("email : ", email, "   password : ", password);

    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error || !data.session) {
        return c.json(
            { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
            401
        );
    }

    return c.json({
        message: "로그인 성공",
        token: data.session.access_token,
        refreshToken: data.session.refresh_token,
        user: {
            id: data.user.id,
            email: data.user.email
        }
    });
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
    // 1. 검증된 안전한 데이터 가져오기
    const { email, password } = c.req.valid("json");
    console.log(`[Login Request] email: ${email}`);

    // 2. Supabase Auth인증 시도
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    // 인증 실패 또는 세션이 없을 경우 처리
    if (error || !data?.session) {
        return c.json(
            { error: "이메일 또는 비밀번호가 올바르지 않습니다." },
            401
        );
    }

    const { access_token, refresh_token, user } = data.session;
    const db = drizzle(c.env.DB);

    try {
        // 3. 🌟 D1 데이터베이스에서 프로필 데이터 조회 (이전 파일 스키마 기반)
        const [userProfile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.userId, user.id))
            .limit(1);

        // 4. 🔒 회원 상태 점검 (스키마의 isActive 정보 활용)
        if (userProfile && !userProfile.isActive) {
            return c.json(
                {
                    error: "정지되거나 비활성화된 계정입니다. 고객센터에 문의하세요."
                },
                403 // Forbidden
            );
        }

        // 5. 프론트엔드(Flutter/Astro)를 위한 최적화된 결과 반환
        return c.json({
            message: "로그인 성공",
            token: access_token,
            refreshToken: refresh_token,
            user: {
                id: user.id,
                email: user.email,
                // D1 DB에서 가져온 실제 메타데이터 결합
                username: userProfile?.username || "Unknown",
                roles: userProfile?.roles || "user",
                phoneNumber: userProfile?.phoneNumber || null
            }
        });
    } catch (dbError) {
        console.error("❌ 로그인 중 D1 프로필 조회 실패:", dbError);

        // 안심 대책: DB 조회에 실패하더라도 인증 토큰은 발급되었으므로 기본 정보만 들려보낼지,
        // 혹은 서버 에러를 낼지 결정할 수 있습니다. 여기서는 사용자 경험을 위해 기본 정보로 진행합니다.
        return c.json({
            message: "로그인 성공 (프로필 조회 일시적 에러)",
            token: access_token,
            refreshToken: refresh_token,
            user: {
                id: user.id,
                email: user.email,
                roles: "user"
            }
        });
    }
});

// 💡 1. 회원가입 요청 검증 스키마 (Supabase 가입용 + Profile 생성용)
//   - Supabase 가입용 : email, password, username
//   - Profile 생성용 : userId, email, username

auth.post("/signup", zValidator("json", signUpSchema), async (c) => {
    // 미들웨어를 통과했으므로 이미 안전함이 보장되고 타입이 추론됨
    const { email, password, username, phoneNumber } = c.req.valid("json");
    console.log("회원가입 요청 데이터:", { email, username, password });

    // 2. Supabase Auth 회원가입
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username }
        }
    });

    if (authError || !authData.user) {
        return c.json(
            { error: authError?.message || "회원가입에 실패했습니다." },
            (authError?.status || 400) as ContentfulStatusCode
            // as ContentfulStatusCode를 붙여 Hono가 인식하는 HTTP 상태 코드임을 알려주는 방식
        );
    }

    // 3. Supabase에서 발급받은 userId 추출
    const userId = authData.user.id;
    const db = drizzle(c.env.DB);

    try {
        // insertProfileSchema로 D1에 넣을 객체 생성 (userId + username 조합)
        // 5. 파일에서 분석한 insertProfileSchema 규칙으로 완벽하게 파싱 및 검증
        //    - roles, isActive, createdAt 등은 DB 혹은 스키마 기본값으로 자동 처리됩니다.
        const profileData = insertProfileSchema.parse({
            userId,
            username,
            phoneNumber // 입력되지 않았다면 undefined 처리되어 스키마에 의해 자동으로 nullable 처리됨
        });

        // 🌟 5. parsed.data가 아닌 profileData를 넣어줍니다! (타입 에러 해결 지점)
        const [newProfile] = await db
            .insert(profiles)
            .values(profileData)
            .returning();

        return c.json(
            {
                message: "회원가입이 완료되었습니다.",
                profile: newProfile
            },
            201
        );
    } catch (dbError: any) {
        console.error("❌ D1 프로필 저장 실패:", dbError);
        return c.json(
            { error: "인증 계정은 생성되었으나 프로필 저장에 실패했습니다." },
            500
        );
    }
});

// 미들웨어(requireAuth)를 라우터 사이에 배치합니다.
auth.get("/me", requireAuth, async (c) => {
    // 미들웨어에서 이미 검증 완료된 Supabase 유저 정보 가져오기
    const authUser = c.get("authUser");

    const db = drizzle(c.env.DB);

    try {
        // 1. Drizzle ORM을 사용하여 타입 안정성과 카멜케이스 포맷 보장
        const [profile] = await db
            .select()
            .from(profiles)
            .where(eq(profiles.userId, authUser.id))
            .limit(1);

        // 2. 🔒 비활성화 유저 체크 (보안 강화)
        if (profile && !profile.isActive) {
            return c.json({ error: "정지되거나 비활성화된 계정입니다." }, 403);
        }

        // 3. Astro 클라이언트가 바로 상태(State)에 집어넣기 좋게 구조화된 데이터 반환
        return c.json({
            success: true,
            user: {
                id: authUser.id,
                email: authUser.email,
                // DB 프로필이 있으면 DB 값을, 없으면 Supabase 메타데이터를 Fallback으로 사용
                username:
                    profile?.username ||
                    authUser.user_metadata?.username ||
                    "사용자",
                roles: profile?.roles || "user",
                phoneNumber: profile?.phoneNumber || null,
                createdAt: profile?.createdAt || null
            }
        });
    } catch (dbError) {
        console.error("❌ [/me] D1 프로필 조회 실패:", dbError);

        // DB 장애 상황이더라도 Supabase 인증은 성공했으므로 Fallback 데이터 반환 (서비스 가용성 확보)
        return c.json({
            success: true,
            user: {
                id: authUser.id,
                email: authUser.email,
                username: authUser.user_metadata?.username || "사용자",
                roles: "user",
                phoneNumber: null,
                createdAt: null
            }
        });
    }
});

export default auth;
