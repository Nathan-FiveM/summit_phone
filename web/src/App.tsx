import './App.scss';
import Header from './components/header';
import { debugData } from './hooks/debugData';
import { useNuiEvent } from './hooks/useNuiEvent';
import { usePhone } from './store/store';
import blueFrame from '../images/frames/blue_frame.svg?url';
import goldFrame from '../images/frames/gold_frame.svg?url';
import greenFrame from '../images/frames/green_frame.svg?url';
import purpleFrame from '../images/frames/purple_frame.svg?url';
import redFrame from '../images/frames/red_frame.svg?url';
import phoneBg from "../images/phoneBG.jpg";
import HomeScreen from './components/screens/Homescreen';
import Lockscreen from './components/screens/Lockscreen';
import Startup from './components/screens/Startup';
import { useEffect } from 'react';
import { isEnvBrowser } from './hooks/misc';
import { fetchNui } from './hooks/fetchNui';
import ControlCenters from './components/screens/ControlCenters';

debugData([
  {
    action: 'setVisible',
    data: true,
  }
]);

export default function App() {
  const { visible, primaryColor, setTime, setVisible } = usePhone();

  useNuiEvent('setVisible', (data: boolean) => {
    setVisible(data);
  });

  useEffect(() => {
    if (!visible) return;

    const keyHandler = (e: KeyboardEvent) => {
      if (["Escape"].includes(e.code)) {
        if (!isEnvBrowser()) fetchNui("hideFrame");
        else setVisible(!visible);
      }
    };

    window.addEventListener("keydown", keyHandler);

    return () => window.removeEventListener("keydown", keyHandler);
  }, [visible]);

  return (
    <div style={{
      width: '17.083333333333332vw',
      height: '35.208333333333336vw',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'start',
      marginTop: visible ? '0vh' : '100vh',
      transition: 'all 1s ease',
      backgroundImage: `url(${primaryColor === 'blue' ? blueFrame : primaryColor === 'gold' ? goldFrame : primaryColor === 'green' ? greenFrame : primaryColor === 'purple' ? purpleFrame : primaryColor === 'red' ? redFrame : ''})`,
      backgroundRepeat: 'no-repeat',

      backgroundSize: 'contain',
    }}>
      <div className="innerFrame" style={{
        backgroundImage: `url(${phoneBg})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }}>
        <div className='headerFrame'>
          <Header />
        </div>
        <div className="contentFrame">
          <ControlCenters />
          <HomeScreen />
          <Lockscreen />
          <Startup />
        </div>
        <div className="backButton" onClick={() => {
          fetchNui("hideFrame");
        }} />
      </div>
    </div>
  )
}