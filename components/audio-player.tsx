"use client"

import { useState, useRef, useEffect } from "react"
import { Play, Pause, SkipBack, SkipForward, Volume2, Download, Share2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"

interface AudioPlayerProps {
  tracks: {
    id: string
    title: string
    artist: string
    cover: string
    audio: string
  }[]
}

export function AudioPlayer({ tracks }: AudioPlayerProps) {
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [volume, setVolume] = useState([75])
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const animationRef = useRef<number | null>(null)

  const currentTrack = tracks[currentTrackIndex]

  useEffect(() => {
    // Reset player when track changes
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setProgress(0)
      setCurrentTime(0)

      // Set volume
      audioRef.current.volume = volume[0] / 100

      // Load new track
      audioRef.current.load()

      // Auto play if was playing
      if (isPlaying) {
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise.catch((error) => {
            console.error("Audio playback failed:", error)
            setIsPlaying(false)
          })
        }
      }
    }
  }, [currentTrackIndex, tracks, isPlaying])

  useEffect(() => {
    // Update volume when slider changes
    if (audioRef.current) {
      audioRef.current.volume = volume[0] / 100
    }
  }, [volume])

  const togglePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    } else {
      const playPromise = audioRef.current.play()
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error("Audio playback failed:", error)
          setIsPlaying(false)
        })
      }
      animationRef.current = requestAnimationFrame(updateProgress)
    }

    setIsPlaying(!isPlaying)
  }

  const updateProgress = () => {
    if (!audioRef.current) return

    const currentTime = audioRef.current.currentTime
    const duration = audioRef.current.duration || 0

    if (duration > 0) {
      setProgress((currentTime / duration) * 100)
      setCurrentTime(currentTime)
    }

    animationRef.current = requestAnimationFrame(updateProgress)
  }

  const onLoadedMetadata = () => {
    if (!audioRef.current) return
    setDuration(audioRef.current.duration)
  }

  const onEnded = () => {
    if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1)
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setIsPlaying(false)
      setProgress(0)
      setCurrentTime(0)
    }
  }

  const skipToPrevious = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(currentTrackIndex - 1)
    }
  }

  const skipToNext = () => {
    if (currentTrackIndex < tracks.length - 1) {
      setCurrentTrackIndex(currentTrackIndex + 1)
    }
  }

  const handleProgressChange = (value: number[]) => {
    if (!audioRef.current) return

    const newTime = (value[0] / 100) * (audioRef.current.duration || 0)
    audioRef.current.currentTime = newTime
    setProgress(value[0])
    setCurrentTime(newTime)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`
  }

  const downloadTrack = () => {
    if (!currentTrack) return

    try {
      // Buat blob URL untuk download
      fetch(currentTrack.audio)
        .then((response) => response.blob())
        .then((blob) => {
          // Buat object URL dari blob
          const blobUrl = URL.createObjectURL(blob)

          // Buat elemen anchor untuk download
          const downloadLink = document.createElement("a")
          downloadLink.href = blobUrl
          downloadLink.download = `${currentTrack.title}.mp3`
          document.body.appendChild(downloadLink)
          downloadLink.click()

          // Cleanup
          setTimeout(() => {
            document.body.removeChild(downloadLink)
            URL.revokeObjectURL(blobUrl)
          }, 100)

          toast({
            title: "Download Started",
            description: `${currentTrack.title} is downloading...`,
          })
        })
        .catch((error) => {
          console.error("Download failed:", error)
          toast({
            title: "Download Failed",
            description: "Couldn't download the track. Please try again.",
            variant: "destructive",
          })
        })
    } catch (error) {
      console.error("Download error:", error)
      toast({
        title: "Download Error",
        description: "There was a problem downloading the track.",
        variant: "destructive",
      })
    }
  }

  // Implement share functionality
  const shareTrack = async () => {
    if (!currentTrack) return

    // Check if Web Share API is supported
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${currentTrack.title} by ${currentTrack.artist}`,
          text: `Check out ${currentTrack.title} by ${currentTrack.artist}`,
          url: window.location.href,
        })

        toast({
          title: "Shared Successfully",
          description: "Track has been shared!",
        })
      } catch (error) {
        console.error("Sharing failed:", error)

        // Fall back to copying to clipboard
        copyLinkToClipboard()
      }
    } else {
      // If Web Share API not supported, copy to clipboard
      copyLinkToClipboard()
    }
  }

  // Helper function to copy link to clipboard
  const copyLinkToClipboard = () => {
    try {
      const shareUrl = `${window.location.origin}/share/track/${currentTrack.id}`
      navigator.clipboard.writeText(shareUrl).then(
        () => {
          toast({
            title: "Link Copied",
            description: "Track link copied to clipboard!",
          })
        },
        (err) => {
          console.error("Could not copy text: ", err)
          toast({
            title: "Copy Failed",
            description: "Could not copy link to clipboard.",
            variant: "destructive",
          })
        },
      )
    } catch (error) {
      console.error("Clipboard API not available:", error)
      toast({
        title: "Share Failed",
        description: "Sharing is not supported in your browser.",
        variant: "destructive",
      })
    }
  }

  // Fallback image handling
  const [imgError, setImgError] = useState(false)
  const handleImageError = () => setImgError(true)

  return (
    <Card className="w-full bg-gradient-to-r from-gray-900 to-gray-800 text-white border-none shadow-xl">
      <CardContent className="p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative w-20 h-20 rounded-md overflow-hidden flex-shrink-0">
            <img
              src={imgError ? "/placeholder.svg?height=80&width=80&query=music" : currentTrack.cover}
              alt={currentTrack.title}
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
          </div>

          <div className="flex-grow">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
              <div>
                <h3 className="font-bold text-lg">{currentTrack.title}</h3>
                <p className="text-gray-300 text-sm">{currentTrack.artist}</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-cyan-400 hover:bg-gray-800"
                  onClick={downloadTrack}
                >
                  <Download className="h-5 w-5" />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:text-cyan-400 hover:bg-gray-800"
                  onClick={shareTrack}
                >
                  <Share2 className="h-5 w-5" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 w-full">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-10">{formatTime(currentTime)}</span>
                <Slider
                  value={[progress]}
                  min={0}
                  max={100}
                  step={0.1}
                  onValueChange={(value) => handleProgressChange(value)}
                  className="flex-grow"
                />
                <span className="text-xs text-gray-400 w-10">{formatTime(duration)}</span>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:text-cyan-400 hover:bg-gray-800"
                    onClick={skipToPrevious}
                    disabled={currentTrackIndex === 0}
                  >
                    <SkipBack className="h-5 w-5" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:text-cyan-400 hover:bg-gray-800"
                    onClick={togglePlayPause}
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:text-cyan-400 hover:bg-gray-800"
                    onClick={skipToNext}
                    disabled={currentTrackIndex === tracks.length - 1}
                  >
                    <SkipForward className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-2 w-24">
                  <Volume2 className="h-4 w-4 text-gray-400" />
                  <Slider value={volume} min={0} max={100} step={1} onValueChange={setVolume} className="flex-grow" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden audio element */}
        <audio
          ref={audioRef}
          src={currentTrack.audio}
          onLoadedMetadata={onLoadedMetadata}
          onEnded={onEnded}
          preload="metadata"
        />
      </CardContent>
    </Card>
  )
}
