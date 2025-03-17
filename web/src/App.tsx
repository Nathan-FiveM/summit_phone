import './App.scss';
import Header from './routers/components/header';
import { debugData } from './hooks/debugData';
import { useNuiEvent } from './hooks/useNuiEvent';
import { usePhone } from './store/store';
import blueFrame from '../images/frames/blue_frame.svg?url';
import goldFrame from '../images/frames/gold_frame.svg?url';
import greenFrame from '../images/frames/green_frame.svg?url';
import purpleFrame from '../images/frames/purple_frame.svg?url';
import redFrame from '../images/frames/red_frame.svg?url';
import phoneBg from "../images/phoneBG.jpg";
import HomeScreen from './routers/screens/Homescreen';
import Lockscreen from './routers/screens/Lockscreen';
import Startup from './routers/screens/Startup';
import { useCallback, useEffect, useState } from 'react';
import { isEnvBrowser } from './hooks/misc';
import { fetchNui } from './hooks/fetchNui';
import ControlCenters from './routers/screens/ControlCenters';
import Phone from './routers/apps/phone/Phone';
import { PhoneSettings } from '../../types/types';
import Notifications from './routers/components/Notifications';
import CallComponent from './routers/components/CallComponent';
import Message from './routers/apps/Messages/Message';
import FilteredPage from './routers/apps/Messages/FilteredPage';
import MessageDetails from './routers/apps/Messages/MessageDetails';
import CreateGroup from './routers/apps/Messages/CreateGroup';
import Settings from './routers/apps/Settings/Settings';
import { useLocalStorage } from '@mantine/hooks';
import Services from './routers/apps/Services/Services';
import PhoneContextMenu from './routers/components/PhoneContextMenu';
import MailApp from './routers/apps/Mail/Mail';
import AppStore from './routers/apps/AppStore/AppStore';
import Calculator from './routers/apps/Calculator/Calculator';
import Camera from './routers/apps/Camera/Camera';
import CameraAdapter from './routers/apps/Camera/Camera';
import Photos from './routers/apps/Photos/Photos';
import { Image } from '@mantine/core';
import DarkChat from './routers/apps/DarkChat/DarkChat';

debugData([
  {
    action: 'setVisible',
    data: {
      show: true,
      color: 'red',
    },
  }
]);

