import { useRef, useState } from "react";
import { CSSTransition, } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Navigation from "./Navigation";
import { Avatar, Divider, Transition } from "@mantine/core";
import DialpadV3 from "../../components/dialpad3";
import { fetchNui } from "../../../hooks/fetchNui";
import { PhoneContacts } from "../../../../../types/types";
import Searchbar from "../../components/SearchBar";
import Title from "../../components/Title";
import AlphabetSearch from "../../components/AlphabetSearch";
import tonyImage from "../../../../images/123.png";
import SavedContact from "./SavedContact";
import SaveOrEdit from "./SaveOrEdit";

export default function Phone() {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setLocation, setSelectedContact } = usePhone();
    const [dialedNumber, setDialedNumber] = useState('');
    const [phoneContacts, setPhoneContacts] = useState<{ [key: string]: PhoneContacts[] }>({});
    const [searchValue, setSearchValue] = useState('');
    const [alphabetArrange, setAlphabetArrange] = useState<string>('');
    const [visible, setVisible] = useState(false);

    return (
        <CSSTransition nodeRef={nodeRef} in={location.app === 'phone'} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter onEntering={async () => {
            const data: string = await fetchNui('getContacts', JSON.stringify({}));
            const parsedData: PhoneContacts[] = JSON.parse(data);
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
                position: 'relative',
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
                            await fetchNui('phone:call', JSON.stringify({
                                number: dialedNumber,
                                email: phoneSettings.smrtId,
                                citizenId: phoneSettings._id,
                            }));
                        }} />
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
                        <div className="myCard">
                            <Avatar src={tonyImage} w={'2.74375vw'} h={'2.74375vw  '} />
                            <div className="details">
                                <div className="FullName">
                                    Jarvis Decker
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
                                    <div key={index}>
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
                                                    }} key={index} onClick={() => {
                                                        setSelectedContact(contact);
                                                        setLocation({
                                                            app: location.app,
                                                            page: {
                                                                phone: 'savedcontact'
                                                            }
                                                        })
                                                    }}>
                                                        <div style={{
                                                            color: '#FFF',
                                                            fontFamily: 'SFPro',
                                                            fontSize: '15px',
                                                            fontStyle: 'normal',
                                                            fontWeight: 700,
                                                            lineHeight: '120.596%',
                                                            letterSpacing: '0.36px',
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
                                    <div key={index}>
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
                                                    }}>
                                                        <Avatar src={tonyImage} size={'2.2395833333333335vw'} style={{ minHeight: '2.2395833333333335vw' }} radius={'50vw'} />
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
                                                                letterSpacing: '0.36px',
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
                                                                    phone: 'savedcontact'
                                                                }
                                                            })
                                                            setSelectedContact(contact);
                                                        }} className='clickanimation' xmlns="http://www.w3.org/2000/svg" width="1.1458333333333333vw" height="1.1458333333333333vw" viewBox="0 0 15 15" fill="none">
                                                            <path d="M6.67554 4.67308C6.67554 4.85159 6.74645 5.02279 6.87268 5.14902C6.9989 5.27524 7.1701 5.34616 7.34862 5.34616C7.52713 5.34616 7.69833 5.27524 7.82455 5.14902C7.95078 5.02279 8.02169 4.85159 8.02169 4.67308C8.02169 4.49457 7.95078 4.32337 7.82455 4.19714C7.69833 4.07091 7.52713 4 7.34862 4C7.1701 4 6.9989 4.07091 6.87268 4.19714C6.74645 4.32337 6.67554 4.49457 6.67554 4.67308Z" fill="#0A84FF" />
                                                            <path d="M8.03848 10.4615V6.15381H6.4231V6.42304H6.96156L6.96156 10.4615H6.4231V10.7307H8.57695V10.4615H8.03848Z" fill="#0A84FF" />
                                                            <path d="M7.50002 0.5C3.63318 0.5 0.5 3.63318 0.5 7.50002C0.5 11.3669 3.63318 14.5 7.50002 14.5C11.3669 14.5 14.5 11.3669 14.5 7.50002C14.5 3.63318 11.3669 0.5 7.50002 0.5ZM7.50002 13.9178C3.96299 13.9178 1.08221 11.0404 1.08221 7.50002C1.08221 3.96299 3.95962 1.08221 7.50002 1.08221C11.037 1.08221 13.9178 3.95962 13.9178 7.50002C13.9178 11.037 11.037 13.9178 7.50002 13.9178Z" fill="#0A84FF" />
                                                        </svg>
                                                    </div>
                                                    <div className="divider" style={{ marginTop: '0.3vw' }} />
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
                            phone: locate
                        }
                    });
                }} location={location.page.phone} />
                <SavedContact onContactEdited={(data: PhoneContacts) => {
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
                }} onCall={async (number: string, _id: string) => {
                    await fetchNui('phoneCall', JSON.stringify({
                        number: number,
                        _id: _id,
                    }));
                }} onMessage={(number: string, _id: string) => {

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
                                phone: 'contacts'
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