// import axios from "axios";
// import fs from "fs";
// import { keys } from "../keys";
// import { OpenAPI } from '@volcengine/openapi';

// // Initialize Volcengine client
// const volcClient = new OpenAPI({
//     accessKeyId: keys.volcengine?.accessKeyId || '',
//     secretKey: keys.volcengine?.secretKey || '',
//     region: 'cn-north-1' // Default region
// });

let audioContext: AudioContext;

export async function startAudio() {
    audioContext = new AudioContext();
    // If AudioContext is in suspended state, user interaction is needed to resume
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (err) {
            console.error("Failed to resume AudioContext:", err);
        }
    }
}

// Use browser built-in TTS as replacement for Volcano Engine
export async function textToSpeech(text: string) {
    try {
        console.log("Using browser TTS:", text);
        
        // Use browser built-in speech synthesis
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US'; // English
            utterance.rate = 1.0;  
            utterance.pitch = 1.0;
            window.speechSynthesis.speak(utterance);
            return { success: true };
        } else {
            throw new Error("Browser does not support speech synthesis");
        }
    } catch (error) {
        console.error("Error in textToSpeech:", error);
        return null;
    }
}

// Test function
export async function testVolcengineServices() {
    console.log("Testing Browser TTS...");
    await startAudio();
    textToSpeech("This is a test voice message using browser speech synthesis");
}

// Browser compatible TTS version (backup)
export function browserTextToSpeech(text: string, voiceIndex?: number) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        
        if (voiceIndex !== undefined && voices.length > 0) {
            // Use specified voice index
            utterance.voice = voices[voiceIndex % voices.length];
        }
        
        utterance.lang = utterance.voice?.lang || 'en-US';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    } else {
        console.error("Current browser does not support speech synthesis");
    }
}

// Simplified gptRequest, directly returns input
export async function gptRequest(systemPrompt: string, userPrompt: string) {
    console.log("Browser compatible gptRequest (placeholder)");
    return "This is a placeholder response. The real API requires Node.js environment.";
}