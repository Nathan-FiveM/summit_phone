import { Slider, TextInput, Transition } from "@mantine/core";
import { usePhone } from "../../../store/store";
import { useLocalStorage } from "@mantine/hooks";
import { useState } from "react";
import { fetchNui } from "../../../hooks/fetchNui";

export default function AboutPage() {
    const { location, phoneSettings, setLocation, setPhoneSettings } = usePhone();
    const [volume, setVolume] = useLocalStorage({
        key: 'volume',
        defaultValue: 40,
    });
    const [isPlaying, setIsPlaying] = useState(false);
    const audio = new Audio();
    function playSound(url: string) {
        if (isPlaying) {
            stopSound();
        }
        audio.src = url;
        audio.volume = volume / 100;
        audio.play();
    };
    function stopSound() {
        setIsPlaying(false);
        audio.pause();
    };
    const [showAddRintone, setShowAddRintone] = useState(false);
    const [addRintone, setAddRintone] = useState('');
    const [newParsedData, setNewParsedData] = useState<{
        firstName: string,
        lastName: string,
        phoneNumber: string,
        email: string,
        notes: string,
        avatar: string,
        _id: string
    }>({
        firstName: '',
        lastName: '',
        phoneNumber: '',
        email: '',
        notes: '',
        avatar: '',
        _id: ''
    });

    return (
        <Transition
            mounted={location.app === "settings" && location.page.settings === "about"}
            transition="fade"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {
                const newRes = await fetchNui('getPhonePlayerCard', "Ok");
                const parseData = JSON.parse(newRes as string);
                setNewParsedData(parseData);
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
                    <div className="name" style={{ marginLeft: '2.31vh' }}>About Phone</div>
                </div>
                <div className="innerCont" style={{ marginTop: '1.78vh' }}>
                    <div className="conta1">
                        <div className="innerConta1">
                            <div className="textConta" style={{
                                cursor: 'pointer',
                            }}>
                                <div className="text1">
                                    Name
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            width: 'auto',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '0.93vh',
                            fontWeight: 500,
                            flexShrink: 0
                        }}>
                            {newParsedData.firstName}'s Phone
                        </div>
                    </div>
                    <div className="divider" style={{
                        marginTop: '0.27vh',
                        marginBottom: '0.27vh',
                    }}></div>
                    <div className="conta1">
                        <div className="innerConta1">
                            <div className="textConta" style={{
                                cursor: 'pointer',
                            }}>
                                <div className="text1">
                                    Version
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            width: 'auto',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '0.93vh',
                            fontWeight: 500,
                            flexShrink: 0
                        }}>
                            v1.9.1
                        </div>
                    </div>
                    <div className="divider" style={{
                        marginTop: '0.27vh',
                        marginBottom: '0.27vh',
                    }}></div>
                    <div className="conta1">
                        <div className="innerConta1">
                            <div className="textConta" style={{
                                cursor: 'pointer',
                            }}>
                                <div className="text1">
                                    Model
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            width: 'auto',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '0.93vh',
                            fontWeight: 500,
                            flexShrink: 0
                        }}>
                            SMRT9FA
                        </div>
                    </div>
                    <div className="divider" style={{
                        marginTop: '0.27vh',
                        marginBottom: '0.27vh',
                    }}></div>
                    <div className="conta1">
                        <div className="innerConta1">
                            <div className="textConta" style={{
                                cursor: 'pointer',
                            }}>
                                <div className="text1">
                                    Serial Number
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            width: 'auto',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '0.93vh',
                            fontWeight: 500,
                            flexShrink: 0
                        }}>
                            SMRTA87955488
                        </div>
                    </div>
                    <div className="divider" style={{
                        marginTop: '0.27vh',
                        marginBottom: '0.27vh',
                    }}></div>
                    <div className="conta1">
                        <div className="innerConta1">
                            <div className="textConta" style={{
                                cursor: 'pointer',
                            }}>
                                <div className="text1">
                                    Developed By
                                </div>
                            </div>
                        </div>
                        <div style={{
                            display: 'flex',
                            width: 'auto',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: '0.93vh',
                            fontWeight: 500,
                            flexShrink: 0
                        }}>
                            Jarvis & Vector
                        </div>
                    </div>
                </div>

            </div>}
        </Transition>
    );
}