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
import { useCallback, useEffect, useState, memo, useMemo } from 'react';
import { isEnvBrowser } from './hooks/misc';
import { fetchNui } from './hooks/fetchNui';
import ControlCenters from './routers/screens/ControlCenters';
import Phone from './routers/apps/phone/Phone';
import { PhoneSettings } from '../../types/types';
import Notifications from './routers/components/Notifications';
import CallComponent from './routers/components/CallComponent';
import Message from './routers/apps/Messages/Message';
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
import Photos from './routers/apps/Photos/Photos';
import DarkChat from './routers/apps/DarkChat/DarkChat';
import Housing from './routers/apps/Housing/Housing';
import Pigeon from './routers/apps/Pigeon/Pigeon';
import BluePage from './routers/apps/BluePage/BluePage';
import GarageApp from './routers/apps/Garage/GarageData';
import Wallet from './routers/apps/Wallet/Wallet';
import Groups from './routers/apps/Groups/Groups';
import HeartSync from './routers/apps/HeartSync/HeartSync';

debugData([
  {
    action: 'setVisible',
    data: {
      show: true,
      color: 'red',
    },
  }
]);

// Memoized app components to prevent unnecessary re-renders
const MemoizedSettings = memo(Settings);
const MemoizedServices = memo(Services);
const MemoizedMailApp = memo(MailApp);
const MemoizedAppStore = memo(AppStore);
const MemoizedCalculator = memo(Calculator);
const MemoizedCamera = memo(Camera);
const MemoizedPhotos = memo(Photos);
const MemoizedDarkChat = memo(DarkChat);
const MemoizedHousing = memo(Housing);
const MemoizedPigeon = memo(Pigeon);
const MemoizedBluePage = memo(BluePage);
const MemoizedGarageApp = memo(GarageApp);
const MemoizedWallet = memo(Wallet);
const MemoizedGroups = memo(Groups);
const MemoizedHeartSync = memo(HeartSync);

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
          content: <svg xmlns="http://www.w3.org/2000/svg" width="4.98vh" height="4.98vh" viewBox="0 0 55 55" fill="none">
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
    if (data.length === 0) return;
    const settings: PhoneSettings = JSON.parse(data);
    setPhoneSettings(settings);
  });

  const closeCallback = useCallback(async (phoneSe: any) => {
    fetchNui("hideFrame");
    const dataX = {
      ...phoneSe,
      isLock: true
    }
    setPhoneSettings(dataX);
    fetchNui('unLockorLockPhone', true);
    setLocation({
      app: '',
      page: {
        ...location.page
      }
    });
  }, [visible, phoneSettings.usePin, phoneSettings.showStartupScreen]);

  useEffect(() => {
    if (!visible) return;
    settingsCallback(visible);

    const keyHandler = (e: KeyboardEvent) => {
      if (["Escape"].includes(e.code)) {
        if (!isEnvBrowser()) {
          closeCallback(phoneSettings);
        } else {
          setVisible(!visible)
        };
      }
    };
    window.addEventListener("keydown", keyHandler);

    return () => window.removeEventListener("keydown", keyHandler);
  }, [visible, phoneSettings.usePin, phoneSettings.showStartupScreen]);

  useNuiEvent('toggleCloseClear', () => {
    closeCallback(phoneSettings);
  })

  const [brightness] = useLocalStorage({
    key: 'brightness',
    defaultValue: 60,
  });
  
  // Consolidate app state into a single object to reduce re-renders
  const [appStates, setAppStates] = useState({
    settingsEnter: false,
    servicesEnter: false,
    mailEnter: false,
    appStoreEnter: false,
    calculatorEnter: false,
    cameraEnter: false,
    photosEnter: false,
    darkChatEnter: false,
    housingEnter: false,
    pigeonEnter: false,
    bluePageEnter: false,
    garagesEnter: false,
    walletEnter: false,
    groupsEnter: false,
    loveLinkEnter: false,
    heartSyncEnter: false,
  });

  // Memoized frame style to prevent recalculation
  const frameStyle = useMemo(() => ({
    width: '32.1vh',
    height: '66.15vh',
    display: 'flex',
    justifyContent: 'start',
    alignItems: 'start',
    marginTop: visible && location.page.camera === 'landscape' ? '45.00vh' : visible ? '0.00vh' : (notificationPush || inCall || showNotiy) && !cursor ? '80.00vh' : '100.00vh',
    transition: 'all 0.9s ease',
    backgroundImage: `url(${primaryColor === 'blue' ? blueFrame : primaryColor === 'gold' ? goldFrame : primaryColor === 'green' ? greenFrame : primaryColor === 'purple' ? purpleFrame : primaryColor === 'red' ? redFrame : ''})`,
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'contain',
    filter: `brightness(${brightness + 30}%)`,
    transform: location.page.camera === 'landscape' ? 'rotate(-90deg)' : 'rotate(0deg)',
    marginRight: location.page.camera === 'landscape' ? '16.00vh' : '0.00vh',
  }), [visible, location.page.camera, notificationPush, inCall, showNotiy, cursor, primaryColor, brightness]);

  return (
    <div style={frameStyle}>
      <div className="innerFrame" style={{
        backgroundImage: `url(${phoneSettings?.background?.current || phoneBg})`,
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
          <MessageDetails />
          <CreateGroup />
        </div>
        {/* Optimized app containers with memoized components */}
        {appStates.settingsEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedSettings onExit={() => setAppStates(prev => ({ ...prev, settingsEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, settingsEnter: true }))} />
          </div>
        )}
        {appStates.servicesEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedServices onExit={() => setAppStates(prev => ({ ...prev, servicesEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, servicesEnter: true }))} />
          </div>
        )}
        {appStates.mailEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedMailApp onExit={() => setAppStates(prev => ({ ...prev, mailEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, mailEnter: true }))} />
          </div>
        )}
        {appStates.appStoreEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedAppStore onExit={() => setAppStates(prev => ({ ...prev, appStoreEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, appStoreEnter: true }))} />
          </div>
        )}
        {appStates.calculatorEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedCalculator onExit={() => setAppStates(prev => ({ ...prev, calculatorEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, calculatorEnter: true }))} />
          </div>
        )}
        {appStates.cameraEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedCamera onExit={() => setAppStates(prev => ({ ...prev, cameraEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, cameraEnter: true }))} />
          </div>
        )}
        {appStates.photosEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedPhotos onExit={() => setAppStates(prev => ({ ...prev, photosEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, photosEnter: true }))} />
          </div>
        )}
        {appStates.darkChatEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedDarkChat onExit={() => setAppStates(prev => ({ ...prev, darkChatEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, darkChatEnter: true }))} />
          </div>
        )}
        {appStates.housingEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedHousing onExit={() => setAppStates(prev => ({ ...prev, housingEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, housingEnter: true }))} />
          </div>
        )}
        {appStates.pigeonEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedPigeon onExit={() => setAppStates(prev => ({ ...prev, pigeonEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, pigeonEnter: true }))} />
          </div>
        )}
        {appStates.bluePageEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedBluePage onExit={() => setAppStates(prev => ({ ...prev, bluePageEnter: false }))} onEnter={() => setAppStates(prev => ({ ...prev, bluePageEnter: true }))} />
          </div>
        )}
        {appStates.garagesEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedGarageApp onEnter={() => setAppStates(prev => ({ ...prev, garagesEnter: true }))} onExit={() => setAppStates(prev => ({ ...prev, garagesEnter: false }))} />
          </div>
        )}
        {appStates.groupsEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedGroups onEnter={() => setAppStates(prev => ({ ...prev, groupsEnter: true }))} onExit={() => setAppStates(prev => ({ ...prev, groupsEnter: false }))} />
          </div>
        )}
        {appStates.walletEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedWallet onEnter={() => setAppStates(prev => ({ ...prev, walletEnter: true }))} onExit={() => setAppStates(prev => ({ ...prev, walletEnter: false }))} />
          </div>
        )}
        {appStates.heartSyncEnter && (
          <div className='fuckerMessager' id='fuckerMessager' style={{ visibility: 'visible' }}>
            <MemoizedHeartSync onEnter={() => setAppStates(prev => ({ ...prev, heartSyncEnter: true }))} onExit={() => setAppStates(prev => ({ ...prev, heartSyncEnter: false }))} />
          </div>
        )}
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
                heartsync: location.page.heartsync,
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