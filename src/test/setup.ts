import '@testing-library/jest-dom/vitest'

class MockIntersectionObserver {
  observe() {}

  unobserve() {}

  disconnect() {}

  takeRecords() {
    return []
  }
}

class MockResizeObserver {
  observe() {}

  unobserve() {}

  disconnect() {}
}

if (typeof globalThis.IntersectionObserver === 'undefined') {
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
}