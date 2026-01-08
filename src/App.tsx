import { useState } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ChatScreen } from './components/ChatScreen';
import { ResourcesScreen } from './components/ResourcesScreen';
import { SimulationScreen } from './components/SimulationScreen';

type Screen = 'welcome' | 'chat' | 'resources' | 'simulation';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('welcome');

  const renderScreen = () => {
    switch (currentScreen) {
      case 'chat':
        return <ChatScreen onBack={() => setCurrentScreen('welcome')} />;
      case 'resources':
        return <ResourcesScreen onBack={() => setCurrentScreen('welcome')} />;
      case 'simulation':
        return <SimulationScreen onBack={() => setCurrentScreen('welcome')} />;
      default:
        return <WelcomeScreen onNavigate={setCurrentScreen} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      {renderScreen()}
    </div>
  );
}

export default App;
