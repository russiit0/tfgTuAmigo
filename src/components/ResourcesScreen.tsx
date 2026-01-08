import React from 'react';
import { ArrowLeft, Book, Phone, ShieldAlert } from 'lucide-react';

interface ResourcesScreenProps {
    onBack: () => void;
}

export const ResourcesScreen: React.FC<ResourcesScreenProps> = ({ onBack }) => {
    return (
        <div className="flex flex-col h-screen bg-gray-50 overflow-y-auto">
            <div className="bg-white shadow-sm p-4 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">Recursos y Ayuda</h1>
                </div>
            </div>

            <div className="p-6 max-w-4xl mx-auto w-full space-y-6">

                {/* Emergency Card */}
                <div className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-start gap-4">
                    <div className="bg-red-100 p-3 rounded-full">
                        <ShieldAlert className="w-8 h-8 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-red-800 mb-2">¿Necesitas ayuda urgente?</h3>
                        <p className="text-red-700 mb-4">Si estás en peligro o necesitas hablar con alguien inmediatamente:</p>
                        <div className="flex flex-wrap gap-3">
                            <button className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors">
                                <Phone className="w-4 h-4" />
                                Llamar al 112
                            </button>
                            <button className="flex items-center gap-2 bg-white text-red-600 border border-red-200 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors">
                                <Phone className="w-4 h-4" />
                                Teléfono ANAR: 900 20 20 10
                            </button>
                        </div>
                    </div>
                </div>

                {/* Categories */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-blue-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                            <Book className="w-6 h-6 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Guía sobre Ciberacoso</h3>
                        <p className="text-gray-500 text-sm mb-4">Aprende a protegerte en redes sociales y bloquear cuentas tóxicas.</p>
                        <button className="text-blue-600 font-medium hover:underline">Leer más →</button>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                        <div className="bg-green-50 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                            <Book className="w-6 h-6 text-green-600" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-2">Técnicas de Relajación</h3>
                        <p className="text-gray-500 text-sm mb-4">Ejercicios de respiración para momentos de ansiedad.</p>
                        <button className="text-green-600 font-medium hover:underline">Leer más →</button>
                    </div>
                </div>
            </div>
        </div>
    );
};
