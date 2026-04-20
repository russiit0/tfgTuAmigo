export interface Message {
    id: string;
    text: string;
    isUser?: boolean; // Usado en ChatScreen
    sender?: 'Victim' | 'Helper'; // Usado en SimulationScreen
    timestamp: Date;
}

export interface EmotionMetrics {
    sadness: number;
    anxiety: number;
    relief: number;
    hope: number;
}

export interface UserProfile {
    name: string;
    age: string;
    situation: string;
    riskLevel: 'Bajo' | 'Medio' | 'Alto';
    suggestedAction: string;
}
