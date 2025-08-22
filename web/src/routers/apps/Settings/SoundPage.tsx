import { Slider, TextInput, Transition } from "@mantine/core";
import { usePhone } from "../../../store/store";
import { useLocalStorage } from "@mantine/hooks";
import { useRef, useState } from "react";
import { fetchNui } from "../../../hooks/fetchNui";

export default function SoundPage() {
    const { location, phoneSettings, setLocation, setPhoneSettings } = usePhone();
    const [volume, setVolume] = useLocalStorage({
        key: 'volume',
        defaultValue: 40,
    });
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef(new Audio());
    function playSound(url: string) {
        if (isPlaying) stopSound();
        const audio = audioRef.current;
        audio.src = url;
        audio.volume = volume / 100;
        audio.play();
        setIsPlaying(true);
    }

    function stopSound() {
        const audio = audioRef.current;
        audio.pause();
        audio.currentTime = 0;
        setIsPlaying(false);
    }
    const [showAddRintone, setShowAddRintone] = useState(false);
    const [addRintone, setAddRintone] = useState('');

    return (
        <Transition
            mounted={location.app === "settings" && location.page.settings === "sounds"}
            transition="fade"
            duration={400}
            timingFunction="ease"
            onExit={() => {
                stopSound();
                setShowAddRintone(false);
                setAddRintone('');
            }}
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
                    <div className="name">Sounds & Ringtones</div>
                </div>
                <div style={{
                    width: "19.44vh",
                    height: "1.57vh",
                    fontStyle: "normal",
                    fontWeight: 500,
                    fontSize: "1.39vh",
                    lineHeight: "1.57vh",
                    color: "rgba(255, 255, 255, 0.9)",
                    marginTop: "2.67vh",
                    marginLeft: "1.42vh",
                }}>All Sounds & Ringtones Volume</div>
                <div style={{
                    display: 'flex',
                    width: '92%',
                    height: '2.50vh',
                    padding: '1.02vh 0px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '0.74vh',
                    marginLeft: '1.42vh',
                    marginTop: '0.89vh',
                    flexShrink: 0,
                }}>
                    <div style={{
                        color: '#FFF',
                        textAlign: 'center',
                        fontSize: '1.57vh',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 'normal',
                    }}>0%</div>
                    <Slider style={{
                        width: '70%'
                    }} value={volume} label={null} styles={{
                        track: {
                            height: '0.37vh',
                        },
                        thumb: {
                            width: '1.67vh',
                            height: '1.67vh',
                            backgroundColor: '#0A84FF',
                        },
                    }} onChange={(e) => {
                        setVolume(e);
                    }} />
                    <div style={{
                        color: '#FFF',
                        textAlign: 'center',
                        fontSize: '1.57vh',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 'normal',
                    }}>100%</div>
                </div>
                <div style={{
                    width: '97%',
                    display: 'flex',
                    justifyContent: 'end',
                    marginTop: '0.53vh',
                }}>
                    <svg onClick={() => {
                        setShowAddRintone(true);
                    }} className='clickanimationXl' xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 14 14" fill="none">
                        <path d="M6.4 6.4V0H7.6V6.4H14V7.6H7.6V14H6.4V7.6H0V6.4H6.4Z" fill="#0A84FF" />
                    </svg>
                </div>
                <div style={{
                    width: '88%',
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginLeft: '1.42vh',
                    marginTop: '1.24vh',
                }}>
                    <div style={{
                        width: '2.87vh',
                        height: '1.20vh',
                        flexShrink: 0,
                        color: 'rgba(255, 255, 255, 0.50)',
                        textAlign: 'center',
                        fontSize: '1.30vh',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 'normal',
                    }}>Name</div>

                    <div style={{
                        width: '2.87vh',
                        height: '1.20vh',
                        flexShrink: 0,
                        color: 'rgba(255, 255, 255, 0.50)',
                        textAlign: 'center',
                        fontSize: '1.30vh',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 'normal',
                    }}>Actions</div>
                </div>
                <div style={{
                    display: 'flex',
                    width: '27.56vh',
                    maxHeight: '41.39vh',
                    padding: '0.37vh 0px',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '0.19vh',
                    marginLeft: '1.42vh',
                }}>
                    {phoneSettings?.ringtone && phoneSettings?.ringtone?.ringtones.map((ringtone, index) => {
                        return (
                            <div key={index} className="containerSAd" style={{
                                display: 'flex',
                                height: '1.85vh',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                alignSelf: 'stretch',
                            }}>
                                <div style={{
                                    color: '#FFF',
                                    textAlign: 'center',
                                    fontSize: '1.47vh',
                                    fontStyle: 'normal',
                                    fontWeight: 500,
                                    lineHeight: 'normal',
                                }} onClick={() => {
                                    const dataX = {
                                        ...phoneSettings,
                                        ringtone: {
                                            current: ringtone.url,
                                            ringtones: phoneSettings.ringtone.ringtones
                                        }
                                    }
                                    setPhoneSettings(dataX);
                                    fetchNui('setSettings', JSON.stringify(dataX));
                                    fetchNui('showNoti', { app: 'settings', title: 'System', description: `You have updated your ringtone` });
                                }}>
                                    {
                                        ringtone.name
                                    }
                                </div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.56vh',
                                }}>
                                    <svg onClick={() => {
                                        //@ts-ignore
                                        playSound(ringtone.url);
                                    }} xmlns="http://www.w3.org/2000/svg" width="1.30vh" height="1.30vh" viewBox="0 0 9 10" fill="none">
                                        <path d="M0.666016 0.258838V9.73981C0.666016 9.93981 0.869135 10.0648 1.03163 9.96481L8.54704 5.22432C8.70641 5.12432 8.70641 4.87745 8.54704 4.77746L1.03163 0.0369692C0.869135 -0.0661528 0.666016 0.0588437 0.666016 0.258838Z" fill="white" />
                                    </svg>
                                    <svg onClick={() => {
                                        stopSound();
                                    }} xmlns="http://www.w3.org/2000/svg" width="1.30vh" height="1.30vh" viewBox="0 0 9 10" fill="none">
                                        <path d="M3.007 10H0.930176C0.783692 10 0.666504 9.8875 0.666504 9.75V0.25C0.666504 0.1125 0.783692 0 0.930176 0H3.007C3.15348 0 3.27067 0.1125 3.27067 0.25V9.75C3.27067 9.8875 3.15348 10 3.007 10ZM8.73617 10H6.65934C6.51286 10 6.39567 9.8875 6.39567 9.75V0.25C6.39567 0.1125 6.51286 0 6.65934 0H8.73617C8.88265 0 8.99984 0.1125 8.99984 0.25V9.75C8.99984 9.8875 8.88265 10 8.73617 10Z" fill="white" />
                                    </svg>
                                    <svg onClick={() => {
                                        stopSound();
                                    }} width="1.30vh" height="1.30vh" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M0 1C0 0.447716 0.447715 0 1 0H9C9.55228 0 10 0.447715 10 1V9C10 9.55228 9.55229 10 9 10H1C0.447716 10 0 9.55229 0 9V1Z" fill="#D9D9D9" />
                                    </svg>
                                    {ringtone.name !== 'default' && <svg xmlns="http://www.w3.org/2000/svg" width="1.30vh" height="1.30vh" viewBox="0 0 20 20" fill="none">
                                        <path d="M19.3333 2.66956H13.2667C13.1137 1.91616 12.7048 1.23882 12.1095 0.752297C11.5142 0.265777 10.7689 0 10 0C9.2311 0 8.48584 0.265777 7.89049 0.752297C7.29515 1.23882 6.88634 1.91616 6.73333 2.66956H0.666667C0.489856 2.66956 0.320286 2.73979 0.195262 2.86479C0.0702379 2.9898 0 3.15934 0 3.33612C0 3.5129 0.0702379 3.68244 0.195262 3.80744C0.320286 3.93245 0.489856 4.00267 0.666667 4.00267H19.3333C19.5101 4.00267 19.6797 3.93245 19.8047 3.80744C19.9298 3.68244 20 3.5129 20 3.33612C20 3.15934 19.9298 2.9898 19.8047 2.86479C19.6797 2.73979 19.5101 2.66956 19.3333 2.66956ZM10 1.33645C10.4126 1.33761 10.8148 1.46635 11.1514 1.70502C11.488 1.94368 11.7425 2.28059 11.88 2.66956H8.12C8.25754 2.28059 8.51205 1.94368 8.84862 1.70502C9.1852 1.46635 9.58737 1.33761 10 1.33645ZM16.92 5.38911C16.7986 5.33806 16.6648 5.32412 16.5355 5.34903C16.4061 5.37394 16.2871 5.43659 16.1933 5.52908C16.1315 5.59137 16.0827 5.66523 16.0495 5.74644C16.0163 5.82766 15.9995 5.91462 16 6.00234C16 6.17912 16.0702 6.34866 16.1953 6.47366C16.3203 6.59867 16.4899 6.66889 16.6667 6.66889C16.8435 6.66889 17.013 6.59867 17.1381 6.47366C17.2631 6.34866 17.3333 6.17912 17.3333 6.00234C17.3309 5.82586 17.2618 5.65682 17.14 5.52908C17.0766 5.4684 17.0018 5.42083 16.92 5.38911ZM16.6667 8.002C16.4899 8.002 16.3203 8.07223 16.1953 8.19724C16.0702 8.32224 16 8.49178 16 8.66856V10.6682C16 10.845 16.0702 11.0145 16.1953 11.1396C16.3203 11.2646 16.4899 11.3348 16.6667 11.3348C16.8435 11.3348 17.013 11.2646 17.1381 11.1396C17.2631 11.0145 17.3333 10.845 17.3333 10.6682V8.66856C17.3333 8.49178 17.2631 8.32224 17.1381 8.19724C17.013 8.07223 16.8435 8.002 16.6667 8.002ZM16.6667 12.6679C16.4899 12.6679 16.3203 12.7381 16.1953 12.8631C16.0702 12.9881 16 13.1577 16 13.3344V18.0003C16 18.1771 15.9298 18.3467 15.8047 18.4717C15.6797 18.5967 15.5101 18.6669 15.3333 18.6669H4.66667C4.48986 18.6669 4.32029 18.5967 4.19526 18.4717C4.07024 18.3467 4 18.1771 4 18.0003V6.00234C4 5.82556 3.92976 5.65602 3.80474 5.53101C3.67971 5.40601 3.51014 5.33578 3.33333 5.33578C3.15652 5.33578 2.98695 5.40601 2.86193 5.53101C2.7369 5.65602 2.66667 5.82556 2.66667 6.00234V18.0003C2.66667 18.5307 2.87738 19.0393 3.25245 19.4143C3.62753 19.7893 4.13623 20 4.66667 20H15.3333C15.8638 20 16.3725 19.7893 16.7475 19.4143C17.1226 19.0393 17.3333 18.5307 17.3333 18.0003V13.3344C17.3333 13.1577 17.2631 12.9881 17.1381 12.8631C17.013 12.7381 16.8435 12.6679 16.6667 12.6679Z" fill="#D9D9D9" />
                                        <path d="M7.33333 15.3341V6.66889C7.33333 6.49211 7.2631 6.32257 7.13807 6.19757C7.01305 6.07257 6.84348 6.00234 6.66667 6.00234C6.48986 6.00234 6.32029 6.07257 6.19526 6.19757C6.07024 6.32257 6 6.49211 6 6.66889V15.3341C6 15.5109 6.07024 15.6804 6.19526 15.8054C6.32029 15.9304 6.48986 16.0007 6.66667 16.0007C6.84348 16.0007 7.01305 15.9304 7.13807 15.8054C7.2631 15.6804 7.33333 15.5109 7.33333 15.3341ZM10.6667 15.3341V6.66889C10.6667 6.49211 10.5964 6.32257 10.4714 6.19757C10.3464 6.07257 10.1768 6.00234 10 6.00234C9.82319 6.00234 9.65362 6.07257 9.5286 6.19757C9.40357 6.32257 9.33333 6.49211 9.33333 6.66889V15.3341C9.33333 15.5109 9.40357 15.6804 9.5286 15.8054C9.65362 15.9304 9.82319 16.0007 10 16.0007C10.1768 16.0007 10.3464 15.9304 10.4714 15.8054C10.5964 15.6804 10.6667 15.5109 10.6667 15.3341ZM14 15.3341V6.66889C14 6.49211 13.9298 6.32257 13.8047 6.19757C13.6797 6.07257 13.5101 6.00234 13.3333 6.00234C13.1565 6.00234 12.987 6.07257 12.8619 6.19757C12.7369 6.32257 12.6667 6.49211 12.6667 6.66889V15.3341C12.6667 15.5109 12.7369 15.6804 12.8619 15.8054C12.987 15.9304 13.1565 16.0007 13.3333 16.0007C13.5101 16.0007 13.6797 15.9304 13.8047 15.8054C13.9298 15.6804 14 15.5109 14 15.3341Z" fill="#D9D9D9" />
                                    </svg>}
                                </div>
                            </div>
                        )
                    })}
                </div>
                <Transition
                    mounted={showAddRintone}
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
                            setShowAddRintone(false);
                        }} className="cancelButton">
                            Cancel
                        </div>
                        <div onClick={async () => {
                            setShowAddRintone(false);
                            if (addRintone === '' || !addRintone.endsWith('.mp3')) {
                                return;
                            }

                            const dataX = {
                                ...phoneSettings,
                                ringtone: {
                                    current: phoneSettings.ringtone.current,
                                    ringtones: [
                                        ...phoneSettings.ringtone.ringtones,
                                        {
                                            name: 'Custom Ringtone',
                                            url: addRintone
                                        }
                                    ]
                                }
                            }
                            setPhoneSettings(dataX);
                            await fetchNui('setSettings', JSON.stringify(dataX));
                        }} className="cancelButton" style={{
                            color: '#0A84FF',
                            marginBottom: '0.89vh',
                        }}>
                            Save
                        </div>
                        <div className="inputPage">
                            <div className="title">Add New Ringtone</div>
                            <TextInput value={addRintone} onChange={(e) => {
                                setAddRintone(e.currentTarget.value);
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