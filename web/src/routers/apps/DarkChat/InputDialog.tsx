import { TextInput, Transition } from '@mantine/core';
import { useState } from 'react';
import { fetchNui } from '../../../hooks/fetchNui';
export default function InputDialog(props: { show: boolean, title: string, description: string, placeholder: string, onConfirm: (value: string) => void, onCancel: () => void }) {
    const [value, setValue] = useState('');
    return (
        <Transition
            mounted={props.show}
            transition="fade"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={{
                ...styles,
                position: 'fixed',
                width: '100%',
                height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(5px)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10,
            }}>
                <div style={{
                    width: '26.20vh',
                    height: '14.35vh',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderRadius: '1.20vh',
                    backgroundColor: '#3C3C3C'
                }}>
                    <div style={{
                        width: '100%',
                        height: '10%',
                        textAlign: 'center',
                        color: '#FFF',
                        marginTop: '0.65vh',
                        fontSize: '1.57vh',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 'normal',
                    }}>
                        {props.title}
                    </div>
                    <div style={{
                        width: '60%',
                        height: '10%',
                        textAlign: 'center',
                        color: '#FFF',
                        marginTop: '1.42vh',
                        fontSize: '1.02vh',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 'normal',
                    }}>
                        {props.description}
                    </div>
                    <TextInput onFocus={() => fetchNui("disableControls", true)} onBlur={() => fetchNui("disableControls", false)} placeholder={props.placeholder} style={{ width: '80%', marginTop: '2.31vh' }} styles={{
                        root: {
                            minHeight: '0.00vh',
                            height: '2.31vh',
                        },
                        input: {
                            minHeight: '0.00vh',
                            height: '2.31vh',
                            backgroundColor: 'rgba(182, 182, 182, 0.12)',
                            color: '#FFF',
                            fontSize: '1.24vh',
                            border: 'none',
                            borderRadius: '0.46vh',
                            textAlign: 'center',
                        },
                    }} value={value} onChange={(e) => setValue(e.currentTarget.value)} />
                    <div style={{
                        width: '100%',
                        height: '3.38vh',
                        borderTop: '0.09vh solid rgba(255, 255, 255, 0.17)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '1.36vh',
                    }}>
                        <div style={{
                            width: '50%',
                            height: '100%', display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFF',
                            fontSize: '1.29vh',
                            fontStyle: 'normal',
                            fontWeight: 500,
                            lineHeight: 'normal',
                            borderRight: '0.09vh solid rgba(255, 255, 255, 0.17)',
                            cursor: 'pointer',
                        }} onClick={() => {
                            props.onCancel();
                            setValue('');
                        }}>
                            Cancel
                        </div>
                        <div style={{
                            width: '50%',
                            height: '100%', display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFF',
                            fontSize: '1.29vh',
                            fontStyle: 'normal',
                            fontWeight: 500,
                            lineHeight: 'normal',
                            cursor: 'pointer',
                        }} onClick={() => {
                            props.onConfirm(value);
                            setValue('');
                        }}>
                            {props.title}
                        </div>
                    </div>

                </div>
            </div>}
        </Transition>
    )
}