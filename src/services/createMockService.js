function wait(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Factory for a mock REST-like service backed by an in-memory array.
// Every method is async and returns plain data, matching the shape a
// FastAPI JSON response would have — so swapping the body for a real
// `fetch`/axios call later doesn't require touching any calling code.
export function createMockService(initialData, keyField = 'id') {
  let store = [...initialData]

  return {
    async list(params = {}) {
      await wait()
      let result = [...store]
      if (params.filter) {
        result = result.filter(params.filter)
      }
      return result
    },
    async get(id) {
      await wait(200)
      const item = store.find((row) => row[keyField] === id)
      if (!item) {
        const error = new Error('Not found')
        error.code = 'NOT_FOUND'
        throw error
      }
      return item
    },
    async create(payload) {
      await wait()
      const item = { [keyField]: `${keyField}-${Date.now()}`, ...payload }
      store = [item, ...store]
      return item
    },
    async update(id, payload) {
      await wait()
      store = store.map((row) => (row[keyField] === id ? { ...row, ...payload } : row))
      return store.find((row) => row[keyField] === id)
    },
    async remove(id) {
      await wait()
      store = store.filter((row) => row[keyField] !== id)
      return { success: true }
    },
    getSnapshot() {
      return store
    },
  }
}
