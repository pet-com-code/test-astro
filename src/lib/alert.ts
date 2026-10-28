export type AlertType = "success" | "error" | "warning" | "info";
// showAlert("로그인에 성공했습니다.", "success");
// showAlert("이메일을 입력해주세요.", "warning");
// showAlert("서버 연결에 실패했습니다.", "error");

export function showAlert(message: string, type: AlertType): void {
    console.log("type ", type);
    const alertElement = document.getElementById("globalCustomAlert");
    if (!alertElement) return;

    const messageSpan = alertElement.querySelector(".alert-message");
    const iconSpan = alertElement.querySelector(".alert-icon");

    const iconMap = {
        success: "✅",
        error: "🚨",
        warning: "⚠️",
        info: "ℹ️"
    };

    // 1. 기존 타입 클래스 제거 후 새로운 타입 클래스 부여
    alertElement.classList.remove("success", "error", "warning", "info");
    alertElement.classList.add(type);

    // 2. 메시지 및 아이콘 주입
    if (messageSpan) messageSpan.textContent = message;
    if (iconSpan) iconSpan.textContent = iconMap[type];

    // 2. 🌟 data-sound 속성을 읽어와서 소리 재생하기
    const soundSrc = alertElement.dataset.sound;
    console.log("sound .... ", soundSrc);
    if (soundSrc) {
        try {
            const audio = new Audio(soundSrc);
            // 소리 재생 시 브라우저 정책(Autoplay Policy) 예외 처리를 위한 catch
            audio.play().catch((err) => {
                console.warn(
                    "오디오 재생 실패 (사용자 상호작용 전이거나 파일 경로 오류):",
                    err
                );
            });
        } catch (e) {
            console.error("오디오 객체 생성 실패:", e);
        }
    }

    // 3. 화면에 표시 (.show 클래스 추가)
    alertElement.classList.add("show");

    // 4. 3초 뒤 자동으로 사라지게 처리 (기존 타이머가 있다면 초기화하는 로직 추가 권장)
    if ((window as any).alertTimer) {
        clearTimeout((window as any).alertTimer);
    }

    (window as any).alertTimer = setTimeout(() => {
        alertElement.classList.remove("show");
    }, 3000);
}
