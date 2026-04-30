import { useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ChatScreen } from './components/ChatScreen';
import { ResourcesScreen } from './components/ResourcesScreen';
import { SimulationScreen } from './components/SimulationScreen';
import { LoginScreen } from './components/LoginScreen';
import { RegisterScreen } from './components/RegisterScreen';
import { AuthProvider } from './context/AuthContext';

import { useAuth } from './context/AuthContext';

type Screen = 'welcome' | 'chat' | 'resources' | 'simulation' | 'login' | 'register';

function MainRouter() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const { user } = useAuth();

  const renderScreen = () => {
    switch (currentScreen) {
      case 'login':
        return <LoginScreen onBack={() => setCurrentScreen('welcome')} onNavigateToRegister={() => setCurrentScreen('register')} />;
      case 'register':
        return <RegisterScreen onBack={() => setCurrentScreen('welcome')} onNavigateToLogin={() => setCurrentScreen('login')} />;
      case 'chat':
        return <ChatScreen onBack={() => setCurrentScreen('welcome')} />;
      case 'resources':
        return <ResourcesScreen onBack={() => setCurrentScreen('welcome')} />;
      case 'simulation':
        if (user?.rol !== 'admin') {
          return <WelcomeScreen onNavigate={setCurrentScreen} onLoginClick={() => setCurrentScreen('login')} />;
        }
        return <SimulationScreen onBack={() => setCurrentScreen('welcome')} />;
      default:
        return <WelcomeScreen onNavigate={setCurrentScreen} onLoginClick={() => setCurrentScreen('login')} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {renderScreen()}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <MainRouter />
    </AuthProvider>
  );
}

export default App;
