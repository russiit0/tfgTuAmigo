import React from 'react';
import { MessageCircle, BookOpen, Heart, Brain, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface WelcomeScreenProps {
    onNavigate: (screen: 'chat' | 'resources' | 'simulation') => void;
    onLoginClick: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onNavigate, onLoginClick }) => {
    const { user, logout } = useAuth();
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-calm-blue-light p-8 text-center relative">
            <div className="absolute top-4 right-8 flex items-center gap-4">
                {user ? (
                    <>
                        <div className="flex items-center gap-2 text-calm-text-primary">
                            <User className="w-5 h-5 text-calm-blue-primary" />
                            <span className="font-semibold">{user.nombre}</span>
                        </div>
                        <button onClick={logout} className="flex items-center gap-1 text-red-500 hover:bg-red-50 p-2 rounded transition-colors">
                            <LogOut className="w-4 h-4" />
                            <span className="text-sm">Salir</span>
                        </button>
                    </>
                ) : (
                    <button onClick={onLoginClick} className="flex items-center gap-2 bg-white text-calm-blue-primary px-4 py-2 rounded-full shadow hover:shadow-md transition-all font-semibold">
                        <User className="w-4 h-4" />
                        Iniciar Sesión
                    </button>
                )}
            </div>

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

                {user?.rol === 'admin' && (
                <button
                    onClick={() => onNavigate('simulation')}
                    className="flex-1 flex flex-col items-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1 border-2 border-transparent hover:border-purple-500 group"
                >
                    <div className="bg-purple-50 p-4 rounded-full mb-4 group-hover:bg-purple-500 transition-colors">
                        <Brain className="w-8 h-8 text-purple-600 group-hover:text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-calm-text-primary mb-2">Simulación IA</h3>
                    <p className="text-gray-500 text-sm">Panel de control y testing (Admin).</p>
                </button>
                )}
            </div>
        </div>
    );
};
