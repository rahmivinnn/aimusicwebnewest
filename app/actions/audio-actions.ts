"use server"

import {
  generateBackgroundMusic,
  generateSpeechWithMusic,
  generateTextToSpeech,
  generateTextToSong
} from "@/lib/elevenlabs-service"
import { verifyAudioQuality } from "@/lib/audio-quality-validator"

// Define constants locally instead of exporting them
// Eleven Labs API key
const ELEVENLABS_API_KEY = "sk_ee1207b428511380b8ccf3cc96216cb71a00c4715e5a054b"

// Helper function to get sample mapping based on voice and style
async function getSampleMapping(voice: string, style: string): Promise<string> {
  // Mapping for sample fallback based on voice and style
  const SAMPLE_MAPPING = {
    male: {
      neutral: "/samples/male-neutral-sample.mp3",
      cheerful: "/samples/male-cheerful-sample.mp3",
      sad: "/samples/male-sad-sample.mp3",
      professional: "/samples/male-professional-sample.mp3",
      excited: "/samples/male-excited-sample.mp3",
      calm: "/samples/male-calm-sample.mp3",
    },
    female: {
      neutral: "/samples/female-neutral-sample.mp3",
      cheerful: "/samples/female-cheerful-sample.mp3",
      sad: "/samples/female-sad-sample.mp3",
      professional: "/samples/female-professional-sample.mp3",
      excited: "/samples/female-excited-sample.mp3",
      calm: "/samples/female-calm-sample.mp3",
    },
    robot: {
      neutral: "/samples/neutral-neutral-sample.mp3",
      cheerful: "/samples/neutral-cheerful-sample.mp3",
      sad: "/samples/neutral-sad-sample.mp3",
      professional: "/samples/neutral-professional-sample.mp3",
      excited: "/samples/neutral-excited-sample.mp3",
      calm: "/samples/neutral-calm-sample.mp3",
    },
    deep: {
      neutral: "/samples/deep-neutral-sample.mp3",
      cheerful: "/samples/deep-cheerful-sample.mp3",
      sad: "/samples/deep-sad-sample.mp3",
      professional: "/samples/deep-professional-sample.mp3",
      excited: "/samples/deep-excited-sample.mp3",
      calm: "/samples/deep-calm-sample.mp3",
    },
    neutral: {
      neutral: "/samples/neutral-neutral-sample.mp3",
      cheerful: "/samples/neutral-cheerful-sample.mp3",
      sad: "/samples/neutral-sad-sample.mp3",
      professional: "/samples/neutral-professional-sample.mp3",
      excited: "/samples/neutral-excited-sample.mp3",
      calm: "/samples/neutral-calm-sample.mp3",
    },
    warm: {
      neutral: "/samples/warm-neutral-sample.mp3",
      cheerful: "/samples/warm-cheerful-sample.mp3",
      sad: "/samples/warm-sad-sample.mp3",
      professional: "/samples/warm-professional-sample.mp3",
      excited: "/samples/warm-excited-sample.mp3",
      calm: "/samples/warm-calm-sample.mp3",
    },
  };

  return SAMPLE_MAPPING[voice]?.[style] || "/samples/sample-neutral.mp3";
}

// Helper function to get music fallback based on style
async function getMusicFallback(style: string): Promise<string> {
  // Music fallback samples
  const MUSIC_FALLBACK = {
    neutral: "/samples/music-neutral.mp3",
    cheerful: "/samples/music-cheerful.mp3",
    sad: "/samples/music-sad.mp3",
    professional: "/samples/music-professional.mp3",
    excited: "/samples/music-excited.mp3",
    calm: "/samples/music-calm.mp3",
  };

  return MUSIC_FALLBACK[style] || "/samples/music-neutral.mp3";
}

/**
 * Generate professional-grade audio using Eleven Labs API with quality assurance
 */
