<template>
  <div class="dmail-root" :class="{ show: visible }" role="presentation" @click.self="emit('cancel')">
    <div
      class="dmail-panel"
      :class="[`severity-${severity}`]"
      ref="panelRef"
      tabindex="-1"
      role="alertdialog"
      aria-modal="true"
      :aria-label="severityLabel"
      @keydown="onKeydown"
    >

      <div class="dmail-scanline"></div>

      <div class="dmail-header">
        <span class="dmail-tag" :class="`severity-${severity}`">{{ severityLabel }}</span>
        <span class="dmail-id">ID:0x{{ idHex }}</span>
      </div>

      <div class="dmail-body">
        <span class="dmail-cursor">></span>
        <span class="dmail-text">{{ displayedText }}</span>
        <span class="dmail-caret" v-if="typing"></span>
      </div>

      <div class="dmail-extra" v-if="$slots.extra">
        <slot name="extra" />
      </div>

      <div class="dmail-footer">
        <button class="dmail-btn abort" :disabled="loading" @click="emit('cancel')">
          <span class="dmail-btn-key">Esc</span>
          <span>{{ cancelText }}</span>
        </button>
        <button class="dmail-btn send" :class="`severity-${severity}`" :disabled="loading" @click="emit('confirm')">
          <span v-if="loading" class="dmail-spinner"></span>
          <span>{{ loading ? loadingText : confirmText }}</span>
          <span v-if="!loading" class="dmail-btn-key">&#x21B5;</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from "vue";

const props = withDefaults(defineProps<{
  show: boolean;
  message: string;
  confirmText?: string;
  cancelText?: string;
  severity?: "danger" | "warning";
  typeSpeed?: number;
  loading?: boolean;
  loadingText?: string;
}>(), {
  confirmText: "SEND",
  cancelText: "ABORT",
  severity: "danger",
  typeSpeed: 40,
  loading: false,
  loadingText: "处理中",
});

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();

const displayedText = ref("");
const visible = ref(false);
const typing = ref(true);
const dismissTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const panelRef = ref<HTMLElement | null>(null);
const previousFocus = ref<HTMLElement | null>(null);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault();
    emit('cancel');
  } else if (e.key === 'Enter' && !typing.value && !props.loading) {
    e.preventDefault();
    emit('confirm');
  } else if (e.key === 'Tab') {
    trapFocus(e);
  }
}

function trapFocus(e: KeyboardEvent) {
  const panel = panelRef.value;
  if (!panel) return;
  const focusables = panel.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  if (focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function resetTypewriter() {
  if (dismissTimer.value) clearTimeout(dismissTimer.value);
  displayedText.value = "";
  typing.value = true;
}

async function animateText() {
  resetTypewriter();
  for (let i = 0; i <= props.message.length; i++) {
    displayedText.value = props.message.substring(0, i);
    const jitter = Math.random() * 25 - 5;
    await new Promise(r => setTimeout(r, props.typeSpeed + jitter));
  }
  typing.value = false;
}

const severityLabel = computed(() => props.severity === "danger" ? "[D-MAIL]" : "[WARNING]");

const idHex = computed(() => {
  const chars = "0123456789ABCDEF";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * 16)];
  return out;
});

watch(() => props.show, async (v) => {
  if (v) {
    previousFocus.value = document.activeElement as HTMLElement | null;
    visible.value = true;
    animateText();
    nextTick(() => panelRef.value?.focus());
  } else {
    dismissTimer.value = setTimeout(() => {
      visible.value = false;
      resetTypewriter();
      previousFocus.value?.focus?.();
      previousFocus.value = null;
    }, 120);
  }
});
</script>

<style scoped>
/* === D-Mail Terminal Confirm === */
/* ref: Steins;Gate VN phone-trigger UI + terminal prompt */
/* ref: Nixie tube divergence meter for ID header */

.dmail-root {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(3px);
  opacity: 0;
  visibility: hidden;
  transition: opacity var(--dur-3) var(--ease-out), visibility var(--dur-3);
}

.dmail-root.show {
  opacity: 1;
  visibility: visible;
}

.dmail-panel {
  position: relative;
  width: 420px;
  max-width: calc(100vw - 40px);
  background: var(--color-surface);
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-hover), 0 0 40px rgba(0, 0, 0, 0.5);
  animation: dmail-enter 0.35s var(--ease-out) both;
  transform-origin: center center;
}

