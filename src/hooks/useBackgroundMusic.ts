import { useRef, useEffect, useState, useCallback } from 'react'

export interface UseBackgroundMusicOptions {
	/** URL of the audio file to play */
	src: string
	/** Whether music should play automatically when component mounts */
	autoPlay?: boolean
	/** Volume level (0.0 to 1.0) */
	volume?: number
	/** Whether to loop the music */
	loop?: boolean
}

export interface BackgroundMusicControls {
	/** Start playing the music */
	play: () => Promise<void>
	/** Pause the music */
	pause: () => void
	/** Stop the music (pause and reset to beginning) */
	stop: () => void
	/** Toggle play/pause */
	toggle: () => Promise<void>
	/** Set volume (0.0 to 1.0) */
	setVolume: (volume: number) => void
}

export interface BackgroundMusicState {
	/** Whether music is currently playing */
	isPlaying: boolean
	/** Whether music is currently loading */
	isLoading: boolean
	/** Whether there was an error loading the music */
	hasError: boolean
	/** Current volume (0.0 to 1.0) */
	volume: number
}

/**
 * Custom hook for managing background music playback
 */
export function useBackgroundMusic(options: UseBackgroundMusicOptions): BackgroundMusicControls & BackgroundMusicState {
	const audioRef = useRef<HTMLAudioElement | null>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [isLoading, setIsLoading] = useState(false)
	const [hasError, setHasError] = useState(false)
	const [volume, setVolumeState] = useState(options.volume ?? 0.3)

	// Initialize audio element
	useEffect(() => {
		const audio = new Audio()
		audio.src = options.src
		audio.loop = options.loop ?? true
		audio.volume = volume
		audio.preload = 'auto'

		// Event handlers
		const handleCanPlayThrough = () => {
			setIsLoading(false)
			setHasError(false)
		}

		const handleLoadStart = () => {
			setIsLoading(true)
			setHasError(false)
		}

		const handleError = () => {
			setIsLoading(false)
			setHasError(true)
			console.error('Failed to load background music:', options.src)
		}

		const handlePlay = () => {
			setIsPlaying(true)
		}

		const handlePause = () => {
			setIsPlaying(false)
		}

		const handleEnded = () => {
			setIsPlaying(false)
		}

		audio.addEventListener('canplaythrough', handleCanPlayThrough)
		audio.addEventListener('loadstart', handleLoadStart)
		audio.addEventListener('error', handleError)
		audio.addEventListener('play', handlePlay)
		audio.addEventListener('pause', handlePause)
		audio.addEventListener('ended', handleEnded)

		audioRef.current = audio

		// Auto-play if requested
		if (options.autoPlay) {
			audio.play().catch((error) => {
				console.warn('Auto-play failed (likely due to browser policy):', error)
			})
		}

		// Cleanup
		return () => {
			audio.removeEventListener('canplaythrough', handleCanPlayThrough)
			audio.removeEventListener('loadstart', handleLoadStart)
			audio.removeEventListener('error', handleError)
			audio.removeEventListener('play', handlePlay)
			audio.removeEventListener('pause', handlePause)
			audio.removeEventListener('ended', handleEnded)
			audio.pause()
			audio.currentTime = 0
		}
	}, [options.src, options.loop, options.autoPlay])

	// Update volume when volume state changes
	useEffect(() => {
		if (audioRef.current) {
			audioRef.current.volume = volume
		}
	}, [volume])

	const play = useCallback(async () => {
		if (audioRef.current && !isPlaying) {
			try {
				await audioRef.current.play()
			} catch (error) {
				console.error('Failed to play background music:', error)
				throw error
			}
		}
	}, [isPlaying])

	const pause = useCallback(() => {
		if (audioRef.current && isPlaying) {
			audioRef.current.pause()
		}
	}, [isPlaying])

	const stop = useCallback(() => {
		if (audioRef.current) {
			audioRef.current.pause()
			audioRef.current.currentTime = 0
		}
	}, [])

	const toggle = useCallback(async () => {
		if (isPlaying) {
			pause()
		} else {
			await play()
		}
	}, [isPlaying, play, pause])

	const setVolume = useCallback((newVolume: number) => {
		const clampedVolume = Math.max(0, Math.min(1, newVolume))
		setVolumeState(clampedVolume)
	}, [])

	return {
		play,
		pause,
		stop,
		toggle,
		setVolume,
		isPlaying,
		isLoading,
		hasError,
		volume,
	}
}