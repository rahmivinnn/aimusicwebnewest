"use client"

import React, { useState, useRef, useCallback } from "react"
import { Button } from "./button"
import { Progress } from "./progress"
import { Upload, X, FileAudio, AlertCircle } from "lucide-react"

interface FileUploadProps {
  onFileSelected: (file: File) => void
  onFileLoaded?: (audioBuffer: AudioBuffer) => void
  accept?: string
  maxSize?: number // in MB
  className?: string
  buttonText?: string
}

export function FileUpload({
  onFileSelected,
  onFileLoaded,
  accept = "audio/*",
  maxSize = 10, // Default 10MB
  className = "",
  buttonText = "Upload Audio File",
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProgress, setLoadingProgress] = useState(0)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  
  // Initialize audio context if needed
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    }
    return audioContextRef.current
  }, [])
  
  // Handle file selection
  const handleFileSelected = useCallback(
    async (selectedFile: File) => {
      setError(null)
      
      // Check file type
      if (!selectedFile.type.startsWith("audio/")) {
        setError("Please select an audio file")
        return
      }
      
      // Check file size
      if (selectedFile.size > maxSize * 1024 * 1024) {
        setError(`File size exceeds ${maxSize}MB limit`)
        return
      }
      
      setFile(selectedFile)
      setIsLoading(true)
      setLoadingProgress(0)
      
      // Call the callback with the file
      onFileSelected(selectedFile)
      
      // If we need to decode the audio
      if (onFileLoaded) {
        try {
          const audioContext = getAudioContext()
          
          // Read the file
          const reader = new FileReader()
          
          reader.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 50) // First 50% is file reading
              setLoadingProgress(progress)
            }
          }
          
          reader.onload = async (event) => {
            try {
              const arrayBuffer = event.target?.result as ArrayBuffer
              
              // Decode the audio data
              const audioBuffer = await audioContext.decodeAudioData(arrayBuffer, 
                (buffer) => {
                  setLoadingProgress(100)
                  setIsLoading(false)
                  onFileLoaded(buffer)
                },
                (error) => {
                  throw new Error("Failed to decode audio data")
                }
              )
            } catch (error) {
              setError(`Error processing audio: ${error instanceof Error ? error.message : String(error)}`)
              setIsLoading(false)
            }
          }
          
          reader.onerror = () => {
            setError("Error reading file")
            setIsLoading(false)
          }
          
          reader.readAsArrayBuffer(selectedFile)
        } catch (error) {
          setError(`Error processing audio: ${error instanceof Error ? error.message : String(error)}`)
          setIsLoading(false)
        }
      } else {
        setIsLoading(false)
        setLoadingProgress(100)
      }
    },
    [maxSize, onFileSelected, onFileLoaded, getAudioContext]
  )
  
  // Handle file input change
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files && files.length > 0) {
      handleFileSelected(files[0])
    }
  }
  
  // Handle drag events
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }
  
  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
  }
  
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    
    const files = event.dataTransfer.files
    if (files && files.length > 0) {
      handleFileSelected(files[0])
    }
  }
  
  // Handle button click
  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }
  
  // Handle file removal
  const handleRemoveFile = () => {
    setFile(null)
    setError(null)
    setLoadingProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }
  
  return (
    <div className={`w-full ${className}`}>
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
        } ${error ? "border-red-300 bg-red-50" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleInputChange}
          accept={accept}
          className="hidden"
        />
        
        {!file ? (
          <div className="space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              <Upload className="h-6 w-6 text-gray-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Drag and drop your audio file here, or{" "}
                <button
                  type="button"
                  className="text-blue-500 hover:text-blue-700 font-medium"
                  onClick={handleButtonClick}
                >
                  browse
                </button>
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supports MP3, WAV, OGG, FLAC (max {maxSize}MB)
              </p>
            </div>
            <Button onClick={handleButtonClick} variant="outline" className="mt-2">
              {buttonText}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileAudio className="h-8 w-8 text-blue-500" />
                <div className="text-left">
                  <p className="text-sm font-medium truncate max-w-[200px]">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {isLoading && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Loading audio...</span>
                  <span>{loadingProgress}%</span>
                </div>
                <Progress value={loadingProgress} className="h-1" />
              </div>
            )}
          </div>
        )}
        
        {error && (
          <div className="mt-4 flex items-center text-red-500 text-sm">
            <AlertCircle className="h-4 w-4 mr-1" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  )
}
