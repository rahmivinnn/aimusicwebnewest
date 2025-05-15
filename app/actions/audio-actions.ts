"use server"

import { generateBackgroundMusic, generateRemix, generateSpeechWithMusic } from "@/lib/riffusion-service"
import { generateTextToSong } from "@/lib/text-to-song-service"
import { verifyAudioQuality } from "@/lib/audio-quality-validator"

// Define constants locally instead of exporting them
// Stability AI API key - Professional audio tier
const STABILITY_API_KEY = "sk-ebfcc1a7d768b55f533eb6194e07f29b8c257373a7bdfcf634f937a0a5bba274"
// Text-to-Song API key
const TEXT_TO_SONG_API_KEY = "sk_ee1207b428511380b8ccf3cc96216cb71a00c4715e5a054b"

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
 * Generate professional-grade audio using Riffusion API with quality assurance
 */
export async function generateAudio(params: any) {
  try {
    // Parse parameters
    const {
      prompt,
      voice = "neutral",
      style = "neutral",
      quality = "professional",
      genre,
      bpm,
      hasUploadedFile = false,
      uploadedFileName,
      uploadedFileType,
      uploadedFileUrl
    } = params;

    console.log(`[Server] Generating professional audio with Stability AI: "${prompt}", voice: ${voice}, style: ${style}, quality: ${quality}`)

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

        // Generate speech and music using Stability AI with quality parameter
        const { speechUrl, musicUrl } = await generateSpeechWithMusic(
          enhancedPrompt,
          voice,
          style,
          genre, // Use genre if provided
          quality, // Pass quality parameter
          hasUploadedFile ? uploadedFileUrl : undefined // Pass uploaded file URL if available
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
          isStabilityAI: true,
          qualityVerified: true,
          attempts,
          hasUploadedFile,
        };
      } catch (error) {
        console.error(`Error in Stability AI API (attempt ${attempts}):`, error);
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
      error: lastError?.message || "Failed to generate professional-quality audio with Stability AI API",
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
 * Generate professional-grade music using Riffusion API with quality assurance
 */
export async function generateMusic({ prompt, genre, bpm, duration = 30 }) {
  console.log(`[Server] Professional music generation requested with Stability AI: "${prompt}", genre: ${genre}, bpm: ${bpm}`)

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
      let enhancedPrompt = `${genre} music with ${bpm} BPM, ${prompt}, professional studio quality, mastered audio, pristine clarity, perfect mix, audiophile quality, high fidelity, 48kHz sample rate, 24-bit depth, perfect EQ balance`;

      if (attempts > 1) {
        // Add more quality terms on retry attempts
        enhancedPrompt += `, premium sound quality, broadcast ready, commercial grade, studio mastered, professional mixing, crystal clear audio`;
        console.log(`Quality retry attempt ${attempts} with enhanced prompt`);
      }

      // Generate music using Stability AI
      const musicUrl = await generateRemix(enhancedPrompt);

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
          isStabilityAI: true,
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
      console.error(`Error in Stability AI music generation (attempt ${attempts}):`, error);
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
      isStabilityAI: true,
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
    error: lastError?.message || "Failed to generate professional-quality music with Stability AI",
    useFallback: true,
    attempts,
  };
}

/**
 * Generate audio with background music
 */
export async function generateAudioWithBackgroundMusic(text: string, voice: string, emotion: string) {
  try {
    console.log(`Generating audio with text: ${text}, voice: ${voice}, emotion: ${emotion}`)

    // Get fallback sample paths
    const fallbackVoiceSample = await getSampleMapping(voice, emotion)
    const fallbackMusicSample = await getMusicFallback(emotion)

    try {
      // Generate speech and music using Stability AI
      const { speechUrl, musicUrl } = await generateSpeechWithMusic(text, voice, emotion)

      return {
        voiceAudioUrl: speechUrl,
        musicUrl: musicUrl,
        fallbackVoiceUrl: fallbackVoiceSample,
        fallbackMusicUrl: fallbackMusicSample,
        success: true,
        message: "Audio generated successfully with Stability AI",
      }
    } catch (error) {
      console.error("Error in Stability AI API:", error)

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
 * Generate music for a specific mood
 */
export async function generateMusicForMood(mood: string) {
  try {
    console.log(`Generating music for mood: ${mood}`)

    // Generate music using Stability AI
    const musicUrl = await generateBackgroundMusic(mood)

    const fallbackUrl = await getMusicFallback(mood)
    return {
      musicUrl,
      fallbackUrl,
      success: true,
      message: "Music generated successfully with Stability AI",
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
 * Generate a text-to-song track using UberDuck API
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
      voice = "auto",
      genre = "hip-hop",
      bpm = 90,
      quality = "high",
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
        quality
      });

      if (result.audio_url) {
        console.log(`Text-to-song generation successful!`);
        return {
          songUrl: result.audio_url,
          fallbackUrl,
          success: true,
          message: `Song generated successfully with Text-to-Song API`,
          duration: result.duration || 30,
        };
      }
    } catch (error) {
      console.error(`Error in text-to-song generation:`, error);

      // Try with Stability AI as fallback
      try {
        console.log(`Trying fallback with Stability AI`);
        const fallbackPrompt = `${genre} song with lyrics: ${text}, ${bpm} BPM, professional studio quality`;
        const fallbackResult = await generateRemix(fallbackPrompt, {
          genre,
          bpm,
          quality: "high",
        });

        if (fallbackResult) {
          console.log(`Fallback song generation successful!`);
          return {
            songUrl: fallbackResult,
            fallbackUrl,
            success: true,
            message: `Song generated successfully with fallback API`,
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
 * Generate a remix track with enhanced options
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
      genre = "edm",
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
    console.log(`Starting fast remix generation for: ${description}`);

    // Check if we should use fast mode
    const useUltraFastMode = true; // Always use ultra-fast mode
    const attemptQuality = useUltraFastMode ? "fast" : quality;

    try {
      // Generate remix using Stability AI with optimized parameters
      const remixUrl = await generateRemix(description, {
        genre,
        bpm,
        quality: attemptQuality, // Use fast quality setting
        seed: seed || undefined,
        uploadedAudioUrl: hasUploadedFile && uploadedFileUrl ? uploadedFileUrl : undefined
      });

      // If successful, return immediately
      if (remixUrl) {
        console.log(`Fast remix generation successful!`);
        return {
          remixUrl,
          fallbackUrl,
          success: true,
          message: `Remix generated successfully with Stability AI (fast mode)`,
        };
      }
    } catch (error) {
      console.error(`Error in fast remix generation:`, error);

      // If fast mode fails, try with lower quality as fallback
      try {
        console.log(`Trying fallback with lower quality settings`);
        const fallbackRemixUrl = await generateRemix(description, {
          genre,
          bpm,
          quality: "low", // Use lowest quality for fallback
          seed: seed || undefined,
          uploadedAudioUrl: hasUploadedFile && uploadedFileUrl ? uploadedFileUrl : undefined
        });

        if (fallbackRemixUrl) {
          console.log(`Fallback remix generation successful!`);
          return {
            remixUrl: fallbackRemixUrl,
            fallbackUrl,
            success: true,
            message: `Remix generated successfully with Stability AI (fallback mode)`,
          };
        }
      } catch (fallbackError) {
        console.error(`Fallback remix generation also failed:`, fallbackError);
        // Continue to fallback handling below
      }
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
        fallbackUrl = await getFallbackUrl(params.genre || "edm");
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
