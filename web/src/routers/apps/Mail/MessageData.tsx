import { Avatar, Transition } from "@mantine/core";
import { usePhone } from "../../../store/store";
import { PhoneMailMessage } from "../../../../../types/types";

export default function MessageData(props: { show: boolean, message: PhoneMailMessage, totalUnreadMessages: number }) {
    const { location, setLocation } = usePhone();
    const totalUnreadMessages = props.totalUnreadMessages;

    function formatedDate(date: string) {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const newDate = new Date(date);
        const timeDiff = today.getTime() - newDate.getTime();
        if (newDate > yesterday && timeDiff < 900000) {
            return 'Just Now';
        } else if (newDate > yesterday && timeDiff < 3600000) {
            return `${Math.floor(timeDiff / 60000)} minutes ago`;
        } else if (newDate > yesterday && timeDiff < 7200000) {
            return '1 hour ago';
        } else if (newDate > yesterday && timeDiff < 86400000) {
            return `${Math.floor(timeDiff / 3600000)} hours ago`;
        } else if (newDate > yesterday) {
            return 'Yesterday';
        } else {
            return `${newDate.getDate().toString().padStart(2, '0')}/${(newDate.getMonth() + 1).toString().padStart(2, '0')}/${newDate.getFullYear()}`;
        }
    }

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
                height: '100%',
                position: 'absolute',
                backgroundColor: '#0E0E0E',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <div style={{
                    width: '90%',
                }}>
                    <svg style={{
                        marginTop: '4.44vh',
                        cursor: 'pointer',
                    }} onClick={() => {
                        setLocation({
                            app: 'mail',
                            page: {
                                ...location.page,
                                mail: ''
                            }
                        })
                    }} width="4.26vh" height="1.67vh" viewBox="0 0 42 17" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M6.99988 16L1.34971 8.93729C1.14519 8.68163 1.14519 8.31837 1.34971 8.06271L6.99988 1" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" />
                        <path d="M16.4471 13H12.703V4.54492H16.3827C17.9706 4.54492 18.9667 5.35938 18.9667 6.6543C18.9667 7.58008 18.2753 8.35352 17.3788 8.48828V8.53516C18.5272 8.62305 19.371 9.46094 19.371 10.5801C19.371 12.0684 18.2518 13 16.4471 13ZM14.4725 5.86328V8.06055H15.744C16.6874 8.06055 17.2264 7.64453 17.2264 6.92969C17.2264 6.25 16.7518 5.86328 15.9257 5.86328H14.4725ZM14.4725 11.6816H15.996C17.0155 11.6816 17.5663 11.248 17.5663 10.4395C17.5663 9.64844 16.9979 9.22656 15.955 9.22656H14.4725V11.6816ZM23.2581 11.8633C24.0022 11.8633 24.6175 11.377 24.6175 10.6973V10.2402L23.2932 10.3223C22.6546 10.3691 22.2913 10.6562 22.2913 11.1016C22.2913 11.5703 22.678 11.8633 23.2581 11.8633ZM22.6956 13.0996C21.5003 13.0996 20.5921 12.3262 20.5921 11.1953C20.5921 10.0527 21.471 9.39062 23.0354 9.29688L24.6175 9.20312V8.78711C24.6175 8.20117 24.2073 7.86133 23.5628 7.86133C22.9241 7.86133 22.5198 8.17773 22.4378 8.64062H20.8733C20.9378 7.42188 21.9749 6.58398 23.6389 6.58398C25.2503 6.58398 26.2991 7.41602 26.2991 8.68164V13H24.6468V12.0391H24.6116C24.26 12.707 23.4807 13.0996 22.6956 13.0996ZM33.7135 9.05664H32.1257C32.026 8.39453 31.5866 7.92578 30.8835 7.92578C30.0397 7.92578 29.5124 8.64062 29.5124 9.85352C29.5124 11.0898 30.0397 11.793 30.8893 11.793C31.5749 11.793 32.0202 11.3828 32.1257 10.6973H33.7194C33.6315 12.1797 32.5241 13.1348 30.8718 13.1348C28.9792 13.1348 27.778 11.9043 27.778 9.85352C27.778 7.83789 28.9792 6.58398 30.86 6.58398C32.5593 6.58398 33.6374 7.63281 33.7135 9.05664ZM36.921 9.23828L39.0538 6.71875H40.9932L38.5968 9.41406L41.1104 13H39.1417L37.3428 10.4453L36.8975 10.9258V13H35.1866V4.54492H36.8975V9.23828H36.921Z" fill="#0A84FF" />
                    </svg>
                </div>
                <div className="mailMessageheader" style={{ marginTop: '0.36vh' }}>
                    <Avatar size={'3.24vh'} src={props.message.avatar ?? "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} />
                    <div className="semicontexsa">
                        <div className="titleCont">
                            <div className="title">{props.message.subject}</div>
                            <div className="timestamp">
                                <div className="treasa">{formatedDate(props.message.date)}</div>
                            </div>
                        </div>
                        <div className="toCont">
                            <div className="to">To:</div>
                            <div className="toEmail">{props.message.username}</div>
                        </div>
                    </div>
                </div>
                <div className="divider" />
                <div className="mailMessageBody">
                    <div>{props.message.message}</div>
                    <div>
                        {props.message.images.map((image, index) => {
                            return <div key={index} style={{
                                width: '100%',
                                height: '17.78vh',
                                marginTop: '1.78vh',
                                backgroundImage: `url(${image})`,
                                backgroundSize: 'contain',
                                backgroundRepeat: 'no-repeat',
                                backgroundPosition: 'center',
                                borderRadius: '0.89vh',
                            }} />
                        })}
                    </div>
                </div>
                <div style={{
                    width: '100%',
                    height: '8.5%',
                    position: 'absolute',
                    bottom: '0',
                    backgroundColor: '#1A1A1A',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                }} className="footer">
                    <div style={{
                        color: 'rgba(255, 255, 255, 1)',
                        fontSize: '1.30vh',
                        fontStyle: 'normal',
                        fontWeight: 700,
                        lineHeight: 'normal',
                        letterSpacing: '0.06vh',
                    }}>{totalUnreadMessages} Unread Messages</div>
                    <svg style={{
                        position: 'absolute',
                        right: '1.78vh',
                        top: '10%',
                        cursor: 'pointer',
                    }} onClick={() => {
                        setLocation({
                            app: 'mail',
                            page: {
                                ...location.page,
                                mail: 'compose'
                            }
                        });
                    }} xmlns="http://www.w3.org/2000/svg" width="2.22vh" height="2.22vh" viewBox="0 0 24 24" fill="none">
                        <path d="M19.0004 22.9566H1.0001V5.21684H15.0074L16.0076 4.17347H-0.00012207V24H20.0001V8.34L19.0004 9.38337V22.9566Z" fill="#0A84FF" />
                        <path d="M10.8517 14.3533L10.2451 13.7204L20.9523 2.54716L20.2449 1.80884L9.00005 13.5423V15.6518H11.0137L22.2663 3.91453L21.5589 3.17874L10.8517 14.3533ZM23.7639 1.06358L22.9845 0.250737C22.8122 0.0896513 22.5898 0.000471931 22.3593 0C22.1211 0 21.9033 0.096 21.7389 0.251368L20.9793 1.04337L20.9847 1.04842L23.0043 3.156L23.7633 2.36337C23.9156 2.18486 23.9999 1.9534 23.9999 1.71347C23.9999 1.47355 23.9156 1.24208 23.7633 1.06358H23.7639Z" fill="#0A84FF" />
                    </svg>
                </div>
            </div>}
        </Transition>
    );
}