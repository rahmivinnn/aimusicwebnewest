"use server"

import { verifyAudioQuality } from "./audio-quality-validator"

// Text-to-Song API key
const TEXT_TO_SONG_API_KEY = "sk_ee1207b428511380b8ccf3cc96216cb71a00c4715e5a054b"
// Text-to-Song API URL
const TEXT_TO_SONG_API_URL = "https://api.uberduck.ai/tts/freestyle"

// Define types for the Text-to-Song service
type TextToSongOptions = {
  text: string
  voice?: string
  genre?: string
  bpm?: number
  quality?: string
}

type TextToSongResponse = {
  audio_url: string
  seed?: number
  duration?: number
}

/**
 * Generate a song from text using the UberDuck API
 */
export async function generateTextToSong(options: TextToSongOptions): Promise<TextToSongResponse> {
  try {
    const { text, voice = "auto", genre = "hip-hop", bpm = 90, quality = "high" } = options

    console.log(`Generating text-to-song with options:`, options)

    // Create the request options
    const requestOptions = {
      speech: text,
      voicemodel_uuid: voice === "auto" ? "hip-hop-male" : voice,
      backing_track: genre,
      bpm: bpm,
      // Additional options based on quality
      ...(quality === "high" ? { 
        render_steps: 50,
        output_format: "mp3"
      } : {
        render_steps: 30,
        output_format: "mp3"
      })
    }

    // Make the API call
    const response = await fetch(TEXT_TO_SONG_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": `Basic ${Buffer.from(`${TEXT_TO_SONG_API_KEY}:`).toString("base64")}`,
      },
      body: JSON.stringify(requestOptions),
      // Add timeout to prevent hanging requests
      signal: AbortSignal.timeout(60000), // 60 second timeout for longer generations
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Text-to-Song API error:", errorText)
      
      // Create a more detailed error message
      let errorMessage = `Text-to-Song API error: ${response.status} ${response.statusText}`
      try {
        // Try to parse the error response as JSON
        const errorJson = JSON.parse(errorText)
        if (errorJson.message) {
          errorMessage += ` - ${errorJson.message}`
        }
      } catch (e) {
        // If parsing fails, just use the raw error text
        if (errorText) {
          errorMessage += ` - ${errorText}`
        }
      }
      
      throw new Error(errorMessage)
    }

    const data = await response.json()
    console.log("Text-to-Song response:", JSON.stringify(data).substring(0, 200) + "...")

    // Handle the UberDuck API response format
    if (data.mix_url) {
      // Create an audio element to get the duration
      const audio = new Audio()
      audio.src = data.mix_url
      
      // Wait for metadata to load to get duration
      const duration = await new Promise<number>((resolve) => {
        audio.addEventListener('loadedmetadata', () => resolve(audio.duration))
        audio.addEventListener('error', () => resolve(30)) // Default to 30 seconds if error
        audio.load()
      })

      return {
        audio_url: data.mix_url,
        duration: duration || 30, // Default to 30 seconds if duration can't be determined
      }
    } else if (data.uuid) {
      // If we get a UUID, we need to poll for the result
      const audioUrl = await pollForAudioResult(data.uuid)
      return {
        audio_url: audioUrl,
        duration: 30, // Default duration
      }
    } else {
      console.error("Unexpected Text-to-Song API response format:", data)
      throw new Error("Unexpected response format from Text-to-Song API")
    }
  } catch (error) {
    console.error("Error in Text-to-Song API call:", error)
    throw error
  }
}

/**
 * Poll for the audio result using the UUID
 */
async function pollForAudioResult(uuid: string): Promise<string> {
  const maxAttempts = 30
  const delayMs = 2000
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${TEXT_TO_SONG_API_URL}/status/${uuid}`, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Basic ${Buffer.from(`${TEXT_TO_SONG_API_KEY}:`).toString("base64")}`,
        },
      })
      
      if (!response.ok) {
        console.warn(`Poll attempt ${attempt + 1} failed: ${response.status} ${response.statusText}`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
        continue
      }
      
      const data = await response.json()
      
      if (data.status === "COMPLETED" && data.mix_url) {
        return data.mix_url
      } else if (data.status === "FAILED") {
        throw new Error(`Text-to-Song generation failed: ${data.error || "Unknown error"}`)
      }
      
      // If still processing, wait and try again
      console.log(`Text-to-Song generation in progress (${data.status}), attempt ${attempt + 1}/${maxAttempts}`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    } catch (error) {
      console.error(`Error polling for Text-to-Song result (attempt ${attempt + 1}):`, error)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }
  
  throw new Error(`Text-to-Song generation timed out after ${maxAttempts} attempts`)
}
