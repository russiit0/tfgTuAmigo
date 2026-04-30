import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface LoginScreenProps {
  onBack: () => void;
  onNavigateToRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onBack, onNavigateToRegister }) => {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await window.electronAPI.auth.login({ correo, password });
    if (res.success && res.user) {
      login(res.user);
      onBack(); // Go back to welcome screen signed in
    } else {
      setError(res.error || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-calm-blue-light p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-calm-text-primary mb-6 text-center">Iniciar Sesión</h2>
        {error && <div className="text-red-500 mb-4 text-center">{error}</div>}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            className="p-3 border border-gray-300 rounded focus:outline-none focus:border-calm-blue-primary"
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 border border-gray-300 rounded focus:outline-none focus:border-calm-blue-primary"
            required
          />
          <button type="submit" className="bg-calm-blue-primary text-white p-3 rounded font-semibold hover:opacity-90">
            Entrar
          </button>
        </form>
        <div className="mt-4 text-center text-gray-600">
          ¿No tienes cuenta?{' '}
          <button onClick={onNavigateToRegister} className="text-calm-blue-primary font-semibold underline">
            Regístrate
          </button>
        </div>
        <div className="mt-4 text-center">
          <button onClick={onBack} className="text-gray-500 underline">Volver al inicio</button>
        </div>
      </div>
    </div>
  );
};
