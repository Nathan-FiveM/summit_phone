import { Transition } from "@mantine/core";
import Title from "../../components/Title";

export default function FilterPage(props: { show: boolean, inboxCount: number, draftCount: number, sentCount: number, binCount: number, onClick: (filter: string) => void, onLogout: () => void }) {
    return (
        <Transition
            mounted={props.show}
            transition="slide-up"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={{
                ...styles,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <div style={{
                    marginTop: '2.67vh',
                    letterSpacing: '0.18vh',
                }}>
                    <Title
                        title="Mailbox"
                        mt="1.78vh"
                    />
                </div>
                <div style={{
                    width: '90%',
                    marginTop: '1.78vh',
                    color: '#FFF',
                    fontSize: '1.39vh',
                    fontStyle: 'normal',
                    fontWeight: 700,
                    lineHeight: 'normal',
                    letterSpacing: '0.07vh',
                }}>SMRT Cloud</div>
                <div className="innerCont" style={{ marginTop: '0.36vh', marginLeft: '0', maxHeight: '16.00vh', overflowY: 'auto', overflowX: 'hidden' }}>
                    <div className="inbox" style={{
                        width: '100%',
                    }}>
                        <div style={{ paddingLeft: '0.53vh', display: 'flex', width: '100%' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="2.13vh" height="2.04vh" viewBox="0 0 17 18" fill="none">
                                <path d="M10.0498 12.6691H6.95757C6.72565 12.6691 6.49373 12.4887 6.33912 12.3083L5.02491 9.96371H0.773077C0.30924 9.96371 1.52407e-05 9.603 1.52588e-05 9.06193C1.52769e-05 8.52086 0.30924 8.16015 0.773077 8.16015H5.41144C5.64336 8.16015 5.87528 8.34051 6.02989 8.52086L7.3441 10.8655H9.58597L10.9002 8.52086C11.0548 8.25033 11.2867 8.16015 11.5186 8.16015H16.157C16.6208 8.16015 16.9301 8.52086 16.9301 9.06193C16.9301 9.603 16.6208 9.96371 16.157 9.96371H11.9052L10.591 12.3083C10.5136 12.4887 10.2817 12.6691 10.0498 12.6691Z" fill="#0A84FF" />
                                <path d="M14.6818 17.219H2.3182C1.00456 17.219 1.52588e-05 16.0407 1.52588e-05 14.4999V9.06193C1.52588e-05 8.88066 1.52671e-05 8.79003 0.077288 8.6994L2.70456 2.44568C3.1682 1.44871 3.94093 0.904907 4.79093 0.904907H12.1318C12.9818 0.904907 13.8318 1.44871 14.2182 2.44568L16.8455 8.6994C17 8.79003 17 8.88066 17 9.06193V14.4999C17 16.0407 15.9955 17.219 14.6818 17.219ZM1.54547 9.2432V14.4999C1.54547 15.0438 1.85456 15.4063 2.3182 15.4063H14.6818C15.1455 15.4063 15.4546 15.0438 15.4546 14.4999V9.2432L12.9046 3.17075C12.75 2.89885 12.4409 2.71758 12.2091 2.71758H4.79093C4.55911 2.71758 4.25002 2.89885 4.09547 3.26138L1.54547 9.2432Z" fill="#0A84FF" />
                            </svg>
                            <div style={{
                                width: '75%', marginLeft: '0.89vh',
                                color: '#FFF',
                                fontSize: '1.48vh',
                                fontStyle: 'normal',
                                fontWeight: 700,
                                lineHeight: 'normal',
                                letterSpacing: '0.09vh'
                            }}>
                                Inbox
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                width: '11%',
                                gap: '0.71vh',
                                cursor: 'pointer',
                            }} onClick={() => props.onClick('inbox')}>
                                <div style={{
                                    color: 'rgba(255, 255, 255, 0.30)',
                                    textAlign: 'right',
                                    fontSize: '1.39vh',
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    lineHeight: 'normal',
                                    letterSpacing: '0.07vh',
                                }}>
                                    {props.inboxCount}
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="6" height="15" viewBox="0 0 6 15" fill="none">
                                    <path d="M1.00002 13.3058L4.72802 7.87553C4.8919 7.63682 4.8919 7.32186 4.72802 7.08315L1.00001 1.65289" stroke="#5E5E5E" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                        <div className="divider" style={{ marginTop: '0.36vh', width: '87%', marginLeft: '3.56vh' }}></div>
                        <div style={{ paddingLeft: '0.53vh', display: 'flex', width: '100%', marginTop: '0.89vh' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="2.13vh" height="2.04vh" viewBox="0 0 12 18" fill="none">
                                <path d="M9.4769 17.1777H1.72304C0.771509 17.1777 1.52588e-05 16.2649 1.52588e-05 15.1388V2.90529C1.52588e-05 1.77913 0.771509 0.866354 1.72304 0.866354H6.89231C7.46883 0.855479 7.69843 0.88089 7.75387 0.88089V0.866354L11.2 4.94411V15.1388C11.2 16.2649 10.4285 17.1777 9.4769 17.1777ZM7.75387 1.88576V3.9247C7.75387 4.48761 8.13952 4.94411 8.61534 4.94411H10.3385L7.75387 1.88576ZM10.3385 5.96363H8.61534C7.66371 5.96363 6.89231 5.05085 6.89231 3.9247C6.89231 3.9247 6.87224 3.10646 6.88008 1.88576H1.72304C1.24723 1.88576 0.861482 2.34215 0.861482 2.90529V15.1388C0.861482 15.7018 1.24723 16.1583 1.72304 16.1583H9.4769C9.95271 16.1583 10.3385 15.7018 10.3385 15.1388V5.96363Z" fill="#0A84FF" />
                            </svg>
                            <div style={{
                                width: '75%', marginLeft: '0.89vh',
                                color: '#FFF',
                                fontSize: '1.48vh',
                                fontStyle: 'normal',
                                fontWeight: 700,
                                lineHeight: 'normal',
                                letterSpacing: '0.09vh'
                            }}>
                                Draft
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                width: '11%',
                                gap: '0.71vh',
                                cursor: 'pointer',
                            }} onClick={() => props.onClick('draft')}>
                                <div style={{
                                    color: 'rgba(255, 255, 255, 0.30)',
                                    textAlign: 'right',
                                    fontSize: '1.39vh',
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    lineHeight: 'normal',
                                    letterSpacing: '0.07vh',
                                }}>
                                    {props.draftCount}
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="6" height="15" viewBox="0 0 6 15" fill="none">
                                    <path d="M1.00002 13.3058L4.72802 7.87553C4.8919 7.63682 4.8919 7.32186 4.72802 7.08315L1.00001 1.65289" stroke="#5E5E5E" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                        <div className="divider" style={{ marginTop: '0.36vh', width: '87%', marginLeft: '3.56vh' }}></div>
                        <div style={{ paddingLeft: '0.53vh', display: 'flex', width: '100%', marginTop: '0.89vh' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="2.13vh" height="2.04vh" viewBox="0 0 15 18" fill="none">
                                <path d="M1.52588e-05 8.40653L5.48525 11.2521L8.12397 17.1363L14.8235 0.822266L1.52588e-05 8.40653ZM1.5872 8.4202L12.8169 2.55773L5.77362 10.7593L1.5872 8.4202ZM6.17365 11.1811L13.3215 2.84365L8.19194 15.662L6.17365 11.1811Z" fill="#0A84FF" />
                            </svg>
                            <div style={{
                                width: '75%', marginLeft: '0.89vh',
                                color: '#FFF',
                                fontSize: '1.48vh',
                                fontStyle: 'normal',
                                fontWeight: 700,
                                lineHeight: 'normal',
                                letterSpacing: '0.09vh'
                            }}>
                                Sent
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                width: '11%',
                                gap: '0.71vh',
                                cursor: 'pointer',
                            }} onClick={() => props.onClick('sent')}>
                                <div style={{
                                    color: 'rgba(255, 255, 255, 0.30)',
                                    textAlign: 'right',
                                    fontSize: '1.39vh',
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    lineHeight: 'normal',
                                    letterSpacing: '0.07vh',
                                }}>
                                    {props.sentCount}
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="6" height="15" viewBox="0 0 6 15" fill="none">
                                    <path d="M1.00002 13.3058L4.72802 7.87553C4.8919 7.63682 4.8919 7.32186 4.72802 7.08315L1.00001 1.65289" stroke="#5E5E5E" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                        <div className="divider" style={{ marginTop: '0.36vh', width: '87%', marginLeft: '3.56vh' }}></div>
                        <div style={{ paddingLeft: '0.53vh', display: 'flex', width: '100%', marginTop: '0.89vh' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="23" height="1.67vh" viewBox="0 0 12 14" fill="none">
                                <path d="M0.872694 4.375V13.125C0.872694 13.6062 1.2654 14 1.74537 14H9.59948C10.0795 14 10.4722 13.6062 10.4722 13.125V4.375H0.872694ZM3.49073 12.25H2.61805V6.125H3.49073V12.25ZM5.23609 12.25H4.36341V6.125H5.23609V12.25ZM6.98145 12.25H6.10877V6.125H6.98145V12.25ZM8.72681 12.25H7.85413V6.125H8.72681V12.25Z" fill="#0A84FF" />
                                <path d="M10.6903 1.75H7.85413V0.65625C7.85413 0.295312 7.5596 0 7.19962 0H4.14524C3.78526 0 3.49073 0.295312 3.49073 0.65625V1.75H0.654525C0.294544 1.75 1.52588e-05 2.04531 1.52588e-05 2.40625V3.5H11.3448V2.40625C11.3448 2.04531 11.0503 1.75 10.6903 1.75ZM6.98145 1.75H4.36341V0.885938H6.98145V1.75Z" fill="#0A84FF" />
                            </svg>
                            <div style={{
                                width: '75%', marginLeft: '0.89vh',
                                color: '#FFF',
                                fontSize: '1.48vh',
                                fontStyle: 'normal',
                                fontWeight: 700,
                                lineHeight: 'normal',
                                letterSpacing: '0.09vh'
                            }}>
                                Bin
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                width: '11%',
                                gap: '0.71vh',
                                cursor: 'pointer',
                            }} onClick={() => props.onClick('bin')}>
                                <div style={{
                                    color: 'rgba(255, 255, 255, 0.30)',
                                    textAlign: 'right',
                                    fontSize: '1.39vh',
                                    fontStyle: 'normal',
                                    fontWeight: 700,
                                    lineHeight: 'normal',
                                    letterSpacing: '0.07vh',
                                }}>
                                    {props.binCount}
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" width="6" height="15" viewBox="0 0 6 15" fill="none">
                                    <path d="M1.00002 13.3058L4.72802 7.87553C4.8919 7.63682 4.8919 7.32186 4.72802 7.08315L1.00001 1.65289" stroke="#5E5E5E" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="innerCont" style={{ marginTop: '1.78vh', marginLeft: '0', maxHeight: '16.00vh', overflowY: 'auto', overflowX: 'hidden' }}>
                    <div className="inbox" style={{
                        width: '100%',
                    }}>
                        <div style={{ paddingLeft: '0.53vh', display: 'flex', width: '100%' }}>
                            <svg width="2.13vh" height="2.04vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M10 10C7.794 10 6 8.206 6 6C6 3.794 7.794 2 10 2C12.206 2 14 3.794 14 6C14 8.206 12.206 10 10 10ZM13.758 10.673C15.124 9.57397 16 7.89 16 6C16 2.686 13.314 0 10 0C6.686 0 4 2.686 4 6C4 7.89 4.876 9.57397 6.242 10.673C2.583 12.048 0 15.445 0 20H2C2 15 5.589 12 10 12C14.411 12 18 15 18 20H20C20 15.445 17.417 12.048 13.758 10.673Z" fill="#0A84FF" />
                            </svg>

                            <div style={{
                                width: '75%', marginLeft: '0.89vh',
                                color: '#FFF',
                                fontSize: '1.48vh',
                                fontStyle: 'normal',
                                fontWeight: 700,
                                lineHeight: 'normal',
                                letterSpacing: '0.09vh'
                            }}>
                                Edit You Profile
                            </div>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                width: '11%',
                                gap: '0.71vh',
                                cursor: 'pointer',
                            }} onClick={() => props.onClick('profile')}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="6" height="15" viewBox="0 0 6 15" fill="none">
                                    <path d="M1.00002 13.3058L4.72802 7.87553C4.8919 7.63682 4.8919 7.32186 4.72802 7.08315L1.00001 1.65289" stroke="#5E5E5E" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div className="divider" style={{ marginTop: '0.36vh', width: '87%', marginLeft: '3.56vh' }}></div>
                    <div className="inbox" style={{
                        width: '100%',
                    }}>
                        <div style={{ paddingLeft: '0.53vh', display: 'flex', width: '100%' }}>
                            <svg width="2.13vh" height="2.04vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" clipRule="evenodd" d="M10 10C7.794 10 6 8.206 6 6C6 3.794 7.794 2 10 2C12.206 2 14 3.794 14 6C14 8.206 12.206 10 10 10ZM13.758 10.673C15.124 9.57397 16 7.89 16 6C16 2.686 13.314 0 10 0C6.686 0 4 2.686 4 6C4 7.89 4.876 9.57397 6.242 10.673C2.583 12.048 0 15.445 0 20H2C2 15 5.589 12 10 12C14.411 12 18 15 18 20H20C20 15.445 17.417 12.048 13.758 10.673Z" fill="#0A84FF" />
                            </svg>

                            <div style={{
                                width: '75%', marginLeft: '0.89vh',
                                color: '#FFF',
                                fontSize: '1.48vh',
                                fontStyle: 'normal',
                                fontWeight: 700,
                                lineHeight: 'normal',
                                letterSpacing: '0.09vh'
                            }} onClick={() => {
                                props.onLogout();
                            }}>
                                Logout
                            </div>
                            {/* <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                width: '11%',
                                gap: '0.71vh',
                                cursor: 'pointer',
                            }} onClick={() => props.onClick('profile')}>
                                <svg xmlns="http://www.w3.org/2000/svg" width="6" height="15" viewBox="0 0 6 15" fill="none">
                                    <path d="M1.00002 13.3058L4.72802 7.87553C4.8919 7.63682 4.8919 7.32186 4.72802 7.08315L1.00001 1.65289" stroke="#5E5E5E" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div> */}
                        </div>
                    </div>
                </div>
            </div>}
        </Transition>
    );
}