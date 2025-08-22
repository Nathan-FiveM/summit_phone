import { ActionIcon, Button, Textarea, TextInput, Transition } from "@mantine/core";
import InputDialog from "../DarkChat/InputDialog";
import { useState } from "react";
import { fetchNui } from "../../../hooks/fetchNui";

export default function CreateNew(props: {
    show: boolean, onSubmit: (data: {
        title: string,
        content: string,
        imageAttachment: string
    }) => void, onCancel: () => void
}) {

    const [inputTitle, setInputTitle] = useState('');
    const [inputDescription, setInputDescription] = useState('');
    const [inputPlaceholder, setInputPlaceholder] = useState('');
    const [inputShow, setInputShow] = useState(false);
    const [imageAttachment, setImageAttachment] = useState<string>('');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    return (
        <Transition
            mounted={props.show}
            transition="slide-up"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {
                /* const res = await fetchNui('getProfile', phoneSettings.pigeonIdAttached);
                setProfileData(JSON.parse(res as string)) */
            }}
        >
            {(styles) => <div style={{
                ...styles,
                width: '100%',
                height: '95%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'absolute',
                backgroundColor: 'rgb(36, 36, 36)',
                zIndex: 1,
                bottom: 0,
                borderTopLeftRadius: '2.67vh',
                borderTopRightRadius: '2.67vh',
            }}>
                <div className="headerButtons" style={{
                    width: '100%',
                    marginTop: '0.36vh',
                    marginLeft: '-0.71vh',
                    display: 'flex',
                    justifyContent: 'space-between',
                }}>
                    <Button variant="transparent" style={{
                        color: 'white',
                        height: '3.20vh',
                        borderRadius: '1.24vh',
                        border: 'none',
                        outline: 'none'
                    }} onClick={props.onCancel}>Cancel</Button>
                    <Button variant="transparent" style={{
                        color: 'white',
                        height: '3.20vh',
                        borderRadius: '1.78vh',
                        border: 'none',
                        outline: 'none'
                    }} onClick={() => {
                        props.onSubmit({
                            title,
                            content,
                            imageAttachment
                        });
                    }}>Submit</Button>
                </div>
                <TextInput value={title} label={'Title'} placeholder="Enter Title" styles={{
                    input: {
                        backgroundColor: 'rgb(44, 44, 44)',
                        color: 'white',
                        width: '100%',
                        marginTop: '0.36vh',
                        borderRadius: '0.53vh',
                        border: '1px solid rgba(140, 140, 140, 0.2)',
                        outline: 'none',
                        fontWeight: 500
                    },
                    label: {
                        color: 'white',
                        fontSize: '1.42vh',
                    },
                    root: {
                        width: '90%',
                        marginTop: '0.89vh',
                        marginBottom: '0.36vh',
                    }
                }} onChange={(e) => {
                    setTitle(e.currentTarget.value);
                }} onFocus={() => fetchNui('disableControls', true)} onBlur={() => fetchNui('disableControls', false)} />
                <Textarea value={content} label={'Content'} placeholder="Enter Content" styles={{
                    input: {
                        backgroundColor: 'rgb(44, 44, 44)',
                        color: 'white',
                        width: '100%',
                        marginTop: '0.36vh',
                        height: '14.22vh',
                        borderRadius: '0.53vh',
                        border: '1px solid rgba(140, 140, 140, 0.2)',
                        outline: 'none',
                        fontWeight: 500
                    },
                    label: {
                        color: 'white',
                        fontSize: '1.42vh',
                    },
                    root: {
                        width: '90%',
                        height: '16.89vh',
                        marginTop: '0.89vh',
                        marginBottom: '0.36vh',
                    }
                }} onChange={(e) => {
                    setContent(e.currentTarget.value);
                }} onFocus={() => fetchNui('disableControls', true)} onBlur={() => fetchNui('disableControls', false)} />

                <div style={{
                    width: '90%',
                    display: 'flex',
                    justifyContent: 'end'
                }}>
                    <ActionIcon variant="filled" onClick={() => {
                        setInputTitle('Attach Image');
                        setInputDescription('Attach an image to your post');
                        setInputPlaceholder('Image URL');
                        setInputShow(true);
                    }} size={'2.31vh'}>
                        <svg width="1.39vh" height="1.39vh" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M8.4375 0.9375C8.4375 0.419733 8.01777 0 7.5 0C6.98223 0 6.5625 0.419733 6.5625 0.9375V6.5625H0.9375C0.419733 6.5625 0 6.98223 0 7.5C0 8.01777 0.419733 8.4375 0.9375 8.4375H6.5625V14.0625C6.5625 14.5803 6.98223 15 7.5 15C8.01777 15 8.4375 14.5803 8.4375 14.0625V8.4375H14.0625C14.5803 8.4375 15 8.01777 15 7.5C15 6.98223 14.5803 6.5625 14.0625 6.5625H8.4375V0.9375Z" fill="white" />
                        </svg>
                    </ActionIcon>
                </div>

                <InputDialog show={inputShow} placeholder={inputPlaceholder} description={inputDescription} title={inputTitle} onConfirm={async (e: string) => {
                    setInputShow(false);
                    if (inputTitle === 'Attach Image') {
                        setImageAttachment(e);
                    }
                }} onCancel={() => {
                    setInputShow(false);
                }} />

                {imageAttachment.length > 0 && <div style={{
                    width: '90%',
                    height: '27.02vh',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'start',
                    marginTop: '0.89vh',
                    overflowY: 'scroll',
                    overflowX: 'hidden',
                }}>
                    <img src={imageAttachment} style={{
                        width: '26.67vh',
                        height: '26.67vh',
                        marginTop: '0.89vh',
                        objectFit: 'contain',
                        borderRadius: '0.89vh',
                    }} />
                </div>}
            </div>}
        </Transition>
    )
}