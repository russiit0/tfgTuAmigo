import React, { useState } from 'react';
import { Heart, TrendingUp, Minus, TrendingDown, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FollowUp {
  conversationId: string;
  title: string;
}

interface FollowUpModalProps {
  followUps: FollowUp[];
  onDismiss: () => void;
}

export const FollowUpModal: React.FC<FollowUpModalProps> = ({ followUps, onDismiss }) => {
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const current = followUps[currentIndex];

  const handleAnswer = async (respuesta: 'mejor' | 'igual' | 'peor') => {
    if (!user || !current) return;
    setSubmitting(true);
    await window.electronAPI.session.recordFollowUp({
      userId: user.id,
      conversationId: current.conversationId,
      respuesta,
    });
    setAnswered(prev => new Set(prev).add(current.conversationId));
    setSubmitting(false);

    if (currentIndex + 1 < followUps.length) {
      setCurrentIndex(i => i + 1);
    } else {
      onDismiss();
    }
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onDismiss} />
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="bg-blue-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4">
          <Heart className="w-7 h-7 text-blue-500" />
        </div>

        <h3 className="text-xl font-bold text-gray-800 text-center mb-1">
          ¿Cómo van las cosas?
        </h3>
        <p className="text-gray-500 text-center text-sm mb-2">
          Han pasado unos días desde que hablamos sobre:
        </p>
        <p className="text-gray-700 text-center text-sm font-medium bg-gray-50 rounded-xl px-4 py-3 mb-6 italic">
          "{current.title}"
        </p>

        {followUps.length > 1 && (
          <p className="text-xs text-gray-400 text-center mb-4">
            {currentIndex + 1} de {followUps.length}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleAnswer('mejor')}
            disabled={submitting}
            className="flex items-center gap-3 w-full p-4 bg-green-50 hover:bg-green-100 border-2 border-transparent hover:border-green-300 text-green-700 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-60"
          >
            <TrendingUp className="w-5 h-5 flex-shrink-0" />
            <span>Ha mejorado</span>
          </button>
          <button
            onClick={() => handleAnswer('igual')}
            disabled={submitting}
            className="flex items-center gap-3 w-full p-4 bg-yellow-50 hover:bg-yellow-100 border-2 border-transparent hover:border-yellow-300 text-yellow-700 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-60"
          >
            <Minus className="w-5 h-5 flex-shrink-0" />
            <span>Sigue igual</span>
          </button>
          <button
            onClick={() => handleAnswer('peor')}
            disabled={submitting}
            className="flex items-center gap-3 w-full p-4 bg-red-50 hover:bg-red-100 border-2 border-transparent hover:border-red-300 text-red-700 rounded-2xl font-semibold transition-all active:scale-95 disabled:opacity-60"
          >
            <TrendingDown className="w-5 h-5 flex-shrink-0" />
            <span>Ha empeorado</span>
          </button>
        </div>

        <p className="text-[10px] text-center text-gray-400 mt-4">
          Tu respuesta nos ayuda a saber si necesitas más apoyo.
        </p>
      </div>
    </div>
  );
};
