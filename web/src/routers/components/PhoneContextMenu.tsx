import { Transition } from "@mantine/core";
import { useState } from "react";
import { useNuiEvent } from "../../hooks/useNuiEvent";
import { fetchNui } from "../../hooks/fetchNui";

export default function PhoneContextMenu() {
    const [contextData, setContextData] = useState<{
        name: string,
        event: string,
        isServer: boolean,
        args: string
    }[]>([]);
    const [show, setShow] = useState(false);

    useNuiEvent('phone:contextMenu', (data: {
        name: string,
        event: string,
        isServer: boolean,
        args: string
    }[]) => {
        setContextData(data);
        setShow(true);
    });

    useNuiEvent('phone:contextMenu:close', () => {
        setShow(false);
    });

    return (
        <Transition
            mounted={show}
            transition="fade"
            duration={400}
            timingFunction="ease"
        >
            {(styles) => <div style={{
                ...styles,
                height: '97%',
                position: 'absolute',
                display: 'flex',
                flexDirection: 'column-reverse',
                zIndex: 10,

            }}>
                <div style={{
                    display: 'flex',
                    width: '27.41vh',
                    padding: '0.93vh 0px 0.83vh 0px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: '0.56vh',
                    background: '#373737',
                }} onClick={()=>{
                    fetchNui('phone:contextMenu:close');
                    setShow(false);
                }}>
                    <div style={{
                        alignSelf: 'stretch',
                        color: '#FF3E41',
                        textAlign: 'center',
                        fontSize: '1.85vh',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 'normal',
                    }} className='clickanimation'>Cancel</div>
                </div>

                <div style={{
                    maxHeight: '24.89vh',
                    marginBottom: '0.93vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.09vh'
                }}>
                    {contextData.map((data, index) => {
                        return (
                            <div key={index} style={{
                                display: 'flex',
                                width: '27.41vh',
                                padding: '0.93vh 0px 0.83vh 0px',
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderRadius: '0.38vh',
                                background: '#373737',
                            }} onClick={async () => {
                                await fetchNui('phone:contextMenu:click', data);
                            }} className='clickanimation'>
                                <div style={{
                                    alignSelf: 'stretch',
                                    color: 'rgba(255, 255, 255, 0.79)',
                                    textAlign: 'center',
                                    fontSize: '1.76vh',
                                    fontStyle: 'normal',
                                    fontWeight: 400,
                                    lineHeight: 'normal',
                                }}>{data.name}</div>
                            </div>
                        )
                    })}
                </div>
            </div>}
        </Transition>
    )
}