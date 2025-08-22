import { Textarea, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { useState } from "react";
import { usePhone } from "../../../store/store";

export default function ComposeMail(props: { show: boolean, onCancel: () => void, onSend: (to: string, from: string, subject: string, body: string, attachments: string[]) => void }) {
    const { location, phoneSettings } = usePhone();
    const [showAttachments, setShowAttachments] = useState(false);
    const [attachments, setAttachments] = useState([
        ""
    ]);
    const [to, setTo] = useState(location.page.mail.split('/')[1]);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');

    return (
        <Transition
            mounted={props.show}
            transition="fade"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={{
                ...styles,
                width: '100%',
                height: '93%',
                bottom: '0',
                position: 'absolute',
                borderRadius: '1.11vh 1.11vh 3.98vh 3.98vh',
                background: '#262626',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <div className="headerOfComposeMail">
                    <div className="cancelBut clickanimation" onClick={() => {
                        props.onCancel();
                    }}>Cancel</div>
                    <svg onClick={() => {
                        setShowAttachments(!showAttachments);
                    }} className='clickanimation' xmlns="http://www.w3.org/2000/svg" width="1.85vh" height="1.85vh" viewBox="0 0 18 18" fill="none">
                        <g clipPath="url(#clip0_279_568)">
                            <path d="M5.62488 14.625C5.02488 14.625 4.49988 14.4 4.04988 13.95C3.14988 13.05 3.14988 11.625 4.04988 10.8C4.34988 10.5 4.79988 10.5 5.09988 10.8C5.39988 11.1 5.39988 11.55 5.09988 11.85C4.79988 12.15 4.79988 12.6 5.09988 12.9C5.39988 13.2 5.84988 13.2 6.14988 12.9C6.44988 12.6 6.89988 12.6 7.19988 12.9C7.49988 13.2 7.49988 13.65 7.19988 13.95C6.74988 14.4 6.14988 14.625 5.62488 14.625Z" fill="#0A84FF" />
                            <path d="M15.1498 9.975C14.9248 9.975 14.7748 9.9 14.6248 9.75C14.3248 9.45 14.3248 9 14.6248 8.7C15.5248 7.8 15.5248 6.375 14.6248 5.55C13.7998 4.725 12.2998 4.725 11.4748 5.55C11.1748 5.85 10.7248 5.85 10.4248 5.55C10.1248 5.25 10.1248 4.8 10.4248 4.5C11.0998 3.75 11.9998 3.375 13.0498 3.375C14.0998 3.375 14.9998 3.75 15.6748 4.425C17.0998 5.85 17.0998 8.25 15.6748 9.75C15.5248 9.9 15.2998 9.975 15.1498 9.975Z" fill="#0A84FF" />
                            <path d="M4.49988 12.075C4.27488 12.075 4.12488 12 3.97488 11.85C3.67488 11.55 3.67488 11.1 3.97488 10.8L10.3499 4.42495C10.6499 4.12495 11.0999 4.12495 11.3999 4.42495C11.6999 4.72495 11.6999 5.17495 11.3999 5.47495L5.02488 11.85C4.94988 12 4.72488 12.075 4.49988 12.075Z" fill="#0A84FF" />
                            <path d="M8.7749 16.35C8.5499 16.35 8.3999 16.275 8.2499 16.125C7.9499 15.825 7.9499 15.375 8.2499 15.075L14.6249 8.69998C14.9249 8.39998 15.3749 8.39998 15.6749 8.69998C15.9749 8.99998 15.9749 9.44998 15.6749 9.74998L9.2999 16.125C9.1499 16.275 8.9999 16.35 8.7749 16.35Z" fill="#0A84FF" />
                            <path d="M6.67493 14.175C6.44993 14.175 6.29993 14.1 6.14993 13.95C5.84993 13.65 5.84993 13.2 6.14993 12.9L12.5249 6.52505C12.8249 6.22505 13.2749 6.22505 13.5749 6.52505C13.8749 6.82505 13.8749 7.27505 13.5749 7.57505L7.19993 13.95C7.04993 14.175 6.82493 14.175 6.67493 14.175Z" fill="#0A84FF" />
                            <path d="M2.3999 9.975C2.1749 9.975 2.0249 9.9 1.8749 9.75C1.5749 9.45 1.5749 9 1.8749 8.7L10.3499 0.225C10.6499 -0.075 11.0999 -0.075 11.3999 0.225C11.6999 0.525 11.6999 0.975 11.3999 1.275L2.9249 9.75C2.7749 9.9 2.6249 9.975 2.3999 9.975Z" fill="#0A84FF" />
                            <path d="M5.62483 17.625C4.27483 17.625 2.92483 17.1 1.94983 16.125C0.974829 15.15 0.449829 13.8 0.449829 12.45C0.449829 11.1 0.974829 9.75005 1.94983 8.77505C2.24983 8.47505 2.69983 8.47505 2.99983 8.77505C3.29983 9.07505 3.29983 9.52505 2.99983 9.82505C2.32483 10.5 1.87483 11.475 1.87483 12.45C1.87483 13.425 2.24983 14.4 2.99983 15.075C4.42483 16.5 6.82483 16.5 8.32483 15.075C8.62483 14.775 9.07483 14.775 9.37483 15.075C9.67483 15.375 9.67483 15.825 9.37483 16.125C8.24983 17.175 6.97483 17.625 5.62483 17.625Z" fill="#0A84FF" />
                        </g>
                        <defs>
                            <clipPath id="clip0_279_568">
                                <rect width="18" height="18" fill="white" />
                            </clipPath>
                        </defs>
                    </svg>
                </div>
                <div className="headerOfComposeMailx">
                    <div className="composeMailTitle">
                        New Message
                    </div>
                    <svg onClick={() => {
                        if (to === '' || subject === '' || body === '') return;
                        props.onSend(to, phoneSettings.smrtId, subject, body, attachments);
                    }} xmlns="http://www.w3.org/2000/svg" className='clickanimation' width="2.78vh" height="2.78vh" viewBox="0 0 30 30" fill="none">
                        <circle cx="14.9999" cy="15" r="15" fill="#E9E9E9" fillOpacity="0.38" />
                        <path d="M15.707 6.29289C15.3165 5.90237 14.6833 5.90237 14.2928 6.29289L7.92881 12.6569C7.53829 13.0474 7.53829 13.6805 7.92881 14.0711C8.31933 14.4616 8.9525 14.4616 9.34302 14.0711L14.9999 8.41421L20.6567 14.0711C21.0473 14.4616 21.6804 14.4616 22.0709 14.0711C22.4615 13.6805 22.4615 13.0474 22.0709 12.6569L15.707 6.29289ZM15.9999 22V7H13.9999V22H15.9999Z" fill="white" fillOpacity="0.6" />
                    </svg>
                </div>
                <div className="composeMailContent">
                    <div className="composeMailData">
                        <div className="toMail">
                            <div className="title">To :</div>
                            <input value={to} onChange={(e) => {
                                setTo(e.target.value);
                            }} type="text" placeholder="" className="inputSsd"
                                onFocus={() => fetchNui("disableControls", true)}
                                onBlur={() => fetchNui("disableControls", false)}
                            />
                        </div>
                        <div style={{ width: '100%', height: '0.09vh', backgroundColor: 'rgba(255,255,255,0.2)', marginTop: '0.36vh' }} />
                        <div className="toMail" style={{ marginTop: '0.36vh' }}>
                            <div className="title" style={{ width: '5.33vh' }}>From :</div>
                            <input value={phoneSettings.smrtId} disabled type="text" placeholder="" className="inputSsd"
                                onFocus={() => fetchNui("disableControls", true)}
                                onBlur={() => fetchNui("disableControls", false)}
                            />
                        </div>
                        <div style={{ width: '100%', height: '0.09vh', backgroundColor: 'rgba(255,255,255,0.2)', marginTop: '0.36vh' }} />
                        <div className="toMail" style={{ marginTop: '0.36vh' }}>
                            <div className="title" style={{ width: '7.11vh' }}>Subject :</div>
                            <input value={subject} type="text" placeholder="" className="inputSsd"
                                onFocus={() => fetchNui("disableControls", true)}
                                onBlur={() => fetchNui("disableControls", false)}
                                onChange={(e) => {
                                    setSubject(e.target.value);
                                }}
                            />
                        </div>
                        <div style={{ width: '100%', height: '0.09vh', backgroundColor: 'rgba(255,255,255,0.2)', marginTop: '0.36vh' }} />
                        {showAttachments && attachments.map((_attachment, index) => {
                            return (
                                <div key={index} className="toMail" style={{ marginTop: '0.36vh' }}>
                                    <div className="title" style={{ width: '5.33vh' }}>Link {index + 1} :</div>
                                    <input type="text" placeholder="" onChange={(event) => {
                                        const newAttachments = attachments;
                                        newAttachments[index] = event.target.value;
                                        setAttachments(newAttachments);
                                    }} className="inputSsd"
                                        style={{ width: '19.56vh' }}
                                        onFocus={() => fetchNui("disableControls", true)}
                                        onBlur={() => fetchNui("disableControls", false)}
                                    />
                                    <svg className='clickanimation' onClick={() => {
                                        setAttachments([...attachments, '']);
                                    }} width="1.85vh" height="1.85vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path fillRule="evenodd" clipRule="evenodd" d="M10 18.75C5.1675 18.75 1.25 14.8313 1.25 10C1.25 5.16875 5.1675 1.25 10 1.25C14.8325 1.25 18.75 5.16875 18.75 10C18.75 14.8313 14.8325 18.75 10 18.75ZM10 0C4.47687 0 0 4.475 0 10C0 15.525 4.47687 20 10 20C15.5231 20 20 15.525 20 10C20 4.475 15.5231 0 10 0ZM13.75 9.375H10.625V6.25C10.625 5.90625 10.3456 5.625 10 5.625C9.65438 5.625 9.375 5.90625 9.375 6.25V9.375H6.25C5.90438 9.375 5.625 9.65625 5.625 10C5.625 10.3438 5.90438 10.625 6.25 10.625H9.375V13.75C9.375 14.0938 9.65438 14.375 10 14.375C10.3456 14.375 10.625 14.0938 10.625 13.75V10.625H13.75C14.0956 10.625 14.375 10.3438 14.375 10C14.375 9.65625 14.0956 9.375 13.75 9.375Z" fill="#0A84FF" />
                                    </svg>
                                </div>
                            )
                        })}
                    </div>
                    <div className="composeMailBody">
                        <Textarea className="composeMailTextArea"
                            onFocus={() => fetchNui("disableControls", true)}
                            onBlur={() => fetchNui("disableControls", false)}
                            styles={{
                                input: {
                                    backgroundColor: 'rgba(255,255,255,0.0)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.89vh',
                                    width: '100%',
                                    height: '26.67vh',
                                    resize: 'none',
                                    fontSize: '1.47vh',
                                }
                            }}
                            onChange={(e) => {
                                setBody(e.currentTarget.value);
                            }}
                            value={body}
                        />
                    </div>
                </div>
            </div>}
        </Transition>
    )
}