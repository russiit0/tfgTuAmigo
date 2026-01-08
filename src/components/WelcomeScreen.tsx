import React from 'react';
import { MessageCircle, BookOpen, Heart, Brain } from 'lucide-react';

interface WelcomeScreenProps {
    onNavigate: (screen: 'chat' | 'resources' | 'simulation') => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate }) => {
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-calm-blue-light p-8 text-center">
            <div className="mb-8 animate-bounce">
                <Heart className="w-24 h-24 text-calm-blue-primary" fill="#2196F3" />
            </div>

            <h1 className="text-4xl font-bold text-calm-text-primary mb-4">
                Tu Amigo
            </h1>

            <p className="text-xl text-gray-600 mb-12 max-w-md">
                Estamos aquí para ti. Un espacio seguro para escucharte y apoyarte.
            </p>

            <div className="flex flex-col md:flex-row gap-6 w-full max-w-2xl">
                <button
                    onClick={() => onNavigate('chat')}
                    className="flex-1 flex flex-col items-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 border-2 border-transparent hover:border-calm-blue-primary group"
                >
                    <div className="bg-calm-blue-light p-4 rounded-full mb-4 group-hover:bg-calm-blue-primary transition-colors">
                        <MessageCircle className="w-8 h-8 text-calm-blue-primary group-hover:text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-calm-text-primary mb-2">Hablar con alguien</h3>
                    <p className="text-gray-500 text-sm">Cuéntanos qué te preocupa en un chat seguro y privado.</p>
                </button>

                <button
                    onClick={() => onNavigate('resources')}
                    className="flex-1 flex flex-col items-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 border-2 border-transparent hover:border-green-500 group"
                >
                    <div className="bg-calm-green-light p-4 rounded-full mb-4 group-hover:bg-green-500 transition-colors">
                        <BookOpen className="w-8 h-8 text-green-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-calm-text-primary mb-2">Ver recursos</h3>
                    <p className="text-gray-500 text-sm">Consejos, guías y herramientas para sentirte mejor.</p>
                </button>

                <button
                    onClick={() => onNavigate('simulation')}
                    className="flex-1 flex flex-col items-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 border-2 border-transparent hover:border-purple-500 group"
                >
                    <div className="bg-purple-50 p-4 rounded-full mb-4 group-hover:bg-purple-500 transition-colors">
                        <Brain className="w-8 h-8 text-purple-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-calm-text-primary mb-2">Simulación IA</h3>
                    <p className="text-gray-500 text-sm">Ver cómo la IA ayuda a otros estudiantes.</p>
                </button>
            </div>
        </div>
    );
};
