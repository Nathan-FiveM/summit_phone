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
          <HomeScreen />
          <Lockscreen />
          <Startup />
          {/* <ControlCenters /> */}
        </div>
        <div className="backButton" />
      </div>
    </div>
  )
}