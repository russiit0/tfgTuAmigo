import { useState, useEffect } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ChatScreen } from './components/ChatScreen';
import { ResourcesScreen } from './components/ResourcesScreen';
import { SimulationScreen } from './components/SimulationScreen';
import { LoginScreen } from './components/LoginScreen';
import { RegisterScreen } from './components/RegisterScreen';
import { FollowUpModal } from './components/FollowUpModal';
import { AuthProvider } from './context/AuthContext';

import { useAuth } from './context/AuthContext';

type Screen = 'welcome' | 'chat' | 'resources' | 'simulation' | 'login' | 'register';

function MainRouter() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');
  const [followUps, setFollowUps] = useState<{ conversationId: string; title: string }[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !window.electronAPI?.session?.getPendingFollowUps) return;
    window.electronAPI.session.getPendingFollowUps(user.id).then(res => {
      if (res.success && res.pendingFollowUps.length > 0) {
        setFollowUps(res.pendingFollowUps);
      }
    }).catch(() => {});
  }, [user]);

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
      {followUps.length > 0 && (
        <FollowUpModal followUps={followUps} onDismiss={() => setFollowUps([])} />
      )}
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
