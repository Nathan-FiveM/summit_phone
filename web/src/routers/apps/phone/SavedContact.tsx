import { Avatar, Transition } from "@mantine/core";
import { usePhone } from "../../../store/store";
import { PhoneContacts } from "../../../../../types/types";
import SaveOrEdit from "./SaveOrEdit";
import { createRef, useState } from "react";
import { fetchNui } from "../../../hooks/fetchNui";
import useNotiQueue from "../../../hooks/useNotiQueue";
import { generateUUid } from "../../../hooks/misc";

export default function SavedContact(props: { onContactEdited: (data: PhoneContacts) => void, onCall: (number: string, _id: string) => void, onMessage: (number: string, _id: string) => void, onFav: (email: string) => void, onDelete: (id: string) => void }) {
    const { location, selectedContact, setLocation, setSelectedContact } = usePhone();
    const [visible, setVisible] = useState(false);
    const noti = useNotiQueue();
    return (
        <Transition
            mounted={location.page.phone === 'savedcontact'}
            transition="slide-up"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => (
                <div style={{
                    ...styles,
                    position: 'absolute',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                }}>
                    <div className="savedContactTop">
                        <div className="topButtons">
                            <svg style={{ flexShrink: 0 }} onClick={() => {
                                setLocation({
                                    app: 'phone',
                                    page: {
                                        ...location.page,
                                        phone: 'contacts',
                                    }
                                });
                                setSelectedContact({
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
                                });
                            }} className='clickanimation' width="2.13vh" height="2.13vh" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect width="23" height="23" rx="11.5" fill="white" fillOpacity="0.14" />
                                <path d="M13 17L8.42806 11.9709C8.18534 11.7039 8.18534 11.2961 8.42806 11.0291L13 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.89vh',
                                marginLeft: '-0.53vh',
                            }}>
                                <svg onClick={() => {
                                    setVisible(true);
                                }} className='clickanimation' width="4.63vh" height="2.13vh" viewBox="0 0 50 23" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <rect width="50" height="23" rx="11.5" fill="white" fillOpacity="0.14" />
                                    <path d="M20.6587 15.2686V16.5H14.8442V7.34033H20.6587V8.56543H16.2661V11.2441H20.4238V12.4248H16.2661V15.2686H20.6587ZM24.4609 16.6143C22.7725 16.6143 21.6553 15.2686 21.6553 13.1611C21.6553 11.0537 22.7725 9.71436 24.4482 9.71436C25.4067 9.71436 26.1685 10.1968 26.543 10.9331H26.5684V7.34033H27.9458V16.5H26.6128V15.3638H26.5874C26.1938 16.1255 25.4321 16.6143 24.4609 16.6143ZM24.8228 10.8696C23.7373 10.8696 23.0581 11.7583 23.0581 13.1611C23.0581 14.5703 23.7373 15.4526 24.8228 15.4526C25.8765 15.4526 26.5811 14.5576 26.5811 13.1611C26.5811 11.7773 25.8765 10.8696 24.8228 10.8696ZM29.3994 16.5V9.82227H30.7705V16.5H29.3994ZM30.085 8.84473C29.647 8.84473 29.2915 8.49561 29.2915 8.06396C29.2915 7.62598 29.647 7.27686 30.085 7.27686C30.5293 7.27686 30.8848 7.62598 30.8848 8.06396C30.8848 8.49561 30.5293 8.84473 30.085 8.84473ZM32.5732 8.2417H33.9507V9.82227H35.2202V10.9077H33.9507V14.5894C33.9507 15.167 34.2046 15.4272 34.7632 15.4272C34.9028 15.4272 35.125 15.4146 35.2139 15.3955V16.481C35.0615 16.519 34.7568 16.5444 34.4521 16.5444C33.1001 16.5444 32.5732 16.0303 32.5732 14.7417V10.9077H31.6021V9.82227H32.5732V8.2417Z" fill="white" />
                                </svg>
                                {selectedContact?.contactNumber !== selectedContact?.personalNumber ? <svg style={{
                                    cursor: 'pointer',
                                }} onClick={() => {
                                    fetchNui('blockNumber', JSON.stringify(selectedContact));
                                }} width="1.85vh" height="1.85vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3.63605 3.63603L16.364 16.364M19 10C19 14.9706 14.9706 19 10 19C5.02944 19 1 14.9706 1 10C1 5.02944 5.02944 1 10 1C14.9706 1 19 5.02944 19 10Z" stroke="white" strokeWidth="2" strokeLinecap="round" stroke-linejoin="round" />
                                </svg> : <></>}
                            </div>
                        </div>
                        <Avatar src={selectedContact.image ?? "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} w={'8.35vh'} h={'8.35vh'} radius="88.89vh" />
                        <div className="savedFullName">
                            <div className="text">
                                {selectedContact.firstName} {selectedContact.lastName}
                            </div>
                        </div>
                        <div className="bottomButton">
                            <div style={{
                                display: 'flex',
                                width: '6.30vh',
                                height: '4.17vh',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.19vh',
                                flexShrink: 0,
                                borderRadius: '0.37vh',
                                background: 'rgba(255, 255, 255, 0.15)',
                            }} className='clickanimation' onClick={() => {
                                if (selectedContact.contactNumber === selectedContact.personalNumber) {
                                    fetchNui('showNoti', { app: 'settings', title: 'Phone', description: 'You can\'t message yourself' });
                                    return;
                                };
                                props.onMessage(selectedContact.contactNumber, selectedContact._id);
                            }}>
                                <svg width="1.39vh" height="1.39vh" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M10.8203 9.37304C11.5159 8.38098 11.8824 7.21852 11.8824 6.00003C11.8824 2.7554 9.24466 0.117676 6.00003 0.117676C2.7554 0.117676 0.117676 2.7554 0.117676 6.00003C0.117676 9.24466 2.7554 11.8824 6.00003 11.8824C6.9314 11.8824 7.85344 11.6606 8.67743 11.2381L11.1261 11.8707C11.1564 11.8777 11.1891 11.8824 11.2194 11.8824C11.3245 11.8824 11.4272 11.838 11.4996 11.7587C11.5929 11.6536 11.6209 11.5066 11.5719 11.3758L10.8203 9.37304ZM4.24233 6.59527C4.02991 6.71898 3.76614 6.71898 3.55372 6.59527C3.3413 6.47155 3.21058 6.24513 3.21058 6.00003C3.21058 5.75493 3.3413 5.52617 3.55372 5.40479C3.76614 5.28107 4.02991 5.28107 4.24233 5.40479C4.45474 5.52851 4.58546 5.75493 4.58546 6.00003C4.5878 6.24513 4.45474 6.47389 4.24233 6.59527ZM6.34317 6.59527C6.13075 6.71898 5.86698 6.71898 5.65456 6.59527C5.44214 6.47155 5.31142 6.24513 5.31142 6.00003C5.31142 5.75493 5.44214 5.52617 5.65456 5.40479C5.86698 5.28107 6.13075 5.28107 6.34317 5.40479C6.55558 5.52851 6.6863 5.75493 6.6863 6.00003C6.68864 6.24513 6.55792 6.47389 6.34317 6.59527ZM8.44634 6.59527C8.23392 6.71898 7.97015 6.71898 7.75773 6.59527C7.54531 6.47155 7.41459 6.24513 7.41459 6.00003C7.41459 5.75493 7.54531 5.52617 7.75773 5.40479C7.97015 5.28107 8.23392 5.28107 8.44634 5.40479C8.65876 5.52851 8.78948 5.75493 8.78948 6.00003C8.78948 6.24513 8.65876 6.47389 8.44634 6.59527Z" fill="white" />
                                </svg>
                                <div className="text" style={{
                                    color: '#FFF',
                                    fontFamily: 'SFPro',
                                    fontSize: '1.02vh',
                                    fontStyle: 'normal',
                                    fontWeight: 500,
                                    lineHeight: 'normal',
                                }}>
                                    Message
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                width: '6.30vh',
                                height: '4.17vh',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.19vh',
                                flexShrink: 0,
                                borderRadius: '0.37vh',
                                background: 'rgba(255, 255, 255, 0.15)',
                            }} className='clickanimation' onClick={() => {
                                if (selectedContact.contactNumber === selectedContact.personalNumber) {
                                    fetchNui('showNoti', { app: 'settings', title: 'Phone', description: 'You can\'t call yourself' });
                                    return;
                                };
                                props.onCall(selectedContact.contactNumber, selectedContact._id);
                            }}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="1.39vh" height="1.39vh" viewBox="0 0 12 12" fill="none">
                                    <path d="M1.06401 1.04067C1.76972 0.239228 2.59613 -0.167738 3.10791 0.345201L4.81505 2.05446C5.24797 2.48802 5.14295 3.06221 4.64526 3.65452C4.42245 3.91957 4.29085 4.24947 4.26998 4.59531C4.2491 4.94115 4.34007 5.28453 4.52938 5.57452C4.75872 5.92588 5.04599 6.27483 5.3912 6.62055C5.81205 7.04202 6.24618 7.38572 6.69318 7.65287C6.97636 7.822 7.30457 7.89995 7.63343 7.87617C7.96228 7.85239 8.27591 7.72802 8.53188 7.5199C9.1523 7.01542 9.58602 6.83289 9.93606 7.18305L11.6432 8.89271C12.6619 9.91295 10.2048 12.1605 8.44458 11.8539C7.02431 11.6061 4.83154 10.0487 3.39277 8.60783C2.12297 7.33616 0.413019 4.86052 0.153106 3.55822C-0.00622127 2.76162 0.384855 1.81068 1.06401 1.03986V1.04067Z" fill="white" />
                                </svg>
                                <div className="text" style={{
                                    color: '#FFF',
                                    fontFamily: 'SFPro',
                                    fontSize: '1.02vh',
                                    fontStyle: 'normal',
                                    fontWeight: 500,
                                    lineHeight: 'normal',
                                }}>
                                    Call
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                width: '6.30vh',
                                height: '4.17vh',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.19vh',
                                flexShrink: 0,
                                borderRadius: '0.37vh',
                                background: 'rgba(255, 255, 255, 0.15)',
                            }} className='clickanimation' onClick={() => {
                                if (selectedContact.contactNumber === selectedContact.personalNumber) {
                                    fetchNui('showNoti', { app: 'settings', title: 'Phone', description: 'You can\'t favourite yourself' });
                                    return;
                                };
                                props.onFav(selectedContact._id);
                            }}>
                                <svg width="1.67vh" height="1.48vh" viewBox="0 0 18 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.0649 5.53846H11.3337L9.59219 0.407692C9.50647 0.157692 9.26881 0 8.99998 0C8.73115 0 8.49349 0.157692 8.40777 0.407692L6.66621 5.53846H0.896082C0.553225 5.53846 0.272705 5.81538 0.272705 6.15385C0.272705 6.18846 0.276601 6.22692 0.284393 6.25769C0.292186 6.39231 0.354523 6.54231 0.545432 6.69231L5.25582 9.96923L3.44803 15.1577C3.35842 15.4077 3.44803 15.6885 3.66232 15.85C3.7753 15.9308 3.8805 16 4.01297 16C4.14154 16 4.29348 15.9346 4.40258 15.8615L8.99998 12.6269L13.5974 15.8615C13.7065 15.9385 13.8584 16 13.987 16C14.1195 16 14.2247 15.9346 14.3337 15.85C14.5519 15.6885 14.6376 15.4115 14.548 15.1577L12.7402 9.96923L17.4117 6.66154L17.5247 6.56538C17.626 6.45769 17.7273 6.31154 17.7273 6.15385C17.7273 5.81538 17.4078 5.53846 17.0649 5.53846Z" fill="#FFF" fillOpacity={selectedContact.isFav ? 1 : 0.8} />
                                </svg>
                                <div className="text" style={{
                                    color: '#FFF',
                                    fontFamily: 'SFPro',
                                    fontSize: '1.02vh',
                                    fontStyle: 'normal',
                                    fontWeight: 500,
                                    lineHeight: 'normal',
                                }}>
                                    Favourite
                                </div>
                            </div>
                            <div style={{
                                display: 'flex',
                                width: '6.12vh',
                                height: '4.17vh',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '0.19vh',
                                flexShrink: 0,
                                borderRadius: '0.37vh',
                                background: 'rgba(255, 255, 255, 0.15)',
                            }} className='clickanimation' onClick={() => {
                                if (selectedContact.contactNumber === selectedContact.personalNumber) {
                                    fetchNui('showNoti', { app: 'settings', title: 'Phone', description: 'You can\'t delete your card' });
                                    return;
                                };
                                props.onDelete(selectedContact._id);
                            }}>
                                <svg className='clickanimation' width="1.39vh" height="1.39vh" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M0.487139 2.18431H1.62716L2.15785 11.5334C2.1685 11.7278 2.32984 11.88 2.52462 11.88H9.48272C9.6775 11.88 9.83884 11.7275 9.84949 11.5331L10.3717 2.18431H11.5125C11.7157 2.18431 11.88 2.01966 11.88 1.8168C11.88 1.61393 11.7157 1.44928 11.5125 1.44928H10.1376C10.1174 1.44928 10.0998 1.45774 10.0803 1.46068C10.0612 1.45774 10.0435 1.44928 10.0241 1.44928H8.0961V0.487507C8.0961 0.28464 7.93182 0.119995 7.72859 0.119995H4.27067C4.06744 0.119995 3.90316 0.28464 3.90316 0.487507V1.44928H1.97446C1.95755 1.44928 1.94248 1.457 1.92595 1.45921C1.90904 1.45663 1.89397 1.44928 1.87633 1.44928H0.487507C0.284273 1.44928 0.119995 1.61393 0.119995 1.8168C0.119995 2.01966 0.283905 2.18431 0.487139 2.18431ZM4.63818 0.855018H7.36107V1.44928H4.63818V0.855018ZM9.6356 2.18431L9.13505 11.1453H2.87192L2.36329 2.18431H9.6356Z" fill="white" />
                                    <path d="M4.17987 10.4563C4.18722 10.4563 4.19383 10.4563 4.20118 10.4559C4.40405 10.4445 4.55877 10.2707 4.54701 10.0682L4.16039 3.25634C4.149 3.05348 3.97039 2.90096 3.77266 2.91015C3.5698 2.92154 3.41508 3.09537 3.42684 3.29787L3.81346 10.1097C3.82448 10.3052 3.98656 10.4563 4.17987 10.4563Z" fill="white" />
                                    <path d="M7.78513 10.4559C7.79248 10.4563 7.79909 10.4563 7.80644 10.4563C7.99975 10.4563 8.16182 10.3052 8.17285 10.1097L8.55947 3.29788C8.57086 3.09538 8.41614 2.92155 8.21364 2.91015C8.01408 2.9017 7.83768 3.05348 7.82592 3.25635L7.4393 10.0682C7.4279 10.2707 7.58263 10.4445 7.78513 10.4559Z" fill="white" />
                                    <path d="M5.9998 10.4563C6.20304 10.4563 6.36731 10.2916 6.36731 10.0888V3.27695C6.36731 3.07408 6.20304 2.90944 5.9998 2.90944C5.79657 2.90944 5.63229 3.07408 5.63229 3.27695V10.0888C5.63229 10.2916 5.79657 10.4563 5.9998 10.4563Z" fill="white" />
                                </svg>
                                <div className="text" style={{
                                    color: '#FFF',
                                    fontFamily: 'SFPro',
                                    fontSize: '1.02vh',
                                    fontStyle: 'normal',
                                    fontWeight: 500,
                                    lineHeight: 'normal',
                                }}>
                                    Delete
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="savedPhoneNumber">
                        <div className="title">
                            Phone
                        </div>
                        <div className="number">
                            +1 {selectedContact.contactNumber.slice(0, 3)} {selectedContact.contactNumber.slice(3, 6)} {selectedContact.contactNumber.slice(6, 10)}
                        </div>
                    </div>
                    <div className="savedPhoneNumberx">
                        <div className="title">
                            Email
                        </div>
                        <div className="number">
                            {selectedContact.email}
                        </div>
                    </div>
                    <div className="savedPhoneNumberx" style={{
                        height: '11.20vh'
                    }}>
                        <div className="title">
                            Notes
                        </div>
                        <div className="number">
                            {selectedContact.notes}
                        </div>
                    </div>
                    <SaveOrEdit visible={visible} data={selectedContact} onCancel={() => {
                        setVisible(false);
                    }} onDone={(data) => {
                        if (selectedContact.contactNumber !== selectedContact.personalNumber) {
                            fetchNui('saveContact', JSON.stringify({
                                _id: data._id,
                                firstName: data.firstName,
                                lastName: data.lastName,
                                contactNumber: data.contactNumber,
                                email: data.email,
                                personalNumber: data.personalNumber,
                                ownerId: data.ownerId,
                                notes: data.notes,
                                image: data.image,
                            }));
                        };

                        props.onContactEdited(data);
                        setVisible(false);
                    }} />
                </div>
            )}
        </Transition >

    )
}