import { ActionIcon, Avatar, Button, Textarea, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { usePhone } from "../../../store/store";
import { useState } from "react";
import { TweetProfileData } from "../../../../../types/types";
import InputDialog from "../DarkChat/InputDialog";

export default function CreateNewReply(props: { show: boolean, tweetId: string, isReply: boolean, onSend: () => void, onCancel: () => void }) {
    const { phoneSettings, location, setLocation } = usePhone();
    const [profileData, setProfileData] = useState<TweetProfileData>({
        _id: '',
        email: '',
        password: '',
        displayName: '',
        avatar: '',
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
    const [imageAttachment, setImageAttachment] = useState<string[]>([]);

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
                    marginTop: '2.2vw',
                    marginLeft: '-0.4vw',
                    display: 'flex',
                    justifyContent: 'space-between',
                }}>
                    <Button variant="transparent" style={{
                        color: 'white',
                        height: '1.8vw',
                        borderRadius: '0.7vw',
                    }} onClick={() => {
                        props.onCancel();
                        setContent('');
                        setImageAttachment([]);
                    }}>Cancel</Button>
                    <Button variant="filled" style={{
                        color: 'white',
                        height: '1.7vw',
                        borderRadius: '1vw',
                    }} onClick={() => {
                        fetchNui('postReply', JSON.stringify({
                            tweetId: props.tweetId,
                            content: content,
                            attachments: imageAttachment,
                            email: profileData.email
                        }));
                        props.onSend();
                        setContent('');
                        setImageAttachment([]);
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
                        gap: '1vw',
                    }}>
                        <Avatar src={profileData.avatar.length > 0 ? profileData.avatar : "https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg"} size={'1.5vw'} />
                        <ActionIcon variant="filled" onClick={() => {
                            setInputTitle('Attach Image');
                            setInputDescription('Attach an image to your post');
                            setInputPlaceholder('Image URL');
                            setInputShow(true);
                        }}>
                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8.4375 0.9375C8.4375 0.419733 8.01777 0 7.5 0C6.98223 0 6.5625 0.419733 6.5625 0.9375V6.5625H0.9375C0.419733 6.5625 0 6.98223 0 7.5C0 8.01777 0.419733 8.4375 0.9375 8.4375H6.5625V14.0625C6.5625 14.5803 6.98223 15 7.5 15C8.01777 15 8.4375 14.5803 8.4375 14.0625V8.4375H14.0625C14.5803 8.4375 15 8.01777 15 7.5C15 6.98223 14.5803 6.5625 14.0625 6.5625H8.4375V0.9375Z" fill="white" />
                            </svg>
                        </ActionIcon>
                    </div>
                    <Textarea onChange={(e) => {
                        setContent(e.currentTarget.value)
                    }} value={content} styles={{
                        root: {
                            height: '15vw',
                            width: '100%',
                            backgroundColor: 'rgba(240, 23, 23, 0)',
                        },
                        input: {
                            color: 'white',
                            backgroundColor: 'rgba(255, 255, 255, 0)',
                            height: '15vw',
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
                    gap: '0.3vw',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                }}>
                    {imageAttachment.map((image, index) => {
                        return <img key={index} src={image} style={{
                            width: '15vw',
                            height: '10vw',
                            objectFit: 'cover',
                            borderRadius: '0.5vw',
                        }} />
                    })}
                </div>

                <InputDialog show={inputShow} placeholder={inputPlaceholder} description={inputDescription} title={inputTitle} onConfirm={async (e: string) => {
                    setInputShow(false);
                    if (inputTitle === 'Attach Image') {
                        setImageAttachment([...imageAttachment, e]);
                    }
                }} onCancel={() => {
                    setInputShow(false);
                }} />
            </div>}
        </Transition>
    )
}