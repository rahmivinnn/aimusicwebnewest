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
  blob_size?: number
}

// Voice mapping for different voice types
const VOICE_MAPPING = {
  // Male voices
  male: "ErXwobaYiN019PkySvjV", // Antoni - Male
  "male-deep": "VR6AewLTigWG4xSOukaG", // Arnold - Deep Male
  "male-warm": "pNInz6obpgDQGcFmaJgB", // Adam - Warm Male
  "male-british": "ODq5zmih8GrVes37Dizd", // Harry - British Male
  "male-american": "SOYHLrjzK2X1ezoPC6cr", // Josh - American Male

  // Female voices
  female: "EXAVITQu4vr4xnSDxMaL", // Bella - Female
  "female-warm": "jBpfuIE2acCO8z3wKNLl", // Grace - Warm Female
  "female-soft": "zcAOhNBS3c14rBihAFp1", // Lily - Soft Female
  "female-british": "oWAxZDx7w5VEj9dCyTzz", // Charlotte - British Female
  "female-american": "z9fAnlkpzviPz146aGWa", // Serena - American Female

  // Neutral voices
  neutral: "onwK4e9ZLuTAKqWW03F9", // Daniel - Neutral
  "neutral-calm": "AZnzlk1XvdvUeBnXmlld", // Alex - Calm Neutral

  // Special purpose voices
  warm: "pNInz6obpgDQGcFmaJgB", // Adam - Warm
  deep: "VR6AewLTigWG4xSOukaG", // Arnold - Deep
  storyteller: "TX3LPaxmHKxFdv7VOQHJ", // Thomas - Storyteller
  announcer: "flq6f7yk4E4fJM5XTYuZ", // Patrick - Announcer
  narrator: "GBv7mTt0atIp3Br8iCZE", // Matthew - Narrator

  // Music-optimized voices
  "music-female": "z9fAnlkpzviPz146aGWa", // Serena - Good for music
  "music-male": "SOYHLrjzK2X1ezoPC6cr", // Josh - Good for music
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

    // Check if the blob is valid (not empty)
    if (audioBlob.size === 0) {
      console.error("Eleven Labs returned an empty audio blob")
      throw new Error("Generated audio is empty. Please try again with different parameters.")
    }

    // Log the blob size for debugging
    console.log(`Audio blob size: ${audioBlob.size} bytes`)

    // Create a URL for the audio blob
    const audioUrl = URL.createObjectURL(audioBlob)

    // Create an audio element to get the duration
    const audio = new Audio()
    audio.src = audioUrl

    // Wait for metadata to load to get duration with a timeout
    const duration = await Promise.race([
      new Promise<number>((resolve) => {
        audio.addEventListener('loadedmetadata', () => {
          // Check if duration is valid
          if (audio.duration === Infinity || isNaN(audio.duration) || audio.duration === 0) {
            console.warn("Invalid audio duration, trying to force duration calculation")
            // Force duration calculation for problematic browsers
            audio.currentTime = 1e101
            setTimeout(() => {
              audio.currentTime = 0
              // Check again after forcing calculation
              if (audio.duration === Infinity || isNaN(audio.duration) || audio.duration === 0) {
                console.warn("Still couldn't determine duration, using default")
                resolve(30)
              } else {
                resolve(audio.duration)
              }
            }, 200)
          } else {
            resolve(audio.duration)
          }
        })
        audio.addEventListener('error', (e) => {
          console.error("Error loading audio metadata:", e)
          resolve(30) // Default to 30 seconds if error
        })
        audio.load()
      }),
      // Add a timeout to prevent hanging
      new Promise<number>((resolve) => setTimeout(() => {
        console.warn("Timeout waiting for audio metadata, using default duration")
        resolve(30)
      }, 5000))
    ])

    // Validate the audio URL by trying to fetch a small part of it
    try {
      const testFetch = await fetch(audioUrl, { method: 'HEAD' })
      if (!testFetch.ok) {
        console.warn(`Audio URL validation failed: ${testFetch.status} ${testFetch.statusText}`)
      }
    } catch (error) {
      console.warn("Error validating audio URL:", error)
      // Continue anyway, as the blob URL might still work
    }

    return {
      audio_url: audioUrl,
      duration: duration || 30, // Default to 30 seconds if duration can't be determined
      blob_size: audioBlob.size, // Include blob size for debugging
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
  quality?: string,
  randomizeVoice?: boolean
}): Promise<string> {
  try {
    const { text, voice_type = "neutral", emotion = "neutral", quality = "high", randomizeVoice = false } = options

    // Map voice type to Eleven Labs voice ID
    let voice_id: string;

    if (randomizeVoice) {
      // Get all voice IDs that match the category (e.g., all male voices if voice_type is "male")
      const categoryVoices = Object.entries(VOICE_MAPPING)
        .filter(([key]) => key === voice_type || key.startsWith(`${voice_type}-`))
        .map(([_, id]) => id);

      // If we have category voices, randomly select one, otherwise use the exact match or default
      if (categoryVoices.length > 0) {
        const randomIndex = Math.floor(Math.random() * categoryVoices.length);
        voice_id = categoryVoices[randomIndex];
      } else {
        voice_id = VOICE_MAPPING[voice_type as keyof typeof VOICE_MAPPING] || VOICE_MAPPING.neutral;
      }
    } else {
      // Use the exact voice type specified
      voice_id = VOICE_MAPPING[voice_type as keyof typeof VOICE_MAPPING] || VOICE_MAPPING.neutral;
    }

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
export async function generateBackgroundMusic(emotion: string, genre?: string, isRemix: boolean = false): Promise<string> {
  try {
    // For music generation, we'll use a specific prompt based on emotion and genre
    let prompt = ""

    if (isRemix) {
      // Enhanced prompt specifically for remixes
      prompt = `Create a professional ${genre || 'electronic'} remix with ${emotion} mood. Include strong beats, clear melody, and dynamic structure. Make it sound like a professional studio production with perfect mastering.`
    } else {
      // Standard prompt for background music
      prompt = `Create background music that is ${emotion}`
      if (genre) {
        prompt += ` in the ${genre} genre`
      }
    }

    // Add quality instructions to the prompt
    prompt += `. Make it high quality, professionally mastered audio with clear sound.`

    console.log(`Generating ${isRemix ? 'remix' : 'background music'} with prompt: "${prompt}"`)

    // Use a specific voice optimized for music
    // For remixes, use a different voice that might work better for instrumental music
    const voice_id = isRemix
      ? "SOYHLrjzK2X1ezoPC6cr" // Josh - better for remixes
      : "z9fAnlkpzviPz146aGWa" // Serena - good for music

    // Use the multilingual model for best quality
    const model_id = "eleven_multilingual_v2"

    // Voice settings optimized for music generation
    const voice_settings = {
      stability: 0.3,         // Lower stability for more creative variation
      similarity_boost: 0.5,  // Balanced similarity
      style: 0.8,             // Higher style for more expressive music
      use_speaker_boost: true,
      speed: 1.0              // Normal speed
    }

    // Generate the audio with enhanced settings
    const result = await generateElevenLabsAudio({
      text: prompt,
      voice_id,
      model_id,
      voice_settings
    })

    // Validate the result
    if (!result.audio_url) {
      throw new Error("Failed to generate audio URL")
    }

    // Log the blob size for debugging
    console.log(`Generated ${isRemix ? 'remix' : 'background music'} with blob size: ${result.blob_size || 'unknown'} bytes`)

    return result.audio_url
  } catch (error) {
    console.error(`Error generating ${isRemix ? 'remix' : 'background music'}:`, error)
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
  uploadedAudioUrl?: string,
  randomizeVoice: boolean = true
): Promise<{ speechUrl: string; musicUrl: string; voiceId?: string }> {
  try {
    // Track which voice ID was used (for display purposes)
    let usedVoiceId: string | undefined;

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
            randomizeVoice,
          }).then(url => {
            // Get the voice ID that was used (for informational purposes)
            const voiceKey = Object.entries(VOICE_MAPPING).find(
              ([_, id]) => id === VOICE_MAPPING[voice_type as keyof typeof VOICE_MAPPING]
            )?.[0];
            usedVoiceId = voiceKey;
            return url;
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
      voiceId: usedVoiceId
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
  quality?: string,
  randomizeVoice?: boolean
}): Promise<{ audio_url: string, duration?: number, voiceId?: string }> {
  try {
    const {
      text,
      voice = "neutral",
      genre = "electronic",
      bpm = 120,
      quality = "high",
      randomizeVoice = true
    } = options

    // Create a prompt that instructs the model to generate a song
    const songPrompt = `Create a ${genre} song with lyrics: ${text}. The tempo should be ${bpm} BPM.`

    // Map voice to Eleven Labs voice ID
    let voice_id: string;

    if (randomizeVoice) {
      // For songs, prefer music-optimized voices if available
      if (voice === "male" || voice === "female") {
        const musicVoiceKey = `music-${voice}`;
        if (VOICE_MAPPING[musicVoiceKey as keyof typeof VOICE_MAPPING]) {
          voice_id = VOICE_MAPPING[musicVoiceKey as keyof typeof VOICE_MAPPING];
        } else {
          // Get all voice IDs that match the category
          const categoryVoices = Object.entries(VOICE_MAPPING)
            .filter(([key]) => key === voice || key.startsWith(`${voice}-`))
            .map(([_, id]) => id);

          if (categoryVoices.length > 0) {
            const randomIndex = Math.floor(Math.random() * categoryVoices.length);
            voice_id = categoryVoices[randomIndex];
          } else {
            voice_id = VOICE_MAPPING[voice as keyof typeof VOICE_MAPPING] || VOICE_MAPPING.neutral;
          }
        }
      } else {
        // For other voice types, just use the specified voice
        voice_id = VOICE_MAPPING[voice as keyof typeof VOICE_MAPPING] || VOICE_MAPPING.neutral;
      }
    } else {
      // Use the exact voice specified
      voice_id = VOICE_MAPPING[voice as keyof typeof VOICE_MAPPING] || VOICE_MAPPING.neutral;
    }

    // Get the voice name for return value
    const voiceKey = Object.entries(VOICE_MAPPING).find(
      ([_, id]) => id === voice_id
    )?.[0];

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
      voiceId: voiceKey
    }
  } catch (error) {
    console.error("Error generating text-to-song:", error)
    throw error
  }
}
