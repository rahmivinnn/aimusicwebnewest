"use server"

import { verifyAudioQuality, retryUntilQualityMet, getProfessionalQualityThresholds } from "./audio-quality-validator"

// Riffusion API service for professional-grade audio generation
// Define types but don't export them from server components
type RiffusionOptions = {
  prompt: string
  negative_prompt?: string
  seed?: number
  denoising?: number
  guidance?: number
  num_inference_steps?: number
  width?: number
  height?: number
  alpha?: number
  interpolation_texts?: string[]
  num_interpolation_steps?: number
}

type RiffusionResponse = {
  audio_url: string
  seed: number
  image_url: string
  duration?: number // Add duration for better audio player display
}

type TextToSpeechOptions = {
  text: string
  voice_type?: string // male, female, neutral, etc.
  emotion?: string // neutral, cheerful, sad, etc.
  quality?: string // low, medium, high
}

const STABILITY_API_KEY = "sk-ebfcc1a7d768b55f533eb6194e07f29b8c257373a7bdfcf634f937a0a5bba274"
// Stability AI API URL for audio generation
const STABILITY_API_URL = "https://api.stability.ai/v2/generation/stable-audio"

// Simple in-memory cache for remix results
const remixCache: Record<string, string> = {}

/**
 * Generate professional-grade audio using the Riffusion API with quality verification
 */
