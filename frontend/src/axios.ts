import axios from 'axios'

let activeRequests = 0
let loadingCallback: ((isLoading: boolean) => void) | null = null

export const setLoadingCallback = (callback: (isLoading: boolean) => void) => {
  loadingCallback = callback
}

const notifyLoading = (isLoading: boolean) => {
  if (loadingCallback) {
    loadingCallback(isLoading)
  }
}

axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    activeRequests++
    if (activeRequests === 1) {
      notifyLoading(true)
    }
    return config
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1)
    if (activeRequests === 0) {
      notifyLoading(false)
    }
    return Promise.reject(error)
  },
)

axios.interceptors.response.use(
  (response) => {
    activeRequests = Math.max(0, activeRequests - 1)
    if (activeRequests === 0) {
      notifyLoading(false)
    }
    return response
  },
  (error) => {
    activeRequests = Math.max(0, activeRequests - 1)
    if (activeRequests === 0) {
      notifyLoading(false)
    }
    return Promise.reject(error)
  },
)
