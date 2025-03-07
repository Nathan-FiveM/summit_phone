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
                    width: '15.416666666666666vw',
                    padding: '0.5208333333333334vw 0px 0.46875vw 0px',
                    justifyContent: 'center',
                    alignItems: 'center',
                    borderRadius: '0.3125vw',
                    background: '#373737',
                }} onClick={()=>{
                    fetchNui('phone:contextMenu:close');
                    setShow(false);
                }}>
                    <div style={{
                        alignSelf: 'stretch',
                        color: '#FF3E41',
                        textAlign: 'center',
                        fontSize: '1.0416666666666667vw',
                        fontStyle: 'normal',
                        fontWeight: 500,
                        lineHeight: 'normal',
                    }} className='clickanimation'>Cancel</div>
                </div>

                <div style={{
                    maxHeight: '14vw',
                    marginBottom: '0.5208333333333334vw',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.05vw'
                }}>
                    {contextData.map((data, index) => {
                        return (
                            <div key={index} style={{
                                display: 'flex',
                                width: '15.416666666666666vw',
                                padding: '0.5208333333333334vw 0px 0.46875vw 0px',
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderRadius: '0.2125vw',
                                background: '#373737',
                            }} onClick={async () => {
                                await fetchNui('phone:contextMenu:click', data);
                            }} className='clickanimation'>
                                <div style={{
                                    alignSelf: 'stretch',
                                    color: 'rgba(255, 255, 255, 0.79)',
                                    textAlign: 'center',
                                    fontSize: '0.9895833333333334vw',
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