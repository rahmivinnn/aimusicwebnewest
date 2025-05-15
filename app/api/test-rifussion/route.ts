"use server"

import { NextResponse } from "next/server"
import { generateRiffusionAudio } from "@/lib/riffusion-service"

/**
 * Test endpoint for Rifussion API integration
 * This endpoint tests both the music generation and text-to-audio capabilities
 */
export async function GET() {
  try {
    console.log("Testing Rifussion API integration...")

    // Test music generation
    const musicResult = await generateRiffusionAudio({
      prompt: "Professional electronic music, high quality, clear audio, perfect mix",
      negative_prompt: "low quality, noise, distortion, amateur recording",
      num_inference_steps: 75,
      guidance: 8.5,
    })

    // Test text-to-audio
    const speechResult = await generateRiffusionAudio({
      prompt: "Male voice speaking clearly, professional studio quality, crystal clear articulation",
      negative_prompt: "music, instruments, low quality, noise, static, distortion",
      num_inference_steps: 75,
      guidance: 8.5,
    })

    return NextResponse.json({
      success: true,
      message: "Rifussion API integration test successful",
      musicUrl: musicResult.audio_url,
      speechUrl: speechResult.audio_url,
    })
  } catch (error) {
    console.error("Error testing Rifussion API:", error)
    
    return NextResponse.json({
      success: false,
      message: "Rifussion API integration test failed",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
