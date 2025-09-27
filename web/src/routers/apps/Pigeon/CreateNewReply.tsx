import { ActionIcon, Avatar, Button, Textarea, Transition, SegmentedControl } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { usePhone } from "../../../store/store";
import { useState } from "react";
import { TweetProfileData, TweetAttachment } from "../../../../../types/types";
import InputDialog from "../DarkChat/InputDialog";

export default function CreateNewReply(props: { show: boolean, tweetId: string, isReply: boolean, onSend: () => void, onCancel: () => void }) {
    const { phoneSettings, location, setLocation } = usePhone();
    const [profileData, setProfileData] = useState<TweetProfileData>({
        _id: '',
        email: '',
        password: '',
        displayName: '',
        avatar: '',
        banner: '',
        bio: '',
        followers: [],
        following: [],
        verified: false,
        notificationsEnabled: false,
        createdAt: '',
    });
    const [content, setContent] = useState('');
    const [inputTitle, setInputTitle] = useState('');
    const [inputDescription, setInputDescription] = useState('');
    const [inputPlaceholder, setInputPlaceholder] = useState('');
    const [inputShow, setInputShow] = useState(false);
    const [attachments, setAttachments] = useState<TweetAttachment[]>([]);
    const [selectedMediaType, setSelectedMediaType] = useState<'image' | 'video'>('image');

    return (
        <Transition
            mounted={props.show}
            transition="slide-right"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {
                const res = await fetchNui('getProfile', phoneSettings.pigeonIdAttached);
                setProfileData(JSON.parse(res as string))
            }}
        >
            {(styles) => <div style={{
                ...styles,
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'absolute',
                zIndex: 1,
                backgroundColor: 'rgba(0, 0, 0, 1)',
            }}>
                <div className="headerButtons" style={{
                    width: '100%',
                    marginTop: '3.91vh',
                    marginLeft: '-0.71vh',
                    display: 'flex',
                    justifyContent: 'space-between',
                }}>
                    <Button variant="transparent" style={{
                        color: 'white',
                        height: '3.20vh',
                        borderRadius: '1.24vh',
                    }} onClick={() => {
                        props.onCancel();
                        setContent('');
                        setAttachments([]);
                    }}>Cancel</Button>
                    <Button variant="filled" style={{
                        color: 'white',
                        height: '3.02vh',
                        borderRadius: '1.78vh',
                    }} onClick={() => {
                        fetchNui('postReply', JSON.stringify({
                            tweetId: props.tweetId,
                            content: content,
                            attachments: attachments,
                            email: profileData.email
                        }));
                        props.onSend();
                        setContent('');
                        setAttachments([]);
                    }}>Post</Button>
                </div>
                <div style={{
                    width: '90%',
                    height: '46%',
                    display: 'flex',
                }}>
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '1.78vh',
                    }}>
                        <Avatar src={profileData.avatar.length > 0 ? profileData.avatar : "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} size={'2.67vh'} />
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.89vh',
                        }}>
                            <SegmentedControl
                                value={selectedMediaType}
                                onChange={(value) => setSelectedMediaType(value as 'image' | 'video')}
                                data={[
                                    { label: 'Image', value: 'image' },
                                    { label: 'Video', value: 'video' }
                                ]}
                                size="xs"
                                styles={{
                                    root: {
                                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                        borderRadius: '0.89vh',
                                    },
                                    control: {
                                        color: 'white',
                                        '&[data-active]': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.2)',
                                        }
                                    }
                                }}
                            />
                            <ActionIcon variant="filled" onClick={() => {
                                setInputTitle(`Attach ${selectedMediaType === 'image' ? 'Image' : 'Video'}`);
                                setInputDescription(`Attach a ${selectedMediaType} to your post`);
                                setInputPlaceholder(`${selectedMediaType === 'image' ? 'Image' : 'Video'} URL`);
                                setInputShow(true);
                            }}>
                                {selectedMediaType === 'image' ? (
                                    <svg width="1.39vh" height="1.39vh" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M8.4375 0.9375C8.4375 0.419733 8.01777 0 7.5 0C6.98223 0 6.5625 0.419733 6.5625 0.9375V6.5625H0.9375C0.419733 6.5625 0 6.98223 0 7.5C0 8.01777 0.419733 8.4375 0.9375 8.4375H6.5625V14.0625C6.5625 14.5803 6.98223 15 7.5 15C8.01777 15 8.4375 14.5803 8.4375 14.0625V8.4375H14.0625C14.5803 8.4375 15 8.01777 15 7.5C15 6.98223 14.5803 6.5625 14.0625 6.5625H8.4375V0.9375Z" fill="white" />
                                    </svg>
                                ) : (
                                    <svg width="1.39vh" height="1.39vh" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M3 2.5C3 2.22386 3.22386 2 3.5 2H11.5C11.7761 2 12 2.22386 12 2.5V12.5C12 12.7761 11.7761 13 11.5 13H3.5C3.22386 13 3 12.7761 3 12.5V2.5ZM4 3V12H11V3H4ZM6.5 4.5L8.5 6L10.5 4.5V10.5L8.5 9L6.5 10.5V4.5Z" fill="white" />
                                    </svg>
                                )}
                            </ActionIcon>
                        </div>
                    </div>
                    <Textarea onChange={(e) => {
                        setContent(e.currentTarget.value)
                    }} value={content} styles={{
                        root: {
                            height: '26.67vh',
                            width: '100%',
                            backgroundColor: 'rgba(240, 23, 23, 0)',
                        },
                        input: {
                            color: 'white',
                            backgroundColor: 'rgba(255, 255, 255, 0)',
                            height: '26.67vh',
                            outline: 'none',
                            border: 'none',
                        }
                    }} placeholder="What's on your mind?" onFocus={() => fetchNui('disableControls', true)} onBlur={() => fetchNui('disableControls', false)} />
                </div>
                <div style={{
                    width: '90%',
                    height: '41%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.53vh',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                }}>
                    {attachments.map((attachment, index) => {
                        return (
                            <div key={index} style={{
                                position: 'relative',
                                width: '26.67vh',
                                height: '17.78vh',
                                borderRadius: '0.89vh',
                                overflow: 'hidden',
                            }}>
                                {attachment?.type === 'image' ? (
                                    <img
                                        src={attachment.url}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                        }}
                                        onError={() => {
                                            setAttachments(attachments.filter((_, i) => i !== index));
                                        }}
                                    />
                                ) : attachment?.type === 'video' ? (
                                    <video
                                        src={attachment.url}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                        }}
                                        controls
                                        onError={() => {
                                            setAttachments(attachments.filter((_, i) => i !== index));
                                        }}
                                    />
                                ) : <img
                                    src={attachment.url}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                    }}
                                    onError={() => {
                                        setAttachments(attachments.filter((_, i) => i !== index));
                                    }}
                                />}
                                <button
                                    onClick={() => {
                                        setAttachments(attachments.filter((_, i) => i !== index));
                                    }}
                                    style={{
                                        position: 'absolute',
                                        top: '0.53vh',
                                        right: '0.53vh',
                                        background: 'rgba(0, 0, 0, 0.7)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '2.13vh',
                                        height: '2.13vh',
                                        color: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '1.07vh',
                                    }}
                                >
                                    ×
                                </button>
                            </div>
                        );
                    })}
                </div>

                <InputDialog show={inputShow} placeholder={inputPlaceholder} description={inputDescription} title={inputTitle} onConfirm={async (e: string) => {
                    setInputShow(false);
                    if (inputTitle.includes('Attach')) {
                        if (e === '') return;
                        // Check if URL already exists in attachments
                        if (attachments.some(att => att.url === e)) return;

                        const newAttachment: TweetAttachment = {
                            type: selectedMediaType,
                            url: e
                        };
                        setAttachments([...attachments, newAttachment]);
                    }
                }} onCancel={() => {
                    setInputShow(false);
                }} />
            </div>}
        </Transition>
    )
}