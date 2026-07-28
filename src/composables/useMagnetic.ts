import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export function useMagnetic(
  elRef: Ref<HTMLElement | null>,
  options: { strength?: number; radius?: number } = {}
) {
  const { strength = 0.3, radius = 100 } = options
  const isActive = ref(false)
  let rafId = 0
  let currentX = 0, currentY = 0
  let targetX = 0, targetY = 0

  function onMove(e: MouseEvent) {
    const el = elRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > radius) {
      isActive.value = false
      targetX = 0; targetY = 0
      return
    }
    isActive.value = true
    const power = 1 - Math.min(dist / radius, 1)
    targetX = dx * strength * power
    targetY = dy * strength * power
  }

  function onLeave() {
    isActive.value = false
    targetX = 0; targetY = 0
  }

  function animate() {
    currentX += (targetX - currentX) * 0.1
    currentY += (targetY - currentY) * 0.1
    if (Math.abs(currentX - targetX) > 0.01 || Math.abs(currentY - targetY) > 0.01) {
      const el = elRef.value
      if (el) {
        el.style.transform = `translate(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px)`
      }
      rafId = requestAnimationFrame(animate)
    }
  }

  const cleanup = () => cancelAnimationFrame(rafId)

  onMounted(() => {
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    animate()
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseleave', onLeave)
    cleanup()
  })

  return { isActive, cleanup }
}

export function useTilt(
  elRef: Ref<HTMLElement | null>,
  options: { maxTilt?: number; perspective?: number } = {}
) {
  const { maxTilt = 8, perspective = 800 } = options

  function onMove(e: MouseEvent) {
    const el = elRef.value
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const tiltX = (y - 0.5) * -maxTilt
    const tiltY = (x - 0.5) * maxTilt
    el.style.transform = `perspective(${perspective}px) rotateX(${tiltX.toFixed(1)}deg) rotateY(${tiltY.toFixed(1)}deg) scale3d(1.02, 1.02, 1.02)`
    el.style.transition = 'transform 0.1s ease-out'
  }

  function onLeave() {
    const el = elRef.value
    if (!el) return
    el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`
    el.style.transition = 'transform 0.5s var(--spring-soft)'
  }

  onMounted(() => {
    const el = elRef.value
    if (!el) return
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
  })

  onUnmounted(() => {
    const el = elRef.value
    if (!el) return
    el.removeEventListener('mousemove', onMove)
    el.removeEventListener('mouseleave', onLeave)
  })
}
