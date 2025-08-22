import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import { Avatar, Button, TextInput, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { PhoneContacts } from "../../../../../types/types";
import AlphabetSearch from "../../components/AlphabetSearch";
import Searchbar from "../../components/SearchBar";

export default function CreateGroup() {
    const nodeRef = useRef(null);
    const { location, setLocation } = usePhone();

    const [avatar, setAvatar] = useState<string>('');
    const [name, setName] = useState<string>('');

    const [members, setMembers] = useState<string[]>([]);
    const [membersPhone, setMembersPhone] = useState<string[]>([]);

    const [phoneContacts, setPhoneContacts] = useState<{ [key: string]: PhoneContacts[] }>({});
    const [showSavedContacts, setShowSavedContacts] = useState(false);
    const [alphabetArrange, setAlphabetArrange] = useState('');

    const [searchValue, setSearchValue] = useState('');

    return (
        <CSSTransition nodeRef={nodeRef} in={location.app === 'message' && location.page.messages === 'createG'} timeout={450} classNames="enterandexitfromtop" unmountOnExit mountOnEnter>
            <div ref={nodeRef} style={{
                backgroundColor: '#0E0E0E',
                width: '100%',
                height: '100%',
                zIndex: 10,
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <div className="back" onClick={() => {
                    const data = {
                        ...location.page,
                        messages: ""
                    };
                    setLocation({
                        app: 'message',
                        page: data
                    })
                }} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginTop: '3.56vh', gap: '0.36vh', justifyContent: 'center', marginLeft:'-23.11vh' }}>
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
                <Avatar size={'7.11vh'} src={avatar ?? "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} mt={'3.56vh'} />
                <TextInput value={avatar} placeholder={'Enter Avatar Link'} mt={'0.00vh'} styles={{
                    root: {
                        width: '90%',
                    },
                    input: {
                        backgroundColor: 'rgba(0,0,0,0)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderBottom: '1px solid #FFFFFF',
                        borderRadius: 0,
                    }
                }} onChange={(e) => {
                    setAvatar(e.currentTarget.value);
                }} onFocus={() => fetchNui("disableControls", true)}
                    onBlur={() => fetchNui("disableControls", false)}
                />
                <TextInput value={name} placeholder={'Enter Group Name'} mt={'2.67vh'} styles={{
                    root: {
                        width: '90%',
                    },
                    input: {
                        backgroundColor: 'rgba(0,0,0,0)',
                        color: '#FFFFFF',
                        border: 'none',
                        borderBottom: '1px solid #FFFFFF',
                        borderRadius: 0,
                    }
                }} onChange={(e) => {
                    setName(e.currentTarget.value);
                }}
                    onFocus={() => fetchNui("disableControls", true)}
                    onBlur={() => fetchNui("disableControls", false)}
                />
                <div className="members" style={{
                    width: '100%',
                    marginTop: '1.78vh',
                    marginLeft: '1.78vh',
                }}>
                    {members.map((member, index) => {
                        return (
                            <div key={index} style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                width: '90%',

                                padding: '0.89vh 0',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                }}>
                                    <div style={{
                                        color: '#FFFFFF',
                                        fontFamily: 'SFPro',
                                        fontSize: '15px',
                                        fontStyle: 'normal',
                                        fontWeight: 700,
                                        lineHeight: '120.596%',
                                        letterSpacing: '0.36px',
                                        marginLeft: '0.89vh',
                                    }}>
                                        {member}
                                    </div>
                                </div>
                                <div style={{
                                    color: '#FFFFFF',
                                    fontFamily: 'SFPro',
                                    fontSize: '12px',
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    lineHeight: '120.596%',
                                    letterSpacing: '0.36px',
                                    cursor: 'pointer',
                                }} onClick={() => {
                                    const newMembers = members.filter((member) => member !== members[index]);
                                    setMembers(newMembers);
                                }}>
                                    Remove
                                </div>
                            </div>
                        )
                    })}
                </div>
                <div style={{
                    marginTop: '2.67vh',
                    padding: '0.53vh',
                    borderRadius: '0.89vh',
                    backgroundColor: '#0A84FF',
                    cursor: 'pointer',
                }} onClick={() => {
                    setShowSavedContacts(true);
                }}>
                    Add Members
                </div>
                <div style={{
                    marginTop: '2.67vh',
                    padding: '0.89vh',
                    borderRadius: '0.89vh',
                    backgroundColor: '#0A84FF',
                    cursor: 'pointer',
                }} onClick={async () => {
                    await fetchNui('createGroup', JSON.stringify({
                        groupName: name,
                        avatar: avatar,
                        memberPhoneNumbers: membersPhone,
                    })).then((data) => {
                        const parsedData = JSON.parse(data as string);
                        if (parsedData.success) {
                            const dataX = {
                                ...location.page,
                                messages: `details/undefined/${parsedData.groupId}`,
                            }
                            setLocation({
                                app: 'message',
                                page: dataX
                            });
                        }
                    });
                }}>
                    Create Group
                </div>
                <Transition
                    mounted={showSavedContacts}
                    transition="fade"
                    duration={400}
                    timingFunction="ease"
                    onEnter={async () => {
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
                    }}
                >
                    {(styles) => <div style={{
                        ...styles,
                        width: '100%',
                        height: '80%',
                        position: 'absolute',
                        bottom: '0.89vh',
                        zIndex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderTopLeftRadius: '1.85vh',
                        borderTopRightRadius: '1.85vh',
                    }}>
                        <div style={{
                            width: '100%',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginTop: '0.44vh',
                        }} >
                            <div style={{
                                width: '34%',
                                fontWeight: 500,
                                fontSize: '1.24vh',
                                color: '#0A84FF',
                                cursor: 'pointer',
                            }} onClick={() => {
                                setShowSavedContacts(false);
                            }}>
                                Cancel
                            </div>
                            <div style={{
                                width: '34%',
                                fontWeight: 500,
                                fontSize: '1.24vh',
                                color: 'white',
                            }}>
                                Select Contact
                            </div>
                            <div style={{
                                width: '21%',
                                textAlign: 'end',
                                fontSize: '1.24vh',
                                color: '#0A84FF',
                                fontWeight: 500
                            }}>
                                Done
                            </div>
                        </div>
                        <Searchbar mt="1.42vh" value={searchValue} onChange={(e: string) => {
                            setSearchValue(e);
                        }} />
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
                                                fontSize: '1.39vh',
                                                fontStyle: 'normal',
                                                fontWeight: 700,
                                                lineHeight: '118.596%',
                                                marginTop: index === 0 ? '' : '0.38vh',
                                                letterSpacing: '0.03vh',
                                            }}>
                                                {letter}
                                                <div style={{
                                                    width: '25.65vh',
                                                    height: '0.05vh',
                                                    background: 'rgba(255, 255, 255, 0.15)',
                                                }} />
                                            </div>
                                            {phoneContacts[letter].filter((letter) =>
                                                letter.firstName.toLowerCase().includes(searchValue.toLowerCase()) || letter.lastName.toLowerCase().includes(searchValue.toLowerCase())
                                            ).map((contact, index) => {
                                                return (
                                                    <div style={{
                                                        display: 'flex',
                                                        height: '2.48vh',
                                                        flexDirection: 'column',
                                                        justifyContent: 'flex-end',
                                                        alignItems: 'flex-start',
                                                        gap: '0.28vh',
                                                        flexShrink: 0,
                                                        alignSelf: 'stretch',
                                                        cursor: 'pointer',
                                                    }} key={index} onClick={() => {
                                                        if (membersPhone.includes(contact.contactNumber)) return;
                                                        setMembers([...members, `${contact.firstName} ${contact.lastName}`]);
                                                        setMembersPhone([...membersPhone, contact.contactNumber]);
                                                        setShowSavedContacts(false);
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
                                                            width: '25.65vh',
                                                            height: '0.05vh',
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
                        <div style={{
                            position: 'absolute',
                            right: '-0.36vh',
                            top: '7.11vh',
                        }}>
                            <AlphabetSearch onClick={(letter: string) => {
                                if (alphabetArrange === letter) {
                                    setAlphabetArrange('');
                                } else {
                                    setAlphabetArrange(letter);
                                }
                            }} />
                        </div>
                    </div>}
                </Transition>
            </div>
        </CSSTransition>

    )
}