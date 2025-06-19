import * as React from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, View } from 'react-native';
import { rotateImage } from '../modules/imaging';
import { toBase64Image } from '../utils/base64';
import { Agent } from '../agent/Agent';
import { InvalidateSync } from '../utils/invalidateSync';
// import { textToSpeech } from '../modules/openai';
// import { textToSpeech } from '../modules/volcengine';
// import { testVolcengineServices } from '../modules/volcengine';
import { browserTextToSpeech } from '../modules/volcengine';
import { ScrollView as RNScrollView } from 'react-native'; // Ensure imports don't conflict
import { SpeechToText } from './components/SpeechToText';


function usePhotos(device: BluetoothRemoteGATTServer) {
    // Subscribe to device
    const [photos, setPhotos] = React.useState<Uint8Array[]>([]);
    const [subscribed, setSubscribed] = React.useState<boolean>(false);
    const photoControlCharRef = React.useRef<BluetoothRemoteGATTCharacteristic | null>(null);
    const [isCapturing, setIsCapturing] = React.useState(false);
    
    const takePhoto = React.useCallback(async () => {
        if (photoControlCharRef.current && !isCapturing) {
            try {
                setIsCapturing(true);
                await photoControlCharRef.current.writeValue(new Uint8Array([0x01]));
                console.log('Capture photo command sent');
                // 延迟恢复按钮状态，因为拍照需要一点时间
                setTimeout(() => setIsCapturing(false), 2000);
            } catch (error) {
                console.error('Error sending capture command:', error);
                setIsCapturing(false);
            }
        } else {
            console.error('Photo control characteristic not available or already capturing');
        }
    }, [isCapturing, photoControlCharRef]);

    const clearPhotos = React.useCallback(() => {
        setPhotos([]);
    }, []);

    React.useEffect(() => {
        (async () => {
            let previousChunk = -1;
            let buffer: Uint8Array = new Uint8Array(0);
            function onChunk(id: number | null, data: Uint8Array) {

                // Resolve if packet is the first one
                if (previousChunk === -1) {
                    if (id === null) {
                        return;
                    } else if (id === 0) {
                        previousChunk = 0;
                        buffer = new Uint8Array(0);
                    } else {
                        return;
                    }
                } else {
                    if (id === null) {
                        console.log('Photo received', buffer);
                        rotateImage(buffer, '270').then((rotated) => {
                            console.log('Rotated photo', rotated);
                            setPhotos((p) => [...p, rotated]);
                        });
                        previousChunk = -1;
                        return;
                    } else {
                        if (id !== previousChunk + 1) {
                            previousChunk = -1;
                            console.error('Invalid chunk', id, previousChunk);
                            return;
                        }
                        previousChunk = id;
                    }
                }

                // Append data
                buffer = new Uint8Array([...buffer, ...data]);
            }

            // Subscribe for photo updates
            const service = await device.getPrimaryService('19B10000-E8F2-537E-4F6C-D104768a1214'.toLowerCase());
            const photoCharacteristic = await service.getCharacteristic('19b10005-e8f2-537e-4f6c-d104768a1214');
            await photoCharacteristic.startNotifications();
            setSubscribed(true);
            photoCharacteristic.addEventListener('characteristicvaluechanged', (e) => {
                const value = (e.target as BluetoothRemoteGATTCharacteristic).value!;
                const array = new Uint8Array(value.buffer);
                if (array[0] == 0xff && array[1] == 0xff) {
                    onChunk(null, new Uint8Array());
                } else {
                    const packetId = array[0] + (array[1] << 8);
                    const packet = array.slice(2);
                    onChunk(packetId, packet);
                }
            });
            
            // 保存照片控制特征值引用，但不启动自动拍照
            const photoControlCharacteristic = await service.getCharacteristic('19b10006-e8f2-537e-4f6c-d104768a1214');
            photoControlCharRef.current = photoControlCharacteristic;
        })();
    }, []);

    return [subscribed, photos, takePhoto, isCapturing, clearPhotos] as const;
}

