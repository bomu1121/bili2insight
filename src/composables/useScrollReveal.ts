import { ref, onMounted, onUnmounted, type Ref } from 'vue'

export function useScrollReveal(
  elRef: Ref<HTMLElement | null>,
  options: {
    staggerDelay?: number
    threshold?: number
    rootMargin?: string
  } = {}
) {
  const { staggerDelay = 80, threshold = 0.1, rootMargin = '0px 0px -40px 0px' } = options
  const revealed = ref(false)
  let observer: IntersectionObserver | null = null

  onMounted(() => {
    const el = elRef.value
    if (!el) return

    observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !revealed.value) {
          revealed.value = true
          const children = el.children
          Array.from(children).forEach((child, i) => {
            const htmlEl = child as HTMLElement
            const delay = i * staggerDelay
            htmlEl.style.transition = `opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) ${delay}ms, transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1) ${delay}ms`
            htmlEl.style.opacity = '0'
            htmlEl.style.transform = 'translateY(16px)'
            requestAnimationFrame(() => {
              htmlEl.style.opacity = '1'
              htmlEl.style.transform = 'translateY(0)'
            })
          })
          observer?.unobserve(el)
        }
      },
      { threshold, rootMargin }
    )
    observer.observe(el)
  })

  onUnmounted(() => {
    observer?.disconnect()
  })

  return { revealed }
}

export function useRipple() {
  function createRipple(e: MouseEvent) {
    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height)
    const x = e.clientX - rect.left - size / 2
    const y = e.clientY - rect.top - size / 2
    const ripple = document.createElement('span')
    ripple.className = 'ripple-effect'
    ripple.style.left = x + 'px'
    ripple.style.top = y + 'px'
    ripple.style.width = size + 'px'
    ripple.style.height = size + 'px'
    if (!el.classList.contains('ripple-container')) {
      el.classList.add('ripple-container')
    }
    el.appendChild(ripple)
    ripple.addEventListener('animationend', () => ripple.remove())
  }

  return { createRipple }
}
