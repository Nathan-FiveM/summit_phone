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
                    width: '14.739583333333334vw',
                    height: '8.072916666666666vw',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    borderRadius: '13px',
                    backgroundColor: '#3C3C3C'
                }}>
                    <div style={{
                        width: '100%',
                        height: '10%',
                        textAlign: 'center',
                        color: '#FFF',
                        marginTop: '0.3645833333333333vw',
                        fontSize: '0.8854166666666666vw',
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
                        marginTop: '0.8vw',
                        fontSize: '11px',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 'normal',
                    }}>
                        {props.description}
                    </div>
                    <TextInput onFocus={() => fetchNui("disableControls", true)} onBlur={() => fetchNui("disableControls", false)} placeholder={props.placeholder} style={{ width: '80%', marginTop: '1.3vw' }} styles={{
                        root: {
                            minHeight: '0vw',
                            height: '1.3vw',
                        },
                        input: {
                            minHeight: '0vw',
                            height: '1.3vw',
                            backgroundColor: 'rgba(182, 182, 182, 0.12)',
                            color: '#FFF',
                            border: 'none',
                            borderRadius: '0.2604166666666667vw',
                            textAlign: 'center',
                        },
                    }} value={value} onChange={(e) => setValue(e.currentTarget.value)} />
                    <div style={{
                        width: '100%',
                        height: '1.9vw',
                        borderTop: '0.052083333333333336vw solid rgba(255, 255, 255, 0.17)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginTop: '0.7645833333333333vw',
                    }}>
                        <div style={{
                            width: '50%',
                            height: '100%', display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#FFF',
                            fontSize: '0.725vw',
                            fontStyle: 'normal',
                            fontWeight: 500,
                            lineHeight: 'normal',
                            borderRight: '0.052083333333333336vw solid rgba(255, 255, 255, 0.17)',
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
                            fontSize: '0.725vw',
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