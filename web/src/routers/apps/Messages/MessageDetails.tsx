import { CSSTransition } from "react-transition-group"
import { usePhone } from "../../../store/store"
import InfiniteScroll from 'react-infinite-scroll-component';
import { useCallback, useEffect, useRef, useState } from "react"
import { fetchNui } from "../../../hooks/fetchNui";
import { Avatar, Image, Menu, TextInput, Transition } from "@mantine/core";
import { PhoneContacts } from "../../../../../types/types";
import { useNuiEvent } from "../../../hooks/useNuiEvent";
import { useDebouncedCallback } from "@mantine/hooks";
import dayjs from "dayjs";

export interface Message {
    message: string;
    read: boolean;
    page: number;
    timestamp: string;
    senderId: string;
    attachments: { type: string; url: string }[];
}

export default function MessageDetails() {
    const { location, phoneSettings, setLocation } = usePhone();
    const nodeRef = useRef(null);
    const scrollableDivRef = useRef(null);
    const breakedLocation = location.page.messages.split("/");
    const [messages, setMessages] = useState<Message[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [page, setPage] = useState(1);
    const [avatar, setAvatar] = useState<string | null>(null);
    const [memberPhoneNumbers, setMemberPhoneNumbers] = useState<string[]>([]);
    const [name, setName] = useState<string>("");
    const [textValue, setTextValue] = useState("");
    const limit = 20;

    const identifier = breakedLocation[1] !== "undefined" ? breakedLocation[1] : breakedLocation[2];
    const conversationType = breakedLocation[1] !== "undefined" ? "private" : "group";
    const [showAttachmentModal, setShowAttachmentModal] = useState(false);
    const [attachments, setAttachments] = useState<{ type: string; url: string }[]>([]);
    const [isAdmin, setIsAdmin] = useState(false);

    const handeNewfetch = useDebouncedCallback(async () => {
        await fetchMessages(true);
    }, 500);

    useNuiEvent('upDatemessages', async () => {
        if (location.app === "message" && breakedLocation[0] === "details") {
            handeNewfetch();
        }
    })

    const fetchMessages = useCallback(
        async (resetPage = false) => {
            try {
                const currentPage = resetPage ? 1 : page;
                let response;
                if (conversationType === "private") {
                    response = await fetchNui(
                        "getPrivateMessages",
                        JSON.stringify({
                            phoneNumber: identifier,
                            page: currentPage,
                            limit,
                        })
                    );
                } else {
                    response = await fetchNui(
                        "getGroupMessages",
                        JSON.stringify({
                            groupId: identifier,
                            page: currentPage,
                            limit,
                        })
                    );


                    const data: string = await fetchNui('getContacts', JSON.stringify({}));
                    const contacts: PhoneContacts[] = JSON.parse(data);
                    setContactList(contacts);
                }
                const data: {
                    success: boolean;
                    name: string;
                    messages: Message[];
                    avatar?: string | null;
                    memberPhoneNumbers?: string[];
                    hasMore: boolean;
                    totalMessages: number;
                    creatorId: string;
                } = JSON.parse(response);

                if (data.success) {
                    setMessages((prev) => (resetPage ? data.messages : [...prev, ...data.messages]));
                    setHasMore(data.hasMore);
                    setAvatar(data.avatar || "");
                    setIsAdmin(data.creatorId === phoneSettings._id);
                    setName(data.name);
                    setMemberPhoneNumbers(data.memberPhoneNumbers || []);
                    if (!resetPage) setPage((prev) => prev + 1);
                }
            } catch (error) {
                console.error("Error fetching messages:", error);
            }
        },
        [conversationType, identifier, page]
    );

    useEffect(() => {
        if (scrollableDivRef.current) {
            scrollableDivRef.current.scrollTop = scrollableDivRef.current.scrollHeight;
        }
    }, [messages]);
    const [contactList, setContactList] = useState<PhoneContacts[]>([]);
    const sendMessage = async () => {
        if (!textValue.trim()) return;

        try {
            if (conversationType === "private") {
                await fetchNui(
                    "sendMessage",
                    JSON.stringify({
                        type: conversationType,
                        phoneNumber: identifier,
                        messageData: {
                            message: textValue,
                            attachments: attachments,
                        },
                    })
                );
            } else {
                await fetchNui(
                    "sendMessage",
                    JSON.stringify({
                        type: conversationType,
                        groupId: identifier,
                        messageData: {
                            message: textValue,
                            attachments: attachments,
                        },
                    })
                );
            }

            const newMessage: Message = {
                message: textValue,
                read: true,
                page: 1,
                timestamp: new Date().toISOString(),
                senderId: phoneSettings.phoneNumber,
                attachments: attachments,
            };
            setMessages((prev) => [newMessage, ...prev]);
            setTextValue("");
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };
    const [showAvatarModal, setShowAvatarModal] = useState(false);
    const [showMemberModal, setShowMemberModal] = useState(false);
    const [showAddMemberModal, setShowAddMemberModal] = useState(false);
    const [typedPhoneNumber, setTypedPhoneNumber] = useState("");
    const [opened, setOpened] = useState(-1);
    function getNameFromContactNumber(phoneNumber: string) {
        const contact = contactList.find((contact) => contact.contactNumber === phoneNumber);
        return contact ? `${contact.firstName} ${contact.lastName}` : phoneNumber;
    }
    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === "message" && breakedLocation[0] === "details"}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                await fetchMessages();
            }}
        >
            <div
                ref={nodeRef}
                style={{
                    backgroundColor: "#0E0E0E",
                    width: "100%",
                    height: "100%",
                    zIndex: 10,
                    position: "absolute",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}
                className="message"
            >
                <div className="messageDetails">
                    <div className="headerbar">
                        <svg
                            style={{ marginLeft: "0.89vh", cursor: "pointer" }}
                            onClick={() => {
                                const data = { ...location.page, messages: "" };
                                setLocation({ app: "message", page: data });
                                setMessages([]);
                                setPage(1);
                                setHasMore(true);
                            }}
                            xmlns="http://www.w3.org/2000/svg"
                            width="1.20vh"
                            height="1.67vh"
                            viewBox="0 0 13 18"
                            fill="none"
                        >
                            <path
                                d="M7 16.5L1.34983 9.43729C1.14531 9.18163 1.14531 8.81837 1.34983 8.56271L7 1.5"
                                stroke="#0A84FF"
                                strokeWidth="2"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className="headerMainCont" style={{ marginLeft: conversationType === 'private' ? "10%" : conversationType === "group" && isAdmin ? "15%" : "0%" }}>
                            <Avatar src={avatar ?? "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} size="3.70vh" radius="xl" onClick={() => {
                                if (conversationType === 'group' && isAdmin) {
                                    setShowAvatarModal(true);
                                }
                            }} style={{
                                cursor: conversationType === 'group' && isAdmin ? 'pointer' : 'default',

                                flexShrink: 0,
                            }} />
                            <TextInput value={name} disabled={conversationType === 'group' && isAdmin ? false : true} onChange={(e) => setName(e.currentTarget.value)} placeholder="Name" styles={{
                                root: { backgroundColor: "rgba(0,0,0,0)", minHeight: '0.00vh', height: '2.67vh', marginLeft: '0.00vh' },
                                input: {
                                    color: "white",
                                    backgroundColor: "rgba(0,0,0,0)",
                                    border: "none",
                                    textAlign: "center",
                                    minHeight: '0.00vh',
                                    height: '2.67vh',
                                    opacity: 1,
                                    fontSize: '1.60vh',
                                },
                            }} onFocus={() => fetchNui("disableControls", true)}
                                onBlur={() => {
                                    fetchNui("disableControls", false);
                                    fetchNui("updateGroupName", JSON.stringify({
                                        groupId: identifier,
                                        newName: name
                                    }))
                                }}
                            />
                        </div>
                        <div style={{

                        }}>
                            {conversationType === 'private' ? <svg onClick={() => {
                                fetchNui('toggleMessageBlock', JSON.stringify({
                                    phoneNumber: identifier
                                }))
                            }} style={{ marginLeft: '3.02vh', cursor: 'pointer' }} width="1.96vh" height="1.96vh" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19.0711 4.92893C20.8807 6.73858 22 9.23858 22 12C22 17.5229 17.5229 22 12 22C9.23858 22 6.73858 20.8807 4.92893 19.0711M19.0711 4.92893C17.2614 3.11929 14.7614 2 12 2C6.47716 2 2 6.47716 2 12C2 14.7614 3.11929 17.2614 4.92893 19.0711M19.0711 4.92893L4.92893 19.0711" stroke="white" strokeWidth="2" strokeLinecap="round" stroke-linejoin="round" />
                            </svg> : <div>
                                {isAdmin ? <div style={{
                                    display: 'flex',
                                }}>
                                    <svg onClick={async () => {
                                        await fetchNui('deleteGroup', identifier);
                                        const data = { ...location.page, messages: "" };
                                        setLocation({ app: "message", page: data });
                                    }} style={{
                                        cursor: 'pointer',
                                    }} width="1.96vh" height="1.96vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M19.3333 2.66956H13.2667C13.1137 1.91616 12.7048 1.23882 12.1095 0.752297C11.5142 0.265777 10.7689 0 10 0C9.2311 0 8.48584 0.265777 7.89049 0.752297C7.29515 1.23882 6.88634 1.91616 6.73333 2.66956H0.666667C0.489856 2.66956 0.320286 2.73979 0.195262 2.86479C0.0702379 2.9898 0 3.15934 0 3.33612C0 3.5129 0.0702379 3.68244 0.195262 3.80744C0.320286 3.93245 0.489856 4.00267 0.666667 4.00267H19.3333C19.5101 4.00267 19.6797 3.93245 19.8047 3.80744C19.9298 3.68244 20 3.5129 20 3.33612C20 3.15934 19.9298 2.9898 19.8047 2.86479C19.6797 2.73979 19.5101 2.66956 19.3333 2.66956ZM10 1.33645C10.4126 1.33761 10.8148 1.46635 11.1514 1.70502C11.488 1.94368 11.7425 2.28059 11.88 2.66956H8.12C8.25754 2.28059 8.51205 1.94368 8.84862 1.70502C9.1852 1.46635 9.58737 1.33761 10 1.33645ZM16.92 5.38911C16.7986 5.33806 16.6648 5.32412 16.5355 5.34903C16.4061 5.37394 16.2871 5.43659 16.1933 5.52908C16.1315 5.59137 16.0827 5.66523 16.0495 5.74644C16.0163 5.82766 15.9995 5.91462 16 6.00234C16 6.17912 16.0702 6.34866 16.1953 6.47366C16.3203 6.59867 16.4899 6.66889 16.6667 6.66889C16.8435 6.66889 17.013 6.59867 17.1381 6.47366C17.2631 6.34866 17.3333 6.17912 17.3333 6.00234C17.3309 5.82586 17.2618 5.65682 17.14 5.52908C17.0766 5.4684 17.0018 5.42083 16.92 5.38911ZM16.6667 8.002C16.4899 8.002 16.3203 8.07223 16.1953 8.19723C16.0702 8.32224 16 8.49178 16 8.66856V10.6682C16 10.845 16.0702 11.0145 16.1953 11.1396C16.3203 11.2646 16.4899 11.3348 16.6667 11.3348C16.8435 11.3348 17.013 11.2646 17.1381 11.1396C17.2631 11.0145 17.3333 10.845 17.3333 10.6682V8.66856C17.3333 8.49178 17.2631 8.32224 17.1381 8.19723C17.013 8.07223 16.8435 8.002 16.6667 8.002ZM16.6667 12.6679C16.4899 12.6679 16.3203 12.7381 16.1953 12.8631C16.0702 12.9881 16 13.1577 16 13.3344V18.0003C16 18.1771 15.9298 18.3467 15.8047 18.4717C15.6797 18.5967 15.5101 18.6669 15.3333 18.6669H4.66667C4.48986 18.6669 4.32029 18.5967 4.19526 18.4717C4.07024 18.3467 4 18.1771 4 18.0003V6.00234C4 5.82556 3.92976 5.65602 3.80474 5.53101C3.67971 5.40601 3.51014 5.33578 3.33333 5.33578C3.15652 5.33578 2.98695 5.40601 2.86193 5.53101C2.7369 5.65602 2.66667 5.82556 2.66667 6.00234V18.0003C2.66667 18.5307 2.87738 19.0393 3.25245 19.4143C3.62753 19.7893 4.13623 20 4.66667 20H15.3333C15.8638 20 16.3725 19.7893 16.7475 19.4143C17.1226 19.0393 17.3333 18.5307 17.3333 18.0003V13.3344C17.3333 13.1577 17.2631 12.9881 17.1381 12.8631C17.013 12.7381 16.8435 12.6679 16.6667 12.6679Z" fill="#0A84FF" />
                                        <path d="M7.33333 15.3341V6.66889C7.33333 6.49211 7.2631 6.32257 7.13807 6.19757C7.01305 6.07257 6.84348 6.00234 6.66667 6.00234C6.48986 6.00234 6.32029 6.07257 6.19526 6.19757C6.07024 6.32257 6 6.49211 6 6.66889V15.3341C6 15.5109 6.07024 15.6804 6.19526 15.8054C6.32029 15.9304 6.48986 16.0007 6.66667 16.0007C6.84348 16.0007 7.01305 15.9304 7.13807 15.8054C7.2631 15.6804 7.33333 15.5109 7.33333 15.3341ZM10.6667 15.3341V6.66889C10.6667 6.49211 10.5964 6.32257 10.4714 6.19757C10.3464 6.07257 10.1768 6.00234 10 6.00234C9.82319 6.00234 9.65362 6.07257 9.5286 6.19757C9.40357 6.32257 9.33333 6.49211 9.33333 6.66889V15.3341C9.33333 15.5109 9.40357 15.6804 9.5286 15.8054C9.65362 15.9304 9.82319 16.0007 10 16.0007C10.1768 16.0007 10.3464 15.9304 10.4714 15.8054C10.5964 15.6804 10.6667 15.5109 10.6667 15.3341ZM14 15.3341V6.66889C14 6.49211 13.9298 6.32257 13.8047 6.19757C13.6797 6.07257 13.5101 6.00234 13.3333 6.00234C13.1565 6.00234 12.987 6.07257 12.8619 6.19757C12.7369 6.32257 12.6667 6.49211 12.6667 6.66889V15.3341C12.6667 15.5109 12.7369 15.6804 12.8619 15.8054C12.987 15.9304 13.1565 16.0007 13.3333 16.0007C13.5101 16.0007 13.6797 15.9304 13.8047 15.8054C13.9298 15.6804 14 15.5109 14 15.3341Z" fill="#0A84FF" />
                                    </svg>
                                    <svg style={{
                                        cursor: 'pointer',
                                    }} onClick={() => {
                                        setShowMemberModal(true);
                                    }} width="1.85vh" height="1.85vh" viewBox="0 0 5 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M2.5 15C2.99445 15 3.4778 15.1466 3.88892 15.4213C4.30005 15.696 4.62048 16.0865 4.8097 16.5433C4.99892 17.0001 5.04843 17.5028 4.95196 17.9877C4.8555 18.4727 4.6174 18.9181 4.26777 19.2678C3.91813 19.6174 3.47268 19.8555 2.98773 19.952C2.50277 20.0484 2.00011 19.9989 1.54329 19.8097C1.08648 19.6205 0.69603 19.3 0.421326 18.8889C0.146623 18.4778 0 17.9945 0 17.5C0 16.837 0.263393 16.2011 0.732233 15.7322C1.20107 15.2634 1.83696 15 2.5 15ZM0 2.5C0 2.99445 0.146623 3.4778 0.421326 3.88893C0.69603 4.30005 1.08648 4.62048 1.54329 4.8097C2.00011 4.99892 2.50277 5.04843 2.98773 4.95196C3.47268 4.8555 3.91813 4.6174 4.26777 4.26777C4.6174 3.91814 4.8555 3.47268 4.95196 2.98773C5.04843 2.50277 4.99892 2.00011 4.8097 1.54329C4.62048 1.08648 4.30005 0.69603 3.88892 0.421326C3.4778 0.146623 2.99445 0 2.5 0C1.83696 0 1.20107 0.263392 0.732233 0.732233C0.263393 1.20107 0 1.83696 0 2.5ZM0 10C0 10.4945 0.146623 10.9778 0.421326 11.3889C0.69603 11.8 1.08648 12.1205 1.54329 12.3097C2.00011 12.4989 2.50277 12.5484 2.98773 12.452C3.47268 12.3555 3.91813 12.1174 4.26777 11.7678C4.6174 11.4181 4.8555 10.9727 4.95196 10.4877C5.04843 10.0028 4.99892 9.50011 4.8097 9.04329C4.62048 8.58648 4.30005 8.19603 3.88892 7.92133C3.4778 7.64662 2.99445 7.5 2.5 7.5C1.83696 7.5 1.20107 7.76339 0.732233 8.23223C0.263393 8.70107 0 9.33696 0 10Z" fill="#0A84FF" />
                                    </svg>
                                    <svg style={{
                                        cursor: 'pointer',
                                    }} onClick={() => {
                                        setShowAddMemberModal(true);
                                    }} width="2.22vh" height="2.22vh" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M7.55556 12H12M12 12H16.4444M12 12V16.4444M12 12V7.55556M12 22C6.47716 22 2 17.5229 2 12C2 6.47716 6.47716 2 12 2C17.5229 2 22 6.47716 22 12C22 17.5229 17.5229 22 12 22Z" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" stroke-linejoin="round" />
                                    </svg>
                                </div> : <svg onClick={async () => {
                                    await fetchNui('leaveGroup', JSON.stringify({
                                        groupId: identifier,
                                        phoneNumber: phoneSettings.phoneNumber
                                    }))
                                    const data = { ...location.page, messages: "" };
                                    setLocation({ app: "message", page: data });
                                }} style={{
                                    cursor: 'pointer',
                                }} width="1.96vh" height="1.96vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M3.37148 19.998C2.50772 20.028 1.66741 19.7138 1.03522 19.1246C0.403034 18.5354 0.030684 17.7193 0 16.8558L0 3.14417C0.030983 2.28072 0.403424 1.46485 1.03555 0.875709C1.66767 0.286565 2.5078 -0.0276992 3.37148 0.00191875H13.4288C13.6561 0.00191875 13.8741 0.0922071 14.0349 0.252921C14.1956 0.413636 14.2859 0.631611 14.2859 0.858895C14.2859 1.08618 14.1956 1.30416 14.0349 1.46487C13.8741 1.62558 13.6561 1.71587 13.4288 1.71587H3.37148C2.96286 1.68811 2.55976 1.82246 2.24956 2.08983C1.93936 2.35719 1.74705 2.736 1.71431 3.14417V16.8558C1.74733 17.2638 1.93973 17.6425 2.24986 17.9098C2.56 18.1771 2.96293 18.3116 3.37148 18.2841H13.4288C13.6561 18.2841 13.8741 18.3744 14.0349 18.5351C14.1956 18.6958 14.2859 18.9138 14.2859 19.1411C14.2859 19.3683 14.1956 19.5863 14.0349 19.747C13.8741 19.9078 13.6561 19.998 13.4288 19.998H3.37148ZM13.9648 15.1773C13.8042 15.0164 13.714 14.7984 13.714 14.5711C13.714 14.3438 13.8042 14.1258 13.9648 13.9649L17.0734 10.857H6.57152C6.34419 10.857 6.12617 10.7667 5.96542 10.606C5.80467 10.4452 5.71437 10.2273 5.71437 9.99998C5.71437 9.7727 5.80467 9.55472 5.96542 9.39401C6.12617 9.23329 6.34419 9.143 6.57152 9.143H17.0745L13.9648 6.03504C13.8829 5.95594 13.8177 5.86135 13.7728 5.75677C13.7279 5.6522 13.7043 5.53973 13.7034 5.42595C13.7025 5.31216 13.7242 5.19932 13.7674 5.09402C13.8105 4.98872 13.8742 4.89307 13.9547 4.81265C14.0352 4.73222 14.131 4.66863 14.2363 4.62559C14.3417 4.58255 14.4546 4.56092 14.5684 4.56197C14.6822 4.56301 14.7947 4.5867 14.8992 4.63166C15.0038 4.67662 15.0983 4.74195 15.1774 4.82384L19.7488 9.39438C19.8285 9.47387 19.8916 9.56827 19.9347 9.67218C19.9778 9.7761 20 9.88749 20 9.99998C20 10.1125 19.9778 10.2239 19.9347 10.3278C19.8916 10.4317 19.8285 10.5261 19.7488 10.6056L15.1774 15.1761C15.0164 15.3367 14.7984 15.4268 14.5711 15.4268C14.3437 15.4268 14.1257 15.3367 13.9648 15.1761V15.1773Z" fill="#0A84FF" />
                                </svg>}
                            </div>}
                        </div>
                    </div>
                    <div
                        id="scrollableDiv"
                        ref={scrollableDivRef}
                        style={{
                            height: "45.33vh",
                            overflowX: "hidden",
                            overflowY: "auto",
                            marginTop: "0.89vh",
                        }}
                    >
                        <InfiniteScroll
                            dataLength={messages.length}
                            next={fetchMessages}
                            hasMore={hasMore}
                            loader={<h4>Loading...</h4>}
                            scrollableTarget="scrollableDiv"
                            style={{
                                display: "flex",
                                flexDirection: "column-reverse",
                                justifyContent: "flex-start",
                                gap: "0.50vh",
                                position: "relative",
                            }}
                        >
                            {messages.map((message, indexX) => {
                                return (
                                    <Menu shadow="md" width={200} key={indexX} opened={opened === indexX}>
                                        <Menu.Target>
                                            <div
                                                className={message.senderId === phoneSettings.phoneNumber ? "sender" : "receiver"}
                                                key={indexX}
                                                style={{
                                                    backgroundColor: message.senderId === phoneSettings.phoneNumber ? "#0A84FF" : "#2A2A2A",
                                                    color: "white",
                                                    padding: "1.00vh",
                                                    borderRadius: "1.00vh",
                                                    maxWidth: "80%",
                                                    alignSelf: message.senderId === phoneSettings.phoneNumber ? "flex-end" : "flex-start",
                                                }}
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    if (e.button === 2 && message.senderId === phoneSettings.phoneNumber) {
                                                        setOpened(opened === indexX ? -1 : indexX);
                                                    }
                                                }}
                                            >
                                                {message.message}
                                                {message.attachments.length > 0 &&
                                                    message.attachments.map((attachment, idx) => (
                                                        attachment.type === "image" && (
                                                            <Image key={idx} src={attachment.url} h="17.78vh" alt="attachment" />
                                                        )
                                                    ))
                                                }
                                                {conversationType === 'group' && message.senderId !== phoneSettings.phoneNumber && (
                                                    <div style={{
                                                        display: 'flex',
                                                        justifyContent: 'flex-end',
                                                        fontSize: '0.89vh',
                                                        color: 'rgba(255,255,255,0.5)',
                                                        marginTop: '0.36vh',
                                                    }}>
                                                        {getNameFromContactNumber(message.senderId)}
                                                    </div>
                                                )}
                                                <div style={{
                                                    display: 'flex',
                                                    justifyContent: 'flex-end',
                                                    fontSize: '0.89vh',
                                                    color: 'rgba(255,255,255,0.5)',
                                                    marginTop: '0.36vh',
                                                }}>
                                                    {dayjs(message.timestamp).format('DD MMM YYYY hh:mm A')}
                                                </div>
                                            </div>
                                        </Menu.Target>
                                        <Menu.Dropdown style={{
                                            width: '10vh',
                                            backgroundColor: '#494949ff',
                                            border: '0.09vh solid rgba(87, 87, 87, 0.63)',
                                        }}>
                                            <Menu.Item color="white" onClick={async () => {
                                                setOpened(-1);
                                                const payload: any = {
                                                    conversationType,
                                                    messageIndex: message.page,
                                                    phoneNumber: conversationType === 'private' ? identifier : undefined,
                                                    groupId: conversationType === 'group' ? identifier : undefined,
                                                };
                                                const res: any = await fetchNui('deleteMessage', JSON.stringify(payload));
                                                console.log(res);
                                                try {
                                                    const parsed = JSON.parse(res);
                                                    if (parsed?.success) {
                                                        setMessages((prev) => prev.filter((m) => Number(m.page) !== Number(message.page)));
                                                    }
                                                } catch {}
                                            }}>
                                                Delete
                                            </Menu.Item>
                                        </Menu.Dropdown>
                                    </Menu>
                                )
                            })}
                        </InfiniteScroll>
                    </div>
                    <div style={{
                        position: 'relative',
                        zIndex: 1,
                    }}>
                        <Transition
                            mounted={showAddMemberModal}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles,
                                width: '29.87vh',
                                height: '12.44vh',
                                marginTop: '-4.44vh',
                                borderTopLeftRadius: '1.78vh',
                                borderTopRightRadius: '1.78vh',
                                display: 'flex',
                                flexDirection: 'column',
                                backgroundColor: '#373737',
                                alignItems: 'center',
                            }}>
                                <div className="headerButtons" style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    width: '26.67vh',
                                    fontSize: '1.42vh',
                                    fontWeight: '500',
                                    marginTop: '0.53vh',
                                }}>
                                    <div className="" style={{
                                        cursor: 'pointer'
                                    }} onClick={() => {
                                        setShowAddMemberModal(false);
                                    }}>Cancel</div>
                                    <div className="" style={{
                                        cursor: 'pointer'
                                    }} onClick={() => {
                                        if (typedPhoneNumber.length === 0) return;
                                        fetchNui('addMember', JSON.stringify({
                                            groupId: identifier,
                                            phoneNumber: typedPhoneNumber
                                        }))
                                        setMemberPhoneNumbers([...memberPhoneNumbers, typedPhoneNumber]);
                                        setTypedPhoneNumber('');
                                        setShowAddMemberModal(false);
                                    }}>Add</div>
                                </div>
                                <TextInput value={typedPhoneNumber} onChange={(e) => setTypedPhoneNumber(e.currentTarget.value)} placeholder="Enter Contact number" styles={{
                                    root: { backgroundColor: "", width: '95%', height: '2.67vh', marginLeft: '0.89vh' },
                                    input: {
                                        color: "white",
                                        backgroundColor: "rgba(0,0,0,0)",
                                        borderRadius: "13.89vh",
                                        border: "0.09vh solid rgba(87, 87, 87, 0.86)",
                                    },
                                }} ml={'-0.00vh'} mt={'0.89vh'} />
                            </div>}
                        </Transition>
                    </div>
                    <div style={{
                        position: 'relative',
                        zIndex: 1,
                    }}>
                        <Transition
                            mounted={showMemberModal}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles,
                                width: '29.87vh',
                                height: '28.44vh',
                                marginTop: '-20.98vh',
                                borderTopLeftRadius: '1.78vh',
                                borderTopRightRadius: '1.78vh',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                            }}>
                                <div style={{
                                    width: '26.67vh',
                                    height: '19.56vh',
                                    marginBottom: '0.53vh',
                                    display: 'flex',
                                    flexDirection: 'column-reverse',
                                    overflowY: 'auto',
                                }}>
                                    {memberPhoneNumbers.filter(
                                        (phoneNumber) => phoneNumber !== phoneSettings.phoneNumber
                                    ).map((phoneNumber, index) => (
                                        <div key={index} style={{
                                            width: '26.67vh',
                                            height: '4.44vh',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            backgroundColor: '#373737',
                                            borderRadius: '0.89vh',
                                            padding: '0.89vh',
                                            marginBottom: '0.18vh',
                                        }}>
                                            <div style={{
                                                fontSize: '1.42vh',
                                                width: '100%',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                            }} onClick={() => {
                                                fetchNui('leaveGroup', JSON.stringify({
                                                    groupId: identifier,
                                                    phoneNumber: phoneNumber
                                                }))
                                                setShowMemberModal(false);
                                                setMemberPhoneNumbers(memberPhoneNumbers.filter((phone) => phone !== phoneNumber));
                                            }}>{phoneNumber}</div>
                                        </div>
                                    ))}
                                </div>
                                <div onClick={() => {
                                    setShowMemberModal(false);
                                }} style={{
                                    width: '26.67vh',
                                    height: '4.80vh',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    backgroundColor: '#373737',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    borderRadius: '0.89vh',
                                    color: 'red',
                                    fontSize: '2.13vh'
                                }}>
                                    Cancel
                                </div>
                            </div>}
                        </Transition>
                    </div>
                    <div style={{
                        position: 'relative',
                        zIndex: 1,
                    }}>
                        <Transition
                            mounted={showAttachmentModal || showAvatarModal}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles,
                                width: '29.87vh',
                                height: '8.89vh',
                                marginTop: '-1.78vh',
                                backgroundColor: 'rgba(55,55,55,1)',
                                borderTopLeftRadius: '1.78vh',
                                borderTopRightRadius: '1.78vh',
                            }}>
                                <div style={{
                                    fontSize: '1.24vh',
                                    fontWeight: '500',
                                    marginLeft: '0.89vh',
                                    marginTop: '0.89vh',
                                }} onClick={() => {
                                    if (showAvatarModal) {
                                        setShowAvatarModal(false);
                                    } else {
                                        setShowAttachmentModal(false);
                                    }
                                }}>Close</div>
                                <div>
                                    <TextInput
                                        value={showAvatarModal ? avatar : attachments[0]?.url || ''}
                                        onChange={(e) => {
                                            if (showAvatarModal) {
                                                setAvatar(e.currentTarget.value)
                                            } else {
                                                setAttachments([{ type: "image", url: e.currentTarget.value }]);
                                            }
                                        }}
                                        placeholder="Enter Image link..."
                                        styles={{
                                            root: { backgroundColor: "", marginTop: '0.89vh', width: '90%', marginLeft: '1.42vh' },
                                            input: {
                                                color: "white",
                                                backgroundColor: "rgba(0,0,0,0)",
                                                borderRadius: "13.89vh",
                                                border: "0.09vh solid rgba(87, 87, 87, 0.86)",
                                            },
                                        }}
                                        onFocus={() => fetchNui("disableControls", true)}
                                        onBlur={() => fetchNui("disableControls", false)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                if (showAvatarModal) {
                                                    fetchNui('updateGroupAvatar', JSON.stringify({
                                                        groupId: identifier,
                                                        newAvatar: avatar
                                                    }))
                                                    setShowAvatarModal(false);
                                                } else {
                                                    sendMessage();
                                                }
                                            }
                                        }}
                                    />
                                </div>
                            </div>}
                        </Transition>
                    </div>
                    <div className="inputSFsada">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="2.41vh"
                            height="2.41vh"
                            viewBox="0 0 26 26"
                            fill="none"
                            style={{ cursor: "pointer" }}
                            onClick={() => {
                                setShowAttachmentModal(true);
                            }}
                        >
                            <circle cx="13" cy="13" r="13" fill="#D9D9D9" fillOpacity="0.3" />
                            <path
                                d="M13.6857 12.3143V5H12.3143V12.3143H5V13.6857H12.3143V21H13.6857V13.6857H21V12.3143H13.6857Z"
                                fill="black"
                            />
                        </svg>
                        <TextInput
                            value={textValue}
                            onChange={(e) => setTextValue(e.currentTarget.value)}
                            placeholder="Type a message..."
                            styles={{
                                root: { backgroundColor: "", width: '90%', },
                                input: {
                                    color: "white",
                                    backgroundColor: "rgba(0,0,0,0)",
                                    borderRadius: "13.89vh",
                                    border: "0.09vh solid rgba(87, 87, 87, 0.86)",
                                },
                            }}
                            onFocus={() => fetchNui("disableControls", true)}
                            onBlur={() => fetchNui("disableControls", false)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    sendMessage();
                                }
                            }}
                        />
                    </div>
                </div>
            </div>
        </CSSTransition>
    )
}