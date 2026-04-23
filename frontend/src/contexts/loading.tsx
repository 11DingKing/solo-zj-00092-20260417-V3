import { LinearProgress } from '@mui/material'
import { createContext, FC, useState, ReactNode, useContext, useEffect, useRef } from 'react'
import { setLoadingCallback } from '../axios'

type LoadingContextType = {
  isLoading: boolean
  progress: number
}

const LoadingContext = createContext<LoadingContextType>({} as LoadingContextType)

interface LoadingContextProviderProps {
  children: ReactNode
}

const LoadingProvider: FC<LoadingContextProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const progressInterval = useRef<number | null>(null)

  useEffect(() => {
    setLoadingCallback((loading: boolean) => {
      if (loading) {
        setIsLoading(true)
        setProgress(10)
        if (progressInterval.current) {
          clearInterval(progressInterval.current)
        }
        progressInterval.current = window.setInterval(() => {
          setProgress((prev) => {
            if (prev >= 90) return 90
            return prev + Math.random() * 10
          })
        }, 200)
      } else {
        if (progressInterval.current) {
          clearInterval(progressInterval.current)
          progressInterval.current = null
        }
        setProgress(100)
        setTimeout(() => {
          setIsLoading(false)
          setProgress(0)
        }, 300)
      }
    })
  }, [])

  return (
    <LoadingContext.Provider value={{ isLoading, progress }}>
      {isLoading && (
        <LinearProgress
          variant='determinate'
          value={progress}
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            height: 3,
            backgroundColor: 'transparent',
            '& .MuiLinearProgress-bar': {
              backgroundColor: 'primary.main',
            },
          }}
        />
      )}
      {children}
    </LoadingContext.Provider>
  )
}

const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext)

  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider')
  }

  return context
}

export { LoadingProvider, useLoading }
