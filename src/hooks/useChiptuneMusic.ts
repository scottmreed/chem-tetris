import { useRef, useEffect, useCallback, useState } from 'react'

export interface ChiptuneMusicControls {
	/** Start playing the chiptune music */
	play: () => void
	/** Stop the music */
	stop: () => void
	/** Toggle play/pause */
	toggle: () => void
	/** Set volume (0.0 to 1.0) */
	setVolume: (volume: number) => void
	/** Start music on user interaction (handles autoplay policies) */
	playOnInteraction: () => Promise<void>
}

export interface ChiptuneMusicState {
	/** Whether music is currently playing */
	isPlaying: boolean
	/** Current volume (0.0 to 1.0) */
	volume: number
	/** Whether autoplay was blocked by browser policy */
	autoplayBlocked: boolean
}

export interface ChiptuneMusicOptions {
	volume?: number
	autoPlayOnInteraction?: boolean
}

/**
 * Hook that generates and plays simple 80s-style chiptune music using Web Audio API
 * Creates a retro synthwave background track
 */
export function useChiptuneMusic(options: number | ChiptuneMusicOptions = 0.2): ChiptuneMusicControls & ChiptuneMusicState {
	// Handle both old and new API
	const config = typeof options === 'number' ? { volume: options } : options
	const volume = config.volume ?? 0.2
	const autoPlayOnInteraction = config.autoPlayOnInteraction ?? false

	const audioContextRef = useRef<AudioContext | null>(null)
	const gainNodeRef = useRef<GainNode | null>(null)
	const oscillatorRef = useRef<OscillatorNode | null>(null)
	const intervalRef = useRef<NodeJS.Timeout | null>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentVolume, setCurrentVolume] = useState(volume)
	const [autoplayBlocked, setAutoplayBlocked] = useState(false)

	// 80s synthwave melody - a simple repeating pattern
	const melody = [
		{ note: 261.63, duration: 300 }, // C4
		{ note: 293.66, duration: 300 }, // D4
		{ note: 329.63, duration: 300 }, // E4
		{ note: 349.23, duration: 300 }, // F4
		{ note: 392.00, duration: 600 }, // G4 (longer)
		{ note: 349.23, duration: 300 }, // F4
		{ note: 329.63, duration: 300 }, // E4
		{ note: 293.66, duration: 300 }, // D4
		{ note: 261.63, duration: 600 }, // C4 (longer)
		{ note: 220.00, duration: 300 }, // A3
		{ note: 246.94, duration: 300 }, // B3
		{ note: 261.63, duration: 900 }, // C4 (very long)
		{ note: 0, duration: 300 }, // rest
	]

	let currentNoteIndex = 0

	const playNextNote = useCallback(() => {
		if (!audioContextRef.current || !gainNodeRef.current || !oscillatorRef.current) return

		const note = melody[currentNoteIndex]

		if (note.note === 0) {
			// Rest - silence
			oscillatorRef.current.frequency.setValueAtTime(0, audioContextRef.current.currentTime)
		} else {
			// Play note with some vibrato for 80s feel
			const baseFreq = note.note
			oscillatorRef.current.frequency.setValueAtTime(baseFreq, audioContextRef.current.currentTime)

			// Add subtle vibrato
			const vibratoRate = 5 // Hz
			const vibratoDepth = 3 // Hz
			for (let i = 0; i < note.duration / 50; i++) {
				const time = audioContextRef.current.currentTime + (i * 0.05)
				const vibrato = Math.sin(time * vibratoRate * Math.PI * 2) * vibratoDepth
				oscillatorRef.current.frequency.setValueAtTime(baseFreq + vibrato, time)
			}
		}

		currentNoteIndex = (currentNoteIndex + 1) % melody.length
	}, [])

	const initializeAudio = useCallback(() => {
		if (!audioContextRef.current) {
			audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()

			gainNodeRef.current = audioContextRef.current.createGain()
			gainNodeRef.current.connect(audioContextRef.current.destination)
			gainNodeRef.current.gain.setValueAtTime(currentVolume, audioContextRef.current.currentTime)

			oscillatorRef.current = audioContextRef.current.createOscillator()
			oscillatorRef.current.type = 'square' // Classic chiptune sound
			oscillatorRef.current.frequency.setValueAtTime(261.63, audioContextRef.current.currentTime)
			oscillatorRef.current.connect(gainNodeRef.current)

			// Add some reverb/filter for 80s feel
			const filter = audioContextRef.current.createBiquadFilter()
			filter.type = 'lowpass'
			filter.frequency.setValueAtTime(800, audioContextRef.current.currentTime) // Muffled sound
			oscillatorRef.current.connect(filter)
			filter.connect(gainNodeRef.current)
		}
	}, [currentVolume])

	const play = useCallback(async () => {
		if (isPlaying) return

		initializeAudio()

		try {
			// Resume audio context if suspended (required for autoplay policy)
			if (audioContextRef.current?.state === 'suspended') {
				await audioContextRef.current.resume()
			}

			if (oscillatorRef.current) {
				oscillatorRef.current.start()
			}

			// Start the melody loop
			currentNoteIndex = 0
			playNextNote()
			intervalRef.current = setInterval(playNextNote, 300) // Note duration

			setIsPlaying(true)
			setAutoplayBlocked(false) // Reset blocked state if it was set
		} catch (error) {
			console.warn('Audio playback blocked by browser autoplay policy:', error)
			setAutoplayBlocked(true)
		}
	}, [isPlaying, initializeAudio, playNextNote])

	const stop = useCallback(() => {
		if (!isPlaying) return

		if (intervalRef.current) {
			clearInterval(intervalRef.current)
			intervalRef.current = null
		}

		if (oscillatorRef.current) {
			try {
				oscillatorRef.current.stop()
			} catch (e) {
				// Oscillator might already be stopped
			}
		}

		// Reset refs
		oscillatorRef.current = null
		audioContextRef.current = null
		gainNodeRef.current = null

		setIsPlaying(false)
	}, [isPlaying])

	const toggle = useCallback(() => {
		if (isPlaying) {
			stop()
		} else {
			play()
		}
	}, [isPlaying, play, stop])

	const setVolume = useCallback((newVolume: number) => {
		const clampedVolume = Math.max(0, Math.min(1, newVolume))
		setCurrentVolume(clampedVolume)

		if (gainNodeRef.current && audioContextRef.current) {
			gainNodeRef.current.gain.setValueAtTime(clampedVolume, audioContextRef.current.currentTime)
		}
	}, [])

	const playOnInteraction = useCallback(async () => {
		// Only auto-play if configured to do so and not already playing
		if (!autoPlayOnInteraction || isPlaying || autoplayBlocked) return

		try {
			await play()
		} catch (error) {
			// Silently fail - user can manually enable music later
			console.warn('Auto-play on interaction failed:', error)
		}
	}, [autoPlayOnInteraction, isPlaying, autoplayBlocked, play])

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			stop()
		}
	}, [stop])

	return {
		play,
		stop,
		toggle,
		setVolume,
		playOnInteraction,
		isPlaying,
		volume: currentVolume,
		autoplayBlocked,
	}
}