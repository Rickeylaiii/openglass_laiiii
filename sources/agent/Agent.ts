import * as React from 'react';
import { AsyncLock } from "../utils/lock";
import { imageDescription, llamaFind } from "./imageDescription";
// import { startAudio } from '../modules/openai';
import { startAudio } from '../modules/volcengine';

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
                    // ȷ��������ȷ���������Ƭ������
                    let combined = '';
                    let i = 0;
                    
                    // ��ӡ��Ƭ������������
                    console.log(`Processing ${this.#photos.length} photos for question`);
                    
                    for (const p of this.#photos) {
                        // ʹ�� += ������ +
                        combined += '\n\nImage #' + i + '\n\n';
                        combined += p.description;
                        console.log(`Added description for image #${i}: ${p.description.substring(0, 50)}...`);
                        i++;
                    }
                    
                    console.log(`Prepared ${i} image descriptions, calling llamaFind`);
                    
                    const answer = await llamaFind(question, combined);
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