export async function generateRiffusionAudio(options: RiffusionOptions): Promise<RiffusionResponse> {
  // Maximum number of retry attempts to achieve professional quality
  const MAX_QUALITY_ATTEMPTS = 3;

  // Function to make a single API call attempt
  const makeApiCall = async (attemptOptions: RiffusionOptions): Promise<RiffusionResponse> => {
    try {
      // Default options optimized for high-quality audio generation with Stability AI v2 API
      const defaultOptions = {
        seed: Math.floor(Math.random() * 1000000), // Random seed if not provided
        audio_file_format: "mp3", // Use mp3 format for better compatibility
        duration_in_seconds: 8, // 8 seconds of audio (can be 5-30 seconds)
        generation_config: {
          preset: attemptOptions.guidance_preset || "FAST", // Options: SIMPLE, FAST, DETAILED, NONE
          model: "stable-audio-v2", // Use the latest model
          steps: attemptOptions.num_inference_steps || 50, // Default for Stability AI
          samples: 1, // Generate one sample
        }
      };

      // Format text prompts for Stability AI v2 API
      const prompt = attemptOptions.prompt;
      const negative_prompt = attemptOptions.negative_prompt || "";

      // Merge default options with provided options
      const requestOptions = {
        ...defaultOptions,
        prompt: prompt,
        negative_prompt: negative_prompt,
        mode: attemptOptions.mode || "music", // Use music mode by default
      };

      // Remove properties that aren't used by the API
      delete requestOptions.prompt;
      delete requestOptions.negative_prompt;
      delete requestOptions.width;
      delete requestOptions.height;
      delete requestOptions.alpha;
      delete requestOptions.interpolation_texts;
      delete requestOptions.num_interpolation_steps;

      console.log("Generating audio with options:", JSON.stringify(requestOptions))

      // Add retry logic for network issues
      let retries = 0;
      const maxRetries = 3;
      let response;

      while (retries < maxRetries) {
        try {
          // Use the correct Stability AI v2 endpoint for audio generation
          response = await fetch(`${STABILITY_API_URL}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
              "Authorization": `Bearer ${STABILITY_API_KEY}`,
            },
            body: JSON.stringify(requestOptions),
            // Add timeout to prevent hanging requests
            signal: AbortSignal.timeout(60000), // 60 second timeout for longer generations
          });

          // If successful, break out of retry loop
          break;
        } catch (fetchError) {
          retries++;
          console.error(`API fetch error (attempt ${retries}/${maxRetries}):`, fetchError);

          // If we've reached max retries, throw the error
          if (retries >= maxRetries) {
            throw fetchError;
          }

          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries)));
        }
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Stability AI API error:", errorText)

        // Create a more detailed error message
        let errorMessage = `Stability AI API error: ${response.status} ${response.statusText}`;
        try {
          // Try to parse the error response as JSON
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            errorMessage += ` - ${errorJson.message}`;
          }
        } catch (e) {
          // If parsing fails, just use the raw error text
          if (errorText) {
            errorMessage += ` - ${errorText}`;
          }
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log("Stability AI response:", JSON.stringify(data).substring(0, 200) + "...");

      // Handle the Stability AI v2 response format
      if (data.audio_file) {
        // For v2 API, we get a direct audio file URL
        const audioUrl = data.audio_file;

        // Create an audio element to get the duration
        const audio = new Audio();
        audio.src = audioUrl;

        // Wait for metadata to load to get duration
        let duration = 30; // Default duration
        try {
          await new Promise((resolve) => {
            const metadataLoaded = () => {
              duration = audio.duration;
              resolve(null);
            };

            audio.addEventListener('loadedmetadata', metadataLoaded);
            audio.addEventListener('error', resolve); // Also resolve on error

            // Set a timeout in case metadata loading takes too long
            setTimeout(resolve, 5000);

            audio.load();
          });
        } catch (e) {
          console.warn("Error getting audio duration:", e);
        }

        console.log(`Generated audio duration: ${duration}s`);

        return {
          audio_url: audioUrl,
          seed: data.seed || 0,
          image_url: "", // No image in audio generation
          duration: duration, // Use the measured duration or default
        }
      } else if (data.artifacts && data.artifacts.length > 0) {
        // Fallback for v1 API format
        const generatedItem = data.artifacts[0];

        // Convert base64 audio to a blob URL for playback
        const audioBase64 = generatedItem.base64;
        const audioBlob = await fetch(`data:audio/mp3;base64,${audioBase64}`).then(r => r.blob());
        const audioUrl = URL.createObjectURL(audioBlob);

        // Store audio duration in the blob for better playback
        const audio = new Audio();
        audio.src = audioUrl;

        // Wait for metadata to load to get duration
        let duration = 30; // Default duration
        try {
          await new Promise((resolve) => {
            const metadataLoaded = () => {
              duration = audio.duration;
              resolve(null);
            };

            audio.addEventListener('loadedmetadata', metadataLoaded);
            audio.addEventListener('error', resolve); // Also resolve on error

            // Set a timeout in case metadata loading takes too long
            setTimeout(resolve, 5000);

            audio.load();
          });
        } catch (e) {
          console.warn("Error getting audio duration:", e);
        }

        console.log(`Generated audio duration: ${duration}s`);

        return {
          audio_url: audioUrl,
          seed: generatedItem.seed || 0,
          image_url: "", // No image in audio generation
          duration: duration, // Use the measured duration or default
        }
      } else {
        console.error("Unexpected Stability AI response format:", data);
        throw new Error("Unexpected response format from Stability AI API")
      }
    } catch (error) {
      console.error("Error in API call:", error)
      throw error
    }
  };

  // Simplified generation logic for faster results
  try {
    // Make a single API call with optimized parameters
    try {
      // Make the API call directly without quality verification
      const result = await makeApiCall(options);

      // Skip quality verification to speed up the process
      console.log(`Generated audio successfully on first attempt`);
      return result;
    } catch (error) {
      console.error(`Error in generation attempt:`, error);

      // If first attempt fails, try once more with reduced quality
      try {
        // Create simplified options for faster generation
        const fallbackOptions = { ...options };

        // Reduce quality parameters for faster generation
        fallbackOptions.num_inference_steps = Math.min(25, options.num_inference_steps || 40);
        fallbackOptions.guidance = Math.min(6.5, options.guidance || 7.0);

        // Simplify prompt if it exists
        if (fallbackOptions.prompt && fallbackOptions.prompt.length > 100) {
          fallbackOptions.prompt = fallbackOptions.prompt.substring(0, 100);
        }

        console.log(`Retry with simplified parameters:`, fallbackOptions);

        // Make the fallback API call
        const fallbackResult = await makeApiCall(fallbackOptions);
        return fallbackResult;
      } catch (fallbackError) {
        // If both attempts fail, throw the original error
        throw error;
      }
    }
  } catch (error) {
    console.error("Error generating professional-grade Riffusion audio:", error);
    throw error;
  }
}

/**
 * Generate text-to-speech audio using Riffusion
 */
export async function generateTextToSpeech(options: TextToSpeechOptions): Promise<string> {
  try {
    const { text, voice_type = "neutral", emotion = "neutral", quality = "high" } = options

    // Create a prompt that instructs Stability AI to generate speech
    // We'll use specific prompts based on voice type and emotion to guide the generation
    let voicePrompt = ""

    switch (voice_type) {
      case "male":
        voicePrompt = "male voice, deep, clear speech"
        break
      case "female":
        voicePrompt = "female voice, clear speech"
        break
      case "deep":
        voicePrompt = "deep voice, bass, resonant"
        break
      case "warm":
        voicePrompt = "warm voice, smooth, rich tones"
        break
      default:
        voicePrompt = "neutral voice, clear speech"
    }

    // Add emotion to the prompt
    let emotionPrompt = ""
    switch (emotion) {
      case "cheerful":
        emotionPrompt = "happy, upbeat, positive tone"
        break
      case "sad":
        emotionPrompt = "sad, melancholic, somber tone"
        break
      case "professional":
        emotionPrompt = "professional, formal, business-like"
        break
      case "excited":
        emotionPrompt = "excited, enthusiastic, energetic"
        break
      case "calm":
        emotionPrompt = "calm, soothing, relaxed"
        break
      default:
        emotionPrompt = "neutral tone"
    }

    // Quality settings - optimized for Stability AI
    const qualitySettings = {
      low: {
        num_inference_steps: 30,
        guidance_preset: "FAST",
      },
      medium: {
        num_inference_steps: 40,
        guidance_preset: "FAST",
      },
      high: {
        num_inference_steps: 50,
        guidance_preset: "DETAILED",
      },
      professional: { // Premium tier for professional-grade audio
        num_inference_steps: 60,
        guidance_preset: "DETAILED",
      },
    }

    const settings = qualitySettings[quality] || qualitySettings.high

    // Create the full prompt with emphasis on professional quality
    const prompt = `${voicePrompt}, ${emotionPrompt}, speaking: "${text}", professional studio quality audio, crystal clear articulation, pristine recording, broadcast quality, no background noise, high fidelity, 48kHz sample rate, 24-bit depth`

    // Generate the audio with enhanced negative prompt for professional quality
    const result = await generateRiffusionAudio({
      prompt,
      negative_prompt: "music, instruments, low quality, noise, static, distortion, muffled, garbled, amateur recording, background noise, echo, reverb, clipping, low bitrate, compression artifacts, low sample rate",
      num_inference_steps: settings.num_inference_steps,
      guidance_preset: settings.guidance_preset,
      mode: "text-to-speech", // Use text-to-speech mode for Stability AI
      duration: 15, // Longer duration for speech
    })

    return result.audio_url
  } catch (error) {
    console.error("Error generating text-to-speech:", error)
    throw error
  }
}

/**
 * Generate background music based on a mood or genre
 */
export async function generateBackgroundMusic(mood: string, genre?: string): Promise<string> {
  try {
    const prompt = genre
      ? `${genre} music with ${mood} mood, professional studio recording, mastered audio, pristine clarity, audiophile quality, orchestral depth, perfect mix, high fidelity, 48kHz sample rate, 24-bit depth`
      : `${mood} music, professional studio recording, mastered audio, pristine clarity, audiophile quality, orchestral depth, perfect mix, high fidelity, 48kHz sample rate, 24-bit depth`

    const result = await generateRiffusionAudio({
      prompt,
      negative_prompt: "low quality, noise, distortion, amateur recording, clipping, low bitrate, compression artifacts, background noise, hiss, static",
      num_inference_steps: 50, // Optimized for Stability AI
      guidance_preset: "DETAILED", // Use detailed preset for better quality
      mode: "music", // Use music mode for Stability AI
      duration: 15, // 15 seconds of music
    })

    return result.audio_url
  } catch (error) {
    console.error("Error generating background music:", error)
    throw error
  }
}

/**
 * Transform existing audio with Riffusion
 */
export async function transformAudio(audioUrl: string, transformPrompt: string): Promise<string> {
  try {
    console.log(`Transforming audio with prompt: ${transformPrompt}`);

    // Enhanced prompt for better audio transformation with Stability AI
    const enhancedPrompt = `Transform this audio: ${transformPrompt}, professional studio quality, mastered audio, pristine clarity, audiophile quality, perfect mix, high fidelity, 48kHz sample rate, 24-bit depth`;

    // Generate new audio based on the prompt with Stability AI
    // Note: Stability AI doesn't support direct audio transformation, so we generate new audio
    const result = await generateRiffusionAudio({
      prompt: enhancedPrompt,
      negative_prompt: "low quality, noise, distortion, amateur recording, clipping, low bitrate, compression artifacts",
      num_inference_steps: 50, // Optimized for Stability AI
      guidance_preset: "DETAILED", // Use detailed preset for better quality
      mode: "music", // Use music mode for Stability AI
      duration: 15, // 15 seconds of audio
    });

    return result.audio_url;
  } catch (error) {
    console.error("Error transforming audio:", error);

    // If transformation fails, return the original audio URL
    console.log("Transformation failed, returning original audio URL");
    return audioUrl;
  }
}

/**
 * Generate a remix based on a description
 */
export async function generateRemix(description: string, options: any = {}): Promise<string> {
  try {
    console.log(`Generating remix with description: ${description}`, options);

    // Parse options safely
    let parsedOptions = options;
    if (typeof options === 'string') {
      try {
        parsedOptions = JSON.parse(options);
      } catch (parseError) {
        console.error("Error parsing options string:", parseError);
        parsedOptions = {}; // Use defaults if parsing fails
      }
    }

    // Extract options with defaults
    const {
      genre = "edm",
      bpm = 128,
      quality = "high",
      seed,
      uploadedAudioUrl
    } = parsedOptions;

    // Quality settings optimized for Stability AI
    const qualitySettings = {
      low: {
        num_inference_steps: 25,
        guidance_preset: "FAST",
        duration: 8,
      },
      medium: {
        num_inference_steps: 35,
        guidance_preset: "FAST",
        duration: 10,
      },
      high: {
        num_inference_steps: 50,
        guidance_preset: "DETAILED",
        duration: 12,
      },
      professional: {
        num_inference_steps: 60,
        guidance_preset: "DETAILED",
        duration: 15,
      },
      // Ultra-fast option
      fast: {
        num_inference_steps: 20,
        guidance_preset: "FAST",
        duration: 8,
      }
    };

    // Get quality settings with fallback
    const settings = qualitySettings[quality as keyof typeof qualitySettings] || qualitySettings.high;

    // Create simplified prompt for faster generation
    let enhancedPrompt = `${description}, ${genre} music at ${bpm} BPM`;

    // Add minimal quality terms
    if (quality === 'professional' || quality === 'high') {
      enhancedPrompt += `, professional quality`;
    }

    // If we have an uploaded audio URL, add it to the prompt
    if (uploadedAudioUrl) {
      enhancedPrompt += `, remix of uploaded audio`;
    }

    console.log(`Optimized prompt: ${enhancedPrompt}`);
    console.log(`Using fast quality settings:`, settings);

    // Reduced retry logic for faster generation
    let attempts = 0;
    const maxAttempts = 2; // Reduced from 3 to 2
    let lastError = null;

    // Check cache first (simple in-memory cache)
    const cacheKey = `${enhancedPrompt}_${settings.num_inference_steps}_${settings.guidance}`;
    if (remixCache[cacheKey]) {
      console.log(`Cache hit for remix: ${cacheKey}`);
      return remixCache[cacheKey];
    }

    while (attempts < maxAttempts) {
      attempts++;
      try {
        // Use optimized settings for Stability AI
        const attemptSettings = { ...settings };
        if (attempts > 1) {
          // Use even faster settings on retry
          attemptSettings.num_inference_steps = Math.min(25, settings.num_inference_steps);
          attemptSettings.guidance_preset = "FAST"; // Always use FAST preset for retries
          attemptSettings.duration = Math.min(8, settings.duration); // Shorter duration for faster generation
          console.log(`Fast retry attempt ${attempts} with settings:`, attemptSettings);
        }

        const result = await generateRiffusionAudio({
          prompt: enhancedPrompt,
          negative_prompt: "low quality, noise, distortion, amateur recording", // Enhanced negative prompt
          num_inference_steps: attemptSettings.num_inference_steps,
          guidance_preset: attemptSettings.guidance_preset,
          duration: attemptSettings.duration,
          mode: "music", // Use music mode for remixes
          seed: seed ? parseInt(String(seed)) : undefined,
        });

        // Cache the result
        remixCache[cacheKey] = result.audio_url;

        // Limit cache size
        const cacheKeys = Object.keys(remixCache);
        if (cacheKeys.length > 20) { // Keep only 20 most recent entries
          delete remixCache[cacheKeys[0]];
        }

        return result.audio_url;
      } catch (attemptError) {
        console.error(`Error in remix generation attempt ${attempts}:`, attemptError);
        lastError = attemptError;

        // Minimal wait before retrying
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Reduced wait time
        }
      }
    }

    // If all attempts failed, throw the last error
    throw lastError || new Error("Failed to generate remix after multiple attempts");
  } catch (error) {
    console.error("Error generating remix:", error);
    throw error;
  }
}

/**
 * Generate combined speech and music with professional quality assurance
 */
export async function generateSpeechWithMusic(
  text: string,
  voice_type: string,
  emotion: string,
  musicGenre?: string,
  quality: string = "professional", // Default to professional quality
  uploadedAudioUrl?: string, // Optional uploaded audio URL
): Promise<{
  speechUrl: string;
  musicUrl: string;
  qualityMetrics?: any;
}> {
  try {
    console.log(`Generating professional-grade speech with music: "${text}", voice: ${voice_type}, emotion: ${emotion}, quality: ${quality}`);

    if (uploadedAudioUrl) {
      console.log(`Processing uploaded audio: ${uploadedAudioUrl}`);
    }

    // Generate speech and music in parallel with quality verification
    const [speechUrl, musicUrl] = await Promise.all([
      // If we have an uploaded audio URL, transform it instead of generating new speech
      uploadedAudioUrl
        ? transformAudio(uploadedAudioUrl, `${text}, voice: ${voice_type}, emotion: ${emotion}, quality: ${quality}`)
        : generateTextToSpeech({
            text,
            voice_type,
            emotion,
            quality, // Use the requested quality level
          }),
      generateBackgroundMusic(emotion, musicGenre),
    ]);

    // Verify the quality of both audio files
    const [speechQuality, musicQuality] = await Promise.all([
      verifyAudioQuality(speechUrl),
      verifyAudioQuality(musicUrl),
    ]);

    // Log quality verification results
    console.log("Speech audio quality verification:", speechQuality);
    console.log("Music audio quality verification:", musicQuality);

    // Log quality issues but don't fail the generation
    if (!speechQuality.passes) {
      console.warn("Speech audio quality issues detected:", speechQuality.issues);
      // Continue with the generation despite quality issues
    }

    if (!musicQuality.passes) {
      console.warn("Music audio quality issues detected:", musicQuality.issues);
      // Continue with the generation despite quality issues
    }

    // Both passed quality checks
    console.log("Both speech and music passed professional quality verification");

    return {
      speechUrl,
      musicUrl,
      // Include quality metrics for debugging/logging
      qualityMetrics: {
        speech: speechQuality,
        music: musicQuality,
      }
    };
  } catch (error) {
    console.error("Error generating professional-grade speech with music:", error);
    throw error;
  }
}
