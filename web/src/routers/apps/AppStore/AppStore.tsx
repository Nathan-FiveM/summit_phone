import { useEffect, useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Searchbar from "../../components/SearchBar";
import { useLocalStorage } from "@mantine/hooks";
import { AddIconToEmptySlot, deleteIconById, getIconByLink, iconList, icons, isIconInstalled } from "../../../utils/icons";
import { Avatar, Button } from "@mantine/core";


export default function AppStore(props: { onExit: () => void, onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setLocation, setPhoneSettings } = usePhone();
    const [searchValue, setSearchValue] = useState('');
    const [loading, setLoading] = useState([]);
    const [slots, setSlots] = useLocalStorage({
        key: 'summit_slots',
        defaultValue: icons,
    });

    function installIcon(icon: any, name: string, link: string, slots: any, index: number = 0) {
        setLoading(prev => {
            const newLoading = [...prev];
            newLoading[index] = true;
            return newLoading;
        });

        setTimeout(() => {
            if (isIconInstalled(link, slots)) {
                setSlots(deleteIconById(slots.find((slot: any) => slot.link === link).id, slots));
            } else {
                setSlots(AddIconToEmptySlot(icon, name, link, slots));
            }
            setLoading(prev => {
                const newLoading = [...prev];
                newLoading[index] = false;
                return newLoading;
            });
        }, 2000);
    }

    useEffect(() => {
        setLoading(Array(iconList.length).fill(false));
    }, []);

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'appstore'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                props.onEnter();
            }}
            onExited={() => {
                props.onExit();
            }}
        >
            <div
                ref={nodeRef}
                style={{
                    backgroundColor: '#0E0E0E',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                }}
                className="settings"
            >
                <div style={{
                    width: '100%', marginTop: '3.02vh', display: 'flex', justifyContent: 'center',
                    fontStyle: 'normal',
                    fontWeight: 700,
                    fontSize: '1.85vh',
                    lineHeight: '2.22vh',
                    letterSpacing: '0.05em',
                    color: '#FFFFFF'
                }}>App Store</div>
                <div style={{
                    width: '90%',
                    marginLeft: '3%',
                }}>
                    <svg style={{
                        cursor: 'pointer',
                    }} onClick={() => {
                        setLocation({
                            app: '',
                            page: {
                                ...location.page,
                            }
                        })
                    }} width="4.26vh" height="1.67vh" viewBox="0 0 42 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.99988 16L1.34971 8.93729C1.14519 8.68163 1.14519 8.31837 1.34971 8.06271L6.99988 1" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                        <path d="M16.4471 13H12.703V4.54492H16.3827C17.9706 4.54492 18.9667 5.35938 18.9667 6.6543C18.9667 7.58008 18.2753 8.35352 17.3788 8.48828V8.53516C18.5272 8.62305 19.371 9.46094 19.371 10.5801C19.371 12.0684 18.2518 13 16.4471 13ZM14.4725 5.86328V8.06055H15.744C16.6874 8.06055 17.2264 7.64453 17.2264 6.92969C17.2264 6.25 16.7518 5.86328 15.9257 5.86328H14.4725ZM14.4725 11.6816H15.996C17.0155 11.6816 17.5663 11.248 17.5663 10.4395C17.5663 9.64844 16.9979 9.22656 15.955 9.22656H14.4725V11.6816ZM23.2581 11.8633C24.0022 11.8633 24.6175 11.377 24.6175 10.6973V10.2402L23.2932 10.3223C22.6546 10.3691 22.2913 10.6562 22.2913 11.1016C22.2913 11.5703 22.678 11.8633 23.2581 11.8633ZM22.6956 13.0996C21.5003 13.0996 20.5921 12.3262 20.5921 11.1953C20.5921 10.0527 21.471 9.39062 23.0354 9.29688L24.6175 9.20312V8.78711C24.6175 8.20117 24.2073 7.86133 23.5628 7.86133C22.9241 7.86133 22.5198 8.17773 22.4378 8.64062H20.8733C20.9378 7.42188 21.9749 6.58398 23.6389 6.58398C25.2503 6.58398 26.2991 7.41602 26.2991 8.68164V13H24.6468V12.0391H24.6116C24.26 12.707 23.4807 13.0996 22.6956 13.0996ZM33.7135 9.05664H32.1257C32.026 8.39453 31.5866 7.92578 30.8835 7.92578C30.0397 7.92578 29.5124 8.64062 29.5124 9.85352C29.5124 11.0898 30.0397 11.793 30.8893 11.793C31.5749 11.793 32.0202 11.3828 32.1257 10.6973H33.7194C33.6315 12.1797 32.5241 13.1348 30.8718 13.1348C28.9792 13.1348 27.778 11.9043 27.778 9.85352C27.778 7.83789 28.9792 6.58398 30.86 6.58398C32.5593 6.58398 33.6374 7.63281 33.7135 9.05664ZM36.921 9.23828L39.0538 6.71875H40.9932L38.5968 9.41406L41.1104 13H39.1417L37.3428 10.4453L36.8975 10.9258V13H35.1866V4.54492H36.8975V9.23828H36.921Z" fill="#0A84FF" />
                    </svg>
                </div>
                <div style={{
                    width: '100%', marginTop: '0.36vh', display: 'flex', justifyContent: 'center',
                }}>
                    <Searchbar value={searchValue} onChange={(e) => {
                        setSearchValue(e);
                    }} mt="" />
                </div>
                <div className="appstore">
                    {iconList.filter(icon => icon.includes(searchValue.toLowerCase())).map((icon, index) => {
                        return (
                            <div className="appStoreBox" key={index}>
                                <div className="appStoreDetails">
                                    <Avatar src={getIconByLink(icon).icon} size="lg" radius="" />
                                    <div className="appStoreDetailsTexts">
                                        <div className="titles">
                                            {getIconByLink(icon).name}
                                        </div>
                                        <div className="descriptions">
                                            {getIconByLink(icon).description}
                                        </div>
                                    </div>
                                </div>
                                <Button loading={loading[index]} className="installIcons" onClick={() => {
                                    installIcon(getIconByLink(icon).icon, getIconByLink(icon).name, getIconByLink(icon).link, slots, index);
                                }}>
                                    {isIconInstalled(icon, slots) ? 'Installed' : 'Get'}
                                </Button>
                            </div>
                        )
                    })}
                </div>
            </div>
        </CSSTransition>
    );
}