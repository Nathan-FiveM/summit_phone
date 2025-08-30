import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Title from "../../components/Title";
import Searchbar from "../../components/SearchBar";
import CreateNew from "./CreateNew";
import { fetchNui } from "../../../hooks/fetchNui";
import { useNuiEvent } from "../../../hooks/useNuiEvent";
import { generateUUid } from "../../../hooks/misc";
import 'react-responsive-modal/styles.css';
import { Modal } from 'react-responsive-modal';

export default function BluePage(props: { onEnter: () => void, onExit: () => void }) {
    const nodeRef = useRef(null);
    const { location, phoneSettings, setLocation } = usePhone();
    const [searchValue, setSearchValue] = useState('');
    const [postData, setPostData] = useState<{
        _id: string,
        title: string,
        content: string,
        imageAttachment: string,
        phoneNumber: string,
        email: string;
        createdAt: string;
    }[]>([]);

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
    };

    useNuiEvent('refreshBluePosts', (data: string) => {
        const parsedData = JSON.parse(data);
        setPostData([parsedData, ...postData]);
    });

    useNuiEvent('refreshDeletePost', (data: string) => {
        setPostData(postData.filter((post) => post._id !== data));
    });

    const [imgContainer, setOpenImgContainer] = useState(false);
    const [selectedImg, setSelectedImg] = useState<string | null>(null);
    const onCloseModal = () => {
        setOpenImgContainer(false);
        setSelectedImg(null);
    };

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'bluepage'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                props.onEnter();
                const res = await fetchNui('bluepage:getPosts');
                setPostData(JSON.parse(res as string));
            }}
            onExited={props.onExit}
        >
            <div
                ref={nodeRef}
                style={{
                    backgroundColor: '#0E0E0E',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
                className="settings"
            >
                <div style={{
                    width: '90%',
                    display: 'flex',
                    marginTop: '3.56vh',
                    letterSpacing: '0.18vh',
                    alignItems: 'center',
                }}>
                    <Title title="Blue Page" />
                    <svg className='clickanimation' onClick={() => {
                        setLocation({
                            app: 'bluepage',
                            page: {
                                ...location.page,
                                bluepages: 'createnew',
                            }
                        });
                    }} width="2.22vh" height="2.22vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19.8048 0.252418C19.7345 0.175226 19.6493 0.113079 19.5544 0.069733C19.4594 0.0263867 19.3567 0.00274094 19.2524 0.000224464C19.148 -0.00229201 19.0442 0.016373 18.9473 0.0550919C18.8504 0.0938107 18.7623 0.151779 18.6884 0.225495L18.0937 0.817321C18.0216 0.889443 17.9812 0.987234 17.9812 1.0892C17.9812 1.19116 18.0216 1.28895 18.0937 1.36107L18.6389 1.9053C18.6746 1.94121 18.7171 1.9697 18.7639 1.98914C18.8107 2.00858 18.8608 2.01859 18.9115 2.01859C18.9622 2.01859 19.0123 2.00858 19.0591 1.98914C19.1059 1.9697 19.1484 1.94121 19.1841 1.9053L19.7639 1.32838C20.0572 1.03559 20.0846 0.558668 19.8048 0.252418Z" fill="#0A84FF" />
                        <path d="M16.8913 2.01924L8.21248 10.6827C8.15986 10.7351 8.12162 10.8002 8.10143 10.8716L7.69999 12.0673C7.69037 12.0998 7.68969 12.1342 7.69801 12.167C7.70634 12.1998 7.72336 12.2297 7.74729 12.2537C7.77122 12.2776 7.80116 12.2946 7.83396 12.3029C7.86676 12.3113 7.9012 12.3106 7.93364 12.301L9.12835 11.8995C9.19981 11.8793 9.26488 11.8411 9.31729 11.7885L17.9807 3.10867C18.0609 3.02766 18.1058 2.9183 18.1058 2.80434C18.1058 2.69038 18.0609 2.58102 17.9807 2.50001L17.5024 2.01924C17.4213 1.93836 17.3114 1.89294 17.1968 1.89294C17.0823 1.89294 16.9724 1.93836 16.8913 2.01924Z" fill="#0A84FF" />
                        <path d="M16.2663 7.00289L10.4062 12.8745C10.1797 13.1016 9.90137 13.27 9.59517 13.3654L8.34998 13.7822C8.05447 13.8657 7.74205 13.8688 7.44491 13.7913C7.14778 13.7139 6.87668 13.5585 6.65954 13.3414C6.44241 13.1243 6.2871 12.8532 6.20962 12.556C6.13214 12.2589 6.13529 11.9465 6.21874 11.651L6.63556 10.4058C6.73063 10.0997 6.89877 9.82131 7.12547 9.59472L12.9971 3.73367C13.0509 3.6799 13.0876 3.61139 13.1025 3.53679C13.1173 3.46218 13.1098 3.38484 13.0807 3.31455C13.0516 3.24425 13.0023 3.18415 12.9391 3.14186C12.8759 3.09956 12.8015 3.07697 12.7255 3.07693H2.6923C1.97826 3.07693 1.29346 3.36059 0.788557 3.86549C0.283653 4.3704 0 5.0552 0 5.76924V17.3077C0 18.0217 0.283653 18.7065 0.788557 19.2114C1.29346 19.7163 1.97826 20 2.6923 20H14.2307C14.9448 20 15.6296 19.7163 16.1345 19.2114C16.6394 18.7065 16.923 18.0217 16.923 17.3077V7.27453C16.923 7.19846 16.9004 7.1241 16.8581 7.06087C16.8158 6.99764 16.7557 6.94837 16.6854 6.91929C16.6151 6.89022 16.5378 6.88264 16.4632 6.89752C16.3886 6.9124 16.3201 6.94907 16.2663 7.00289Z" fill="#0A84FF" />
                    </svg>
                </div>
                <Searchbar value={searchValue} onChange={(e) => {
                    setSearchValue(e);
                }} mt="0.53vh" />
                <div style={{
                    width: '90%',
                    height: '80%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    marginTop: '0.89vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                }}>
                    {postData.length > 0 && postData.filter(
                        (post) => post.title.toLowerCase().includes(searchValue.toLowerCase()) || post.content.toLowerCase().includes(searchValue.toLowerCase())
                    ).map((post, i) => {
                        return (
                            <div style={{
                                width: '100%',
                                backgroundColor: '#1A1A1A',
                                borderRadius: '0.89vh',
                                display: 'flex',
                                marginTop: i === 0 ? '' : '0.89vh',
                            }} key={i}>
                                <div style={{
                                    width: post.imageAttachment.length > 0 ? '60%' : '100%',
                                }}>
                                    <div style={{ fontSize: '1.78vh', padding: '0.89vh' }}>{post.title}</div>
                                    <div style={{
                                        fontSize: '1.24vh',
                                        fontWeight: 500,
                                        display: 'flex',
                                        flexDirection: 'column',
                                        padding: '0.89vh',
                                        marginTop: '-2.13vh',
                                        lineHeight: '1.60vh',
                                    }}>
                                        {post.content}
                                    </div>
                                    <div style={{
                                        display: 'flex',
                                        marginTop: '0.89vh',
                                        marginBottom: '0.89vh',
                                        gap: '0.89vh',
                                        marginLeft: '0.89vh',
                                        alignItems: 'center',
                                        justifyContent: 'start',
                                    }}>
                                        <svg onClick={async () => {
                                            if (post.phoneNumber === phoneSettings.phoneNumber) { fetchNui('showNoti', { app: 'settings', title: 'Phone', description: 'You can\'t call yourself' }); return };
                                            await fetchNui('phoneCall', JSON.stringify({
                                                number: post.phoneNumber,
                                                _id: generateUUid(),
                                            }));
                                        }} className='clickanimation' width="2.31vh" height="2.31vh" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="0.5" y="0.5" width="20" height="20" rx="2" fill="#585858" />
                                            <path d="M5.56401 6.12893C6.26972 5.32749 7.09613 4.92052 7.60791 5.43346L9.31505 7.14272C9.74797 7.57628 9.64295 8.15046 9.14526 8.74278C8.92245 9.00783 8.79085 9.33773 8.76998 9.68357C8.7491 10.0294 8.84007 10.3728 9.02938 10.6628C9.25872 11.0141 9.54599 11.3631 9.8912 11.7088C10.312 12.1303 10.7462 12.474 11.1932 12.7411C11.4764 12.9103 11.8046 12.9882 12.1334 12.9644C12.4623 12.9406 12.7759 12.8163 13.0319 12.6082C13.6523 12.1037 14.086 11.9212 14.4361 12.2713L16.1432 13.981C17.1619 15.0012 14.7048 17.2488 12.9446 16.9422C11.5243 16.6943 9.33154 15.137 7.89277 13.6961C6.62297 12.4244 4.91302 9.94877 4.65311 8.64648C4.49378 7.84987 4.88486 6.89894 5.56401 6.12812V6.12893Z" fill="white" />
                                        </svg>
                                        <svg onClick={() => {
                                            if (post.phoneNumber === phoneSettings.phoneNumber) { fetchNui('showNoti', { app: 'settings', title: 'Mail', description: 'You can\'t Message yourself' }); return };
                                            const data = {
                                                ...location.page,
                                                messages: `details/${post.phoneNumber}/undefined`,
                                            };
                                            setLocation({
                                                app: "message",
                                                page: data,
                                            });
                                        }} className='clickanimation' width="2.31vh" height="2.31vh" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <rect x="0.5" y="0.5" width="20" height="20" rx="2" fill="#585858" />
                                            <path d="M17.8774 7.27184L13.9976 11.2207C13.9688 11.2495 13.9688 11.2927 13.9976 11.3215L16.7127 14.2111C16.8966 14.3949 16.8966 14.6903 16.7127 14.874C16.6226 14.9641 16.5 15.011 16.381 15.011C16.262 15.011 16.1394 14.9641 16.0493 14.874L13.345 11.9953C13.3161 11.9665 13.2692 11.9665 13.2404 11.9953L12.5805 12.6654C12.0288 13.2239 11.2969 13.5338 10.5108 13.5374C9.71394 13.541 8.95673 13.2059 8.39784 12.6402L7.76322 11.9953C7.73438 11.9665 7.6875 11.9665 7.65865 11.9953L4.95433 14.874C4.86418 14.9641 4.74159 15.011 4.6226 15.011C4.50361 15.011 4.38101 14.9641 4.29087 14.874C4.10697 14.6903 4.10697 14.3949 4.29087 14.2111L7.00601 11.3215C7.03125 11.2927 7.03125 11.2495 7.00601 11.2207L3.1226 7.27184C3.07572 7.225 3 7.25743 3 7.32228V15.2235C3 15.8576 3.51923 16.3765 4.15385 16.3765H16.8462C17.4808 16.3765 18 15.8576 18 15.2235V7.32228C18 7.25743 17.9207 7.2286 17.8774 7.27184Z" fill="white" />
                                            <path d="M10.5 12.597C11.0337 12.597 11.5349 12.388 11.9099 12.0061L17.5673 6.25221C17.369 6.09368 17.1238 6 16.8534 6H4.15024C3.87981 6 3.63101 6.09368 3.4363 6.25221L9.09375 12.0061C9.46514 12.3844 9.96635 12.597 10.5 12.597Z" fill="white" />
                                        </svg>
                                        {post.phoneNumber === phoneSettings.phoneNumber && <svg onClick={() => {
                                            fetchNui('showNoti', { app: 'bluepages', title: 'Delete', description: 'You deleted your own post' });
                                            fetchNui('bluepage:deletePost', post._id);
                                        }} className='clickanimation' width="1.39vh" height="1.39vh" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M2.81625 13.7123L1.5 4.5H13.5L12.1838 13.7123C12.1327 14.0697 11.9544 14.3967 11.6816 14.6332C11.4088 14.8698 11.0598 15 10.6987 15H4.30125C3.94018 15 3.59122 14.8698 3.31843 14.6332C3.04565 14.3967 2.86734 14.0697 2.81625 13.7123ZM14.25 1.5H10.5V0.75C10.5 0.551088 10.421 0.360322 10.2803 0.21967C10.1397 0.0790176 9.94891 0 9.75 0H5.25C5.05109 0 4.86032 0.0790176 4.71967 0.21967C4.57902 0.360322 4.5 0.551088 4.5 0.75V1.5H0.75C0.551088 1.5 0.360322 1.57902 0.21967 1.71967C0.0790176 1.86032 0 2.05109 0 2.25C0 2.44891 0.0790176 2.63968 0.21967 2.78033C0.360322 2.92098 0.551088 3 0.75 3H14.25C14.4489 3 14.6397 2.92098 14.7803 2.78033C14.921 2.63968 15 2.44891 15 2.25C15 2.05109 14.921 1.86032 14.7803 1.71967C14.6397 1.57902 14.4489 1.5 14.25 1.5Z" fill="#828282" />
                                        </svg>}
                                    </div>
                                    <div style={{
                                        fontSize: '1.07vh',
                                        fontWeight: 500,
                                        marginLeft: '0.89vh',
                                        color: '#828282',
                                        marginBottom: '0.36vh',
                                    }}>{formatedDate(post.createdAt)}</div>
                                </div>
                                {post.imageAttachment.length > 0 && <div style={{
                                    width: '40%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                }}>
                                    <img src={post.imageAttachment} alt="placeholder" onClick={() => {
                                        setOpenImgContainer(true);
                                        setSelectedImg(post.imageAttachment);
                                    }} style={{
                                        width: '100%',
                                        height: 'auto',
                                        borderRadius: '0.89vh',
                                    }} />
                                </div>}
                            </div>
                        )
                    })}
                </div>
                <CreateNew show={location.page.bluepages === 'createnew'} onSubmit={async (data: {
                    title: string,
                    content: string,
                    imageAttachment: string,
                }) => {
                    if (data.title.length > 0 && data.content.length > 0) {
                        setLocation({
                            app: 'bluepage',
                            page: {
                                ...location.page,
                                bluepages: '',
                            }
                        });
                        const res = await fetchNui('bluepage:createPost', JSON.stringify({
                            ...data,
                            phoneNumber: phoneSettings.phoneNumber,
                            email: phoneSettings.smrtId,
                        }));
                    };

                }} onCancel={() => {
                    setLocation({
                        app: 'bluepage',
                        page: {
                            ...location.page,
                            bluepages: '',
                        }
                    });
                }} />

                <Modal styles={{
                    modal: {
                        backgroundColor: 'rgba(0, 0, 0, 0)',
                        boxShadow: 'none',
                    },
                    closeIcon: {
                        color: 'white',
                        backgroundColor: 'rgba(255, 255, 255, 0.98)',
                    }
                }} open={imgContainer} onClose={onCloseModal} center>
                    <img src={selectedImg} style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '80.00vh',
                        borderRadius: '0.89vh',
                        objectFit: 'cover',
                    }} />
                </Modal>
            </div>
        </CSSTransition>
    )
}