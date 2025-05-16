"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
import { Download, Play, Pause, RefreshCw, Music } from "lucide-react"

export default function RemixApiPage() {
  const { toast } = useToast()
  
  // State for remix generation
  const [prompt, setPrompt] = useState("")
  const [genre, setGenre] = useState("edm")
  const [bpm, setBpm] = useState(128)
  const [format, setFormat] = useState("mp3")
  const [isGenerating, setIsGenerating] = useState(false)
  const [remixUrl, setRemixUrl] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [apiKey, setApiKey] = useState("3909ddf5613106b3fa8c0926b4393b4a") // Default API key
  
  // Audio element reference
  const audioRef = useRef<HTMLAudioElement | null>(null)
  
  // Genre options
  const genres = [
    { id: "edm", name: "EDM" },
    { id: "house", name: "House" },
    { id: "techno", name: "Techno" },
    { id: "trance", name: "Trance" },
    { id: "dubstep", name: "Dubstep" },
    { id: "hiphop", name: "Hip Hop" },
    { id: "rock", name: "Rock" },
    { id: "pop", name: "Pop" },
    { id: "ambient", name: "Ambient" },
    { id: "jazz", name: "Jazz" },
  ]
  
  // Format options
  const formats = [
    { id: "mp3", name: "MP3" },
    { id: "wav", name: "WAV" },
  ]
  
  // Handle audio time update
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime)
    }
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration)
    }
    
    const handleEnded = () => {
      setIsPlaying(false)
    }
    
    audio.addEventListener("timeupdate", handleTimeUpdate)
    audio.addEventListener("loadedmetadata", handleLoadedMetadata)
    audio.addEventListener("ended", handleEnded)
    
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate)
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
      audio.removeEventListener("ended", handleEnded)
    }
  }, [remixUrl])
  
  // Handle play/pause
  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return
    
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
    
    setIsPlaying(!isPlaying)
  }
  
  // Generate remix
  const generateRemix = async () => {
    if (!prompt) {
      toast({
        title: "Please enter a prompt",
        description: "A prompt is required to generate a remix",
        variant: "destructive",
      })
      return
    }
    
    setIsGenerating(true)
    
    try {
      // Call our API endpoint
      const response = await fetch("/api/remix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt,
          format,
          genre,
          bpm,
        }),
      })
      
      // Check if response is OK
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to generate remix")
      }
      
      // Check content type to determine how to handle the response
      const contentType = response.headers.get("Content-Type")
      
      if (contentType && contentType.includes("audio")) {
        // Direct audio response - create a blob URL
        const blob = await response.blob()
        
        // Log the blob size for debugging
        console.log(`Received audio blob: ${blob.size} bytes`)
        
        if (blob.size === 0) {
          throw new Error("Received empty audio file")
        }
        
        // Create a URL for the blob
        const url = URL.createObjectURL(blob)
        setRemixUrl(url)
        
        toast({
          title: "Remix generated",
          description: `Generated a ${format.toUpperCase()} remix (${Math.round(blob.size / 1024)} KB)`,
        })
      } else {
        // JSON response with a URL
        const data = await response.json()
        
        if (!data.success || !data.remix_url) {
          throw new Error(data.error || "Failed to generate remix")
        }
        
        setRemixUrl(data.remix_url)
        
        toast({
          title: "Remix generated",
          description: data.message,
        })
      }
    } catch (error) {
      console.error("Error generating remix:", error)
      
      toast({
        title: "Error generating remix",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }
  
  // Download remix
  const downloadRemix = () => {
    if (!remixUrl) return
    
    const a = document.createElement("a")
    a.href = remixUrl
    a.download = `remix-${Date.now()}.${format}`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }
  
  // Format time (seconds to MM:SS)
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00"
    
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
  }
  
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Remix API Demo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Generate Remix</CardTitle>
            <CardDescription>
              Create a high-quality EDM remix based on your prompt
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="prompt">Prompt</Label>
              <Input
                id="prompt"
                placeholder="e.g., uplifting EDM drop with energetic bass"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
            </div>
            
            <div>
              <Label htmlFor="genre">Genre</Label>
              <Select value={genre} onValueChange={setGenre}>
                <SelectTrigger id="genre">
                  <SelectValue placeholder="Select genre" />
                </SelectTrigger>
                <SelectContent>
                  {genres.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="bpm">BPM: {bpm}</Label>
              <Slider
                id="bpm"
                min={80}
                max={180}
                step={1}
                value={[bpm]}
                onValueChange={(value) => setBpm(value[0])}
              />
            </div>
            
            <div>
              <Label htmlFor="format">Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger id="format">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  {formats.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          </CardContent>
          
          <CardFooter>
            <Button 
              onClick={generateRemix} 
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Music className="mr-2 h-4 w-4" />
                  Generate Remix
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Generated Remix</CardTitle>
            <CardDescription>
              Listen to and download your generated remix
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {remixUrl ? (
              <div className="space-y-4">
                <audio ref={audioRef} src={remixUrl} preload="metadata" />
                
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="icon" onClick={togglePlayback}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  
                  <div className="flex-1 mx-4">
                    <div className="text-xs text-muted-foreground flex justify-between">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={0.1}
                      onValueChange={(value) => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = value[0]
                          setCurrentTime(value[0])
                        }
                      }}
                    />
                  </div>
                  
                  <Button variant="outline" size="icon" onClick={downloadRemix}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Music className="h-12 w-12 mb-2" />
                <p>No remix generated yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">API Documentation</h2>
        
        <Card>
          <CardContent className="pt-6">
            <pre className="bg-muted p-4 rounded-md overflow-x-auto">
              {`curl -X POST https://yoursite.com/api/remix \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "prompt": "beat EDM",
    "format": "mp3",
    "genre": "edm",
    "bpm": 128
  }'`}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
