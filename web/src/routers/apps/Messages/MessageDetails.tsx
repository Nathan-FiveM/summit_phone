import { CSSTransition } from "react-transition-group"
import { usePhone } from "../../../store/store"
import InfiniteScroll from 'react-infinite-scroll-component';
import { useCallback, useEffect, useRef, useState } from "react"
import { fetchNui } from "../../../hooks/fetchNui";
import { Avatar, Image, TextInput, Transition } from "@mantine/core";

interface Message {
    message: string;
    read: boolean;
    page: number;
    timestamp: string;
    senderId: string;
    attachments: { type: string; url: string }[];
}

interface Conversation {
    messages: Message[];
    avatar?: string | null;
    name: string;
    memberPhoneNumbers?: string[];
    hasMore: boolean;
    totalMessages: number;
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
                }
                const data: {
                    success: boolean;
                    name: string;
                    messages: Message[];
                    avatar?: string | null;
                    memberPhoneNumbers?: string[];
                    hasMore: boolean;
                    totalMessages: number;
                } = JSON.parse(response);

                if (data.success) {
                    setMessages((prev) => (resetPage ? data.messages : [...prev, ...data.messages]));
                    setHasMore(data.hasMore);
                    setAvatar(data.avatar || "");
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
    // Scroll to bottom when messages change
    useEffect(() => {
        if (scrollableDivRef.current) {
            scrollableDivRef.current.scrollTop = scrollableDivRef.current.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async () => {
        if (!textValue.trim()) return; // Prevent sending empty messages

        try {
            await fetchNui(
                "sendMessage",
                JSON.stringify({
                    type: conversationType,
                    phoneNumber: identifier,
                    messageData: {
                        message: textValue,
                        attachments: [],
                    },
                })
            );

            const newMessage: Message = {
                message: textValue,
                read: true,
                page: 1,
                timestamp: new Date().toISOString(),
                senderId: phoneSettings._id,
                attachments: attachments,
            };
            setMessages((prev) => [newMessage, ...prev]);
            setTextValue("");
        } catch (error) {
            console.error("Error sending message:", error);
        }
    };


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
                            style={{ marginLeft: "0.5vw", cursor: "pointer" }}
                            onClick={() => {
                                const data = { ...location.page, messages: "" };
                                setLocation({ app: "message", page: data });
                                setMessages([]);
                                setPage(1);
                                setHasMore(true);
                            }}
                            xmlns="http://www.w3.org/2000/svg"
                            width="0.6770833333333334vw"
                            height="0.9375vw"
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
                        <div className="headerMainCont">
                            <Avatar src={avatar} size="2.0833333333333335vw" radius="xl" />
                            <div className="name">{name}</div>
                        </div>
                    </div>
                    <div
                        id="scrollableDiv"
                        ref={scrollableDivRef}
                        style={{
                            height: "25.5vw",
                            overflowX: "hidden",
                            overflowY: "auto",
                            marginTop: "0.5vw",
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
                                gap: "0.5vh",
                                position: "relative",
                            }}
                        >
                            {messages.map((message, index) => (
                                <div
                                    className={message.senderId === phoneSettings._id ? "sender" : "receiver"}
                                    key={index}
                                    style={{
                                        backgroundColor: message.senderId === phoneSettings._id ? "#0A84FF" : "#2A2A2A",
                                        color: "white",
                                        padding: "0.5625vw",
                                        borderRadius: "0.5625vw",
                                        maxWidth: "80%",
                                        alignSelf: message.senderId === phoneSettings._id ? "flex-end" : "flex-start",
                                    }}
                                >
                                    {message.message}
                                    {message.attachments.length > 0 &&
                                        message.attachments.map((attachment, idx) => (
                                            attachment.type === "image" && (
                                                <Image key={idx} src={attachment.url} h="10vw" alt="attachment" />
                                            )
                                        ))}
                                </div>
                            ))}
                        </InfiniteScroll>
                    </div>
                    <div style={{
                        position: 'relative',
                        zIndex: 1,
                    }}>
                        <Transition
                            mounted={showAttachmentModal}
                            transition="fade"
                            duration={400}
                            timingFunction="ease"
                        >
                            {(styles) => <div style={{
                                ...styles,
                                width: '16.8vw',
                                height: '5vw',
                                marginTop: '-1vw',
                                backgroundColor: 'rgba(55,55,55,1)',
                                borderTopLeftRadius: '1vw',
                                borderTopRightRadius: '1vw',
                            }}>
                                <div style={{
                                    fontSize: '0.7vw',
                                    fontWeight: '500',
                                    marginLeft: '0.5vw',
                                    marginTop: '0.5vw',
                                }} onClick={() => {
                                    setShowAttachmentModal(false);
                                }}>Close</div>
                                <div>
                                    <TextInput
                                        value={attachments[0]?.url || ""}
                                        onChange={(e) => {
                                            setAttachments([{ type: "image", url: e.currentTarget.value }]);
                                        }}
                                        placeholder="Enter Image link..."
                                        styles={{
                                            root: { backgroundColor: "", marginTop: '0.5vw', width: '90%', marginLeft: '0.8vw' },
                                            input: {
                                                color: "white",
                                                backgroundColor: "rgba(0,0,0,0)",
                                                borderRadius: "7.8125vw",
                                                border: "0.052083333333333336vw solid rgba(87, 87, 87, 0.86)",
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
                            </div>}
                        </Transition>
                    </div>
                    <div className="inputSFsada">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="1.3541666666666667vw"
                            height="1.3541666666666667vw"
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
                                    borderRadius: "7.8125vw",
                                    border: "0.052083333333333336vw solid rgba(87, 87, 87, 0.86)",
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