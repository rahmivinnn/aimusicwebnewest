"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Loader2, Download, Play, Pause } from "lucide-react"

export function TextToAudioGenerator() {
  const [text, setText] = useState("")
  const [voice, setVoice] = useState("neutral")
  const [emotion, setEmotion] = useState("neutral")
  const [effect, setEffect] = useState("clean")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState([80])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Simulasi proses generasi audio
  const generateAudio = () => {
    if (!text.trim()) return

    setIsGenerating(true)
    setGeneratedAudio(null)

    // Simulasi delay untuk proses generasi
    setTimeout(() => {
      // Pilih sample audio berdasarkan voice dan emotion
      const audioSample = `/samples/${voice}-${emotion}-sample.mp3`
      setGeneratedAudio(audioSample)
      setIsGenerating(false)
    }, 2000)
  }

  const togglePlayback = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch((error) => {
        console.error("Audio playback failed:", error)
      })
    }

    setIsPlaying(!isPlaying)
  }

  const handleVolumeChange = (value: number[]) => {
    setVolume(value)
    if (audioRef.current) {
      audioRef.current.volume = value[0] / 100
    }
  }

  const handleAudioEnded = () => {
    setIsPlaying(false)
  }

  const downloadAudio = () => {
    if (!generatedAudio) return

    // Buat elemen anchor untuk download
    const downloadLink = document.createElement("a")
    downloadLink.href = generatedAudio
    downloadLink.download = `generated-audio-${voice}-${emotion}.mp3`
    document.body.appendChild(downloadLink)
    downloadLink.click()
    document.body.removeChild(downloadLink)
  }

  // Efek EDM yang tersedia
  const edmEffects = [
    { id: "clean", name: "Clean" },
    { id: "bass-boost", name: "Bass Boost" },
    { id: "reverb", name: "Reverb" },
    { id: "delay", name: "Delay" },
    { id: "filter-sweep", name: "Filter Sweep" },
  ]

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="border-2 border-gray-200 dark:border-gray-800">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Text to Audio Generator</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid grid-cols-2 mb-4">
              <TabsTrigger value="text">Text Input</TabsTrigger>
              <TabsTrigger value="settings">Voice Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="text">
              <div className="space-y-4">
                <Textarea
                  placeholder="Enter the text you want to convert to speech..."
                  className="min-h-[200px] resize-none"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="voice-type">Voice Type</Label>
                    <Select value={voice} onValueChange={setVoice}>
                      <SelectTrigger id="voice-type">
                        <SelectValue placeholder="Select voice" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="warm">Warm</SelectItem>
                        <SelectItem value="deep">Deep</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emotion">Emotion</Label>
                    <Select value={emotion} onValueChange={setEmotion}>
                      <SelectTrigger id="emotion">
                        <SelectValue placeholder="Select emotion" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="neutral">Neutral</SelectItem>
                        <SelectItem value="cheerful">Cheerful</SelectItem>
                        <SelectItem value="sad">Sad</SelectItem>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="excited">Excited</SelectItem>
                        <SelectItem value="calm">Calm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>EDM Effect</Label>
                  <Select value={effect} onValueChange={setEffect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select effect" />
                    </SelectTrigger>
                    <SelectContent>
                      {edmEffects.map((effect) => (
                        <SelectItem key={effect.id} value={effect.id}>
                          {effect.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Volume</Label>
                    <span className="text-sm text-gray-500">{volume[0]}%</span>
                  </div>
                  <Slider value={volume} min={0} max={100} step={1} onValueChange={handleVolumeChange} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <div className="w-full flex justify-between items-center">
            <Button
              onClick={generateAudio}
              disabled={isGenerating || !text.trim()}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate Audio"
              )}
            </Button>

            {generatedAudio && (
              <div className="flex space-x-2">
                <Button variant="outline" size="icon" onClick={togglePlayback}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>

                <Button variant="outline" size="icon" onClick={downloadAudio}>
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {generatedAudio && (
            <div className="w-full pt-4 border-t">
              <p className="text-sm text-gray-500 mb-2">Generated Audio:</p>
              <audio ref={audioRef} src={generatedAudio} onEnded={handleAudioEnded} className="w-full" controls />
            </div>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
