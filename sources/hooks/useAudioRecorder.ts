import * as React from 'react';
import { isAudioRecordingSupported } from '../utils/platform';

/**
 * Audio recorder configuration options
 */
export interface AudioRecorderOptions {
  /** Maximum recording time in seconds (0 = unlimited) */
  maxRecordingTime?: number;
  /** MIME type for audio recording */
  mimeType?: string;
  /** Recording quality (bitrate in bits per second) */
  audioBitsPerSecond?: number;
  /** Time slice in milliseconds (how often the dataavailable event is fired) */
  timeSlice?: number;
}

/**
 * Audio recorder state interface
 */
export interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob?: Blob;
  audioUrl?: string;
  isSupported: boolean;
  error?: string;
}

/**
 * Hook for audio recording functionality
 * @param options Configuration options for the audio recorder
 * @returns Audio recorder state and control functions
 */
export function useAudioRecorder(options: AudioRecorderOptions = {}) {
  const {
    maxRecordingTime = 60, // Default to 60 seconds max recording time
    mimeType = 'audio/webm',
    audioBitsPerSecond = 128000, // 128 kbps default
    timeSlice = 1000 // Get data every second by default
  } = options;

  const [state, setState] = React.useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
    isSupported: isAudioRecordingSupported()
  });
  
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const timerRef = React.useRef<number | null>(null);
  const maxTimeReachedRef = React.useRef<boolean>(false);
  
  // Cleanup function to release resources
  const cleanup = React.useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }
    
    chunksRef.current = [];
    maxTimeReachedRef.current = false;
  }, []);
  
  // Function to check supported MIME types
  const getSupportedMimeType = React.useCallback(() => {
    if (!window.MediaRecorder) return null;
    
    // Prioritized list of MIME types to try
    const types = [
      mimeType,
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg'
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    
    return null;
  }, [mimeType]);
  
  // Start recording function
  const startRecording = React.useCallback(async () => {
    if (!state.isSupported) {
      setState(prevState => ({
        ...prevState,
        error: 'Your browser does not support audio recording'
      }));
      return;
    }
    
    try {
      cleanup();
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      
      const supportedType = getSupportedMimeType();
      if (!supportedType) {
        throw new Error('No supported audio MIME type found');
      }
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: supportedType,
        audioBitsPerSecond
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });
      
      mediaRecorder.addEventListener("stop", () => {
        const audioBlob = new Blob(chunksRef.current, { type: supportedType });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setState(prevState => ({
          ...prevState,
          isRecording: false,
          isPaused: false,
          audioBlob,
          audioUrl,
          error: maxTimeReachedRef.current ? 'Maximum recording time reached' : undefined
        }));
        
        maxTimeReachedRef.current = false;
      });
      
      // Start recording with time slices to get data during recording
      mediaRecorder.start(timeSlice);
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setState(prevState => {
          const newTime = prevState.recordingTime + 1;
          
          // Check if max recording time reached
          if (maxRecordingTime > 0 && newTime >= maxRecordingTime && mediaRecorderRef.current?.state === 'recording') {
            maxTimeReachedRef.current = true;
            mediaRecorderRef.current.stop();
            if (timerRef.current) {
              window.clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
          
          return {
            ...prevState,
            recordingTime: newTime
          };
        });
      }, 1000);
      
      setState({
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
        audioBlob: undefined,
        audioUrl: undefined,
        isSupported: true
      });
    } catch (error) {
      console.error("Failed to start recording:", error);
      setState(prevState => ({
        ...prevState,
        error: typeof error === 'object' && error !== null && 'message' in error 
          ? (error as Error).message 
          : 'Failed to start recording'
      }));
    }
  }, [cleanup, getSupportedMimeType, audioBitsPerSecond, timeSlice, maxRecordingTime, state.isSupported]);
  
  // Pause recording function
  const pauseRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      setState(prevState => ({
        ...prevState,
        isPaused: true
      }));
    }
  }, []);
  
  // Resume recording function
  const resumeRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      
      timerRef.current = window.setInterval(() => {
        setState(prevState => {
          const newTime = prevState.recordingTime + 1;
          
          // Check if max recording time reached
          if (maxRecordingTime > 0 && newTime >= maxRecordingTime && mediaRecorderRef.current?.state === 'recording') {
            maxTimeReachedRef.current = true;
            mediaRecorderRef.current.stop();
            if (timerRef.current) {
              window.clearInterval(timerRef.current);
              timerRef.current = null;
            }
          }
          
          return {
            ...prevState,
            recordingTime: newTime
          };
        });
      }, 1000);
      
      setState(prevState => ({
        ...prevState,
        isPaused: false
      }));
    }
  }, [maxRecordingTime]);
  
  // Stop recording function
  const stopRecording = React.useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, []);
  
  // Reset recording function
  const resetRecording = React.useCallback(() => {
    cleanup();
    setState(prevState => ({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
      audioBlob: undefined,
      audioUrl: undefined,
      isSupported: prevState.isSupported,
      error: undefined
    }));
  }, [cleanup]);
  
  // Get recording status text
  const getStatusText = React.useCallback(() => {
    if (!state.isSupported) {
      return 'Your device does not support recording';
    }
    
    if (state.error) {
      return `Error: ${state.error}`;
    }
    
    if (state.isRecording) {
      return state.isPaused ? 'Paused' : 'Recording...';
    }
    
    return state.audioBlob ? 'Recording completed' : 'Ready to record';
  }, [state.isSupported, state.error, state.isRecording, state.isPaused, state.audioBlob]);
  
  // Calculate recording progress percentage (0-100)
  const getRecordingProgress = React.useCallback(() => {
    if (maxRecordingTime <= 0 || state.recordingTime <= 0) return 0;
    return Math.min(100, (state.recordingTime / maxRecordingTime) * 100);
  }, [state.recordingTime, maxRecordingTime]);
  
  // Cleanup on unmount
  React.useEffect(() => {
    return cleanup;
  }, [cleanup]);
  
  return {
    ...state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
    getStatusText,
    getRecordingProgress,
    maxRecordingTime
  };
}