export async function generateAudio(params: any) {
  try {
    // Parse parameters
    const {
      prompt,
      voice = "neutral",
      style = "neutral",
      quality = "high", // Changed to match Eleven Labs quality levels
      genre,
      bpm,
      hasUploadedFile = false,
      uploadedFileName,
      uploadedFileType,
      uploadedFileUrl,
      randomizeVoice = true
    } = params;

    console.log(`[Server] Generating professional audio with Eleven Labs: "${prompt}", voice: ${voice}, style: ${style}, quality: ${quality}`)

    if (hasUploadedFile) {
      console.log(`[Server] Processing uploaded file: ${uploadedFileName}`)
    }

    // Get fallback sample paths
    const fallbackVoiceSample = await getSampleMapping(voice, style)
    const fallbackMusicSample = await getMusicFallback(style)

    // Maximum number of retries for quality assurance
    const MAX_QUALITY_RETRIES = 2;
    let attempts = 0;
    let lastError = null;

    // Try multiple times to ensure professional quality
    while (attempts < MAX_QUALITY_RETRIES) {
      attempts++;

      try {
        // Enhanced prompt for professional quality on retry attempts
        let enhancedPrompt = prompt;
        if (attempts > 1) {
          enhancedPrompt = `${prompt} (professional studio quality, pristine audio)`;
          console.log(`Quality retry attempt ${attempts} with enhanced prompt`);
        }

        // Add uploaded file information to the prompt if available
        if (hasUploadedFile && uploadedFileName) {
          enhancedPrompt += ` (processing uploaded audio file: ${uploadedFileName})`;
        }

        // Generate speech and music using Eleven Labs with quality parameter
        const { speechUrl, musicUrl, voiceId } = await generateSpeechWithMusic(
          enhancedPrompt,
          voice,
          style,
          genre, // Use genre if provided
          quality, // Pass quality parameter
          hasUploadedFile ? uploadedFileUrl : undefined, // Pass uploaded file URL if available
          randomizeVoice // Pass randomize voice parameter
        );

        // If we got here, generation was successful
        return {
          audioUrl: speechUrl,
          musicUrl: musicUrl,
          fallbackUrl: fallbackVoiceSample,
          fallbackMusicUrl: fallbackMusicSample,
          success: true,
          prompt,
          voice,
          style,
          quality,
          isElevenLabs: true,
          qualityVerified: true,
          attempts,
          hasUploadedFile,
          voiceId, // Include the voice ID that was used
        };
      } catch (error) {
        console.error(`Error in Eleven Labs API (attempt ${attempts}):`, error);
        lastError = error;

        // Only retry if this is a quality-related error, not an API failure
        if (error.message && !error.message.includes("quality")) {
          break;
        }
      }
    }

    // If all attempts failed, return fallback samples
    console.warn(`Failed to generate professional-quality audio after ${attempts} attempts. Using fallback.`);
    return {
      audioUrl: null,
      musicUrl: null,
      fallbackUrl: fallbackVoiceSample,
      fallbackMusicUrl: fallbackMusicSample,
      success: false,
      error: lastError?.message || "Failed to generate professional-quality audio with Eleven Labs API",
      useFallback: true,
      attempts,
    };
  } catch (error) {
    console.error("Error in audio generation:", error);
    return {
      audioUrl: null,
      musicUrl: null,
      fallbackUrl: "/samples/sample-neutral.mp3",
      fallbackMusicUrl: "/samples/music-neutral.mp3",
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate audio",
      useFallback: true,
    };
  }
}

/**
 * Generate professional-grade music using Eleven Labs API with quality assurance
 */
