import { useRef, useState } from "react";
import { CSSTransition, } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Navigation from "./Navigation";
import { Avatar, SegmentedControl, Transition } from "@mantine/core";
import DialpadV3 from "../../components/dialpad3";
import { fetchNui } from "../../../hooks/fetchNui";
import { PhoneContacts, PhoneCallHistory, PhonePlayerCard } from "../../../../../types/types";
import Searchbar from "../../components/SearchBar";
import Title from "../../components/Title";
import AlphabetSearch from "../../components/AlphabetSearch";
import tonyImage from "../../../../images/123.png";
import SavedContact from "./SavedContact";
import SaveOrEdit from "./SaveOrEdit";
import dayjs from "dayjs";

export default function Phone() {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setLocation, setSelectedContact } = usePhone();
    const [dialedNumber, setDialedNumber] = useState('');
    const [phoneContacts, setPhoneContacts] = useState<{ [key: string]: PhoneContacts[] }>({});
    const [searchValue, setSearchValue] = useState('');
    const [alphabetArrange, setAlphabetArrange] = useState<string>('');
    const [visible, setVisible] = useState(false);
    const [recentCallData, setRecentCallData] = useState<any[]>([]);
    const [allMissed, setAllMissed] = useState('all');
    const [playerPhoneCard, setPlayerPhoneCard] = useState<PhonePlayerCard>(null);
    function getContactByPhoneNumber(phoneNumber: string) {
        let contact: PhoneContacts | null = null;
        Object.keys(phoneContacts).forEach((letter) => {
            const index = phoneContacts[letter].findIndex((contact) => contact.contactNumber === phoneNumber);
            if (index !== -1) {
                contact = phoneContacts[letter][index];
            }
        });
        return contact;
    }

    return (
        <CSSTransition nodeRef={nodeRef} in={location.app === 'phone'} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {
            const data: string = await fetchNui('getContacts', JSON.stringify({}));
            const recentCallData: string = await fetchNui('getCallRecentData', "Ok");
            const playerCard: string = await fetchNui('getPhonePlayerCard', "Ok");
            const parsedData: PhoneContacts[] = JSON.parse(data);
            const parsedRecentCallData: PhoneCallHistory[] = JSON.parse(recentCallData);
            const parsedPlayerCard: PhonePlayerCard = JSON.parse(playerCard);
            setRecentCallData(parsedRecentCallData);
            setPlayerPhoneCard(parsedPlayerCard);
            if (parsedData.length === 0) return;
            const uniqueAlphabets = Array.from(
                new Set(parsedData.map(contact => contact.firstName.charAt(0).toUpperCase()))
            ).sort();

            const contactsByAlphabet: { [key: string]: PhoneContacts[] } = {};
            uniqueAlphabets.forEach(letter => {
                contactsByAlphabet[letter] = parsedData.filter(contact => contact.firstName.charAt(0).toUpperCase() === letter);
            });
            setPhoneContacts(contactsByAlphabet);
        }}>
            <div ref={nodeRef} style={{
                backgroundColor: '#0E0E0E',
                width: '100%',
                height: '100%',
                zIndex: 10,
                position: 'absolute',
            }}>
                <Transition
                    mounted={location.page.phone === 'keypad'}
                    transition="slide-left"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        position: 'absolute',
                        width: '100%',
                        top: '1.60vw',
                        height: '85.5%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}>
                        <div className="NumberDialing">
                            {dialedNumber}
                        </div>
                        <DialpadV3 len={dialedNumber.length} mt="2vw" onClick={async (n) => {
                            if (dialedNumber.length !== 10) {
                                setDialedNumber(dialedNumber + n);
                            }
                        }} onBack={() => {
                            setDialedNumber(dialedNumber.slice(0, -1));
                        }} onCall={async () => {
                            await fetchNui('callFromDialPad', JSON.stringify({
                                number: dialedNumber,
                                citizenId: phoneSettings._id,
                            }));
                        }} />
                    </div>}
                </Transition>
                <Transition
                    mounted={location.page.phone === 'recent'}
                    transition="slide-left"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        position: 'absolute',
                        width: '100%',
                        top: '1.60vw',
                        height: '85.5%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                    }}>
                        <SegmentedControl bg={'dark'} data={[
                            { label: 'All', value: 'all' },
                            { label: 'Missed', value: 'missed' },
                        ]} defaultValue={allMissed} onChange={(data) => {
                            setAllMissed(data);
                        }} mt="0.6vw" w={'6.145833333333333vw'} styles={{
                            label: {
                                color: '#FFF',
                                fontFamily: 'SFPro',
                                fontSize: '0.5vw',
                                fontWeight: 400,
                                lineHeight: 'normal',
                                letterSpacing: '0.05vw',
                            },
                            indicator: {
                                color: 'white !important',
                                backgroundColor: '#4D4D4D'
                            }
                        }} />
                        <Title title="Recent" mt="0" />
                        <div style={{
                            width: '95%',
                            height: '80%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '0.3125vw',
                            overflowY: 'scroll',
                            overflowX: 'hidden',
                            marginTop: '0.625vw',
                        }}>
                            {recentCallData && recentCallData.filter(
                                (call) => allMissed === 'all' ? true : call.status === 'missed'
                            ).map((call, index) => {
                                const contactData = getContactByPhoneNumber(call.otherPartyPhoneNumber);
                                return (
                                    <>
                                        <div key={index + "/*-_ds"} style={{
                                            width: '15.052083333333334vw',
                                            display: 'flex',
                                            alignItems: 'center',
                                        }}>
                                            <Avatar src={contactData?.image} size={'1.875vw'} />
                                            <div className="" style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                alignItems: 'flex-start',
                                                gap: '0.15625vw',
                                                flex: '1 0 0',
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'flex-end',
                                                    alignSelf: 'stretch',
                                                    marginLeft: '0.325vw',
                                                }}>
                                                    <div style={{
                                                        width: '9.1vw',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        color: '#FFF',
                                                        fontFamily: 'SFPro',
                                                        fontSize: '0.78125vw',
                                                        fontStyle: 'normal',
                                                        fontWeight: 700,
                                                        lineHeight: '118.596%',
                                                        letterSpacing: '0.36px',
                                                    }}>
                                                        {contactData ? `${contactData.firstName} ${contactData.lastName}` : call.otherPartyPhoneNumber}
                                                    </div>
                                                    <div style={{
                                                        flex: '1 0 0',
                                                        color: 'rgba(255, 255, 255, 0.41)',
                                                        fontSize: '0.5208333333333334vw',
                                                        lineHeight: '118.596%',
                                                        letterSpacing: '0.015625vw',
                                                    }}>
                                                        {dayjs(call.callTimestamp).format('hh:mm A')}
                                                    </div>
                                                </div>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '0.1665625vw',
                                                    alignSelf: 'stretch',
                                                    marginLeft: '0.325vw',
                                                }}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="0.5729166666666666vw" height="0.5729166666666666vw" viewBox="0 0 11 10" fill="none">
                                                        <path d="M10.103 8.95457C10.5057 8.25376 10.2827 7.71551 9.56956 7.17697C8.73125 6.54385 7.91198 6.11799 7.3229 6.80015C7.3229 6.80015 6.69775 7.54437 4.85805 5.80284C2.71879 3.76361 3.61662 3.04037 3.61662 3.04037C4.36064 2.29238 3.88769 1.73437 3.26369 0.889256C2.63975 0.0441589 2.00944 -0.223321 1.10457 0.503506C-0.63913 1.90419 1.81959 5.19302 3.06273 6.47184L3.06268 6.47193C3.06268 6.47193 4.95307 8.42728 6.14265 9.07821L6.77903 9.43405C7.69176 9.90243 8.71698 10.1168 9.43876 9.68191C9.43876 9.68194 9.78669 9.50297 10.103 8.95457Z" fill="white" fillOpacity="0.41" />
                                                        <path d="M8.11731 2.11713H6.46304C6.34238 2.11713 6.24456 2.21494 6.24456 2.33561C6.24456 2.45627 6.34238 2.55409 6.46304 2.55409H7.59587L6.09487 4.04209C6.00917 4.12704 6.00856 4.26538 6.09353 4.35106C6.13625 4.39416 6.19246 4.41573 6.24871 4.41573C6.3043 4.41573 6.35991 4.39464 6.40251 4.35241L7.89883 2.86906V4.01586C7.89883 4.13652 7.99665 4.23434 8.11731 4.23434C8.23797 4.23434 8.33579 4.13652 8.33579 4.01586V2.33561C8.33579 2.21494 8.23797 2.11713 8.11731 2.11713Z" fill="white" fillOpacity="0.41" />
                                                    </svg>
                                                    <div style={{
                                                        color: 'rgba(255, 255, 255, 0.41)',
                                                        fontSize: '0.55vw',
                                                        lineHeight: '118.596%',
                                                        letterSpacing: '0.0140625vw',
                                                    }}>Mobile</div>
                                                </div>
                                            </div>
                                            <svg onClick={() => {
                                                if (!contactData) return;
                                                setSelectedContact(contactData);
                                                setLocation({
                                                    app: location.app,
                                                    page: {
                                                        phone: 'savedcontact',
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
                                                })
                                            }} className='clickanimation' xmlns="http://www.w3.org/2000/svg" width="0.88125vw" height="0.88125vw" viewBox="0 0 15 15" fill="none">
                                                <path d="M6.67551 4.67308C6.67551 4.85159 6.74642 5.02279 6.87265 5.14902C6.99887 5.27524 7.17007 5.34616 7.34859 5.34616C7.5271 5.34616 7.6983 5.27524 7.82452 5.14902C7.95075 5.02279 8.02166 4.85159 8.02166 4.67308C8.02166 4.49457 7.95075 4.32337 7.82452 4.19714C7.6983 4.07091 7.5271 4 7.34859 4C7.17007 4 6.99887 4.07091 6.87265 4.19714C6.74642 4.32337 6.67551 4.49457 6.67551 4.67308Z" fill="#0A84FF" />
                                                <path d="M8.03848 10.4615V6.15381H6.4231V6.42304H6.96156L6.96156 10.4615H6.4231V10.7307H8.57695V10.4615H8.03848Z" fill="#0A84FF" />
                                                <path d="M7.50002 0.5C3.63318 0.5 0.5 3.63318 0.5 7.50002C0.5 11.3669 3.63318 14.5 7.50002 14.5C11.3669 14.5 14.5 11.3669 14.5 7.50002C14.5 3.63318 11.3669 0.5 7.50002 0.5ZM7.50002 13.9178C3.96299 13.9178 1.08221 11.0404 1.08221 7.50002C1.08221 3.96299 3.95962 1.08221 7.50002 1.08221C11.037 1.08221 13.9178 3.95962 13.9178 7.50002C13.9178 11.037 11.037 13.9178 7.50002 13.9178Z" fill="#0A84FF" />
                                            </svg>
                                        </div>
                                        {index === recentCallData.length - 1 ? '' : <div className="divider" key={index + '////_+'} style={{ marginTop: '0.1vw' }} />}
                                    </>
                                )
                            })}
                        </div>
                    </div>}
                </Transition>
                <Transition
                    mounted={location.page.phone === 'contacts'}
                    transition="slide-left"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        position: 'absolute',
                        width: '100%',
                        top: '1.60vw',
                        height: '85.5%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        fontFamily: 'SFPro'
                    }}>
                        <div style={{
                            width: '80%',
                            display: 'flex',
                            justifyContent: 'end'
                        }}>
                            <svg style={{
                                marginTop: '0.5645833333333333vw',
                            }} className='clickanimation' onClick={() => {
                                setVisible(true);
                            }} width="0.8333333333333334vw" height="0.8333333333333334vw" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.31429 7.31429V0H8.68571V7.31429H16V8.68571H8.68571V16H7.31429V8.68571H0V7.31429H7.31429Z" fill="#0A84FF" />
                            </svg>
                        </div>
                        <Title title="Contacts" mt="0" />
                        <Searchbar mt="0.3125vw" value={searchValue} onChange={(e) => {
                            setSearchValue(e);
                        }} />
                        <div className="divider"></div>
                        <div className="myCard" style={{ cursor: 'pointer' }} onClick={() => {
                            setSelectedContact({
                                _id: playerPhoneCard._id,
                                firstName: playerPhoneCard.firstName,
                                lastName: playerPhoneCard.lastName,
                                personalNumber: playerPhoneCard.phoneNumber,
                                contactNumber: playerPhoneCard.phoneNumber,
                                image: playerPhoneCard.avatar,
                                ownerId: playerPhoneCard._id,
                                notes: playerPhoneCard.notes,
                                email: playerPhoneCard.email,
                                isFav: false,
                            });
                            setLocation({
                                app: location.app,
                                page: {
                                    phone: 'savedcontact',
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
                            })
                        }}>
                            <Avatar src={playerPhoneCard?.avatar} w={'2.74375vw'} h={'2.74375vw  '} />
                            <div className="details">
                                <div className="FullName">
                                    {playerPhoneCard.firstName} {playerPhoneCard.lastName}
                                </div>
                                <div className="mydsa">
                                    My Card
                                </div>
                            </div>
                        </div>
                        <div className="phoneContacts">
                            {Object.keys(phoneContacts).filter(
                                letter => letter.includes(alphabetArrange) && phoneContacts[letter].filter((letter) =>
                                    letter.firstName.toLowerCase().includes(searchValue.toLowerCase()) || letter.lastName.toLowerCase().includes(searchValue.toLowerCase())
                                ).length > 0
                            ).map((letter, index) => {
                                return (
                                    <div key={index + "_+-"}>
                                        <div className="letter">
                                            <div style={{
                                                color: 'rgba(255, 255, 255, 0.40)',
                                                fontFamily: 'SFPro',
                                                fontSize: '0.78125vw',
                                                fontStyle: 'normal',
                                                fontWeight: 700,
                                                lineHeight: '118.596%',
                                                marginTop: index === 0 ? '' : '0.2125vw',
                                                letterSpacing: '0.01875vw',
                                            }}>
                                                {letter}
                                                <div style={{
                                                    width: '14.427083333333334vw',
                                                    height: '0.026041666666666668vw',
                                                    background: 'rgba(255, 255, 255, 0.15)',
                                                }} />
                                            </div>
                                            {phoneContacts[letter].filter((letter) =>
                                                letter.firstName.toLowerCase().includes(searchValue.toLowerCase()) || letter.lastName.toLowerCase().includes(searchValue.toLowerCase())
                                            ).map((contact, index) => {
                                                return (
                                                    <div style={{
                                                        display: 'flex',
                                                        height: '1.39375vw',
                                                        flexDirection: 'column',
                                                        justifyContent: 'flex-end',
                                                        alignItems: 'flex-start',
                                                        gap: '0.15625vw',
                                                        flexShrink: 0,
                                                        alignSelf: 'stretch',
                                                        cursor: 'pointer',
                                                    }} key={index + "_+"} onClick={() => {
                                                        setSelectedContact(contact);
                                                        setLocation({
                                                            app: location.app,
                                                            page: {
                                                                phone: 'savedcontact',
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
                                                        })
                                                    }}>
                                                        <div style={{
                                                            color: '#FFF',
                                                            fontFamily: 'SFPro',
                                                            fontSize: '0.78125vw',
                                                            fontStyle: 'normal',
                                                            fontWeight: 700,
                                                            lineHeight: '120.596%',
                                                            letterSpacing: '0.01875vw',
                                                        }}>
                                                            {contact.firstName} {contact.lastName}
                                                        </div>
                                                        <div style={{
                                                            width: '14.427083333333334vw',
                                                            height: '0.026041666666666668vw',
                                                            background: 'rgba(255, 255, 255, 0.15)',
                                                        }} />
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <AlphabetSearch onClick={(letter: string) => {
                            if (alphabetArrange === letter) {
                                setAlphabetArrange('');
                            } else {
                                setAlphabetArrange(letter);
                            }
                        }} />
                    </div>}
                </Transition>
                <Transition
                    mounted={location.page.phone === 'favourites'}
                    transition="slide-left"
                    duration={400}
                    timingFunction="ease"
                >
                    {(styles) => <div style={{
                        ...styles,
                        position: 'absolute',
                        width: '100%',
                        top: '1.60vw',
                        height: '85.5%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        fontFamily: 'SFPro'
                    }}>
                        <div style={{
                            width: '87%',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: '0.5645833333333333vw',
                        }}>
                            <div style={{
                                width: '6%',
                            }} />
                            <div style={{
                                fontFamily: 'SFPro',
                                fontStyle: 'normal',
                                fontWeight: 700,
                                fontSize: '1.0416666666666667vw',
                                lineHeight: '0.9375vw',
                                textAlign: 'center',
                                color: '#FFFFFF',
                            }}>
                                Favourites
                            </div>
                            <svg className='clickanimation' onClick={() => {
                                setVisible(true);
                            }} width="0.8333333333333334vw" height="0.8333333333333334vw" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.31429 7.31429V0H8.68571V7.31429H16V8.68571H8.68571V16H7.31429V8.68571H0V7.31429H7.31429Z" fill="#0A84FF" />
                            </svg>
                        </div>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            padding: '0px',
                            gap: '0.3125vw',
                            width: '93%',
                            height: '90%',
                            marginTop: '1.2vw'
                        }}>
                            {Object.keys(phoneContacts).filter(
                                letter => phoneContacts[letter].filter((letter) => letter.isFav).length > 0
                            ).map((letter, index) => {
                                return (
                                    <div key={index + "_+-/"}>
                                        {phoneContacts[letter].filter((letter) => letter.isFav).map((contact, index) => {
                                            return (
                                                <>
                                                    <div style={{
                                                        display: 'flex',
                                                        flexDirection: 'row',
                                                        justifyContent: 'center',
                                                        alignItems: 'center',
                                                        padding: '0px',
                                                        gap: '0.3125vw',
                                                        width: '100%',
                                                        height: '2.2395833333333335vw',
                                                        flex: 'none',
                                                        order: 0,
                                                        alignSelf: 'stretch',
                                                        flexGrow: 0,
                                                        marginTop: index === 0 ? '0vw' : '0.4125vw',
                                                    }} key={index + '__+'}>
                                                        <Avatar src={contact?.image} size={'2.2395833333333335vw'} style={{ minHeight: '2.2395833333333335vw' }} radius={'50vw'} />
                                                        <div style={{
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            alignItems: 'flex-start',
                                                            padding: '0px',
                                                            width: '10.979166666666666vw',
                                                            height: '1.4583333333333333vw',
                                                        }}>
                                                            <div style={{
                                                                display: 'flex',
                                                                flexDirection: 'row',
                                                                alignItems: 'flex-end',
                                                                padding: '0px',
                                                                width: '11.979166666666666vw',
                                                                height: '0.7291666666666666vw',
                                                                flex: 'none',
                                                                order: 0,
                                                                alignSelf: 'stretch',
                                                                flexGrow: 0,
                                                                color: '#FFF',
                                                                fontFamily: 'SFPro',
                                                                fontSize: '0.78125vw',
                                                                fontStyle: 'normal',
                                                                fontWeight: 700,
                                                                lineHeight: '118.596%',
                                                                letterSpacing: '0.01875vw',
                                                            }}>
                                                                {contact.firstName} {contact.lastName}
                                                            </div>
                                                            <div style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '0.1665625vw',
                                                                alignSelf: 'stretch',
                                                                color: 'rgba(255, 255, 255, 0.41)',
                                                                fontFamily: 'SFPro',
                                                                fontSize: '0.5208333333333334vw',
                                                                fontStyle: 'normal',
                                                                fontWeight: 700,
                                                                lineHeight: '180.596%',
                                                                letterSpacing: '0.0140625vw',
                                                            }}>
                                                                Mobile
                                                            </div>
                                                        </div>
                                                        <svg onClick={() => {
                                                            setLocation({
                                                                app: location.app,
                                                                page: {
                                                                    phone: 'savedcontact',
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
                                                            })
                                                            setSelectedContact(contact);
                                                        }} className='clickanimation' xmlns="http://www.w3.org/2000/svg" width="1.1458333333333333vw" height="1.1458333333333333vw" viewBox="0 0 15 15" fill="none">
                                                            <path d="M6.67554 4.67308C6.67554 4.85159 6.74645 5.02279 6.87268 5.14902C6.9989 5.27524 7.1701 5.34616 7.34862 5.34616C7.52713 5.34616 7.69833 5.27524 7.82455 5.14902C7.95078 5.02279 8.02169 4.85159 8.02169 4.67308C8.02169 4.49457 7.95078 4.32337 7.82455 4.19714C7.69833 4.07091 7.52713 4 7.34862 4C7.1701 4 6.9989 4.07091 6.87268 4.19714C6.74645 4.32337 6.67554 4.49457 6.67554 4.67308Z" fill="#0A84FF" />
                                                            <path d="M8.03848 10.4615V6.15381H6.4231V6.42304H6.96156L6.96156 10.4615H6.4231V10.7307H8.57695V10.4615H8.03848Z" fill="#0A84FF" />
                                                            <path d="M7.50002 0.5C3.63318 0.5 0.5 3.63318 0.5 7.50002C0.5 11.3669 3.63318 14.5 7.50002 14.5C11.3669 14.5 14.5 11.3669 14.5 7.50002C14.5 3.63318 11.3669 0.5 7.50002 0.5ZM7.50002 13.9178C3.96299 13.9178 1.08221 11.0404 1.08221 7.50002C1.08221 3.96299 3.95962 1.08221 7.50002 1.08221C11.037 1.08221 13.9178 3.95962 13.9178 7.50002C13.9178 11.037 11.037 13.9178 7.50002 13.9178Z" fill="#0A84FF" />
                                                        </svg>
                                                    </div>
                                                    <div className="divider" key={index} style={{ marginTop: '0.3vw' }} />
                                                </>
                                            )
                                        })}
                                    </div>
                                )
                            })}

                        </div>

                    </div>}
                </Transition>
                <Navigation onClick={(locate) => {
                    setLocation({
                        app: location.app,
                        page: {
                            phone: locate,
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
                }} location={location.page.phone} />
                <SavedContact onContactEdited={(data: PhoneContacts) => {

                    if (data.contactNumber === data.personalNumber) {
                        fetchNui('updatePersonalCard', JSON.stringify({
                            _id: data._id,
                            firstName: data.firstName,
                            lastName: data.lastName,
                            phoneNumber: data.personalNumber,
                            email: data.email,
                            notes: data.notes,
                            avatar: data.image,
                        }))
                        const dataX = {
                            ...data,
                        }
                        setSelectedContact(data);
                        setPlayerPhoneCard({
                            _id: data._id,
                            firstName: data.firstName,
                            lastName: data.lastName,
                            phoneNumber: data.personalNumber,
                            email: data.email,
                            notes: data.notes,
                            avatar: data.image,
                        });
                    } else {
                        const dataX = {
                            ...data,
                        }
                        setSelectedContact(dataX);
                        setPhoneContacts((prev) => {
                            const newContacts = { ...prev };
                            const letter = data.firstName.charAt(0).toUpperCase();
                            if (newContacts[letter]) {
                                const index = newContacts[letter].findIndex((contact) => contact._id === data._id);
                                if (index !== -1) {
                                    newContacts[letter][index] = data;
                                }
                            }
                            return newContacts;
                        });
                    }
                }} onCall={async (number: string, _id: string) => {
                    await fetchNui('phoneCall', JSON.stringify({
                        number: number,
                        _id: _id,
                    }));
                }} onMessage={(number: string, _id: string) => {
                    console.log(number, _id);
                }} onFav={async (_idX: string) => {

                    await fetchNui('favContact', _idX).then((res: string) => {
                        const data: PhoneContacts = JSON.parse(res);
                        setPhoneContacts((prev) => {
                            const newContacts = { ...prev };
                            Object.keys(newContacts).forEach((letter) => {
                                const index = newContacts[letter].findIndex((contact) => {
                                    return contact._id === _idX;
                                });
                                if (index !== -1) {
                                    newContacts[letter][index] = data;
                                }
                            });
                            return newContacts;
                        });
                        setSelectedContact(data);
                    });
                }} onDelete={(_id: string) => {
                    setPhoneContacts((prev) => {
                        const newContacts = { ...prev };
                        Object.keys(newContacts).forEach((letter) => {
                            const index = newContacts[letter].findIndex((contact) => contact._id === _id);
                            if (index !== -1) {
                                newContacts[letter].splice(index, 1);
                            }
                        });
                        return newContacts;
                    });
                    fetchNui('deleteContact', _id);
                    setLocation({
                        app: location.app,
                        page: {
                            phone: 'contacts',
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
                }} />
                <SaveOrEdit visible={visible} data={{
                    _id: '',
                    personalNumber: '',
                    contactNumber: '',
                    firstName: '',
                    lastName: '',
                    image: '',
                    ownerId: '',
                    notes: '',
                    email: '',
                    isFav: false,
                }} onCancel={() => {
                    setVisible(false);
                }} onDone={async (data: PhoneContacts) => {
                    await fetchNui('addContact', JSON.stringify({
                        _id: data._id,
                        firstName: data.firstName,
                        lastName: data.lastName,
                        contactNumber: data.contactNumber,
                        email: data.email,
                        personalNumber: data.personalNumber,
                        ownerId: data.ownerId,
                        notes: data.notes,
                        image: data.image,
                        isFav: data.isFav,
                    })).then((res: string) => {
                        const data: PhoneContacts = JSON.parse(res);
                        setPhoneContacts((prev) => {
                            const newContacts = { ...prev };
                            const letter = data.firstName.charAt(0).toUpperCase();
                            if (newContacts[letter]) {
                                newContacts[letter].push(data);
                            } else {
                                newContacts[letter] = [data];
                            }
                            return newContacts;
                        });
                        setVisible(false);
                    });
                }} />
            </div >
        </CSSTransition >

    )
}