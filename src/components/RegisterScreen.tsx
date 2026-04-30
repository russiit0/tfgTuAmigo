import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface RegisterScreenProps {
  onBack: () => void;
  onNavigateToLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onBack, onNavigateToLogin }) => {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = await window.electronAPI.auth.register({ nombre, correo, password });
    if (res.success && res.user) {
      login(res.user);
      onBack(); // Go back to welcome screen signed in
    } else {
      setError(res.error || 'Error al registrarse');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-calm-blue-light p-4">
      <div className="bg-white p-8 rounded-2xl shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-calm-text-primary mb-6 text-center">Registrarse</h2>
        {error && <div className="text-red-500 mb-4 text-center">{error}</div>}
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="p-3 border border-gray-300 rounded focus:outline-none focus:border-calm-blue-primary"
            required
          />
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
            Crear cuenta
          </button>
        </form>
        <div className="mt-4 text-center text-gray-600">
          ¿Ya tienes cuenta?{' '}
          <button onClick={onNavigateToLogin} className="text-calm-blue-primary font-semibold underline">
            Inicia sesión
          </button>
        </div>
        <div className="mt-4 text-center">
          <button onClick={onBack} className="text-gray-500 underline">Volver al inicio</button>
        </div>
      </div>
    </div>
  );
};