.dmail-panel.severity-warning {
  width: 480px;
  border-color: var(--color-warning-border);
  box-shadow: var(--shadow-hover), 0 0 30px rgba(255, 142, 66, 0.12);
}

.dmail-panel.severity-danger {
  border-color: var(--color-error-border);
  box-shadow: var(--shadow-hover), 0 0 20px rgba(181, 58, 58, 0.1);
}

@keyframes dmail-enter {
  from {
    opacity: 0;
    transform: translateY(-12px) scale(0.96);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

/* Scanline */
.dmail-scanline {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    transparent 5%,
    rgba(139, 62, 62, 0.25) 20%,
    rgba(139, 62, 62, 0.25) 80%,
    transparent 95%
  );
  animation: scanline-sweep 3s ease-in-out infinite;
}

@keyframes scanline-sweep {
  0% { top: 0; opacity: 0; }
  15% { opacity: 0.6; }
  30% { opacity: 0; }
  100% { top: 100%; opacity: 0; }
}

/* Header */
.dmail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 10px;
  border-bottom: 1px solid var(--color-border);
}

.dmail-tag {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: var(--radius-xs);
}

.dmail-tag.severity-danger {
  color: var(--color-error);
  background: var(--color-error-soft);
  border: 1px solid var(--color-error-border);
}

.dmail-tag.severity-warning {
  color: var(--color-warning);
  background: var(--color-warning-soft);
  border: 1px solid var(--color-warning-border);
  text-shadow: var(--amber-glow);
}

.dmail-id {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--divergence-color);
  text-shadow: var(--divergence-glow);
  letter-spacing: 0.04em;
}

/* Body */
.dmail-body {
  padding: 18px 16px 22px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-height: 48px;
  font-family: var(--font-mono);
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.dmail-cursor {
  color: var(--divergence-color);
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}

.dmail-text {
  flex: 1;
  min-width: 0;
}

.dmail-caret {
  display: inline-block;
  width: 8px;
  height: 14px;
  background: var(--divergence-color);
  margin-left: 2px;
  animation: caret-blink 0.8s step-end infinite;
  vertical-align: -1px;
}

@keyframes caret-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Extra content (template picker etc.) */
/* ref: Radix Alert Dialog — dialog body stays compact, secondary content scrolls internally */
.dmail-extra {
  padding: 0 16px 18px;
  max-height: 240px;
  overflow-y: auto;
  border-top: 1px dashed var(--color-border);
}

/* Footer */
.dmail-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px 14px;
  border-top: 1px solid var(--color-border);
  background: var(--color-surface-muted);
}

.dmail-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all var(--dur-2);
  user-select: none;
}

.dmail-btn:hover {
  border-color: var(--color-border-strong);
}

.dmail-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}

.dmail-spinner {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  border-radius: 50%;
  border: 2px solid var(--color-border-strong);
  border-top-color: currentColor;
  animation: spin 0.8s linear infinite;
}

.dmail-btn-key {
  font-size: 10px;
  color: var(--color-text-tertiary);
  letter-spacing: 0;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--color-ink-soft);
}

.dmail-btn.abort {
  color: var(--color-text-secondary);
}

.dmail-btn.abort:hover {
  color: var(--color-text);
  border-color: var(--color-border-strong);
}

.dmail-btn.send {
  color: var(--color-text);
}

.dmail-btn.send.severity-danger {
  border-color: var(--color-error-border);
  background: var(--color-error-soft);
  color: var(--color-error);
}

.dmail-btn.send.severity-danger:hover {
  background: var(--color-error);
  color: var(--color-on-error);
  border-color: var(--color-error);
  box-shadow: 0 0 12px rgba(181, 58, 58, 0.35);
}

.dmail-btn.send.severity-warning {
  border-color: var(--color-warning-border);
  background: var(--color-warning-soft);
  color: var(--color-warning);
  text-shadow: var(--amber-glow);
}

.dmail-btn.send.severity-warning:hover {
  background: var(--color-warning);
  color: var(--color-text-inverse);
  border-color: var(--color-warning);
  box-shadow: 0 0 16px rgba(255, 142, 66, 0.4);
}
</style>
