import * as React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useAudioRecorder, AudioRecorderOptions } from '../../hooks/useAudioRecorder';
import { transcribeAudio, translateAudio } from '../../modules/groq-speech-to-text';
import { isWeb, getUnsupportedMessage } from '../../utils/platform';

interface SpeechToTextProps {
  onTranscriptionComplete?: (text: string) => void;
  language?: string;
  isTranslate?: boolean;
  recordingOptions?: AudioRecorderOptions;
}

export const SpeechToText: React.FC<SpeechToTextProps> = ({
  onTranscriptionComplete,
  language = 'en',
  isTranslate = false,  
  recordingOptions = {
    maxRecordingTime: 60, // Default maximum recording time of 60 seconds
    mimeType: 'audio/webm',
    audioBitsPerSecond: 128000
  }
}) => {
  const recorder = useAudioRecorder(recordingOptions);
  const [transcription, setTranscription] = React.useState<string>('');
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [autoTranscribeAfterStop, setAutoTranscribeAfterStop] = React.useState(false);
  
  // Format recording time as MM:SS
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Define handleStopAndTranscribe first
  const handleStopAndTranscribe = React.useCallback(() => {
    setAutoTranscribeAfterStop(true);
    recorder.stopRecording();
  }, [recorder]);
  
  // Then define handleTranscribe
  const handleTranscribe = React.useCallback(async () => {    
    if (!recorder.audioBlob) {
      setError('No audio recording available');
      return;
    }
    
    try {
      setIsTranscribing(true);
      setError(null);
      
      let result;
      if (isTranslate) {
        result = await translateAudio(recorder.audioBlob, {
          responseFormat: 'json',
          language: 'en' // Translation endpoint only supports English as output
        });
      } else {
        result = await transcribeAudio(recorder.audioBlob, {
          responseFormat: 'json',
          language
        });
      }
      
      if (result && result.text) {
        setTranscription(result.text);
        if (onTranscriptionComplete) {
          onTranscriptionComplete(result.text);
        }
      } else {
        setError('Transcription result is empty');
      }
    } catch (err) {
      console.error('Transcription error:', err);
      setError('Transcription failed, please try again');
    } finally {
      setIsTranscribing(false);
    }
  }, [recorder.audioBlob, language, isTranslate, onTranscriptionComplete]);
  
  // AFTER all functions are defined, use them in effects
  // ALT key controls recording
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger on ALT key press
      if (event.key === 'Alt') {
        event.preventDefault(); // Prevent browser menu trigger
        
        if (recorder.isRecording) {
          // If recording, stop and transcribe
          console.log('ALT pressed: stopping and transcribing');
          handleStopAndTranscribe();
        } else if (!isTranscribing && !recorder.audioBlob) {
          // If not recording, start recording
          console.log('ALT pressed: starting recording');
          recorder.startRecording();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [recorder, isTranscribing, handleStopAndTranscribe]);
  
  // Auto-transcribe when stopping recording if flag is set
  React.useEffect(() => {
    if (autoTranscribeAfterStop && !recorder.isRecording && recorder.audioBlob && !isTranscribing) {
      handleTranscribe();
      setAutoTranscribeAfterStop(false);
    }
  }, [recorder.isRecording, recorder.audioBlob, autoTranscribeAfterStop, handleTranscribe]);
  
  // If recording is not supported on this platform, show a message
  if (!recorder.isSupported) {
    return (
      <View style={styles.container}>
        <View style={styles.unsupportedContainer}>
          <Text style={styles.errorText}>{getUnsupportedMessage()}</Text>
        </View>
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      {recorder.error && (
        <Text style={styles.errorText}>{recorder.error}</Text>
      )}
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {recorder.isRecording ? 
            "Recording... (Press ALT to stop and transcribe)" : 
            recorder.audioBlob ? 
              "Recording complete" : 
              "Press ALT to start recording"}
        </Text>
        {recorder.isRecording && recorder.maxRecordingTime > 0 && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${recorder.getRecordingProgress()}%` }]} />
            <Text style={styles.timeText}>
              {formatTime(recorder.recordingTime)} / {formatTime(recorder.maxRecordingTime)}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.controlsContainer}>
        {!recorder.isRecording ? (
          <TouchableOpacity 
            style={[styles.button, styles.startButton]} 
            onPress={recorder.startRecording}
            disabled={isTranscribing}
          >
            <Text style={styles.buttonText}>Start Recording (or press ALT)</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.recordingControls}>
            <Text style={styles.recordingTime}>
              {formatTime(recorder.recordingTime)}
            </Text>
            
            {recorder.isPaused ? (
              <TouchableOpacity 
                style={[styles.button, styles.resumeButton]} 
                onPress={recorder.resumeRecording}
              >
                <Text style={styles.buttonText}>Resume</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={[styles.button, styles.pauseButton]} 
                onPress={recorder.pauseRecording}
              >
                <Text style={styles.buttonText}>Pause</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.button, styles.stopButton]} 
              onPress={recorder.stopRecording}
            >
              <Text style={styles.buttonText}>Stop</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.transcribeNowButton]} 
              onPress={handleStopAndTranscribe}
            >
              <Text style={styles.buttonText}>Stop and Transcribe (or press ALT)</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      
      {recorder.audioUrl && (
        <View style={styles.audioPreviewContainer}>
          {/* Use conditional rendering, only render audio element in Web environment */}
          {isWeb() && (
            <View style={styles.audioPlayerContainer}>
              <Text style={styles.audioPlayerText}>Audio Preview:</Text>
              {/* Use Web platform specific code, safely render in React Native */}
              {React.createElement('audio', {
                src: recorder.audioUrl,
                controls: true,
                style: { width: '100%', marginBottom: 8 }
              })}
            </View>
          )}
          
          <View style={styles.transcribeControls}>
            <TouchableOpacity 
              style={[styles.button, styles.transcribeButton]} 
              onPress={handleTranscribe}
              disabled={isTranscribing}
            >
              <Text style={styles.buttonText}>
                {isTranscribing ? 'Transcribing...' : isTranslate ? 'Translate to Text' : 'Transcribe to Text'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.resetButton]} 
              onPress={recorder.resetRecording}
              disabled={isTranscribing}
            >
              <Text style={styles.buttonText}>Record Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      
      {isTranscribing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>Processing audio...</Text>
        </View>
      )}
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      {transcription && !isTranscribing && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>Transcription Result:</Text>
          <Text style={styles.transcriptionText}>{transcription}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: 'rgb(28 28 28)',
    borderRadius: 8,
    width: '100%',
  },
  unsupportedContainer: {
    padding: 16,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 8,
    alignItems: 'center',
  },
  statusContainer: {
    marginBottom: 16,
    alignItems: 'center',
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  progressContainer: {
    width: '100%',
    height: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#4CAF50',
  },
  timeText: {
    position: 'absolute',
    width: '100%',
    textAlign: 'center',
    color: 'white',
    fontSize: 12,
    lineHeight: 20,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  recordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
    marginHorizontal: 4,
    marginBottom: 8,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  pauseButton: {
    backgroundColor: '#FFC107',
  },
  resumeButton: {
    backgroundColor: '#2196F3',
  },
  transcribeButton: {
    backgroundColor: '#9C27B0',
  },
  transcribeNowButton: {
    backgroundColor: '#E91E63',
  },
  resetButton: {
    backgroundColor: '#607D8B',
  },
  recordingTime: {
    color: 'white',
    fontSize: 18,
    marginRight: 8,
  },
  audioPreviewContainer: {
    marginVertical: 16,
  },
  audioPlayerContainer: {
    marginBottom: 8,
  },
  audioPlayerText: {
    color: 'white',
    marginBottom: 4,
  },
  audioPlayer: {
    width: '100%',
    marginBottom: 8,
  },
  transcribeControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
    flexWrap: 'wrap',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 16,
  },
  loadingText: {
    color: 'white',
    marginLeft: 8,
  },
  errorText: {
    color: '#F44336',
    marginVertical: 8,
    textAlign: 'center',
  },
  resultContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
  },
  resultTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  transcriptionText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
});
