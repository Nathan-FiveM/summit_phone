import { BackgroundImage, TextInput, Transition } from "@mantine/core";
import { usePhone } from "../../../store/store";
import { useState } from "react";
import { fetchNui } from "../../../hooks/fetchNui";
import phoneBg from "../../../../images/phoneBG.jpg";
import lockScreenBg from "../../../../images/lockscreenBG.png";
import startupBg from "../../../../images/startupBg.png";
import wall1 from "../../../../images/wallpaper/1.jpg";
import wall2 from "../../../../images/wallpaper/2.jpeg";
import wall3 from "../../../../images/wallpaper/3.jpeg";
import wall4 from "../../../../images/wallpaper/4.jpeg";

export default function LockWallpaperPage() {
    const { location, phoneSettings, setLocation, setPhoneSettings } = usePhone();
    const [hover, setHover] = useState(0);
    const [wallpaper, setWallpaper] = useState('');
    const [showWallpaper, setShowWallpaper] = useState(false);

    return (
        <Transition
            mounted={location.app === "settings" && location.page.settings === "lockwallpaper"}
            transition="fade"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={{
                ...styles,
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: "absolute",
                zIndex: 1,
                backgroundColor: '#0E0E0E',
            }}>
                <div className="soundheader">
                    <div className="back" onClick={() => {
                        const data = {
                            ...location.page,
                            settings: ""
                        };
                        setLocation({
                            app: 'settings',
                            page: data
                        })
                    }} style={{ cursor: 'pointer' }}>
                        <svg style={{
                            flexShrink: '0'
                        }} width="8" height="18" viewBox="0 0 8 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 16.5L1.34983 9.43729C1.14531 9.18163 1.14531 8.81837 1.34983 8.56271L7 1.5" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <div style={{
                            width: "3.06vh",
                            height: "1.67vh",
                            fontStyle: "normal",
                            fontWeight: 500,
                            fontSize: "1.39vh",
                            lineHeight: "1.67vh",
                            textAlign: "center",
                            color: "#0A84FF",
                            flex: "none",
                            order: 1,
                            flexGrow: 0,
                        }}>Back</div>
                    </div>
                    <div className="name" style={{ width: 'auto', marginLeft: '0.00vh' }}>LockScreen Wallpaper</div>
                    <div style={{
                        marginLeft: '0.71vh',
                        display: 'flex',
                        justifyContent: 'end',
                        marginTop: '0.53vh',
                    }}>
                        <svg onClick={() => {
                            setShowWallpaper(true);
                        }} className='clickanimationXl' xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 14 14" fill="none">
                            <path d="M6.4 6.4V0H7.6V6.4H14V7.6H7.6V14H6.4V7.6H0V6.4H6.4Z" fill="#0A84FF" />
                        </svg>
                    </div>
                </div>
                <div style={{
                    width: '100%',
                    height: '85%',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gridTemplateRows: 'repeat(3, 1fr)',
                    justifyItems: 'center',
                    alignItems: 'center',
                    gap: '0.18vh',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                }}>
                    <BackgroundImage src={phoneBg} style={{
                        width: '9.54vh',
                        height: '17.69vh',
                        borderRadius: '0.71vh',
                        imageRendering: 'crisp-edges',
                        cursor: 'pointer',
                        flexShrink: 0
                    }} onMouseEnter={() => setHover(1)} onMouseLeave={() => setHover(0)} onClick={async () => {
                        const data = {
                            ...phoneSettings,
                            lockscreen: {
                                ...phoneSettings.lockscreen,
                                current: phoneBg
                            }
                        }
                        setPhoneSettings(data)
                        await fetchNui('setSettings', JSON.stringify(data));
                    }}>
                        <div style={{
                            width: '97%',
                            height: '97%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                        }} className="">
                            <div></div>
                            {(hover === 1 || phoneSettings.lockscreen.current === phoneBg) && <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 9 9" fill="none">
                                <path d="M4.5 0C3.60999 0 2.73996 0.26392 1.99994 0.758387C1.25991 1.25285 0.683138 1.95566 0.342544 2.77792C0.00194979 3.60019 -0.0871652 4.50499 0.0864682 5.3779C0.260102 6.25082 0.688685 7.05264 1.31802 7.68198C1.94736 8.31131 2.74918 8.7399 3.6221 8.91353C4.49501 9.08716 5.39981 8.99805 6.22208 8.65746C7.04434 8.31686 7.74715 7.74008 8.24161 7.00006C8.73608 6.26004 9 5.39001 9 4.5C9 3.90905 8.8836 3.32389 8.65746 2.77792C8.43131 2.23196 8.09984 1.73588 7.68198 1.31802C7.26412 0.900156 6.76804 0.568688 6.22208 0.342542C5.67611 0.116396 5.09095 0 4.5 0ZM7.0542 3.70665L4.3542 6.18165C4.26872 6.26003 4.15627 6.30238 4.04032 6.29987C3.92436 6.29735 3.81386 6.25017 3.73185 6.16815L2.38185 4.81815C2.33887 4.77664 2.30459 4.72698 2.28101 4.67208C2.25742 4.61718 2.24501 4.55813 2.24449 4.49838C2.24397 4.43863 2.25536 4.37937 2.27798 4.32407C2.30061 4.26877 2.33402 4.21852 2.37627 4.17627C2.41853 4.13402 2.46877 4.10061 2.52407 4.07798C2.57938 4.05535 2.63863 4.04397 2.69838 4.04449C2.75813 4.04501 2.81718 4.05742 2.87208 4.081C2.92699 4.10459 2.97664 4.13887 3.01815 4.18185L4.0635 5.2272L6.4458 3.04335C6.53376 2.96267 6.65017 2.92024 6.76941 2.92539C6.88866 2.93053 7.00097 2.98284 7.08165 3.0708C7.16233 3.15876 7.20476 3.27516 7.19961 3.39441C7.19447 3.51365 7.14216 3.62597 7.0542 3.70665Z" fill="white" />
                            </svg>}
                        </div>
                    </BackgroundImage>
                    <BackgroundImage src={lockScreenBg} style={{
                        width: '9.54vh',
                        height: '17.69vh',
                        borderRadius: '0.71vh',
                        cursor: 'pointer',
                        imageRendering: 'crisp-edges',
                        flexShrink: 0
                    }} onMouseEnter={() => setHover(2)} onMouseLeave={() => setHover(0)} onClick={async () => {
                        const data = {
                            ...phoneSettings,
                            lockscreen: {
                                ...phoneSettings.lockscreen,
                                current: lockScreenBg
                            }
                        }
                        setPhoneSettings(data)
                        await fetchNui('setSettings', JSON.stringify(data));
                    }}>
                        <div style={{
                            width: '97%',
                            height: '97%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                        }}>
                            <div></div>
                            {(hover === 2 || phoneSettings.lockscreen.current === lockScreenBg) && <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 9 9" fill="none">
                                <path d="M4.5 0C3.60999 0 2.73996 0.26392 1.99994 0.758387C1.25991 1.25285 0.683138 1.95566 0.342544 2.77792C0.00194979 3.60019 -0.0871652 4.50499 0.0864682 5.3779C0.260102 6.25082 0.688685 7.05264 1.31802 7.68198C1.94736 8.31131 2.74918 8.7399 3.6221 8.91353C4.49501 9.08716 5.39981 8.99805 6.22208 8.65746C7.04434 8.31686 7.74715 7.74008 8.24161 7.00006C8.73608 6.26004 9 5.39001 9 4.5C9 3.90905 8.8836 3.32389 8.65746 2.77792C8.43131 2.23196 8.09984 1.73588 7.68198 1.31802C7.26412 0.900156 6.76804 0.568688 6.22208 0.342542C5.67611 0.116396 5.09095 0 4.5 0ZM7.0542 3.70665L4.3542 6.18165C4.26872 6.26003 4.15627 6.30238 4.04032 6.29987C3.92436 6.29735 3.81386 6.25017 3.73185 6.16815L2.38185 4.81815C2.33887 4.77664 2.30459 4.72698 2.28101 4.67208C2.25742 4.61718 2.24501 4.55813 2.24449 4.49838C2.24397 4.43863 2.25536 4.37937 2.27798 4.32407C2.30061 4.26877 2.33402 4.21852 2.37627 4.17627C2.41853 4.13402 2.46877 4.10061 2.52407 4.07798C2.57938 4.05535 2.63863 4.04397 2.69838 4.04449C2.75813 4.04501 2.81718 4.05742 2.87208 4.081C2.92699 4.10459 2.97664 4.13887 3.01815 4.18185L4.0635 5.2272L6.4458 3.04335C6.53376 2.96267 6.65017 2.92024 6.76941 2.92539C6.88866 2.93053 7.00097 2.98284 7.08165 3.0708C7.16233 3.15876 7.20476 3.27516 7.19961 3.39441C7.19447 3.51365 7.14216 3.62597 7.0542 3.70665Z" fill="white" />
                            </svg>}
                        </div>
                    </BackgroundImage>
                    <BackgroundImage src={startupBg} style={{
                        width: '9.54vh',
                        height: '17.69vh',
                        borderRadius: '0.71vh',
                        cursor: 'pointer',
                        imageRendering: 'crisp-edges',
                        flexShrink: 0
                    }}>
                        <div style={{
                            width: '97%',
                            height: '97%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                        }} onMouseEnter={() => setHover(3)} onMouseLeave={() => setHover(0)} onClick={async () => {
                            const data = {
                                ...phoneSettings,
                                lockscreen: {
                                    ...phoneSettings.lockscreen,
                                    current: startupBg
                                }
                            }
                            setPhoneSettings(data)
                            await fetchNui('setSettings', JSON.stringify(data));
                        }}>
                            <div></div>
                            {(hover === 3 || phoneSettings.lockscreen.current === startupBg) && <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 9 9" fill="none">
                                <path d="M4.5 0C3.60999 0 2.73996 0.26392 1.99994 0.758387C1.25991 1.25285 0.683138 1.95566 0.342544 2.77792C0.00194979 3.60019 -0.0871652 4.50499 0.0864682 5.3779C0.260102 6.25082 0.688685 7.05264 1.31802 7.68198C1.94736 8.31131 2.74918 8.7399 3.6221 8.91353C4.49501 9.08716 5.39981 8.99805 6.22208 8.65746C7.04434 8.31686 7.74715 7.74008 8.24161 7.00006C8.73608 6.26004 9 5.39001 9 4.5C9 3.90905 8.8836 3.32389 8.65746 2.77792C8.43131 2.23196 8.09984 1.73588 7.68198 1.31802C7.26412 0.900156 6.76804 0.568688 6.22208 0.342542C5.67611 0.116396 5.09095 0 4.5 0ZM7.0542 3.70665L4.3542 6.18165C4.26872 6.26003 4.15627 6.30238 4.04032 6.29987C3.92436 6.29735 3.81386 6.25017 3.73185 6.16815L2.38185 4.81815C2.33887 4.77664 2.30459 4.72698 2.28101 4.67208C2.25742 4.61718 2.24501 4.55813 2.24449 4.49838C2.24397 4.43863 2.25536 4.37937 2.27798 4.32407C2.30061 4.26877 2.33402 4.21852 2.37627 4.17627C2.41853 4.13402 2.46877 4.10061 2.52407 4.07798C2.57938 4.05535 2.63863 4.04397 2.69838 4.04449C2.75813 4.04501 2.81718 4.05742 2.87208 4.081C2.92699 4.10459 2.97664 4.13887 3.01815 4.18185L4.0635 5.2272L6.4458 3.04335C6.53376 2.96267 6.65017 2.92024 6.76941 2.92539C6.88866 2.93053 7.00097 2.98284 7.08165 3.0708C7.16233 3.15876 7.20476 3.27516 7.19961 3.39441C7.19447 3.51365 7.14216 3.62597 7.0542 3.70665Z" fill="white" />
                            </svg>}
                        </div>
                    </BackgroundImage>
                    <BackgroundImage src={wall1} style={{
                        width: '9.54vh',
                        height: '17.69vh',
                        borderRadius: '0.71vh',
                        cursor: 'pointer',
                        imageRendering: 'crisp-edges',
                        flexShrink: 0
                    }}>
                        <div style={{
                            width: '97%',
                            height: '97%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                        }} onMouseEnter={() => setHover(4)} onMouseLeave={() => setHover(0)} onClick={async () => {
                            const data = {
                                ...phoneSettings,
                                lockscreen: {
                                    ...phoneSettings.lockscreen,
                                    current: wall1
                                }
                            }
                            setPhoneSettings(data)
                            await fetchNui('setSettings', JSON.stringify(data));
                        }}>
                            <div></div>
                            {(hover === 4 || phoneSettings.lockscreen.current === wall1) && <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 9 9" fill="none">
                                <path d="M4.5 0C3.60999 0 2.73996 0.26392 1.99994 0.758387C1.25991 1.25285 0.683138 1.95566 0.342544 2.77792C0.00194979 3.60019 -0.0871652 4.50499 0.0864682 5.3779C0.260102 6.25082 0.688685 7.05264 1.31802 7.68198C1.94736 8.31131 2.74918 8.7399 3.6221 8.91353C4.49501 9.08716 5.39981 8.99805 6.22208 8.65746C7.04434 8.31686 7.74715 7.74008 8.24161 7.00006C8.73608 6.26004 9 5.39001 9 4.5C9 3.90905 8.8836 3.32389 8.65746 2.77792C8.43131 2.23196 8.09984 1.73588 7.68198 1.31802C7.26412 0.900156 6.76804 0.568688 6.22208 0.342542C5.67611 0.116396 5.09095 0 4.5 0ZM7.0542 3.70665L4.3542 6.18165C4.26872 6.26003 4.15627 6.30238 4.04032 6.29987C3.92436 6.29735 3.81386 6.25017 3.73185 6.16815L2.38185 4.81815C2.33887 4.77664 2.30459 4.72698 2.28101 4.67208C2.25742 4.61718 2.24501 4.55813 2.24449 4.49838C2.24397 4.43863 2.25536 4.37937 2.27798 4.32407C2.30061 4.26877 2.33402 4.21852 2.37627 4.17627C2.41853 4.13402 2.46877 4.10061 2.52407 4.07798C2.57938 4.05535 2.63863 4.04397 2.69838 4.04449C2.75813 4.04501 2.81718 4.05742 2.87208 4.081C2.92699 4.10459 2.97664 4.13887 3.01815 4.18185L4.0635 5.2272L6.4458 3.04335C6.53376 2.96267 6.65017 2.92024 6.76941 2.92539C6.88866 2.93053 7.00097 2.98284 7.08165 3.0708C7.16233 3.15876 7.20476 3.27516 7.19961 3.39441C7.19447 3.51365 7.14216 3.62597 7.0542 3.70665Z" fill="white" />
                            </svg>}
                        </div>
                    </BackgroundImage>
                    <BackgroundImage src={wall2} style={{
                        width: '9.54vh',
                        height: '17.69vh',
                        borderRadius: '0.71vh',
                        cursor: 'pointer',
                        imageRendering: 'crisp-edges',
                        flexShrink: 0
                    }}>
                        <div style={{
                            width: '97%',
                            height: '97%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                        }} onMouseEnter={() => setHover(5)} onMouseLeave={() => setHover(0)} onClick={async () => {
                            const data = {
                                ...phoneSettings,
                                lockscreen: {
                                    ...phoneSettings.lockscreen,
                                    current: wall2
                                }
                            }
                            setPhoneSettings(data)
                            await fetchNui('setSettings', JSON.stringify(data));
                        }}>
                            <div></div>
                            {(hover === 5 || phoneSettings.lockscreen.current === wall2) && <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 9 9" fill="none">
                                <path d="M4.5 0C3.60999 0 2.73996 0.26392 1.99994 0.758387C1.25991 1.25285 0.683138 1.95566 0.342544 2.77792C0.00194979 3.60019 -0.0871652 4.50499 0.0864682 5.3779C0.260102 6.25082 0.688685 7.05264 1.31802 7.68198C1.94736 8.31131 2.74918 8.7399 3.6221 8.91353C4.49501 9.08716 5.39981 8.99805 6.22208 8.65746C7.04434 8.31686 7.74715 7.74008 8.24161 7.00006C8.73608 6.26004 9 5.39001 9 4.5C9 3.90905 8.8836 3.32389 8.65746 2.77792C8.43131 2.23196 8.09984 1.73588 7.68198 1.31802C7.26412 0.900156 6.76804 0.568688 6.22208 0.342542C5.67611 0.116396 5.09095 0 4.5 0ZM7.0542 3.70665L4.3542 6.18165C4.26872 6.26003 4.15627 6.30238 4.04032 6.29987C3.92436 6.29735 3.81386 6.25017 3.73185 6.16815L2.38185 4.81815C2.33887 4.77664 2.30459 4.72698 2.28101 4.67208C2.25742 4.61718 2.24501 4.55813 2.24449 4.49838C2.24397 4.43863 2.25536 4.37937 2.27798 4.32407C2.30061 4.26877 2.33402 4.21852 2.37627 4.17627C2.41853 4.13402 2.46877 4.10061 2.52407 4.07798C2.57938 4.05535 2.63863 4.04397 2.69838 4.04449C2.75813 4.04501 2.81718 4.05742 2.87208 4.081C2.92699 4.10459 2.97664 4.13887 3.01815 4.18185L4.0635 5.2272L6.4458 3.04335C6.53376 2.96267 6.65017 2.92024 6.76941 2.92539C6.88866 2.93053 7.00097 2.98284 7.08165 3.0708C7.16233 3.15876 7.20476 3.27516 7.19961 3.39441C7.19447 3.51365 7.14216 3.62597 7.0542 3.70665Z" fill="white" />
                            </svg>}
                        </div>
                    </BackgroundImage>
                    <BackgroundImage src={wall3} style={{
                        width: '9.54vh',
                        height: '17.69vh',
                        borderRadius: '0.71vh',
                        cursor: 'pointer',
                        imageRendering: 'crisp-edges',
                        flexShrink: 0
                    }}>
                        <div style={{
                            width: '97%',
                            height: '97%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                        }} onMouseEnter={() => setHover(6)} onMouseLeave={() => setHover(0)} onClick={async () => {
                            const data = {
                                ...phoneSettings,
                                lockscreen: {
                                    ...phoneSettings.lockscreen,
                                    current: wall3
                                }
                            }
                            setPhoneSettings(data)
                            await fetchNui('setSettings', JSON.stringify(data));
                        }}>
                            <div></div>
                            {(hover === 6 || phoneSettings.lockscreen.current === wall3) && <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 9 9" fill="none">
                                <path d="M4.5 0C3.60999 0 2.73996 0.26392 1.99994 0.758387C1.25991 1.25285 0.683138 1.95566 0.342544 2.77792C0.00194979 3.60019 -0.0871652 4.50499 0.0864682 5.3779C0.260102 6.25082 0.688685 7.05264 1.31802 7.68198C1.94736 8.31131 2.74918 8.7399 3.6221 8.91353C4.49501 9.08716 5.39981 8.99805 6.22208 8.65746C7.04434 8.31686 7.74715 7.74008 8.24161 7.00006C8.73608 6.26004 9 5.39001 9 4.5C9 3.90905 8.8836 3.32389 8.65746 2.77792C8.43131 2.23196 8.09984 1.73588 7.68198 1.31802C7.26412 0.900156 6.76804 0.568688 6.22208 0.342542C5.67611 0.116396 5.09095 0 4.5 0ZM7.0542 3.70665L4.3542 6.18165C4.26872 6.26003 4.15627 6.30238 4.04032 6.29987C3.92436 6.29735 3.81386 6.25017 3.73185 6.16815L2.38185 4.81815C2.33887 4.77664 2.30459 4.72698 2.28101 4.67208C2.25742 4.61718 2.24501 4.55813 2.24449 4.49838C2.24397 4.43863 2.25536 4.37937 2.27798 4.32407C2.30061 4.26877 2.33402 4.21852 2.37627 4.17627C2.41853 4.13402 2.46877 4.10061 2.52407 4.07798C2.57938 4.05535 2.63863 4.04397 2.69838 4.04449C2.75813 4.04501 2.81718 4.05742 2.87208 4.081C2.92699 4.10459 2.97664 4.13887 3.01815 4.18185L4.0635 5.2272L6.4458 3.04335C6.53376 2.96267 6.65017 2.92024 6.76941 2.92539C6.88866 2.93053 7.00097 2.98284 7.08165 3.0708C7.16233 3.15876 7.20476 3.27516 7.19961 3.39441C7.19447 3.51365 7.14216 3.62597 7.0542 3.70665Z" fill="white" />
                            </svg>}
                        </div>
                    </BackgroundImage>
                    <BackgroundImage src={wall4} style={{
                        width: '9.54vh',
                        height: '17.69vh',
                        borderRadius: '0.71vh',
                        cursor: 'pointer',
                        imageRendering: 'crisp-edges',
                        flexShrink: 0
                    }}>
                        <div style={{
                            width: '97%',
                            height: '97%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                        }} onMouseEnter={() => setHover(7)} onMouseLeave={() => setHover(0)} onClick={async () => {
                            const data = {
                                ...phoneSettings,
                                lockscreen: {
                                    ...phoneSettings.lockscreen,
                                    current: wall4
                                }
                            }
                            setPhoneSettings(data)
                            await fetchNui('setSettings', JSON.stringify(data));
                        }}>
                            <div></div>
                            {(hover === 7 || phoneSettings.lockscreen.current === wall4) && <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 9 9" fill="none">
                                <path d="M4.5 0C3.60999 0 2.73996 0.26392 1.99994 0.758387C1.25991 1.25285 0.683138 1.95566 0.342544 2.77792C0.00194979 3.60019 -0.0871652 4.50499 0.0864682 5.3779C0.260102 6.25082 0.688685 7.05264 1.31802 7.68198C1.94736 8.31131 2.74918 8.7399 3.6221 8.91353C4.49501 9.08716 5.39981 8.99805 6.22208 8.65746C7.04434 8.31686 7.74715 7.74008 8.24161 7.00006C8.73608 6.26004 9 5.39001 9 4.5C9 3.90905 8.8836 3.32389 8.65746 2.77792C8.43131 2.23196 8.09984 1.73588 7.68198 1.31802C7.26412 0.900156 6.76804 0.568688 6.22208 0.342542C5.67611 0.116396 5.09095 0 4.5 0ZM7.0542 3.70665L4.3542 6.18165C4.26872 6.26003 4.15627 6.30238 4.04032 6.29987C3.92436 6.29735 3.81386 6.25017 3.73185 6.16815L2.38185 4.81815C2.33887 4.77664 2.30459 4.72698 2.28101 4.67208C2.25742 4.61718 2.24501 4.55813 2.24449 4.49838C2.24397 4.43863 2.25536 4.37937 2.27798 4.32407C2.30061 4.26877 2.33402 4.21852 2.37627 4.17627C2.41853 4.13402 2.46877 4.10061 2.52407 4.07798C2.57938 4.05535 2.63863 4.04397 2.69838 4.04449C2.75813 4.04501 2.81718 4.05742 2.87208 4.081C2.92699 4.10459 2.97664 4.13887 3.01815 4.18185L4.0635 5.2272L6.4458 3.04335C6.53376 2.96267 6.65017 2.92024 6.76941 2.92539C6.88866 2.93053 7.00097 2.98284 7.08165 3.0708C7.16233 3.15876 7.20476 3.27516 7.19961 3.39441C7.19447 3.51365 7.14216 3.62597 7.0542 3.70665Z" fill="white" />
                            </svg>}
                        </div>
                    </BackgroundImage>
                    {phoneSettings?.lockscreen && phoneSettings?.lockscreen?.wallpapers?.map((wallpape, index) => {
                        return (
                            <BackgroundImage src={wallpape} style={{
                                width: '9.54vh',
                                height: '17.69vh',
                                borderRadius: '0.71vh',
                                cursor: 'pointer',
                                imageRendering: 'crisp-edges',
                                flexShrink: 0
                            }} key={index + 8}>
                                <div style={{
                                    width: '97%',
                                    height: '97%',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-end',
                                }} onMouseEnter={() => setHover(index + 8)} onMouseLeave={() => setHover(0)} onClick={async () => {
                                    const data = {
                                        ...phoneSettings,
                                        lockscreen: {
                                            ...phoneSettings.lockscreen,
                                            current: wallpape
                                        }
                                    }
                                    setPhoneSettings(data)
                                    await fetchNui('setSettings', JSON.stringify(data));
                                }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 8 9" fill="none">
                                        <path d="M1 1.17391H7M2.5 1.17391C3.28845 0.275365 4.71155 0.275365 5.5 1.17391M2.5 8.5H5.5C6.0523 8.5 6.5 8.06268 6.5 7.52319V3.12753C6.5 2.85779 6.27615 2.63912 6 2.63912H2C1.72386 2.63912 1.5 2.85779 1.5 3.12753V7.52319C1.5 8.06268 1.94771 8.5 2.5 8.5Z" stroke="white" strokeWidth="0.8" strokeLinecap="round" stroke-linejoin="round" />
                                    </svg>
                                    {(hover === index + 8 || phoneSettings.lockscreen.current === wallpape) && <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 9 9" fill="none">
                                        <path d="M4.5 0C3.60999 0 2.73996 0.26392 1.99994 0.758387C1.25991 1.25285 0.683138 1.95566 0.342544 2.77792C0.00194979 3.60019 -0.0871652 4.50499 0.0864682 5.3779C0.260102 6.25082 0.688685 7.05264 1.31802 7.68198C1.94736 8.31131 2.74918 8.7399 3.6221 8.91353C4.49501 9.08716 5.39981 8.99805 6.22208 8.65746C7.04434 8.31686 7.74715 7.74008 8.24161 7.00006C8.73608 6.26004 9 5.39001 9 4.5C9 3.90905 8.8836 3.32389 8.65746 2.77792C8.43131 2.23196 8.09984 1.73588 7.68198 1.31802C7.26412 0.900156 6.76804 0.568688 6.22208 0.342542C5.67611 0.116396 5.09095 0 4.5 0ZM7.0542 3.70665L4.3542 6.18165C4.26872 6.26003 4.15627 6.30238 4.04032 6.29987C3.92436 6.29735 3.81386 6.25017 3.73185 6.16815L2.38185 4.81815C2.33887 4.77664 2.30459 4.72698 2.28101 4.67208C2.25742 4.61718 2.24501 4.55813 2.24449 4.49838C2.24397 4.43863 2.25536 4.37937 2.27798 4.32407C2.30061 4.26877 2.33402 4.21852 2.37627 4.17627C2.41853 4.13402 2.46877 4.10061 2.52407 4.07798C2.57938 4.05535 2.63863 4.04397 2.69838 4.04449C2.75813 4.04501 2.81718 4.05742 2.87208 4.081C2.92699 4.10459 2.97664 4.13887 3.01815 4.18185L4.0635 5.2272L6.4458 3.04335C6.53376 2.96267 6.65017 2.92024 6.76941 2.92539C6.88866 2.93053 7.00097 2.98284 7.08165 3.0708C7.16233 3.15876 7.20476 3.27516 7.19961 3.39441C7.19447 3.51365 7.14216 3.62597 7.0542 3.70665Z" fill="white" />
                                    </svg>}
                                </div>
                            </BackgroundImage>
                        )
                    })}
                </div>
                <Transition
                    mounted={showWallpaper}
                    transition="slide-up"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        width: '100%',
                        height: '50%',
                        position: 'absolute',
                        bottom: '2.13vh',
                        zIndex: 2,
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        alignItems: 'center',
                    }} >
                        <div onClick={() => {
                            setShowWallpaper(false);
                        }} className="cancelButton">
                            Cancel
                        </div>
                        <div onClick={async () => {
                            if (!wallpaper) return;
                            const data = {
                                ...phoneSettings,
                                lockscreen: {
                                    current: phoneSettings.lockscreen.current,
                                    wallpapers: [...phoneSettings.lockscreen.wallpapers, wallpaper]
                                }
                            }
                            await fetchNui('setSettings', JSON.stringify(data));
                            setPhoneSettings(data);
                            setWallpaper('');
                            setShowWallpaper(false);
                        }} className="cancelButton" style={{
                            color: '#0A84FF',
                            marginBottom: '0.89vh',
                        }}>
                            Save
                        </div>
                        <div className="inputPage">
                            <div className="title">Add New Wallpaper</div>
                            <TextInput value={wallpaper} onChange={(e) => {
                                setWallpaper(e.currentTarget.value);
                            }} placeholder="Link" styles={{
                                root: {
                                    padding: '0.89vh 0px',
                                },
                                input: {
                                    width: '100%',
                                    height: '2.67vh',
                                    backgroundColor: 'rgba(255, 255, 255, 0.0)',
                                    border: 'none',
                                    borderBottom: '0.09vh solid rgba(255, 255, 255, 0.2)',
                                    color: '#FFF',
                                    textAlign: 'center',
                                },
                            }}
                                onFocus={() => fetchNui('disableControls', true)}
                                onBlur={() => fetchNui('disableControls', false)}
                                className="Dsadsadsa"
                            />
                        </div>

                    </div>}
                </Transition>
            </div>}
        </Transition>
    );
}