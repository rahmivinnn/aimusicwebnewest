import { NextRequest, NextResponse } from "next/server";
import { generateBackgroundMusic } from "@/lib/elevenlabs-service";
import { verifyAudioQuality } from "@/lib/audio-quality-validator";

// API key validation middleware
function validateApiKey(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { valid: false, error: "Missing or invalid Authorization header" };
  }
  
  const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
  
  // List of valid API keys - in production, this should be stored securely
  const validApiKeys = [
    "3909ddf5613106b3fa8c0926b4393b4a",
    "sk_ee1207b428511380b8ccf3cc96216cb71a00c4715e5a054b"
  ];
  
  if (!validApiKeys.includes(apiKey)) {
    return { valid: false, error: "Invalid API key" };
  }
  
  return { valid: true };
}

/**
 * POST /api/remix
 * 
 * Generate a high-quality EDM remix based on the prompt provided by the user.
 * 
 * Request body:
 * {
 *   "prompt": "beat EDM",
 *   "format": "mp3",
 *   "duration": 30
 * }
 * 
 * Response:
 * - 200 OK with audio file
 * - 400 Bad Request if parameters are invalid
 * - 401 Unauthorized if API key is invalid
 * - 500 Internal Server Error if generation fails
 */
export async function POST(request: NextRequest) {
  console.log("Remix API called");
  
  try {
    // Validate API key
    const keyValidation = validateApiKey(request);
    if (!keyValidation.valid) {
      console.error("API key validation failed:", keyValidation.error);
      return NextResponse.json(
        { error: keyValidation.error },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    const { prompt, format = "mp3", duration = 30 } = body;
    
    // Validate required parameters
    if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
      console.error("Invalid prompt:", prompt);
      return NextResponse.json(
        { error: "Invalid prompt. Please provide a non-empty string." },
        { status: 400 }
      );
    }
    
    console.log(`Generating remix with prompt: "${prompt}", format: ${format}, duration: ${duration}`);
    
    // Determine genre from prompt
    const genreKeywords = {
      "edm": ["edm", "electronic", "beat", "drop", "dance"],
      "house": ["house", "deep house", "progressive house"],
      "techno": ["techno", "minimal", "industrial"],
      "trance": ["trance", "uplifting", "progressive trance"],
      "dubstep": ["dubstep", "bass", "wobble"],
      "hiphop": ["hip hop", "hiphop", "rap", "trap"],
      "rock": ["rock", "guitar", "band"],
      "pop": ["pop", "catchy", "chorus"],
      "ambient": ["ambient", "chill", "relaxing", "atmospheric"],
      "jazz": ["jazz", "smooth", "saxophone", "trumpet"]
    };
    
    let detectedGenre = "edm"; // Default genre
    
    // Detect genre from prompt
    for (const [genre, keywords] of Object.entries(genreKeywords)) {
      if (keywords.some(keyword => prompt.toLowerCase().includes(keyword))) {
        detectedGenre = genre;
        break;
      }
    }
    
    // Enhanced prompt for better quality
    let enhancedPrompt = prompt;
    
    // If prompt is too short, enhance it
    if (prompt.length < 15) {
      enhancedPrompt = `${prompt}, professional ${detectedGenre} track with clear beats and melody, 128 BPM`;
    }
    
    console.log(`Enhanced prompt: "${enhancedPrompt}", detected genre: ${detectedGenre}`);
    
    // Generate the remix with isRemix=true flag
    const remixUrl = await generateBackgroundMusic(enhancedPrompt, detectedGenre, true);
    
    if (!remixUrl) {
      throw new Error("Failed to generate remix: No audio URL returned");
    }
    
    // Verify audio quality
    const qualityResult = await verifyAudioQuality(remixUrl);
    console.log("Audio quality verification:", qualityResult);
    
    if (!qualityResult.passes && qualityResult.qualityScore < 30) {
      console.error("Audio quality check failed:", qualityResult.issues);
      throw new Error(`Generated audio failed quality check: ${qualityResult.issues.join(", ")}`);
    }
    
    // For blob URLs, we need to fetch the content and return it
    if (remixUrl.startsWith("blob:")) {
      const response = await fetch(remixUrl);
      const audioBlob = await response.blob();
      
      // Log the blob size for debugging
      console.log(`Audio blob size: ${audioBlob.size} bytes`);
      
      if (audioBlob.size === 0) {
        throw new Error("Generated audio is empty (0 bytes)");
      }
      
      // Return the audio file with appropriate headers
      return new NextResponse(audioBlob, {
        headers: {
          "Content-Type": format === "wav" ? "audio/wav" : "audio/mpeg",
          "Content-Length": audioBlob.size.toString(),
          "Content-Disposition": `attachment; filename="remix-${Date.now()}.${format}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
    } else {
      // For regular URLs, redirect to the audio file
      return NextResponse.json({
        success: true,
        remix_url: remixUrl,
        format,
        duration,
        message: "Remix generated successfully"
      });
    }
  } catch (error) {
    console.error("Error generating remix:", error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Unknown error occurred",
        logs: {
          timestamp: new Date().toISOString(),
          error_type: error instanceof Error ? error.name : "Unknown",
          stack: error instanceof Error ? error.stack : undefined
        }
      },
      { status: 500 }
    );
  }
}