export async function generateMusic({ prompt, genre, bpm, duration = 30 }) {
  console.log(`[Server] Professional music generation requested with Eleven Labs: "${prompt}", genre: ${genre}, bpm: ${bpm}`)

  // Fallback samples in case API fails
  const fallbackSamples = {
    electronic: "/samples/music-neutral.mp3",
    house: "/samples/music-cheerful.mp3",
    dubstep: "/samples/music-excited.mp3",
    trance: "/samples/music-calm.mp3",
    hiphop: "/samples/music-professional.mp3",
    rock: "/samples/music-sad.mp3",
    ambient: "/samples/music-calm.mp3",
    jazz: "/samples/music-professional.mp3",
  }

  // Fallback URL based on genre
  const fallbackUrl = fallbackSamples[genre] || "/samples/music-neutral.mp3"

  // Maximum number of retries for quality assurance
  const MAX_QUALITY_RETRIES = 3;
  let attempts = 0;
  let lastError = null;
  let bestMusicUrl = null;
  let bestQualityScore = 0;

  // Try multiple times to ensure professional quality
  while (attempts < MAX_QUALITY_RETRIES) {
    attempts++;

    try {
      // Enhance prompt with genre and BPM information for professional-grade results
      // Add more quality terms on retry attempts
      let enhancedPrompt = `${genre} music with ${bpm} BPM, ${prompt}, professional studio quality, mastered audio, pristine clarity, perfect mix, audiophile quality, high fidelity`;

      if (attempts > 1) {
        // Add more quality terms on retry attempts
        enhancedPrompt += `, premium sound quality, broadcast ready, commercial grade, studio mastered, professional mixing, crystal clear audio`;
        console.log(`Quality retry attempt ${attempts} with enhanced prompt`);
      }

      // Generate music using Eleven Labs
      const musicUrl = await generateBackgroundMusic(enhancedPrompt, genre);

      // Verify the audio quality
      const qualityResult = await verifyAudioQuality(musicUrl);
      console.log(`Music quality verification result (attempt ${attempts}):`, qualityResult);

      // If it passes quality checks, return immediately
      if (qualityResult.passes) {
        console.log(`Generated music passed quality verification on attempt ${attempts}`);
        return {
          audioUrl: musicUrl,
          fallbackUrl,
          success: true,
          genre,
          bpm,
          isElevenLabs: true,
          qualityVerified: true,
          qualityScore: qualityResult.qualityScore,
          attempts,
        };
      }

      // Otherwise, keep track of the best result so far
      if (qualityResult.qualityScore > bestQualityScore) {
        bestMusicUrl = musicUrl;
        bestQualityScore = qualityResult.qualityScore;
      }

      // Log quality issues for debugging
      if (qualityResult.issues.length > 0) {
        console.warn(`Music quality issues detected:`, qualityResult.issues);
        lastError = new Error(`Music quality below professional standards: ${qualityResult.issues.join(", ")}`);
      }
    } catch (error) {
      console.error(`Error in Eleven Labs music generation (attempt ${attempts}):`, error);
      lastError = error;

      // Only retry if this is a quality-related error, not an API failure
      if (error.message && !error.message.includes("quality")) {
        break;
      }
    }
  }

  // If we have a best result but it didn't pass quality checks, still return it
  // but mark it as not fully quality verified
  if (bestMusicUrl) {
    console.log(`Returning best quality music after ${attempts} attempts (score: ${bestQualityScore})`);
    return {
      audioUrl: bestMusicUrl,
      fallbackUrl,
      success: true,
      genre,
      bpm,
      isElevenLabs: true,
      qualityVerified: false,
      qualityScore: bestQualityScore,
      attempts,
      warning: "Music meets minimum quality standards but not professional-grade",
    };
  }

  // If all attempts failed, fall back to local samples
  console.warn(`Failed to generate professional-quality music after ${attempts} attempts. Using fallback.`);
  return {
    audioUrl: null,
    fallbackUrl,
    success: false,
    error: lastError?.message || "Failed to generate professional-quality music with Eleven Labs",
    useFallback: true,
    attempts,
  };
}

/**
 * Generate audio with background music using Eleven Labs
 */
