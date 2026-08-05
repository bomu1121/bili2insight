/**
 * 平台统一信息提示（Toast）
 * ref: ancoleman/ai-design-components/toast-patterns — bottom-right 定位（不遮挡导航/头部、自然阅读流、易堆叠）
 * ref: sonner (12.5k stars) — 右下角堆叠 + 悬停保持
 * ref: steinsgate-theme — Notification = incoming D-Mail（角落新消息）
 */
import { createDiscreteApi } from "naive-ui";

const { message } = createDiscreteApi(["message"], {
  messageProviderProps: {
    placement: "bottom-right",
    duration: 3200,
    keepAliveOnHover: true,
  },
});

export { message };
