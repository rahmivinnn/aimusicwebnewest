"use server"

import { NextResponse } from "next/server"
import { generateMusic, generateAudio } from "@/app/actions/audio-actions"
import { verifyAudioQuality, PROFESSIONAL_QUALITY } from "@/lib/audio-quality-validator"

/**
 * Test endpoint for verifying professional audio quality
 * This endpoint tests both music generation and text-to-audio with quality verification
 */
export async function GET(request: Request) {
  try {
    console.log("Testing professional audio quality...")
    const results = {
      music: null,
      speech: null,
      qualityVerification: null,
    };

    // Test music generation with quality verification
    const musicResult = await generateMusic({
      prompt: "Upbeat electronic track with strong bass",
      genre: "electronic",
      bpm: 128,
      duration: 30,
    });

    results.music = {
      success: musicResult.success,
      qualityVerified: musicResult.qualityVerified,
      qualityScore: musicResult.qualityScore,
      attempts: musicResult.attempts,
      useFallback: musicResult.useFallback,
    };

    // Test text-to-audio with quality verification
    const speechResult = await generateAudio({
      prompt: "This is a test of professional-grade audio quality for text-to-speech conversion",
      voice: "male",
      style: "professional",
      quality: "professional",
    });

    results.speech = {
      success: speechResult.success,
      qualityVerified: speechResult.qualityVerified,
      attempts: speechResult.attempts,
      useFallback: speechResult.useFallback,
    };

    // If we have audio URLs, verify their quality directly
    if (musicResult.audioUrl) {
      const qualityCheck = await verifyAudioQuality(musicResult.audioUrl, PROFESSIONAL_QUALITY);
      results.qualityVerification = {
        passes: qualityCheck.passes,
        qualityScore: qualityCheck.qualityScore,
        issues: qualityCheck.issues,
        metadata: qualityCheck.metadata,
      };
    }

    return NextResponse.json({
      success: true,
      message: "Professional audio quality test completed",
      results,
    });
  } catch (error) {
    console.error("Error testing professional audio quality:", error);
    
    return NextResponse.json({
      success: false,
      message: "Professional audio quality test failed",
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