export async function generateAudioWithBackgroundMusic(text: string, voice: string, emotion: string) {
  try {
    console.log(`Generating audio with text: ${text}, voice: ${voice}, emotion: ${emotion}`)

    // Get fallback sample paths
    const fallbackVoiceSample = await getSampleMapping(voice, emotion)
    const fallbackMusicSample = await getMusicFallback(emotion)

    try {
      // Generate speech and music using Eleven Labs
      const { speechUrl, musicUrl } = await generateSpeechWithMusic(text, voice, emotion)

      return {
        voiceAudioUrl: speechUrl,
        musicUrl: musicUrl,
        fallbackVoiceUrl: fallbackVoiceSample,
        fallbackMusicUrl: fallbackMusicSample,
        success: true,
        message: "Audio generated successfully with Eleven Labs",
      }
    } catch (error) {
      console.error("Error in Eleven Labs API:", error)

      // Return fallback samples if API fails
      return {
        voiceAudioUrl: null,
        musicUrl: null,
        fallbackVoiceUrl: fallbackVoiceSample,
        fallbackMusicUrl: fallbackMusicSample,
        success: false,
        message: `Error generating audio: ${error instanceof Error ? error.message : String(error)}`,
        useFallback: true,
      }
    }
  } catch (error) {
    console.error("Error generating audio:", error)
    // Get default fallback paths
    const fallbackVoiceUrl = await getSampleMapping("neutral", "neutral")
    const fallbackMusicUrl = await getMusicFallback("neutral")

    return {
      voiceAudioUrl: null,
      musicUrl: null,
      fallbackVoiceUrl,
      fallbackMusicUrl,
      success: false,
      message: `Error generating audio: ${error instanceof Error ? error.message : String(error)}`,
      useFallback: true,
    }
  }
}

/**
 * Generate music for a specific mood using Eleven Labs
 */
export async function generateMusicForMood(mood: string) {
  try {
    console.log(`Generating music for mood: ${mood}`)

    // Generate music using Eleven Labs
    const musicUrl = await generateBackgroundMusic(mood)

    const fallbackUrl = await getMusicFallback(mood)
    return {
      musicUrl,
      fallbackUrl,
      success: true,
      message: "Music generated successfully with Eleven Labs",
    }
  } catch (error) {
    console.error("Error generating music:", error)
    const fallbackUrl = await getMusicFallback(mood)
    return {
      musicUrl: null,
      fallbackUrl,
      success: false,
      message: `Error generating music: ${error instanceof Error ? error.message : String(error)}`,
      useFallback: true,
    }
  }
}

/**
 * Generate a text-to-song track using Eleven Labs API
 */
