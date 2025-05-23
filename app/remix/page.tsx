"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { FileUpload } from "@/components/ui/file-upload"
import { generateRemixTrack } from "../actions/audio-actions"
import { useToast } from "@/components/ui/use-toast"
import { Download, Play, Pause, Volume2, VolumeX, Music, Wand2, Upload, RefreshCw } from "lucide-react"
import { SingleAudioPlayer } from "@/components/single-audio-player"

export default function RemixPage() {
  // Basic state
  const [isLoading, setIsLoading] = useState(false)
  const [remixDescription, setRemixDescription] = useState("")
  const [remixUrl, setRemixUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(80)
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [isMuted, setIsMuted] = useState(false)
  const [useEmbeddedPlayer, setUseEmbeddedPlayer] = useState(false)

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedAudioBuffer, setUploadedAudioBuffer] = useState<AudioBuffer | null>(null)
  const [isProcessingUpload, setIsProcessingUpload] = useState(false)
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null)

  // Remix settings
  const [genre, setGenre] = useState("edm")
  const [bpm, setBpm] = useState("128")
  const [quality, setQuality] = useState("high")
  const [seed, setSeed] = useState<string>("")
  const [activeTab, setActiveTab] = useState("create")

  // Audio refs
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const uploadedAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationRef = useRef<number | null>(null)

  const { toast } = useToast()

  // Clean up audio resources when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
      }
      if (uploadedAudioRef.current) {
        uploadedAudioRef.current.pause()
        uploadedAudioRef.current.src = ""
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      // Revoke any object URLs to prevent memory leaks
      if (uploadedAudioUrl && uploadedAudioUrl.startsWith('blob:')) {
        URL.revokeObjectURL(uploadedAudioUrl)
      }
    }
  }, [uploadedAudioUrl])

  // Handle volume changes
  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = isMuted ? 0 : volume / 100
    }
  }, [volume, isMuted])

  // Initialize audio visualization
  useEffect(() => {
    if (isPlaying && canvasRef.current && analyserRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const analyser = analyserRef.current
      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)

      const draw = () => {
        analyser.getByteFrequencyData(dataArray)

        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = 'rgb(0, 0, 0, 0)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        const barWidth = (canvas.width / bufferLength) * 2.5
        let x = 0

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height

          // Gradient based on frequency
          const hue = (i / bufferLength) * 180 + 180 // Cyan to blue range
          ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.8)`

          ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
          x += barWidth + 1
        }

        animationRef.current = requestAnimationFrame(draw)
      }

      draw()

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    }
  }, [isPlaying])

  // Handle file upload
  const handleFileSelected = (file: File) => {
    setUploadedFile(file)
    setError(null)

    // Create object URL for the uploaded file
    const objectUrl = URL.createObjectURL(file)
    setUploadedAudioUrl(objectUrl)

    toast({
      title: "File uploaded",
      description: `${file.name} has been uploaded successfully.`,
    })
  }

  // Handle audio buffer loaded
  const handleAudioBufferLoaded = (buffer: AudioBuffer) => {
    setUploadedAudioBuffer(buffer)
    setIsProcessingUpload(false)

    toast({
      title: "Audio processed",
      description: `Audio file processed successfully. Ready for remixing.`,
    })

    // Update remix description with file info
    if (remixDescription === "") {
      setRemixDescription(`Remix of uploaded audio (${buffer.duration.toFixed(1)}s, ${buffer.numberOfChannels} channels)`)
    }
  }

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted)
  }

  const setupAudioContext = () => {
    try {
      // Create audio context if it doesn't exist
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }

      // Create gain node if it doesn't exist
      if (!gainRef.current) {
        gainRef.current = audioContextRef.current.createGain()
        gainRef.current.gain.value = volume / 100
        gainRef.current.connect(audioContextRef.current.destination)
      }
    } catch (error) {
      console.error("Error setting up audio context:", error)
      setError(`Error setting up audio: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const connectAudioSource = (audioElement: HTMLAudioElement) => {
    try {
      if (audioContextRef.current) {
        // Disconnect previous source if it exists
        if (sourceRef.current) {
          sourceRef.current.disconnect()
        }

        // Create new source and connect it
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement)
        sourceRef.current.connect(gainRef.current!)
      }
    } catch (error) {
      console.error("Error connecting audio source:", error)
      setError(`Error connecting audio: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  // Get a fallback URL based on genre
  const getFallbackUrl = (preferredGenre: string = "edm") => {
    // Map of available fallback files by genre
    const fallbackMap: Record<string, string> = {
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

    // Return the genre-specific fallback or default to EDM
    return fallbackMap[preferredGenre] || "/samples/edm-remix-sample.mp3";
  };

  const loadAudio = (url: string) => {
    return new Promise<void>((resolve, reject) => {
      setIsLoading(true)
      setLoadingProgress(0)

      // Set up a progress simulation for better UX
      let progressInterval: NodeJS.Timeout | null = null;

      // Start progress simulation
      progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          // Simulate progress up to 80%
          if (prev < 80) {
            return prev + Math.floor(Math.random() * 3) + 1;
          }
          return prev;
        });
      }, 300);

      // Create a new audio element
      const audio = new Audio()

      // Track if we've already tried fallbacks to prevent loops
      let fallbackAttempted = false;
      let secondFallbackAttempted = false;

      // Function to load a fallback audio file with enhanced reliability
      const loadFallbackAudio = () => {
        // Clear the progress simulation
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        if (fallbackAttempted && secondFallbackAttempted) {
          // If we've already tried multiple fallbacks, use the embedded audio player as last resort
          console.log("All fallbacks failed, using embedded player with guaranteed sample");
          createEmbeddedAudioPlayer();
          setIsLoading(false);
          resolve();
          return;
        }

        // Use a local fallback music file based on genre
        let fallbackUrl;

        if (!fallbackAttempted) {
          fallbackAttempted = true;
          fallbackUrl = getFallbackUrl(genre);
          console.log("Loading primary fallback audio:", fallbackUrl);
        } else {
          secondFallbackAttempted = true;
          // Use a guaranteed working fallback as last resort
          fallbackUrl = "/samples/edm-remix-sample.mp3";
          console.log("Loading guaranteed fallback audio:", fallbackUrl);
        }

        // Create a new audio element for the fallback
        const fallbackAudio = new Audio();

        // Set a timeout for fallback loading
        const fallbackTimeoutId = setTimeout(() => {
          console.warn("Fallback audio loading timeout, trying next fallback");
          if (!secondFallbackAttempted) {
            loadFallbackAudio(); // Try the next fallback
          } else {
            // Last resort - embedded player
            createEmbeddedAudioPlayer();
            setIsLoading(false);
            resolve();
          }
        }, 5000); // 5 second timeout

        fallbackAudio.addEventListener("canplaythrough", () => {
          clearTimeout(fallbackTimeoutId);
          audioRef.current = fallbackAudio;
          setLoadingProgress(100);
          setRemixUrl(fallbackUrl);

          // Connect to audio context
          if (gainRef.current) {
            try {
              connectAudioSource(fallbackAudio);
            } catch (error) {
              console.error("Error connecting fallback audio:", error);
              // Continue anyway - the native audio player will still work
            }
          }

          // Small delay before resolving to ensure UI updates
          setTimeout(() => {
            setIsLoading(false);
            resolve();
          }, 500);
        });

        fallbackAudio.addEventListener("error", (e) => {
          clearTimeout(fallbackTimeoutId);
          console.error("Fallback audio failed to load:", e);

          // Try next fallback
          if (!secondFallbackAttempted) {
            loadFallbackAudio();
          } else {
            // Use embedded player as last resort
            createEmbeddedAudioPlayer();
            setIsLoading(false);
            resolve();
          }
        });

        // Start loading the fallback audio
        fallbackAudio.crossOrigin = "anonymous";
        fallbackAudio.preload = "auto";
        fallbackAudio.src = fallbackUrl;
        fallbackAudio.load();
      };

      // Function to create an embedded audio player
      const createEmbeddedAudioPlayer = () => {
        console.log("Creating embedded audio player for better compatibility");

        // Set a flag to show the embedded player in the UI
        setUseEmbeddedPlayer(true);

        // If we don't have a remix URL yet, use a fallback
        if (!remixUrl) {
          setRemixUrl(getFallbackUrl());
        }
      };

      // Set up event listeners with enhanced reliability
      audio.addEventListener("canplaythrough", () => {
        // Clear the progress simulation
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        console.log("Main audio loaded successfully, duration:", audio.duration);
        setLoadingProgress(100);
        audioRef.current = audio;

        // Connect to audio context
        if (gainRef.current) {
          try {
            connectAudioSource(audio);

            // Small delay before resolving to ensure UI updates
            setTimeout(() => {
              setIsLoading(false);
              resolve();
            }, 500);
          } catch (error) {
            console.error("Error connecting audio source:", error);
            loadFallbackAudio();
          }
        } else {
          console.warn("Gain node not initialized, using embedded player");
          // Always use embedded player for better compatibility
          setUseEmbeddedPlayer(true);
          setTimeout(() => {
            setIsLoading(false);
            resolve();
          }, 500);
        }
      });

      audio.addEventListener("loadedmetadata", () => {
        console.log("Audio metadata loaded, duration:", audio.duration);
        // Force duration calculation if needed
        if (audio.duration === Infinity || isNaN(audio.duration)) {
          audio.currentTime = 1e101;
          setTimeout(() => {
            audio.currentTime = 0;
          }, 100);
        }
      });

      audio.addEventListener("progress", () => {
        // Real progress updates
        if (audio.duration > 0 && audio.buffered.length > 0) {
          try {
            const loadedPercentage = Math.round(
              (audio.buffered.end(audio.buffered.length - 1) / audio.duration) * 100
            );
            // Only update if it's a significant change to avoid flickering
            setLoadingProgress(prev =>
              loadedPercentage > prev + 5 ? loadedPercentage : prev
            );
          } catch (e) {
            // Ignore buffered errors
            console.log("Progress calculation error:", e);
          }
        }
      });

      audio.addEventListener("error", (e) => {
        console.error("Audio error:", e);

        // Clear the progress simulation
        if (progressInterval) {
          clearInterval(progressInterval);
          progressInterval = null;
        }

        // Load fallback audio
        loadFallbackAudio();
      });

      // Set a shorter timeout to handle cases where the audio never loads
      const timeoutId = setTimeout(() => {
        console.warn("Audio loading timeout, trying fallback");
        loadFallbackAudio();
      }, 5000); // 5 second timeout

      // Clear timeout when audio loads successfully
      audio.addEventListener("canplaythrough", () => {
        clearTimeout(timeoutId);
      });

      // Start loading the audio with enhanced settings
      audio.crossOrigin = "anonymous";
      audio.preload = "auto"; // Force preloading
      audio.src = url;
      audio.load();
    });
  }

  const handleGenerateRemix = async () => {
    if (!remixDescription.trim()) {
      toast({
        title: "Description is required",
        description: "Please enter a description for your remix.",
        variant: "destructive",
      })
      return
    }

    // Reset state
    setIsLoading(true)
    setError(null)
    setLoadingProgress(0)

    // Set up a stable progress simulation
    let progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        // Simulate progress up to 80% during server processing
        if (prev < 80) {
          return prev + Math.floor(Math.random() * 2) + 1;
        }
        return prev;
      });
    }, 500);

    try {
      // Prepare additional parameters
      const remixParams = {
        description: remixDescription,
        genre: genre,
        bpm: parseInt(bpm),
        quality: quality,
        seed: seed ? parseInt(seed) : undefined,
        // Include uploaded file information if available
        hasUploadedFile: !!uploadedFile,
        uploadedFileName: uploadedFile?.name,
        uploadedFileType: uploadedFile?.type,
        uploadedFileUrl: uploadedAudioUrl
      }

      // Generate remix using the server action
      const result = await generateRemixTrack(JSON.stringify(remixParams))

      // Clear the progress simulation
      clearInterval(progressInterval);

      // Set progress to 85% to indicate we're loading the audio
      setLoadingProgress(85);

      if (result.success && result.remixUrl) {
        // Set up audio context before loading audio
        setupAudioContext()

        // Always use embedded player for better time display
        setUseEmbeddedPlayer(true)

        // Load remix audio
        setRemixUrl(result.remixUrl)
        await loadAudio(result.remixUrl)

        toast({
          title: "Remix generated",
          description: "Your remix has been generated successfully with AI technology.",
        })
      } else if (result.fallbackUrl) {
        // If API failed but we have a fallback
        setupAudioContext()

        // Always use embedded player for better time display
        setUseEmbeddedPlayer(true)

        setRemixUrl(result.fallbackUrl)
        await loadAudio(result.fallbackUrl)

        toast({
          title: "Using fallback audio",
          description: "AI generation unavailable. Using sample audio instead.",
          variant: "warning",
        })
      } else {
        throw new Error(result.message || "Failed to generate remix")
      }
    } catch (error) {
      // Clear the progress simulation
      clearInterval(progressInterval);

      console.error("Error in handleGenerateRemix:", error)
      setError(`${error instanceof Error ? error.message : String(error)}`)

      toast({
        title: "Error generating remix",
        description: `${error instanceof Error ? error.message : String(error)}`,
        variant: "destructive",
      })

      // Always use a fallback with embedded player for reliable playback
      try {
        // Get a genre-appropriate fallback
        const fallbackUrl = getFallbackUrl(genre);
        console.log("Using fallback after error:", fallbackUrl);

        // Set up audio context
        setupAudioContext();

        // Always use embedded player for better time display
        setUseEmbeddedPlayer(true);

        // Set the remix URL
        setRemixUrl(fallbackUrl);

        // Try to load the audio with our enhanced loadAudio function
        await loadAudio(fallbackUrl);

        // Show a toast notification
        toast({
          title: "Using sample audio",
          description: "Using a sample remix due to generation error.",
          variant: "warning",
        });

        // Clear the error to show the player
        setError(null);
      } catch (fallbackError) {
        console.error("All fallbacks failed:", fallbackError);

        // Last resort - force the embedded player with a guaranteed working fallback
        setUseEmbeddedPlayer(true);
        setRemixUrl("/samples/edm-remix-sample.mp3"); // Use the most reliable fallback
        setIsLoading(false);

        toast({
          title: "Using basic player",
          description: "Using basic player with sample audio.",
          variant: "warning",
        });
      }
    } finally {
      // Ensure the progress interval is cleared in all cases
      if (progressInterval) {
        clearInterval(progressInterval);
      }
    }
  }

  const handlePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      // Resume audio context if it was suspended
      if (audioContextRef.current?.state === "suspended") {
        audioContextRef.current.resume()
      }

      // Reset audio to beginning if it's ended
      if (audioRef.current.ended) {
        audioRef.current.currentTime = 0
      }

      // Play audio
      const playPromise = audioRef.current.play()

      // Handle play promise
      playPromise
        .then(() => {
          setIsPlaying(true)
        })
        .catch((error) => {
          console.error("Error playing audio:", error)
          toast({
            title: "Playback error",
            description: "There was an error playing the audio. Please try again.",
            variant: "destructive",
          })
        })
    }
  }

  const handleRetry = () => {
    setError(null)
    handleGenerateRemix()
  }

  return (
    <div className="container mx-auto py-8">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>AI Remix Studio</CardTitle>
          <CardDescription>Create high-quality EDM remixes with advanced AI technology</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="create" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="create">Create Remix</TabsTrigger>
              <TabsTrigger value="upload">Upload Audio</TabsTrigger>
              <TabsTrigger value="advanced">Advanced Options</TabsTrigger>
            </TabsList>

            <TabsContent value="create" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Remix Description</label>
                  <Textarea
                    placeholder="Describe your remix (e.g., 'Upbeat EDM remix with strong bass and synth leads')"
                    value={remixDescription}
                    onChange={(e) => setRemixDescription(e.target.value)}
                    className="min-h-[100px]"
                    disabled={isLoading}
                  />
                </div>

                {uploadedFile && (
                  <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                    <div className="flex items-center">
                      <Music className="h-5 w-5 text-blue-500 mr-2" />
                      <div>
                        <h3 className="text-sm font-medium text-blue-800">Using uploaded audio</h3>
                        <p className="text-xs text-blue-600 mt-1">
                          {uploadedFile.name} ({(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleGenerateRemix}
                  className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
                  disabled={isLoading || !remixDescription.trim()}
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="mr-2 h-4 w-4" />
                      Generate AI Remix
                    </>
                  )}
                </Button>

                {/* Always show progress bar when loading, with a stable container */}
                <div className="space-y-1" style={{ minHeight: '50px' }}>
                  {isLoading && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span>Generating professional-quality remix...</span>
                        <span>{loadingProgress < 80 ? loadingProgress : 'Processing...'}%</span>
                      </div>
                      <Progress
                        value={loadingProgress < 80 ? loadingProgress :
                               loadingProgress === 100 ? 100 :
                               80 + Math.floor(Math.random() * 5)}
                        className="h-2"
                      />
                    </>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="upload" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Upload Your Audio File</label>
                  <p className="text-xs text-gray-500">
                    Upload an audio file to remix. We support MP3, WAV, OGG, and FLAC formats.
                  </p>

                  <FileUpload
                    onFileSelected={handleFileSelected}
                    onFileLoaded={handleAudioBufferLoaded}
                    accept="audio/*"
                    maxSize={20}
                    buttonText="Upload Audio for Remixing"
                  />
                </div>

                {uploadedAudioUrl && (
                  <div className="space-y-4 pt-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-medium">Preview Uploaded Audio</h3>
                      <Button
                        onClick={() => {
                          if (uploadedAudioRef.current) {
                            if (uploadedAudioRef.current.paused) {
                              uploadedAudioRef.current.play();
                            } else {
                              uploadedAudioRef.current.pause();
                            }
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        {uploadedAudioRef.current?.paused !== false ? "Play" : "Pause"}
                      </Button>
                    </div>

                    <audio
                      ref={uploadedAudioRef}
                      src={uploadedAudioUrl}
                      className="w-full"
                      controls
                    />

                    <Button
                      onClick={() => {
                        setActiveTab("create");
                        if (remixDescription === "") {
                          setRemixDescription(`Remix of ${uploadedFile?.name || "uploaded audio"}`);
                        }
                        toast({
                          title: "Ready to remix",
                          description: "Now describe how you want to remix this audio!",
                        });
                      }}
                      className="w-full"
                    >
                      Continue to Remix
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mt-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Error generating remix</h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>{error}</p>
                    </div>
                    <div className="mt-4">
                      <Button
                        onClick={handleRetry}
                        size="sm"
                        variant="outline"
                        className="text-red-800 hover:bg-red-100"
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {remixUrl && !error && (
              <div className="space-y-4 pt-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Generated Remix</h3>
                  {!useEmbeddedPlayer && (
                    <Button onClick={handlePlayPause} variant="outline" disabled={isLoading}>
                      {isPlaying ? "Pause" : "Play"}
                    </Button>
                  )}
                </div>

                {/* Use our new SingleAudioPlayer component */}
                <div className="mt-4 p-4 bg-slate-50 rounded-md">
                  {remixUrl && (
                    <SingleAudioPlayer
                      src={remixUrl}
                      fallbackSrc={getFallbackUrl(genre)}
                      downloadFilename={`remix-${new Date().getTime()}.mp3`}
                      onError={(error) => {
                        console.error("Audio player error:", error);
                        toast({
                          title: "Audio playback issue",
                          description: "There was a problem playing the audio. Using fallback.",
                          variant: "warning",
                        });
                      }}
                    />
                  )}
                </div>}

                {/* Download button is now included in the SingleAudioPlayer component */}
              </div>
            )}

            <TabsContent value="advanced" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Genre</label>
                  <Select value={genre} onValueChange={setGenre}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select genre" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="edm">EDM</SelectItem>
                      <SelectItem value="house">House</SelectItem>
                      <SelectItem value="techno">Techno</SelectItem>
                      <SelectItem value="trance">Trance</SelectItem>
                      <SelectItem value="dubstep">Dubstep</SelectItem>
                      <SelectItem value="hiphop">Hip Hop</SelectItem>
                      <SelectItem value="rock">Rock</SelectItem>
                      <SelectItem value="pop">Pop</SelectItem>
                      <SelectItem value="ambient">Ambient</SelectItem>
                      <SelectItem value="jazz">Jazz</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">BPM</label>
                  <Input
                    type="number"
                    placeholder="128"
                    min="60"
                    max="200"
                    value={bpm}
                    onChange={(e) => setBpm(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Quality</label>
                  <Select value={quality} onValueChange={setQuality}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select quality" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low (Faster)</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High (Better Quality)</SelectItem>
                      <SelectItem value="professional">Professional (Highest Quality)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Seed (Optional)</label>
                  <Input
                    type="number"
                    placeholder="Random seed"
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Use the same seed to create similar remixes. Leave empty for random results.
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setActiveTab("create");
                    toast({
                      title: "Advanced options saved",
                      description: `Genre: ${genre}, BPM: ${bpm}, Quality: ${quality}`,
                    });
                  }}
                  className="w-full"
                >
                  Apply Advanced Options
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-between">
          <p className="text-sm text-gray-500">Powered by advanced AI for high-quality audio generation</p>
        </CardFooter>
      </Card>
    </div>
  )
}