export const DeviceView = React.memo((props: { device: BluetoothRemoteGATTServer }) => {
    const [subscribed, photos, takePhoto, isCapturing, clearPhotos] = usePhotos(props.device);
    const agent = React.useMemo(() => new Agent(), []);
    const agentState = agent.use();

    // Add this function to handle clearing photos
    const handleClearPhotos = React.useCallback(() => {
        // Clear photos in the UI
        clearPhotos();
        // Clear photos in the Agent
        agent.clearPhotos();
        console.log('All photos cleared (UI and Agent)');
    }, [clearPhotos, agent]);

    // Add this useEffect to ensure the photo array is empty at the start of each session
    React.useEffect(() => {
        // Ensure the Agent's photo array is empty
        agent.clearPhotos();
        console.log('Agent photos initialized');
    }, [agent]);

    // Background processing agent
    const processedPhotos = React.useRef<Uint8Array[]>([]);
    const sync = React.useMemo(() => {
        let processed = 0;
        return new InvalidateSync(async () => {
            if (processedPhotos.current.length > processed) {
                const unprocessed = processedPhotos.current.slice(processed);
                processed = processedPhotos.current.length;
                await agent.addPhoto(unprocessed);
            }
        });
    }, []);
    React.useEffect(() => {
        processedPhotos.current = photos;
        sync.invalidate();
    }, [photos]);

    // 添加音色选择相关的状态
    const [voices, setVoices] = React.useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceIndex, setSelectedVoiceIndex] = React.useState<number>(0);
    const [isVoicePanelOpen, setIsVoicePanelOpen] = React.useState<boolean>(false);
    
    // 添加语音转文本相关状态
    const [showSpeechToText, setShowSpeechToText] = React.useState<boolean>(false);
    const [transcribedText, setTranscribedText] = React.useState<string>('');
    const [speechToTextLanguage] = React.useState<string>('en');
    const [speechToTextOptions] = React.useState({
        maxRecordingTime: 60,
        audioBitsPerSecond: 128000
    });
    
    // 处理语音转文本完成的回调函数
    const handleTranscriptionComplete = React.useCallback((text: string) => {
        setTranscribedText(text);
        
        // 自动将识别的文本提交给agent
        if (text && !agentState.loading) {
            agent.answer(text);
            
            // 自动隐藏语音输入组件
            setShowSpeechToText(false);
        }
    }, [agent, agentState.loading]);

    // 添加加载可用音色的钩子
    React.useEffect(() => {
        function loadVoices() {
            if ('speechSynthesis' in window) {
                const availableVoices = window.speechSynthesis.getVoices();
                if (availableVoices.length > 0) {
                    setVoices(availableVoices);
                    console.log(`Loaded ${availableVoices.length} voices`);
                }
            }
        }
        
        // 首次尝试加载
        loadVoices();
        
        // 某些浏览器需要等待 onvoiceschanged 事件
        if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = loadVoices;
        }
        
        return () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.onvoiceschanged = null;
            }
        };
    }, []);

    // 修改文本到语音效果钩子，使用选定的音色
    React.useEffect(() => {
        if (agentState.answer) {
            browserTextToSpeech(agentState.answer, selectedVoiceIndex);
        }
    }, [agentState.answer, selectedVoiceIndex]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {photos.map((photo, index) => (
                        <Image key={index} style={{ width: 100, height: 100 }} source={{ uri: toBase64Image(photo) }} />
                    ))}
                </View>
            </View>

            <View style={{ backgroundColor: 'rgb(28 28 28)', height: 600, width: 600, borderRadius: 64, flexDirection: 'column', padding: 64 }}>
                {/* Add photo capture button */}
                <View style={{ alignItems: 'center', marginBottom: 16 }}>
                    <Text onPress={takePhoto} style={{ 
                        color: 'white', 
                        fontSize: 20, 
                        backgroundColor: isCapturing ? '#666' : '#2196F3',
                        padding: 10,
                        borderRadius: 8,
                        textAlign: 'center',
                        width: 150,
                        opacity: isCapturing ? 0.7 : 1
                    }}>
                        {isCapturing ? 'Taking Photo...' : 'Take Photo'}
                    </Text>
                    
                    {/* Modify the click event handler for the Clear Photos button */}
                    <Text onPress={handleClearPhotos} style={{ 
                        color: 'white', 
                        fontSize: 20, 
                        backgroundColor: '#FF5722',
                        padding: 10,
                        borderRadius: 8,
                        textAlign: 'center',
                        width: 150,
                        marginTop: 10
                    }}>
                        Clear Photos
                    </Text>
                    
                    {/* 添加语音输入按钮 */}
                    <Text 
                        onPress={() => setShowSpeechToText(!showSpeechToText)}
                        style={{ 
                            color: 'white', 
                            fontSize: 20, 
                            backgroundColor: showSpeechToText ? '#4A148C' : '#673AB7',
                            padding: 10,
                            borderRadius: 8,
                            textAlign: 'center',
                            width: 150,
                            marginTop: 10
                        }}>
                        {showSpeechToText ? 'Hide Voice Input' : 'Voice Input'}
                    </Text>
                </View>
                
                {/* 语音转文本组件 */}
                {showSpeechToText && (
                    <View style={{ marginBottom: 16 }}>
                        <SpeechToText 
                            onTranscriptionComplete={handleTranscriptionComplete}
                            language={speechToTextLanguage}
                            recordingOptions={speechToTextOptions}
                        />
                    </View>
                )}

                <View style={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}>
                    {agentState.loading && (<ActivityIndicator size="large" color={"white"} />)}
                    {agentState.answer && !agentState.loading && (<ScrollView style={{ flexGrow: 1, flexBasis: 0 }}><Text style={{ color: 'white', fontSize: 32 }}>{agentState.answer}</Text></ScrollView>)}
                    <TextInput
                        style={{ color: 'white', height: 64, fontSize: 32, borderRadius: 16, backgroundColor: 'rgb(48 48 48)', padding: 16 }}
                        placeholder='What do you need?'
                        placeholderTextColor={'#888'}
                        readOnly={agentState.loading}
                        value={transcribedText} // 显示转录的文本
                        onChangeText={setTranscribedText} // 允许编辑转录的文本
                        onSubmitEditing={(e) => agent.answer(e.nativeEvent.text)}
                    />
                </View>

                {/* Add test buttons for TTS services */}
                <View style={{margin: 10}}>
                    {/* 
                    <Text 
                        onPress={() => testVolcengineServices()}
                        style={{
                            backgroundColor: '#4CAF50',
                            color: 'white',
                            padding: 10,
                            borderRadius: 5,
                            textAlign: 'center',
                            marginBottom: 5
                        }}>
                        Test Volcengine TTS
                    </Text>
                    */}
                    
                    <Text 
                        onPress={() => browserTextToSpeech("I am rickey lai, this is a test voice message using browser speech synthesis.", selectedVoiceIndex)}
                        style={{
                            backgroundColor: '#2196F3',
                            color: 'white',
                            padding: 10,
                            borderRadius: 5,
                            textAlign: 'center'
                        }}>
                        Test Browser TTS
                    </Text>
                    
                    {/* 添加音色选择按钮 */}
                    <Text 
                        onPress={() => setIsVoicePanelOpen(!isVoicePanelOpen)}
                        style={{
                            backgroundColor: '#9C27B0',
                            color: 'white',
                            padding: 10,
                            borderRadius: 5,
                            textAlign: 'center',
                            marginTop: 10
                        }}>
                        {isVoicePanelOpen ? 'Hide Voice Options' : 'Select Voice'}
                    </Text>
                    
                    {/* 音色选择面板 */}
                    {isVoicePanelOpen && (
                        <View style={{ 
                            position: 'absolute',
                            bottom: 150,
                            right: 10,
                            maxHeight: 300,
                            width: 300,
                            backgroundColor: 'rgb(48 48 48)',
                            borderRadius: 8,
                            padding: 10,
                            zIndex: 100,
                        }}>
                            <RNScrollView style={{ maxHeight: 280 }}>
                                {voices.map((voice, index) => (
                                    <Text
                                        key={index}
                                        onPress={() => {
                                            setSelectedVoiceIndex(index);
                                            browserTextToSpeech("This voice has been selected", index);
                                        }}
                                        style={{
                                            color: selectedVoiceIndex === index ? '#2196F3' : 'white',
                                            padding: 8,
                                            borderBottomWidth: 1,
                                            borderBottomColor: '#444',
                                            fontSize: 16
                                        }}>
                                        {voice.name} ({voice.lang})
                                    </Text>
                                ))}
                            </RNScrollView>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
});

DeviceView.displayName = 'DeviceView';