export default function App() {
  const { visible, primaryColor, phoneSettings, location, notificationPush, inCall, showNotiy, setVisible, setInCall, setPrimaryColor, setPhoneSettings, setDynamicNoti, setLocation } = usePhone();
  const [cursor, setCursor] = useState(false);
  useNuiEvent('setVisible', (data: {
    show: boolean;
    color: string;
  }) => {
    setVisible(data.show);
    setPrimaryColor(data.color);
  });
  useNuiEvent('setCursor', (data: {
    show: boolean;
    color: string;
  }) => {
    setCursor(data.show);
    setPrimaryColor(data.color);
  });

  const settingsCallback = useCallback(async (visible: boolean) => {
    const data: string = await fetchNui("getSettings");
    if (data) {
      const settings: PhoneSettings = JSON.parse(data);
      setPhoneSettings(settings);
      const citizenId: string = await fetchNui("getCitizenId");
      if (visible && citizenId === settings.faceIdIdentifier && !settings.showStartupScreen && settings.useFaceId) {
        setDynamicNoti({
          show: true,
          type: 'success',
          timeout: 1000,
          content: <svg xmlns="http://www.w3.org/2000/svg" width="2.8vw" height="2.8vw" viewBox="0 0 55 55" fill="none">
            <path d="M16.1667 2H15.6C10.8395 2 8.45932 2 6.64109 2.92644C5.0417 3.74137 3.74137 5.0417 2.92644 6.64109C2 8.45932 2 10.8395 2 15.6V16.1667M16.1667 53H15.6C10.8395 53 8.45932 53 6.64109 52.0735C5.0417 51.2586 3.74137 49.9584 2.92644 48.359C2 46.5406 2 44.1606 2 39.4V38.8333M53 16.1667V15.6C53 10.8395 53 8.45932 52.0735 6.64109C51.2586 5.0417 49.9584 3.74137 48.359 2.92644C46.5406 2 44.1606 2 39.4 2H38.8333M53 38.8333V39.4C53 44.1606 53 46.5406 52.0735 48.359C51.2586 49.9584 49.9584 51.2586 48.359 52.0735C46.5406 53 44.1606 53 39.4 53H38.8333M14.75 16.1667V20.4167M40.25 16.1667V20.4167M24.6667 29.2003C26.9333 29.2003 28.9167 27.2169 28.9167 24.9503V16.1667M36.5672 36.5667C31.4672 41.6667 23.2506 41.6667 18.1506 36.5667" stroke="rgba(0,255,0,0.8)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        });
        setTimeout(() => {
          const dataX = {
            ...settings,
            isLock: false
          }
          setPhoneSettings(dataX);
          fetchNui('unLockorLockPhone', false);
        }, 800);
      }
    }
  }, []);

  useNuiEvent('setSettings', (data: string) => {
    const settings: PhoneSettings = JSON.parse(data);
    setPhoneSettings(settings);
  });

  useEffect(() => {
    if (!visible) return;
    settingsCallback(visible);

    const keyHandler = (e: KeyboardEvent) => {
      if (["Escape"].includes(e.code)) {
        if (!isEnvBrowser()) {
          fetchNui("hideFrame");
          const dataX = {
            ...phoneSettings,
            isLock: true
          }
          setPhoneSettings(dataX);
          fetchNui('unLockorLockPhone', true);
          setLocation({
            app: '',
            page: {
              phone: location.page.phone,
              messages: location.page.messages,
              settings: location.page.settings,
              services: location.page.services,
              mail: location.page.mail,
              wallet: location.page.wallet,
              calulator: location.page.calulator,
              appstore: location.page.appstore,
              camera: location.page.camera,
              gallery: location.page.gallery,
              pigeon: location.page.pigeon,
              darkchat: location.page.darkchat,
              garages: location.page.garages,
              notes: location.page.notes,
              houses: location.page.houses,
              bluepages: location.page.bluepages,
              pixie: location.page.pixie,
              groups: location.page.groups,
            }
          });
        } else {
          setVisible(!visible)
        };
      }
    };
    window.addEventListener("keydown", keyHandler);

    return () => window.removeEventListener("keydown", keyHandler);
  }, [visible, phoneSettings.usePin, phoneSettings.useFaceId, phoneSettings.showStartupScreen]);

  const [brightness] = useLocalStorage({
    key: 'brightness',
    defaultValue: 60,
  });
  const [settingsEnter, setSettingsEnter] = useState(false);
  const [servicesEnter, setServiceEnter] = useState(false);
  const [mailEnter, setMailEnter] = useState(false);
  const [appStoreEnter, setAppStoreEnter] = useState(false);
  const [calculatorEnter, setCalculatorEnter] = useState(false);
  const [cameraEnter, setCameraEnter] = useState(false);
  const [photosEnter, setPhotosEnter] = useState(false);
  const [darkChatEnter, setDarkChatEnter] = useState(false);

  return (
    <div style={{
      width: '20.083333333333332vw',
      height: '37.208333333333336vw',
      display: 'flex',
      justifyContent: 'start',
      alignItems: 'start',
      marginTop: visible && location.page.camera === 'landscape' ? '45vh' : visible ? '0vh' : (notificationPush || inCall || showNotiy) && !cursor ? '80vh' : '100vh',
      transition: 'all 0.9s ease',
      backgroundImage: `url(${primaryColor === 'blue' ? blueFrame : primaryColor === 'gold' ? goldFrame : primaryColor === 'green' ? greenFrame : primaryColor === 'purple' ? purpleFrame : primaryColor === 'red' ? redFrame : ''})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: 'contain',
      filter: `brightness(${brightness + 30}%)`,
      transform: location.page.camera === 'landscape' ? 'rotate(-90deg)' : 'rotate(0deg)',
      marginRight: location.page.camera === 'landscape' ? '9vw' : '0vw',
    }}>
      <div className="innerFrame" style={{
        backgroundImage: `url(${phoneSettings.background.current ? phoneSettings.background.current : phoneBg})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
      }}>
        <Notifications />
        <PhoneContextMenu />
        <div className='headerFrame'>
          <Header />
        </div>
        <div className="contentFrame" id='contentFrame'>
          <ControlCenters />
          <HomeScreen />
          <Lockscreen />
          <Startup />
          <Phone />
          <CallComponent />
          <Message />
          <FilteredPage />
          <MessageDetails />
          <CreateGroup />
        </div>
        <div className='fuckerMessager' id='fuckerMessager' style={{
          visibility: settingsEnter ? 'visible' : 'hidden',
        }}>
          <Settings onExit={() => {
            setSettingsEnter(false);
          }} onEnter={() => {
            setSettingsEnter(true);
          }} />
        </div>
        <div className='fuckerMessager' id='fuckerMessager' style={{
          visibility: servicesEnter ? 'visible' : 'hidden',
        }}>
          <Services onExit={() => {
            setServiceEnter(false);
          }} onEnter={() => {
            setServiceEnter(true);
          }} />
        </div>
        <div className='fuckerMessager' id='fuckerMessager' style={{
          visibility: mailEnter ? 'visible' : 'hidden',
        }}>
          <MailApp onExit={() => {
            setMailEnter(false);
          }} onEnter={() => {
            setMailEnter(true);
          }} />
        </div>
        <div className='fuckerMessager' id='fuckerMessager' style={{
          visibility: appStoreEnter ? 'visible' : 'hidden',
        }}>
          <AppStore onExit={() => {
            setAppStoreEnter(false);
          }} onEnter={() => {
            setAppStoreEnter(true);
          }} />
        </div>
        <div className='fuckerMessager' id='fuckerMessager' style={{
          visibility: calculatorEnter ? 'visible' : 'hidden',
        }}>
          <Calculator onExit={() => {
            setCalculatorEnter(false);
          }} onEnter={() => {
            setCalculatorEnter(true);
          }} />
        </div>
        <div className='fuckerMessager' id='fuckerMessager' style={{
          visibility: cameraEnter ? 'visible' : 'hidden',
        }}>
          <Camera onExit={() => {
            setCameraEnter(false);
          }} onEnter={() => {
            setCameraEnter(true);
          }} />
        </div>
        <div className='fuckerMessager' id='fuckerMessager' style={{
          visibility: photosEnter ? 'visible' : 'hidden',
        }}>
          <Photos onExit={() => {
            setPhotosEnter(false);
          }} onEnter={() => {
            setPhotosEnter(true);
          }} />
        </div>
        <div className='fuckerMessager' id='fuckerMessager' style={{
          visibility: darkChatEnter ? 'visible' : 'hidden',
        }}>
          <DarkChat onExit={() => {
            setDarkChatEnter(false);
          }} onEnter={() => {
            setDarkChatEnter(true);
          }} />
        </div>
        <div className="backButton" onClick={() => {
          if (location.app !== '') {
            setLocation({
              app: '',
              page: {
                phone: location.page.phone,
                messages: location.page.messages,
                settings: location.page.settings,
                services: location.page.services,
                mail: location.page.mail,
                wallet: location.page.wallet,
                calulator: location.page.calulator,
                appstore: location.page.appstore,
                camera: location.page.camera,
                gallery: location.page.gallery,
                pigeon: location.page.pigeon,
                darkchat: location.page.darkchat,
                garages: location.page.garages,
                notes: location.page.notes,
                houses: location.page.houses,
                bluepages: location.page.bluepages,
                pixie: location.page.pixie,
                groups: location.page.groups,
              }
            });
          } else {
            fetchNui("hideFrame");
            const dataX = {
              ...phoneSettings,
              isLock: true
            };
            setPhoneSettings(dataX);
            fetchNui('unLockorLockPhone', true);
          }
        }} />
      </div>
    </div>
  )
}