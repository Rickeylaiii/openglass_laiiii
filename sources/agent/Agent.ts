import * as React from 'react';
import { AsyncLock } from "../utils/lock";
import { imageDescription, llamaFind } from "./imageDescription";
// import { startAudio } from '../modules/openai';
import { startAudio } from '../modules/volcengine';
import { getWeather, geocodeAddress } from '../modules/mcp-api';
import { groqRequest } from '../modules/groq-llama3';


type AgentState = {
    lastDescription?: string;
    answer?: string;
    loading: boolean;
}

export class Agent {
    #lock = new AsyncLock();
    #photos: { photo: Uint8Array, description: string }[] = [];
    #state: AgentState = { loading: false };
    #stateCopy: AgentState = { loading: false };
    #stateListeners: (() => void)[] = [];
    #systemPrompt: string; // 添加系统提示作为类属性

    constructor() {
        // 定义并存储系统提示
        this.#systemPrompt = `You are an intelligent assistant that can describe images and answer questions.
                
        You can also provide weather information services. When users ask about the weather in a particular city, you will retrieve and display real-time weather data for that city.

        Example weather queries:
        - "How's the weather in Beijing today?"
        - "What's the temperature in Shanghai?"
        - "Will it rain in Guangzhou today?"

        For other questions, please continue to provide helpful answers, including descriptions of images uploaded by the user.`;
        
        console.log("Agent initialized with weather capability");
    }

    clearPhotos() {
        this.#photos = [];
        this.#state.lastDescription = undefined;
        this.#state.answer = undefined;
        this.#notify();
        console.log("Agent photos cleared");
    }

    async addPhoto(photos: Uint8Array[]) {
        await this.#lock.inLock(async () => {

            // Append photos
            let lastDescription: string | null = null;
            for (const p of photos) {
                console.log('Processing photo', p.length);
                const description = await imageDescription(p);
                console.log('Description', description);
                this.#photos.push({ photo: p, description });
                lastDescription = description;
            }

            // TODO: Update summaries

            // Update UI
            if (lastDescription) {
                this.#state.lastDescription = lastDescription;
                this.#notify();
            }
        });
    }

    async answer(question: string) {
        console.log("Starting answer process for question:", question);
        
        try {
            startAudio()
        } catch(error) {
            console.log("Failed to start audio")
        }
        
        if (this.#state.loading) {
            console.log("Already processing a request, ignoring new question");
            return;
        }
        
        this.#state.loading = true;
        this.#notify();
        console.log("Set loading state to true");
        
        try {
            console.log("Attempting to acquire lock");
            await this.#lock.inLock(async () => {
                console.log("Lock acquired, processing question");
                try {
                    // 检查是否是天气查询
                    if (question.includes('weather') || 
                        question.includes('temperature') || 
                        question.includes('rain') || 
                        question.includes('cloudy') || 
                        question.includes('sunny') ||
                        question.includes('天气') ||  
                        question.includes('气温')) {
                        console.log('Weather query detected, redirecting to weather handler');
                        const weatherAnswer = await this.handleWeatherQuery(question);
                        this.#state.answer = weatherAnswer;
                        return;
                    }

                    // 组合所有图像描述
                    let combined = '';
                    let i = 0;

                    // 处理图像描述
                    console.log(`Processing ${this.#photos.length} photos for question`);
                    
                    for (const p of this.#photos) {
                        // 组合 += 图像描述 +
                        combined += '\n\nImage #' + i + '\n\n';
                        combined += p.description;
                        console.log(`Added description for image #${i}: ${p.description.substring(0, 50)}...`);
                        i++;
                    }
                    
                    console.log(`Prepared ${i} image descriptions, calling llamaFind`);
                    
                    // 使用我们的自定义实现来包装llamaFind，加入系统提示
                    const answer = await this.customLlamaFind(question, combined);
                    console.log("Received answer from llamaFind");
                    this.#state.answer = answer;
                } catch (error) {
                    console.error("Error processing request:", error);
                    this.#state.answer = "Sorry, an error occurred while processing your request.";
                }
                console.log("Finished processing within lock");
            });
            console.log("Lock released");
        } catch (error) {
            console.error("Lock error:", error);
        } finally {
            this.#state.loading = false;
            this.#notify();
        }
    }

    // 添加自定义的llamaFind包装方法，使用系统提示
    private async customLlamaFind(question: string, images: string): Promise<string> {
        console.log("Using customLlamaFind with stored system prompt");
        return new Promise((resolve) => {
            const globalTimeout = setTimeout(() => {
                console.log("Global timeout triggered - request taking too long");
                resolve("Request timed out. Please try again.");
            }, 40000);
            
            try {
                const controller = new AbortController();
                const requestTimeout = setTimeout(() => {
                    controller.abort();
                }, 30000);
                
                // 使用存储的系统提示而不是硬编码的提示
                groqRequest(
                    `${this.#systemPrompt}
                    
                    This are the provided images:
                    ${images}
                    
                    DO NOT mention the images, scenes or descriptions in your answer, just answer the question.
                    DO NOT try to generalize or provide possible scenarios.
                    ONLY use the information in the description of the images to answer the question.
                    BE concise and specific.`,
                    question,
                    { signal: controller.signal }
                ).then(response => {
                    clearTimeout(requestTimeout);
                    clearTimeout(globalTimeout);
                    resolve(response);
                }).catch(error => {
                    clearTimeout(requestTimeout);
                    console.error("Error in customLlamaFind request:", error);
                    resolve("Sorry, I couldn't process your request. Please try again.");
                });
            } catch (error) {
                clearTimeout(globalTimeout);
                console.error("Error setting up customLlamaFind request:", error);
                resolve("Failed to set up request. Please try again.");
            }
        });
    }

    private async handleWeatherQuery(question: string): Promise<string> {
        try {
            // Extract city name
            const cityPrompt = `Extract the Chinese city name from the following question, return only the city name without any explanation or additional text:
            "${question}"`;
            
            const cityName = await groqRequest("You are an assistant that precisely extracts city names.", cityPrompt);
            console.log(`Extracted city name from question: "${cityName}"`);
            
            if (!cityName || cityName.trim() === '') {
                return "Sorry, I couldn't determine which city's weather you want to know. Please specify a city name clearly, for example, 'How's the weather in Beijing today?'";
            }
            
            // Get weather data
            const weatherResult = await getWeather(cityName.trim());
            console.log('Raw weather query result:', weatherResult);
            
            if (weatherResult.status !== '1') {
                return `Sorry, I couldn't get weather information for ${cityName}. ${weatherResult.info || 'Please try again later.'}`;
            }
            
            // Process weather data
            const weatherInfo = weatherResult.lives?.[0];
            if (!weatherInfo) {
                return `Sorry, I couldn't find weather information for ${cityName}.`;
            }
            
            // Return formatted weather information
            return `Current weather conditions for ${weatherInfo.province}${weatherInfo.city}:
                Weather: ${weatherInfo.weather}
                Temperature: ${weatherInfo.temperature}°C
                Humidity: ${weatherInfo.humidity}%
                Wind Direction: ${weatherInfo.winddirection}
                Wind Force: ${weatherInfo.windpower}
                Updated at: ${weatherInfo.reporttime}`;
        } catch (error) {
            console.error('Error processing weather query:', error);
            return "Sorry, I encountered a problem when querying weather information. Please try again later.";
        }
    }

    #notify = () => {
        this.#stateCopy = { ...this.#state };
        for (const l of this.#stateListeners) {
            l();
        }
    }


    use() {
        const [state, setState] = React.useState(this.#stateCopy);
        React.useEffect(() => {
            const listener = () => setState(this.#stateCopy);
            this.#stateListeners.push(listener);
            return () => {
                this.#stateListeners = this.#stateListeners.filter(l => l !== listener);
            }
        }, []);
        return state;
    }
}