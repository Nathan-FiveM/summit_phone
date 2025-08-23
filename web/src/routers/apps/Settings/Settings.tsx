import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Title from "../../components/Title";
import Searchbar from "../../components/SearchBar";
import { Avatar } from "@mantine/core";
import CustomSwitch from "../../components/CustomSwitch";
import { fetchNui } from "../../../hooks/fetchNui";
import SoundPage from "./SoundPage";
import WallpaperPage from "./WallpaperPage";
import LockWallpaperPage from "./LockWallpaperPage";
import FacePass from "./FacePass";
import AboutPage from "./AboutPage";
import { useLocalStorage } from "@mantine/hooks";

export default function Settings(props: { onExit: () => void, onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setPhoneSettings, setLocation } = usePhone();
    const [searchValue, setSearchValue] = useState('');
    const [streamerMode, setStreamerMode] = useState(false);
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
    const [militaryTime, setMilitaryTime] = useLocalStorage<boolean>({
        key: 'militaryTime',
        defaultValue: true
    });
    const [notificationsEnabled, setNotificationsEnabled] = useLocalStorage<boolean>({
        key: 'notificationsEnabled',
        defaultValue: true
    });
    return (
        <CSSTransition nodeRef={nodeRef} in={location.app === 'settings'} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {
            props.onEnter();
            const res = await fetchNui('getStreamerMode');
            const newRes = await fetchNui('getPhonePlayerCard', "Ok");
            const parseData = JSON.parse(newRes as string);
            setNewParsedData(parseData);
            if (res === null || res === 'null' || res === 'false') {
                setStreamerMode(false);
            } else {
                setStreamerMode(true);
            }
        }} onExited={() => {
            props.onExit();
        }}>
            <div ref={nodeRef} style={{
                backgroundColor: '#0E0E0E',
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
            }} className="settings">
                <div style={{
                    marginLeft: '1.42vh',
                    marginTop: '4.44vh',
                    letterSpacing: '0.12vh',
                }}>
                    <Title title="Settings" fontSize="3.38vh" />
                    <Searchbar value={searchValue} onChange={(e) => {
                        setSearchValue(e);
                    }} mt="0.36vh" />
                </div>
                <div className="card">
                    <Avatar size={'5.08vh'} src={newParsedData.avatar ?? "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} />
                    <div className="NameAndBottoer">
                        <div className="name">{newParsedData.firstName}'s Phone</div>
                        <div className="small">Cloud backup</div>
                    </div>
                    <div className="right">
                        <svg className='clickanimationXl' xmlns="http://www.w3.org/2000/svg" width="0.74vh" height="1.57vh" viewBox="0 0 8 17" fill="none">
                            <path d="M1 1L6.65017 8.06271C6.85469 8.31837 6.85469 8.68163 6.65017 8.93729L1 16" stroke="white" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </div>
                </div>
                <div style={{
                    overflowY: 'auto',
                    maxHeight: '42.5vh',
                }}>
                    <div className="innerCont">
                        <div className="conta1">
                            <div className="innerConta1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="2.41vh" height="2.41vh" viewBox="0 0 23 23" fill="none">
                                    <rect width="23" height="23" rx="4" fill="#FFA600" />
                                    <path d="M17.418 10.7826C17.2966 10.7826 16.8895 10.7864 16.7752 10.794L14.4575 10.8587C14.4325 10.8587 14.4075 10.8473 14.3967 10.8245L10.9219 5.28152C10.8184 5.10652 10.6327 5 10.4398 5H9.59345C9.39346 5 9.32561 5.21304 9.39703 5.41087L11.1862 10.8435C11.2041 10.8929 11.1719 10.9462 11.1219 10.9462L6.75076 11.0147C6.6579 11.0185 6.5722 10.9728 6.51506 10.8967L5.1937 9.18478C5.08657 9.03641 4.91872 8.95272 4.74373 8.95272H4.14376C4.04377 8.95272 3.97591 9.05543 4.00806 9.15435L4.71873 11.7679C4.7723 11.9125 4.7723 12.0761 4.71873 12.2207L4.00806 14.8342C3.97591 14.9332 4.04377 15.0359 4.14376 15.0359H4.74016C4.91515 15.0359 5.08299 14.9484 5.19013 14.8038L6.53648 13.0652C6.59362 12.9891 6.6829 12.9435 6.77218 12.9473L11.1184 13.05C11.1684 13.0538 11.2005 13.1033 11.1826 13.1527L9.39346 18.5891C9.32204 18.787 9.38989 19 9.58988 19H10.4363C10.6327 19 10.8148 18.8935 10.9184 18.7185L14.3967 13.1793C14.411 13.1565 14.4325 13.1451 14.4575 13.1451L16.7752 13.2098C16.893 13.2174 17.2966 13.2212 17.418 13.2212C19.0001 13.2212 20 12.6772 20 12.0038C20 11.3304 19.0036 10.7826 17.418 10.7826Z" fill="white" />
                                </svg>
                                <div className="textConta">
                                    <div className="text1">
                                        Airplane Mode
                                    </div>
                                    <div className="text2">
                                        Disable calls, cellular data etc.
                                    </div>
                                </div>
                            </div>
                            <CustomSwitch switchValue={phoneSettings.isFlightMode} setSwitchValue={async (e) => {
                                const data = {
                                    ...phoneSettings,
                                    isFlightMode: e,
                                }
                                setPhoneSettings(data);
                                await fetchNui('setSettings', JSON.stringify(data));
                            }} />
                        </div>
                        <div className="divider" style={{
                            marginTop: '0.27vh',
                            marginBottom: '0.27vh',
                        }}></div>
                        <div className="conta1">
                            <div className="innerConta1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="2.41vh" height="2.41vh" viewBox="0 0 23 23" fill="none">
                                    <rect width="23" height="23" rx="4" fill="#7E00EC" />
                                    <path d="M12.6101 7H5.84502C5.35569 7 4.8864 7.19754 4.54039 7.54917C4.19439 7.9008 4 8.37772 4 8.875V15.125C4 15.6223 4.19439 16.0992 4.54039 16.4508C4.8864 16.8025 5.35569 17 5.84502 17H12.6101C13.0994 17 13.5687 16.8025 13.9147 16.4508C14.2607 16.0992 14.4551 15.6223 14.4551 15.125V8.875C14.4551 8.37772 14.2607 7.9008 13.9147 7.54917C13.5687 7.19754 13.0994 7 12.6101 7ZM15.3961 11.1312L17.9606 8.63125C18.0476 8.54697 18.157 8.49045 18.2753 8.46865C18.3935 8.44686 18.5155 8.46076 18.626 8.50863C18.7366 8.55651 18.831 8.63625 18.8974 8.73802C18.9639 8.83979 18.9995 8.95911 19 9.08125V14.925C18.9996 15.0464 18.9644 15.1651 18.8987 15.2666C18.833 15.368 18.7397 15.4478 18.6301 15.4962C18.5205 15.5446 18.3994 15.5595 18.2816 15.5391C18.1638 15.5187 18.0544 15.4638 17.9668 15.3813L15.4084 12.9375C15.2876 12.8217 15.1911 12.6821 15.1248 12.5274C15.0585 12.3726 15.0237 12.2058 15.0226 12.037C15.0214 11.8683 15.0539 11.701 15.1181 11.5453C15.1823 11.3896 15.2769 11.2488 15.3961 11.1312Z" fill="white" />
                                </svg>
                                <div className="textConta">
                                    <div className="text1">
                                        Streamer mode
                                    </div>
                                    <div className="text2">
                                        Blurs Sensitive Information.
                                    </div>
                                </div>
                            </div>
                            <CustomSwitch switchValue={streamerMode} setSwitchValue={(e) => {
                                setStreamerMode(e);
                                fetchNui('setStreamerMode', e);
                            }} />
                        </div>
                        <div className="divider" style={{
                            marginTop: '0.27vh',
                            marginBottom: '0.27vh',
                        }}></div>
                        <div className="conta1">
                            <div className="innerConta1">
                                <svg width="2.41vh" height="2.41vh" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="23" height="23" rx="4" fill="#00ECD8" />
                                    <path d="M11.5 15.4112V11.8L13.3056 10.7167M18 11.8C18 15.3899 15.0899 18.3 11.5 18.3C7.91015 18.3 5 15.3899 5 11.8C5 8.2102 7.91015 5.30005 11.5 5.30005C15.0899 5.30005 18 8.2102 18 11.8Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                                </svg>
                                <div className="textConta">
                                    <div className="text1">
                                        Military Time
                                    </div>
                                    <div className="text2">
                                        Change the time format to 24-hour or 12-hour.
                                    </div>
                                </div>
                            </div>
                            <CustomSwitch switchValue={militaryTime} setSwitchValue={(e) => {
                                setMilitaryTime(e);
                            }} />
                        </div>
                        <div className="divider" style={{
                            marginTop: '0.27vh',
                            marginBottom: '0.27vh',
                        }}></div>
                        <div className="conta1">
                            <div className="innerConta1">
                                <svg width="2.41vh" height="2.41vh" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="23" height="23" rx="4" fill="#00EC62" />
                                    <path d="M16.5695 13.1185L15.9195 12.0395C15.783 11.799 15.6595 11.344 15.6595 11.0775V9.433C15.6595 7.9055 14.7624 6.586 13.4688 5.9685C13.1308 5.3705 12.5068 5 11.7917 5C11.0832 5 10.4462 5.3835 10.1081 5.988C8.84055 6.6185 7.96299 7.925 7.96299 9.433V11.0775C7.96299 11.344 7.83948 11.799 7.70297 12.033L7.04643 13.1185C6.78641 13.554 6.72791 14.035 6.89042 14.477C7.04643 14.9125 7.41695 15.2505 7.89798 15.413C9.15907 15.842 10.4852 16.05 11.8112 16.05C13.1373 16.05 14.4634 15.842 15.7245 15.4195C16.1795 15.27 16.5305 14.9255 16.6995 14.477C16.8685 14.0285 16.823 13.5345 16.5695 13.1185Z" fill="white" />
                                    <path d="M13.6377 16.7065C13.3647 17.4605 12.6431 18 11.7981 18C11.2845 18 10.7775 17.792 10.42 17.4215C10.212 17.2265 10.056 16.9665 9.96496 16.7C10.0495 16.713 10.134 16.7195 10.225 16.7325C10.3745 16.752 10.5305 16.7715 10.6865 16.7845C11.057 16.817 11.4341 16.8365 11.8111 16.8365C12.1816 16.8365 12.5521 16.817 12.9162 16.7845C13.0527 16.7715 13.1892 16.765 13.3192 16.7455C13.4232 16.7325 13.5272 16.7195 13.6377 16.7065Z" fill="white" />
                                </svg>
                                <div className="textConta">
                                    <div className="text1">
                                        Toggle Notiication
                                    </div>
                                    <div className="text2">
                                        Enable or disable notifications.
                                    </div>
                                </div>
                            </div>
                            <CustomSwitch switchValue={notificationsEnabled} setSwitchValue={(e) => {
                                setNotificationsEnabled(e);
                            }} />
                        </div>
                    </div>
                    <div className="innerCont" style={{ marginTop: '1.78vh' }}>
                        <div className="conta1">
                            <div className="innerConta1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="2.41vh" height="2.41vh" viewBox="0 0 23 23" fill="none">
                                    <rect width="23" height="23" rx="4" fill="#FF6200" />
                                    <path d="M11.1111 15.2742H8.38889C8.175 15.2742 8 15.0855 8 14.8548V8.14516C8 7.91451 8.175 7.7258 8.38889 7.7258H11.1111" fill="white" />
                                    <path d="M10.1389 8.56452C10.1389 8.56452 13.8139 5 14.0278 5H14.6111C14.825 5 15 5.18871 15 5.41935V17.5806C15 17.8113 14.825 18 14.6111 18H14.0278C13.8139 18 10.1389 14.4355 10.1389 14.4355" fill="white" />
                                </svg>
                                <div className="textConta" style={{
                                    cursor: 'pointer',
                                }} onClick={() => {
                                    const data = {
                                        ...location.page,
                                        settings: 'sounds'
                                    }
                                    setLocation({
                                        app: 'settings',
                                        page: data
                                    });
                                }}>
                                    <div className="text1">
                                        Sounds & Ringtones
                                    </div>
                                    <div className="text2">
                                        Change Ringtone, Volumes, etc.
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                width: '1.48vh',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: '0.93vh',
                                flexShrink: 0
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="0.74vh" height="1.67vh" viewBox="0 0 8 18" fill="none">
                                    <path d="M1 1.5L6.65017 8.56271C6.85469 8.81837 6.85469 9.18163 6.65017 9.43729L1 16.5" stroke="white" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                        <div className="divider" style={{
                            marginTop: '0.27vh',
                            marginBottom: '0.27vh',
                        }}></div>
                        <div className="conta1">
                            <div className="innerConta1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="2.41vh" height="2.41vh" viewBox="0 0 23 23" fill="none">
                                    <rect width="23" height="23" rx="4" fill="#00D0FF" />
                                    <path d="M13.5715 12.9015L13.675 13.0111L17.875 17.7114V13.3991C17.875 13.2471 17.9292 13.1007 18.0265 12.9897C18.1238 12.8786 18.257 12.8111 18.3992 12.8007C18.5413 12.7903 18.6819 12.8379 18.7925 12.9339C18.903 13.0298 18.9753 13.1669 18.9948 13.3175L19 13.3991V17.8002C19 18.3604 18.7997 18.8995 18.4398 19.3075C18.08 19.7155 17.5877 19.9618 17.0635 19.996L16.9375 20H12.8125C12.67 20 12.5328 19.9422 12.4287 19.8384C12.3245 19.7347 12.2612 19.5926 12.2515 19.441C12.2418 19.2893 12.2864 19.1394 12.3763 19.0215C12.4663 18.9035 12.5948 18.8264 12.736 18.8057L12.8125 18.8001H16.7755L12.589 14.1142C12.3214 13.8145 11.9553 13.6371 11.5676 13.6192C11.18 13.6013 10.8009 13.7443 10.51 14.0182L10.417 14.115L6.2335 18.8001H10.1875L10.264 18.8057C10.3986 18.8255 10.522 18.8966 10.6113 19.0058C10.7006 19.1151 10.7498 19.2551 10.7498 19.4001C10.7498 19.545 10.7006 19.6851 10.6113 19.7943C10.522 19.9036 10.3986 19.9746 10.264 19.9944L10.1875 20H6.0625L5.9365 19.996C5.4348 19.9634 4.96155 19.7364 4.60565 19.3579C4.24976 18.9793 4.03572 18.4752 4.00375 17.9402L4 17.7994V13.3999L4.00525 13.3183C4.02377 13.1747 4.09042 13.0431 4.19285 12.9478C4.29529 12.8526 4.4266 12.8001 4.5625 12.8001C4.6984 12.8001 4.82971 12.8526 4.93215 12.9478C5.03458 13.0431 5.10123 13.1747 5.11975 13.3183L5.125 13.3999V17.7226L9.33025 13.0127C9.87896 12.3982 10.6341 12.0414 11.4294 12.0207C12.2248 12 12.9953 12.3171 13.5715 12.9023V12.9015ZM10.1875 4C10.33 4.00005 10.4672 4.05779 10.5713 4.16156C10.6755 4.26533 10.7388 4.4074 10.7485 4.55905C10.7582 4.7107 10.7136 4.86063 10.6237 4.97854C10.5337 5.09646 10.4052 5.17356 10.264 5.19428L10.1875 5.19988H6.0625C5.83052 5.19975 5.60674 5.29135 5.43441 5.45698C5.26208 5.6226 5.15344 5.85049 5.1295 6.09659L5.125 6.19898V10.6001C5.12496 10.7521 5.07082 10.8985 4.97352 11.0095C4.87622 11.1206 4.74303 11.1881 4.60084 11.1985C4.45865 11.2089 4.31808 11.1613 4.20753 11.0653C4.09697 10.9694 4.02468 10.8323 4.00525 10.6817L4 10.6001V6.20058C3.99997 5.64041 4.20032 5.10132 4.56017 4.69329C4.92002 4.28526 5.41227 4.03902 5.9365 4.0048L6.0625 4.0008H10.1875V4ZM16.9375 4L17.0635 4.004C17.5652 4.03664 18.0385 4.26355 18.3943 4.64211C18.7502 5.02066 18.9643 5.52479 18.9963 6.05979L19 6.20058V10.6017L18.9948 10.6833C18.9762 10.8269 18.9096 10.9585 18.8071 11.0538C18.7047 11.149 18.5734 11.2015 18.4375 11.2015C18.3016 11.2015 18.1703 11.149 18.0679 11.0538C17.9654 10.9585 17.8988 10.8269 17.8802 10.6833L17.875 10.6017V6.20058L17.8705 6.09819C17.8485 5.86943 17.7533 5.65574 17.6008 5.49313C17.4483 5.33052 17.248 5.22893 17.0335 5.20548L16.9375 5.20068H12.8125L12.736 5.19508C12.6014 5.17532 12.478 5.10425 12.3887 4.99499C12.2994 4.88573 12.2502 4.74569 12.2502 4.60074C12.2502 4.45579 12.2994 4.31575 12.3887 4.20649C12.478 4.09723 12.6014 4.02616 12.736 4.0064L12.8125 4.0008H16.9375V4ZM14.5023 7.19968C14.9001 7.19968 15.2816 7.36823 15.5629 7.66826C15.8442 7.96829 16.0023 8.37522 16.0023 8.79952C16.0023 9.22382 15.8442 9.63075 15.5629 9.93078C15.2816 10.2308 14.9001 10.3994 14.5023 10.3994C14.1044 10.3994 13.7229 10.2308 13.4416 9.93078C13.1603 9.63075 13.0022 9.22382 13.0022 8.79952C13.0022 8.37522 13.1603 7.96829 13.4416 7.66826C13.7229 7.36823 14.1044 7.19968 14.5023 7.19968Z" fill="white" />
                                </svg>
                                <div className="textConta" style={{
                                    cursor: 'pointer',
                                }} onClick={() => {
                                    const data = {
                                        ...location.page,
                                        settings: 'wallpaper'
                                    }
                                    setLocation({
                                        app: 'settings',
                                        page: data
                                    });
                                }}>
                                    <div className="text1">
                                        Wallpaper
                                    </div>
                                    <div className="text2">
                                        Change Wallpaper
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                width: '1.48vh',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: '0.93vh',
                                flexShrink: 0
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="0.74vh" height="1.67vh" viewBox="0 0 8 18" fill="none">
                                    <path d="M1 1.5L6.65017 8.56271C6.85469 8.81837 6.85469 9.18163 6.65017 9.43729L1 16.5" stroke="white" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                        <div className="divider" style={{
                            marginTop: '0.27vh',
                            marginBottom: '0.27vh',
                        }}></div>
                        <div className="conta1">
                            <div className="innerConta1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="2.41vh" height="2.41vh" viewBox="0 0 23 23" fill="none">
                                    <rect width="23" height="23" rx="4" fill="#F7345E" />
                                    <path d="M12.8752 12.3048L12.9712 12.4009L14.4066 14.4805C14.6112 14.777 14.5345 15.1852 14.2365 15.3855C13.9553 15.5746 13.5768 15.5103 13.3725 15.2389L11.9642 13.3681C11.716 13.1053 11.3766 12.9498 11.0171 12.9341C10.6576 12.9184 10.3061 13.0438 10.0364 13.284L9.95017 13.3688L6.07101 17.4767H9.73736L9.8083 17.4817C9.93314 17.499 10.0475 17.5613 10.1303 17.6571C10.2132 17.7529 10.2588 17.8757 10.2588 18.0028C10.2588 18.1299 10.2132 18.2527 10.1303 18.3485C10.0475 18.4442 9.93314 18.5066 9.8083 18.5239L9.73736 18.5288H5.91245L5.79562 18.5253C5.33042 18.4967 4.8916 18.2977 4.56159 17.9658C4.23159 17.6339 4.03312 17.1919 4.00348 16.7228L4 16.5993V12.7418L4.00487 12.6703C4.02204 12.5444 4.08384 12.429 4.17882 12.3455C4.27381 12.2619 4.39556 12.2159 4.52158 12.2159C4.64759 12.2159 4.76935 12.2619 4.86433 12.3455C4.95932 12.429 5.02111 12.5444 5.03829 12.6703L5.04316 12.7418V16.532L8.94248 12.4023C9.45127 11.8636 10.1514 11.5507 10.889 11.5325C11.6265 11.5144 12.3409 11.7924 12.8752 12.3055V12.3048ZM9.73736 4.5C9.86951 4.50004 9.99672 4.55067 10.0933 4.64166C10.1898 4.73264 10.2486 4.85721 10.2576 4.99017C10.2666 5.12314 10.2252 5.2546 10.1418 5.35799C10.0584 5.46137 9.93921 5.52898 9.8083 5.54715L9.73736 5.55205H5.91245C5.69735 5.55194 5.48985 5.63225 5.33005 5.77748C5.17026 5.9227 5.06953 6.12251 5.04733 6.33829L5.04316 6.42807V10.287C5.04312 10.4203 4.99292 10.5486 4.9027 10.646C4.81248 10.7433 4.68897 10.8026 4.55713 10.8116C4.42529 10.8207 4.29494 10.779 4.19243 10.6949C4.08992 10.6108 4.02288 10.4906 4.00487 10.3585L4 10.287V6.42947C3.99998 5.93831 4.18575 5.46564 4.51942 5.10788C4.85309 4.75012 5.30952 4.53421 5.79562 4.50421L5.91245 4.5007H9.73736V4.5ZM15.9963 4.5L16.1131 4.50351C16.5783 4.53212 17.0172 4.73108 17.3472 5.063C17.6772 5.39491 17.8756 5.83694 17.9053 6.30603L17.9088 6.42947V10.2884L17.9039 10.3599C17.8867 10.4858 17.8249 10.6012 17.7299 10.6847C17.635 10.7683 17.5132 10.8143 17.3872 10.8143C17.2612 10.8143 17.1394 10.7683 17.0444 10.6847C16.9494 10.6012 16.8876 10.4858 16.8705 10.3599L16.8656 10.2884V6.42947L16.8614 6.33969C16.841 6.13911 16.7527 5.95175 16.6114 5.80918C16.47 5.6666 16.2842 5.57753 16.0853 5.55696L15.9963 5.55276H12.1714L12.1005 5.54785C11.9756 5.53052 11.8612 5.4682 11.7784 5.37241C11.6956 5.27661 11.65 5.15382 11.65 5.02673C11.65 4.89964 11.6956 4.77685 11.7784 4.68105C11.8612 4.58525 11.9756 4.52293 12.1005 4.50561L12.1714 4.5007H15.9963V4.5ZM13.7382 7.30548C14.1071 7.30548 14.4609 7.45327 14.7217 7.71633C14.9826 7.9794 15.1291 8.33619 15.1291 8.70822C15.1291 9.08025 14.9826 9.43704 14.7217 9.70011C14.4609 9.96317 14.1071 10.111 13.7382 10.111C13.3693 10.111 13.0156 9.96317 12.7547 9.70011C12.4939 9.43704 12.3473 9.08025 12.3473 8.70822C12.3473 8.33619 12.4939 7.9794 12.7547 7.71633C13.0156 7.45327 13.3693 7.30548 13.7382 7.30548Z" fill="white" />
                                    <path d="M14.4365 16.2546C14.4365 15.839 14.7341 15.4903 15.1181 15.4903H15.3625V14.4879C15.3625 13.3893 16.1941 12.4863 17.218 12.4863C18.2379 12.4863 19.0677 13.3755 19.0743 14.4778C19.0745 14.4822 19.074 15.4904 19.074 15.4904H19.2896C19.6736 15.4904 20 15.839 20 16.2547V18.7634C20 19.179 19.6736 19.5 19.2896 19.5H15.1181C14.7341 19.5 14.4365 19.179 14.4365 18.7634L14.4365 16.2546ZM17.6754 16.9759C17.6754 16.6988 17.4638 16.4742 17.2078 16.4742C16.9519 16.4742 16.7487 16.6988 16.7487 16.9759C16.7487 17.1615 16.8441 17.3232 16.9849 17.41V17.7285C16.9849 17.8671 17.0902 17.9794 17.2182 17.9794C17.3462 17.9794 17.4516 17.8671 17.4516 17.7285V17.41C17.5627 17.3232 17.6754 17.1615 17.6754 16.9759ZM18.1479 14.4877C18.1479 13.9504 17.7292 13.4898 17.218 13.4898C16.7082 13.4898 16.2915 13.917 16.2893 14.4683C16.2893 14.4698 16.2885 14.4879 16.2885 14.4879V15.4903H18.148L18.1479 14.4877Z" fill="white" />
                                </svg>
                                <div className="textConta" style={{
                                    cursor: 'pointer',
                                }} onClick={() => {
                                    const data = {
                                        ...location.page,
                                        settings: 'lockwallpaper'
                                    }
                                    setLocation({
                                        app: 'settings',
                                        page: data
                                    });
                                }}>
                                    <div className="text1">
                                        Lockscreen Wallpaper
                                    </div>
                                    <div className="text2">
                                        Change Lockscreen Wallpaper
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                width: '1.48vh',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: '0.93vh',
                                flexShrink: 0
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="0.74vh" height="1.67vh" viewBox="0 0 8 18" fill="none">
                                    <path d="M1 1.5L6.65017 8.56271C6.85469 8.81837 6.85469 9.18163 6.65017 9.43729L1 16.5" stroke="white" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                        <div className="divider" style={{
                            marginTop: '0.27vh',
                            marginBottom: '0.27vh',
                        }}></div>
                        <div className="conta1">
                            <div className="innerConta1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="2.41vh" height="2.41vh" viewBox="0 0 23 23" fill="none">
                                    <rect width="23" height="23" rx="4" fill="#7E00EC" />
                                    <path d="M17.5855 9.15429C17.8618 9.15429 18 9.01151 18 8.72594V6.97856C18 6.3213 17.8324 5.82723 17.4971 5.49634C17.1619 5.16545 16.6635 5 16.0021 5H14.2556C13.9702 5 13.8275 5.13825 13.8275 5.41475C13.8275 5.69578 13.9702 5.8363 14.2556 5.8363H15.9817C16.3668 5.8363 16.6613 5.93602 16.8651 6.13546C17.0645 6.3349 17.1641 6.6318 17.1641 7.02615V8.72594C17.1641 9.01151 17.3046 9.15429 17.5855 9.15429ZM5.42133 9.15429C5.69768 9.15429 5.83586 9.01151 5.83586 8.72594V7.02615C5.83586 6.6318 5.94006 6.3349 6.14846 6.13546C6.35686 5.93602 6.64907 5.8363 7.02509 5.8363H8.74438C9.0298 5.8363 9.1725 5.69578 9.1725 5.41475C9.1725 5.13825 9.0298 5 8.74438 5H7.0047C6.33873 5 5.83813 5.16771 5.50287 5.50314C5.16762 5.83403 5 6.32584 5 6.97856V8.72594C5 9.01151 5.14044 9.15429 5.42133 9.15429ZM16.0021 18C16.6635 18 17.1619 17.8323 17.4971 17.4969C17.8324 17.166 18 16.6719 18 16.0146V14.2741C18 13.9885 17.8618 13.8457 17.5855 13.8457C17.3046 13.8457 17.1641 13.9885 17.1641 14.2741V15.9738C17.1641 16.3682 17.0645 16.6651 16.8651 16.8645C16.6613 17.064 16.3668 17.1637 15.9817 17.1637H14.2556C13.9702 17.1637 13.8275 17.3042 13.8275 17.5853C13.8275 17.8618 13.9702 18 14.2556 18H16.0021ZM8.74438 18C9.0298 18 9.1725 17.8618 9.1725 17.5853C9.1725 17.3042 9.0298 17.1637 8.74438 17.1637H7.02509C6.64907 17.1637 6.35686 17.064 6.14846 16.8645C5.94006 16.6651 5.83586 16.3682 5.83586 15.9738V14.2741C5.83586 13.9885 5.69768 13.8457 5.42133 13.8457C5.14044 13.8457 5 13.9885 5 14.2741V16.0146C5 16.6719 5.16762 17.166 5.50287 17.4969C5.83813 17.8323 6.33873 18 7.0047 18H8.74438ZM14.0246 10.9561C14.156 10.9561 14.2647 10.9153 14.3508 10.8337C14.4323 10.7521 14.4731 10.641 14.4731 10.5005V9.58264C14.4731 9.44665 14.4323 9.33787 14.3508 9.25628C14.2647 9.17015 14.156 9.12709 14.0246 9.12709C13.8932 9.12709 13.7845 9.17015 13.6984 9.25628C13.6123 9.33787 13.5693 9.44665 13.5693 9.58264V10.5005C13.5693 10.641 13.6123 10.7521 13.6984 10.8337C13.7845 10.9153 13.8932 10.9561 14.0246 10.9561ZM12.0538 12.5471C12.1943 12.5471 12.303 12.5153 12.38 12.4519C12.457 12.3839 12.4956 12.2932 12.4956 12.1799C12.4956 12.0802 12.4638 11.9986 12.4004 11.9351C12.3325 11.8672 12.2486 11.8332 12.149 11.8332H11.9179C11.8681 11.8332 11.8251 11.8173 11.7888 11.7856C11.748 11.7538 11.7277 11.7062 11.7277 11.6428V9.46705C11.7277 9.35826 11.6959 9.27441 11.6325 9.21548C11.5691 9.15202 11.4853 9.12029 11.3811 9.12029C11.2723 9.12029 11.1863 9.15202 11.1228 9.21548C11.0594 9.27441 11.0277 9.35826 11.0277 9.46705V11.5816C11.0277 11.8989 11.1093 12.1391 11.2723 12.3023C11.4354 12.4655 11.6756 12.5471 11.9927 12.5471C12.0017 12.5471 12.0131 12.5471 12.0267 12.5471C12.0357 12.5471 12.0448 12.5471 12.0538 12.5471ZM9.0162 10.9561C9.15212 10.9561 9.26085 10.9153 9.34239 10.8337C9.42394 10.7521 9.46472 10.641 9.46472 10.5005V9.58264C9.46472 9.44665 9.42394 9.33787 9.34239 9.25628C9.26085 9.17015 9.15212 9.12709 9.0162 9.12709C8.88482 9.12709 8.77836 9.17015 8.69681 9.25628C8.61073 9.33787 8.56769 9.44665 8.56769 9.58264V10.5005C8.56769 10.641 8.61073 10.7521 8.69681 10.8337C8.77836 10.9153 8.88482 10.9561 9.0162 10.9561ZM11.551 14.7432C11.9451 14.7432 12.3347 14.6661 12.7198 14.512C13.1049 14.3534 13.4311 14.1245 13.6984 13.8253C13.7346 13.7891 13.7641 13.7505 13.7867 13.7097C13.8048 13.6644 13.8139 13.6168 13.8139 13.5669C13.8139 13.4627 13.7799 13.3788 13.712 13.3154C13.644 13.2519 13.5602 13.2202 13.4605 13.2202C13.3971 13.2202 13.345 13.2338 13.3042 13.261C13.2589 13.2882 13.2114 13.3244 13.1615 13.3698C12.9622 13.5737 12.7175 13.7369 12.4276 13.8593C12.1377 13.9817 11.8454 14.0429 11.551 14.0429C11.2384 14.0429 10.9394 13.9817 10.6539 13.8593C10.364 13.7324 10.1216 13.5692 9.92682 13.3698C9.83168 13.27 9.73427 13.2202 9.63461 13.2202C9.53947 13.2202 9.45792 13.2519 9.38996 13.3154C9.32201 13.3788 9.28803 13.4627 9.28803 13.5669C9.28803 13.6259 9.29709 13.678 9.31521 13.7233C9.33333 13.7641 9.35825 13.8004 9.38996 13.8321C9.67991 14.1177 10.0152 14.342 10.3957 14.5052C10.7717 14.6639 11.1568 14.7432 11.551 14.7432Z" fill="white" />
                                </svg>
                                <div className="textConta" style={{
                                    cursor: 'pointer',
                                }} onClick={() => {
                                    const data = {
                                        ...location.page,
                                        settings: 'facepass'
                                    }
                                    setLocation({
                                        app: 'settings',
                                        page: data
                                    });
                                }}>
                                    <div className="text1">
                                        Face Lock & Passcode
                                    </div>
                                    <div className="text2">
                                        Choose your Passcode, Face unlock ..
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                width: '1.48vh',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: '0.93vh',
                                flexShrink: 0
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="0.74vh" height="1.67vh" viewBox="0 0 8 18" fill="none">
                                    <path d="M1 1.5L6.65017 8.56271C6.85469 8.81837 6.85469 9.18163 6.65017 9.43729L1 16.5" stroke="white" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="innerCont" style={{ marginTop: '1.78vh' }}>
                        <div className="conta1">
                            <div className="innerConta1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="2.41vh" height="2.41vh" viewBox="0 0 23 23" fill="none">
                                    <rect width="23" height="23" rx="4" fill="#A8A8A8" />
                                    <path d="M10.6755 8.67308C10.6755 8.85159 10.7464 9.02279 10.8726 9.14901C10.9988 9.27524 11.17 9.34615 11.3486 9.34615C11.5271 9.34615 11.6983 9.27524 11.8245 9.14901C11.9507 9.02279 12.0216 8.85159 12.0216 8.67308C12.0216 8.49457 11.9507 8.32337 11.8245 8.19714C11.6983 8.07091 11.5271 8 11.3486 8C11.17 8 10.9988 8.07091 10.8726 8.19714C10.7464 8.32337 10.6755 8.49457 10.6755 8.67308Z" fill="white" />
                                    <path d="M12.0385 14.4615V10.1538H10.4231V10.4231H10.9615V14.4615H10.4231V14.7308H12.5769V14.4615H12.0385Z" fill="white" />
                                    <path d="M11.5 4.5C7.63317 4.5 4.5 7.63317 4.5 11.5C4.5 15.3668 7.63317 18.5 11.5 18.5C15.3668 18.5 18.5 15.3668 18.5 11.5C18.5 7.63317 15.3668 4.5 11.5 4.5ZM11.5 17.9178C7.96298 17.9178 5.08221 15.0404 5.08221 11.5C5.08221 7.96298 7.95962 5.08221 11.5 5.08221C15.037 5.08221 17.9178 7.95962 17.9178 11.5C17.9178 15.037 15.037 17.9178 11.5 17.9178Z" fill="white" />
                                </svg>
                                <div className="textConta" style={{
                                    cursor: 'pointer',
                                }} onClick={() => {
                                    const data = {
                                        ...location.page,
                                        settings: 'about'
                                    }
                                    setLocation({
                                        app: 'settings',
                                        page: data
                                    });
                                }}>
                                    <div className="text1">
                                        About Phone
                                    </div>
                                    <div className="text2">
                                        Information about your phone
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                width: '1.48vh',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                gap: '0.93vh',
                                flexShrink: 0
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="0.74vh" height="1.67vh" viewBox="0 0 8 18" fill="none">
                                    <path d="M1 1.5L6.65017 8.56271C6.85469 8.81837 6.85469 9.18163 6.65017 9.43729L1 16.5" stroke="white" strokeOpacity="0.5" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
                <SoundPage />
                <WallpaperPage />
                <LockWallpaperPage />
                <FacePass />
                <AboutPage />
            </div>
        </CSSTransition>
    );
}