"use server"

import { verifyAudioQuality } from "./audio-quality-validator"

// Eleven Labs API key
const ELEVENLABS_API_KEY = "sk_ee1207b428511380b8ccf3cc96216cb71a00c4715e5a054b"
// Eleven Labs API URL
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1"

// Define types for the Eleven Labs service
type ElevenLabsOptions = {
  text: string
  voice_id?: string
  model_id?: string
  voice_settings?: {
    stability?: number
    similarity_boost?: number
    style?: number
    use_speaker_boost?: boolean
    speed?: number
  }
  output_format?: string
}

type ElevenLabsResponse = {
  audio_url: string
  seed?: number
  duration?: number
}

// Voice mapping for different voice types
const VOICE_MAPPING = {
  male: "ErXwobaYiN019PkySvjV", // Antoni - Male
  female: "EXAVITQu4vr4xnSDxMaL", // Bella - Female
  neutral: "onwK4e9ZLuTAKqWW03F9", // Daniel - Neutral
  warm: "pNInz6obpgDQGcFmaJgB", // Adam - Warm
  deep: "VR6AewLTigWG4xSOukaG", // Arnold - Deep
}

// Model mapping for different quality levels
const MODEL_MAPPING = {
  high: "eleven_multilingual_v2", // Best quality
  medium: "eleven_turbo_v2_5", // Good balance
  low: "eleven_flash_v2_5", // Fastest
}

/**
 * Generate audio using Eleven Labs API
 */