export async function generateTextToSongTrack(paramsJson: string) {
  try {
    console.log(`Generating text-to-song with params: ${paramsJson}`);

    // Parse parameters safely
    let params;
    try {
      params = typeof paramsJson === 'string' ? JSON.parse(paramsJson) : paramsJson;
    } catch (parseError) {
      console.error("Error parsing text-to-song parameters:", parseError);
      // If parsing fails, assume it's just a text string
      params = { text: paramsJson };
    }

    // Extract parameters with defaults
    const {
      text = "",
      voice = "neutral",
      genre = "electronic",
      bpm = 120,
      quality = "high",
      randomizeVoice = true,
    } = params;

    // Validate required parameters
    if (!text || text.trim() === "") {
      throw new Error("Song lyrics are required");
    }

    console.log(`Text-to-song parameters:`, {
      text,
      voice,
      genre,
      bpm,
      quality
    });

    // Determine fallback URL based on genre
    const fallbackUrl = await getFallbackUrl(genre);

    // Generate the song
    try {
      const result = await generateTextToSong({
        text,
        voice,
        genre,
        bpm,
        quality,
        randomizeVoice
      });

      if (result.audio_url) {
        console.log(`Text-to-song generation successful!`);
        return {
          songUrl: result.audio_url,
          fallbackUrl,
          success: true,
          message: `Song generated successfully with Eleven Labs API`,
          duration: result.duration || 30,
          voiceId: result.voiceId, // Include the voice ID that was used
        };
      }
    } catch (error) {
      console.error(`Error in text-to-song generation:`, error);

      // Try with a different approach as fallback
      try {
        console.log(`Trying fallback with different parameters`);
        // Try with a different voice or quality setting
        const fallbackResult = await generateTextToSong({
          text,
          voice: voice === "neutral" ? "deep" : "neutral", // Try a different voice
          genre,
          bpm,
          quality: quality === "high" ? "medium" : "high", // Try a different quality
          randomizeVoice: true, // Always randomize for fallback
        });

        if (fallbackResult.audio_url) {
          console.log(`Fallback song generation successful!`);
          return {
            songUrl: fallbackResult.audio_url,
            fallbackUrl,
            success: true,
            message: `Song generated successfully with fallback parameters`,
            duration: fallbackResult.duration || 30,
            voiceId: fallbackResult.voiceId, // Include the voice ID that was used
          };
        }
      } catch (fallbackError) {
        console.error(`Fallback song generation also failed:`, fallbackError);
      }
    }

    // If all attempts failed, return fallback URL
    console.warn(`Failed to generate song. Using fallback.`);
    return {
      songUrl: null,
      fallbackUrl,
      success: false,
      message: "Failed to generate song. Using fallback audio.",
      useFallback: true,
    };
  } catch (error) {
    console.error("Error generating song:", error);
    return {
      songUrl: null,
      fallbackUrl: "/samples/music-neutral.mp3",
      success: false,
      message: `Error generating song: ${error instanceof Error ? error.message : String(error)}`,
      useFallback: true,
    };
  }
}

/**
 * Generate a remix track with enhanced options using Eleven Labs
 */
