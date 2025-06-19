import axios from "axios";
import { keys } from "../keys";
import FormData from "form-data";

/**
 * Transcription options for Groq Speech-to-Text API
 */
export type TranscriptionOptions = {
  model?: string;
  prompt?: string;
  responseFormat?: "json" | "verbose_json" | "text";
  timestampGranularities?: ("word" | "segment")[];
  language?: string;
  temperature?: number;
  timeoutMs?: number; // API request timeout in milliseconds
};

/**
 * Translation options for Groq Speech-to-Text API
 */
export type TranslationOptions = {
  model?: string;
  prompt?: string;
  responseFormat?: "json" | "text";
  language?: string;
  temperature?: number;
  timeoutMs?: number; // API request timeout in milliseconds
};

/**
 * Segment in transcription result
 */
export type TranscriptionSegment = {
  id: number;
  seek: number;
  start: number;
  end: number;
  text: string;
  tokens: number[];
  temperature: number;
  avg_logprob: number;
  compression_ratio: number;
  no_speech_prob: number;
};

/**
 * Transcription result format
 */
export type TranscriptionResult = {
  text: string;
  segments?: TranscriptionSegment[];
  language?: string;
};

/**
 * Error from Groq API
 */
export type GroqApiError = {
  message: string;
  type: string;
  param?: string;
  code?: string;
};

/**
 * Error response from Groq API
 */
export type GroqErrorResponse = {
  error: GroqApiError;
};

/**
 * Checks if the response is a Groq API error
 * @param response The response to check
 * @returns True if the response is a Groq API error
 */
function isGroqError(response: any): response is GroqErrorResponse {
  return (
    response &&
    typeof response === 'object' &&
    'error' in response &&
    typeof response.error === 'object' &&
    'message' in response.error &&
    'type' in response.error
  );
}

/**
 * Formats a Groq API error message
 * @param error The Groq API error
 * @returns A formatted error message
 */
function formatGroqError(error: GroqApiError): string {
  return `Groq API Error (${error.type}): ${error.message}`;
}

/**
 * Transcribe audio data using Groq's Speech-to-Text API
 * @param audioData Audio data as Blob or Base64 string
 * @param options Transcription options
 * @returns Transcription result
 */
export async function transcribeAudio(
  audioData: Blob,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  try {
    console.info("Calling Groq Speech-to-Text API");

    const formData = new FormData();
    
    // Validate and optimize audio for best results
    const audioMimeType = audioData.type || 'audio/webm';
    formData.append("file", audioData, `audio.${audioMimeType.split('/')[1] || 'webm'}`);
    formData.append("model", options.model || "whisper-large-v3-turbo");
    
    if (options.prompt) {
      formData.append("prompt", options.prompt);
    }
    
    if (options.responseFormat) {
      formData.append("response_format", options.responseFormat);
    }
    
    if (options.timestampGranularities && options.timestampGranularities.length > 0) {
      options.timestampGranularities.forEach(granularity => {
        formData.append("timestamp_granularities[]", granularity);
      });
    }
    
    if (options.language) {
      formData.append("language", options.language);
    }
    
    if (options.temperature !== undefined) {
      formData.append("temperature", options.temperature.toString());
    }
    
    const response = await axios.post(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      formData,
      {
        headers: {
          'Authorization': `Bearer ${keys.groq}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: options.timeoutMs || 30000 // Default 30 second timeout
      }
    );
    
    // Check for Groq API errors
    if (isGroqError(response.data)) {
      throw new Error(formatGroqError(response.data.error));
    }
    
    return response.data;  } catch (error) {
    console.error("Error transcribing audio:", error);
    
    // Check for axios errors
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with an error status
        if (isGroqError(error.response.data)) {
          throw new Error(formatGroqError(error.response.data.error));
        }
        throw new Error(`API response error: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response received from API, please check network connection');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('API request timeout, please try again later');
      }
    }
    
    // Re-throw the original error if it's not an Axios error
    throw error;
  }
}

/**
 * Translate audio data to English using Groq's Speech-to-Text API
 * @param audioData Audio data as Blob
 * @param options Translation options
 * @returns Translation result
 */
export async function translateAudio(
  audioData: Blob,
  options: TranslationOptions = {}
): Promise<TranscriptionResult> {
  try {
    console.info("Calling Groq Speech-to-Text Translation API");

    const formData = new FormData();
    
    // Validate and optimize audio for best results
    const audioMimeType = audioData.type || 'audio/webm';
    formData.append("file", audioData, `audio.${audioMimeType.split('/')[1] || 'webm'}`);
    formData.append("model", options.model || "whisper-large-v3");
    
    if (options.prompt) {
      formData.append("prompt", options.prompt);
    }
    
    if (options.responseFormat) {
      formData.append("response_format", options.responseFormat);
    }
    
    if (options.language) {
      formData.append("language", options.language);
    }
    
    if (options.temperature !== undefined) {
      formData.append("temperature", options.temperature.toString());
    }
    
    const response = await axios.post(
      "https://api.groq.com/openai/v1/audio/translations",
      formData,
      {
        headers: {
          'Authorization': `Bearer ${keys.groq}`,
          'Content-Type': 'multipart/form-data'
        },
        timeout: options.timeoutMs || 30000 // Default 30 second timeout
      }
    );
    
    // Check for Groq API errors
    if (isGroqError(response.data)) {
      throw new Error(formatGroqError(response.data.error));
    }
    
    return response.data;
  } catch (error) {
    console.error("Error translating audio:", error);
    
    // Check for axios errors
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // The request was made and the server responded with an error status
        if (isGroqError(error.response.data)) {
          throw new Error(formatGroqError(error.response.data.error));
        }
        throw new Error(`API response error: ${error.response.status} ${error.response.statusText}`);
      } else if (error.request) {
        // The request was made but no response was received
        throw new Error('No response received from API, please check network connection');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('API request timeout, please try again later');
      }
    }
    
    // Re-throw the original error if it's not an Axios error
    throw error;
  }
}