export async function generateElevenLabsAudio(options: ElevenLabsOptions): Promise<ElevenLabsResponse> {
  try {
    const { 
      text, 
      voice_id = "onwK4e9ZLuTAKqWW03F9", // Default to Daniel (neutral)
      model_id = "eleven_multilingual_v2", // Default to highest quality
      voice_settings,
      output_format = "mp3_44100_128"
    } = options

    console.log(`Generating audio with Eleven Labs: "${text.substring(0, 50)}..."`)

    // Prepare the request body
    const requestBody = {
      text,
      model_id,
      voice_settings,
      output_format
    }

    // Make the API call
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voice_id}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify(requestBody),
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(60000), // 60 second timeout
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(`Eleven Labs API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
    }

    // Get the audio data as a blob
    const audioBlob = await response.blob()
    
    // Create a URL for the audio blob
    const audioUrl = URL.createObjectURL(audioBlob)

    // Create an audio element to get the duration
    const audio = new Audio()
    audio.src = audioUrl
    
    // Wait for metadata to load to get duration
    const duration = await new Promise<number>((resolve) => {
      audio.addEventListener('loadedmetadata', () => resolve(audio.duration))
      audio.addEventListener('error', () => resolve(30)) // Default to 30 seconds if error
      audio.load()
    })

    return {
      audio_url: audioUrl,
      duration: duration || 30, // Default to 30 seconds if duration can't be determined
    }
  } catch (error) {
    console.error("Error generating audio with Eleven Labs:", error)
    throw error
  }
}

/**
 * Generate text-to-speech audio using Eleven Labs
 */
export async function generateTextToSpeech(options: { 
  text: string, 
  voice_type?: string, 
  emotion?: string, 
  quality?: string 
}): Promise<string> {
  try {
    const { text, voice_type = "neutral", emotion = "neutral", quality = "high" } = options

    // Map voice type to Eleven Labs voice ID
    const voice_id = VOICE_MAPPING[voice_type as keyof typeof VOICE_MAPPING] || VOICE_MAPPING.neutral
    
    // Map quality to model ID
    const model_id = MODEL_MAPPING[quality as keyof typeof MODEL_MAPPING] || MODEL_MAPPING.high

    // Adjust voice settings based on emotion
    let voice_settings: any = {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true,
      speed: 1.0
    }

    // Adjust settings based on emotion
    switch (emotion) {
      case "cheerful":
        voice_settings.stability = 0.3
        voice_settings.style = 0.7
        voice_settings.speed = 1.1
        break
      case "sad":
        voice_settings.stability = 0.8
        voice_settings.style = 0.4
        voice_settings.speed = 0.9
        break
      case "professional":
        voice_settings.stability = 0.7
        voice_settings.style = 0.2
        voice_settings.speed = 1.0
        break
      case "excited":
        voice_settings.stability = 0.2
        voice_settings.style = 0.9
        voice_settings.speed = 1.2
        break
      case "calm":
        voice_settings.stability = 0.9
        voice_settings.style = 0.3
        voice_settings.speed = 0.95
        break
    }

    // Generate the audio
    const result = await generateElevenLabsAudio({
      text,
      voice_id,
      model_id,
      voice_settings,
    })

    return result.audio_url
  } catch (error) {
    console.error("Error generating text-to-speech:", error)
    throw error
  }
}

/**
 * Generate background music using Eleven Labs
 */
export async function generateBackgroundMusic(emotion: string, genre?: string): Promise<string> {
  try {
    // For music generation, we'll use a specific prompt based on emotion and genre
    let prompt = `Create background music that is ${emotion}`
    if (genre) {
      prompt += ` in the ${genre} genre`
    }
    
    // Use a specific voice optimized for music
    const voice_id = "z9fAnlkpzviPz146aGWa" // Serena - good for music

    // Use the multilingual model for best quality
    const model_id = "eleven_multilingual_v2"

    // Generate the audio
    const result = await generateElevenLabsAudio({
      text: prompt,
      voice_id,
      model_id,
    })

    return result.audio_url
  } catch (error) {
    console.error("Error generating background music:", error)
    throw error
  }
}

/**
 * Generate speech with background music using Eleven Labs
 */
export async function generateSpeechWithMusic(
  text: string,
  voice_type: string = "neutral",
  emotion: string = "neutral",
  genre?: string,
  quality: string = "high",
  uploadedAudioUrl?: string
): Promise<{ speechUrl: string; musicUrl: string }> {
  try {
    // Generate speech and music in parallel
    const [speechUrl, musicUrl] = await Promise.all([
      // If we have an uploaded audio URL, use it instead of generating new speech
      uploadedAudioUrl
        ? Promise.resolve(uploadedAudioUrl)
        : generateTextToSpeech({
            text,
            voice_type,
            emotion,
            quality,
          }),
      generateBackgroundMusic(emotion, genre),
    ])

    // Verify the quality of both audio files
    const [speechQuality, musicQuality] = await Promise.all([
      verifyAudioQuality(speechUrl),
      verifyAudioQuality(musicUrl),
    ])

    if (!speechQuality.isGoodQuality) {
      console.warn("Speech audio quality check failed:", speechQuality.reason)
    }

    if (!musicQuality.isGoodQuality) {
      console.warn("Music audio quality check failed:", musicQuality.reason)
    }

    return {
      speechUrl,
      musicUrl,
    }
  } catch (error) {
    console.error("Error generating speech with music:", error)
    throw error
  }
}

/**
 * Generate a song from text using Eleven Labs
 */
export async function generateTextToSong(options: { 
  text: string, 
  voice?: string, 
  genre?: string, 
  bpm?: number, 
  quality?: string 
}): Promise<{ audio_url: string, duration?: number }> {
  try {
    const { text, voice = "neutral", genre = "electronic", bpm = 120, quality = "high" } = options

    // Create a prompt that instructs the model to generate a song
    const songPrompt = `Create a ${genre} song with lyrics: ${text}. The tempo should be ${bpm} BPM.`
    
    // Map voice to Eleven Labs voice ID
    const voice_id = VOICE_MAPPING[voice as keyof typeof VOICE_MAPPING] || VOICE_MAPPING.neutral
    
    // Use the highest quality model for songs
    const model_id = MODEL_MAPPING[quality as keyof typeof MODEL_MAPPING] || MODEL_MAPPING.high

    // Generate the audio
    const result = await generateElevenLabsAudio({
      text: songPrompt,
      voice_id,
      model_id,
    })

    return {
      audio_url: result.audio_url,
      duration: result.duration,
    }
  } catch (error) {
    console.error("Error generating text-to-song:", error)
    throw error
  }
}