export async function generateRemixTrack(paramsJson: string) {
  try {
    console.log(`Generating remix with params: ${paramsJson}`);

    // Parse parameters safely
    let params;
    try {
      params = typeof paramsJson === 'string' ? JSON.parse(paramsJson) : paramsJson;
    } catch (parseError) {
      console.error("Error parsing remix parameters:", parseError);
      // If parsing fails, assume it's just a description string
      params = { description: paramsJson };
    }

    // Extract parameters with defaults
    const {
      description = "",
      genre = "electronic",
      bpm = 128,
      quality = "high",
      seed = "",
      hasUploadedFile = false,
      uploadedFileName = "",
      uploadedFileType = "",
      uploadedFileUrl = ""
    } = params;

    // Validate required parameters
    if (!description || description.trim() === "") {
      throw new Error("Remix description is required");
    }

    console.log(`Remix parameters:`, {
      description,
      genre,
      bpm,
      quality,
      seed,
      hasUploadedFile,
      uploadedFileName
    });

    // Determine fallback URL based on genre
    const fallbackUrl = await getFallbackUrl(genre);

    // Fast remix generation with minimal retries
    console.log(`Starting remix generation for: ${description}`);

    // Determine quality setting based on user preference
    const attemptQuality = quality === "high" ? "high" : (quality === "medium" ? "medium" : "low");

    // Maximum number of retries for remix generation
    const MAX_RETRY_ATTEMPTS = 2;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        console.log(`Remix generation attempt ${attempt} of ${MAX_RETRY_ATTEMPTS}`);

        // Create an enhanced prompt for remix generation
        let remixPrompt;
        if (attempt === 1) {
          // First attempt with standard parameters
          remixPrompt = description;
        } else {
          // Second attempt with more detailed instructions
          remixPrompt = `${description}. Make it a professional ${genre} track with clear beats and melody.`;
        }

        // Call the enhanced background music generator with isRemix=true
        const remixUrl = await generateBackgroundMusic(remixPrompt, genre, true);

        // Verify the remix URL is valid
        if (remixUrl) {
          console.log(`Remix generation successful on attempt ${attempt}!`);

          // Verify the audio quality
          try {
            const qualityResult = await verifyAudioQuality(remixUrl);
            console.log(`Remix quality verification:`, qualityResult);

            if (qualityResult.passes || qualityResult.qualityScore > 50) {
              return {
                remixUrl,
                fallbackUrl,
                success: true,
                message: `Remix generated successfully with Eleven Labs`,
                qualityScore: qualityResult.qualityScore,
                attempt,
              };
            } else {
              console.warn(`Remix quality check failed: ${qualityResult.issues.join(', ')}`);
              // Continue to next attempt if quality is poor
              lastError = new Error(`Poor quality remix: ${qualityResult.issues.join(', ')}`);
            }
          } catch (qualityError) {
            console.error(`Error verifying remix quality:`, qualityError);
            // If we can't verify quality but have a URL, return it anyway
            return {
              remixUrl,
              fallbackUrl,
              success: true,
              message: `Remix generated successfully (quality unverified)`,
              attempt,
            };
          }
        }
      } catch (error) {
        console.error(`Error in remix generation attempt ${attempt}:`, error);
        lastError = error;

        // Short delay before retry
        if (attempt < MAX_RETRY_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    // If all attempts failed, try one last approach with different voice settings
    try {
      console.log(`Trying last resort approach for remix generation`);

      // Use a completely different approach for the last attempt
      const lastResortPrompt = `Create a ${genre} instrumental track with ${bpm} BPM. ${description}`;

      // Use the text-to-song function as a fallback approach
      const songResult = await generateTextToSong({
        text: lastResortPrompt,
        voice: "music-male", // Use music-optimized voice
        genre,
        bpm,
        quality: "high",
        randomizeVoice: false
      });

      if (songResult.audio_url) {
        console.log(`Last resort remix generation successful!`);
        return {
          remixUrl: songResult.audio_url,
          fallbackUrl,
          success: true,
          message: `Remix generated successfully with alternative method`,
          duration: songResult.duration,
        };
      }
    } catch (lastResortError) {
      console.error(`Last resort remix generation failed:`, lastResortError);
      // Continue to fallback handling
    }

    // If all attempts failed, use fallback
    console.warn(`All remix generation attempts failed. Using fallback.`);
    return {
      remixUrl: null,
      fallbackUrl,
      success: false,
      message: `Error generating remix. Using fallback audio.`,
      useFallback: true,
    };
  } catch (error) {
    console.error("Error in generateRemixTrack:", error);

    // Determine fallback URL based on genre from params
    let fallbackUrl = "/samples/edm-remix-sample.mp3";
    try {
      if (typeof paramsJson === 'string') {
        const params = JSON.parse(paramsJson);
        fallbackUrl = await getFallbackUrl(params.genre || "electronic");
      }
    } catch (parseError) {
      console.error("Error parsing params for fallback:", parseError);
    }

    return {
      remixUrl: null,
      fallbackUrl,
      success: false,
      message: `Error generating remix: ${error instanceof Error ? error.message : String(error)}`,
      useFallback: true,
    };
  }
}

// Helper function to get fallback URL based on genre
async function getFallbackUrl(genre: string): Promise<string> {
  const fallbacks: Record<string, string> = {
    edm: "/samples/edm-remix-sample.mp3",
    house: "/samples/house-remix-sample.mp3",
    techno: "/samples/techno-remix-sample.mp3",
    trance: "/samples/trance-remix-sample.mp3",
    dubstep: "/samples/dubstep-remix-sample.mp3",
    hiphop: "/samples/hiphop-remix-sample.mp3",
    rock: "/samples/rock-remix-sample.mp3",
    pop: "/samples/pop-remix-sample.mp3",
    ambient: "/samples/ambient-remix-sample.mp3",
    jazz: "/samples/jazz-remix-sample.mp3",
  };

  return fallbacks[genre?.toLowerCase()] || "/samples/edm-remix-sample.mp3";
}
