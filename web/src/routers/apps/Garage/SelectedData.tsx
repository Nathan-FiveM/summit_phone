import { Button, Image, Transition } from "@mantine/core";
import { GarageData } from "../../../../../types/types";
import { CircularProgressbarWithChildren } from "react-circular-progressbar";
import 'react-circular-progressbar/dist/styles.css';
import { fetchNui } from "../../../hooks/fetchNui";
import { useState } from "react";

export default function SelectedData(props: { show: boolean, data: GarageData, onExit: () => void }) {
    const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
    const handleImageError = (category: string) => {
        setImageErrors(prev => new Set(prev).add(category));
    };

    return (
        <Transition
            mounted={props.show}
            transition="slide-up"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {
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
                borderTopLeftRadius: '1.5vw',
                borderTopRightRadius: '1.5vw',
            }}>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'start',
                    marginTop: '0.5vw',
                }}>
                    <div style={{
                        fontSize: '0.7vw',
                        color: 'rgba(255, 255, 255, 0.5)',
                        marginLeft: '0.5vw',
                        cursor: 'pointer',
                    }} onClick={() => {
                        props.onExit();
                    }}>Close</div>
                    <div style={{
                        width: '60%',
                        textAlign: 'center',
                        marginLeft: '1.3vw',
                    }}>
                        {props.data.garage?.toUpperCase()}
                    </div>
                </div>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: '0.5vw',
                }}>
                    {!imageErrors.has(props.data.category)
                        ? <Image
                            onError={() => handleImageError(props.data.category)}
                            src={`https://cdn.summitrp.gg/uploads/server/phone/${props.data.category?.toUpperCase()}.png`}
                            alt="vehicle"
                            width={180}
                            height={180}
                            style={{ borderRadius: '0.5vw' }}
                        />
                        :
                        <></>
                    }
                </div>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: '1.3vw',
                    alignItems: 'center',
                }}>
                    <CircularProgressbarWithChildren
                        value={props.data.fuelLevel}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={100}
                        styles={{
                            root: {
                                width: "3vw",
                                height: "3vw",
                                transform: "rotate(-135deg)",
                                overflow: "visible",
                            },
                            path: {
                                stroke: "rgb(14, 169, 55)",
                            }
                        }}
                        strokeWidth={8}
                    >
                        <div style={{
                            width: "3vw",
                            height: "3vw",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.1vw",
                            fontSize: "0.6vw",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.1vw",
                            marginBottom: "0.1vw",
                        }}>
                            Fuel
                        </div>
                    </CircularProgressbarWithChildren>
                    <CircularProgressbarWithChildren
                        value={props.data.bodyHealth}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={1000}
                        styles={{
                            root: {
                                width: "3vw",
                                height: "3vw",
                                transform: "rotate(-135deg)"
                            },
                            path: {
                                stroke: "rgb(14, 169, 55)",
                            }
                        }}
                        strokeWidth={8}
                    >
                        <div style={{
                            width: "3vw",
                            height: "3vw",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.1vw",
                            fontSize: "0.6vw",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.1vw",
                            marginBottom: "0.1vw",
                        }}>
                            Body
                        </div>
                    </CircularProgressbarWithChildren>
                    <CircularProgressbarWithChildren
                        value={props.data.tankHealth}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={1000}
                        styles={{
                            root: {
                                width: "3vw",
                                height: "3vw",
                                transform: "rotate(-135deg)",
                                overflow: "visible",
                            },
                            path: {
                                stroke: "rgb(14, 169, 55)",
                            }
                        }}
                        strokeWidth={8}
                    >
                        <div style={{
                            width: "3vw",
                            height: "3vw",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.1vw",
                            fontSize: "0.6vw",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.1vw",
                            marginBottom: "0.1vw",
                        }}>
                            Tank
                        </div>
                    </CircularProgressbarWithChildren>
                    <CircularProgressbarWithChildren
                        value={props.data.engineHealth}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={1000}
                        styles={{
                            root: {
                                width: "3vw",
                                height: "3vw",
                                transform: "rotate(-135deg)",
                                overflow: "visible",
                            },
                            path: {
                                stroke: "rgb(14, 169, 55)",
                            }
                        }}
                        strokeWidth={8}
                    >
                        <div style={{
                            width: "3vw",
                            height: "3vw",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.1vw",
                            fontSize: "0.5vw",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.1vw",
                            marginBottom: "0.1vw",
                        }}>
                            Engine
                        </div>
                    </CircularProgressbarWithChildren>
                </div>
                <div className="divider" />
                <div style={{
                    marginTop: '0.5vw',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    rowGap: '1.3vw',
                    columnGap: '2vw',
                    alignItems: 'center',
                }}>
                    <CircularProgressbarWithChildren
                        value={props.data.modEngine}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={5}
                        styles={{
                            root: {
                                width: "6vw",
                                height: "6vw",
                                transform: "rotate(-135deg)",
                                overflow: "visible",
                            },
                            path: {
                                stroke: "rgb(195, 15, 66)",
                            }
                        }}
                        strokeWidth={8}
                    >
                        <div style={{
                            width: "6vw",
                            height: "6vw",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.1vw",
                            fontSize: "0.5vw",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.1vw",
                            marginBottom: "0.1vw",
                        }}>
                            <div>Engine</div>
                            <div>Lvl.</div>
                        </div>
                    </CircularProgressbarWithChildren>
                    <CircularProgressbarWithChildren
                        value={props.data.modBrakes}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={5}
                        styles={{
                            root: {
                                width: "6vw",
                                height: "6vw",
                                transform: "rotate(-135deg)",
                                overflow: "visible",
                            },
                            path: {
                                stroke: "rgb(195, 15, 66)",
                            }
                        }}
                        strokeWidth={8}
                    >
                        <div style={{
                            width: "6vw",
                            height: "6vw",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.1vw",
                            fontSize: "0.5vw",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.1vw",
                            marginBottom: "0.1vw",
                        }}>
                            <div>Brakes</div>
                            <div>Lvl.</div>
                        </div>
                    </CircularProgressbarWithChildren>
                    <CircularProgressbarWithChildren
                        value={props.data.modTransmission}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={5}
                        styles={{
                            root: {
                                width: "6vw",
                                height: "6vw",
                                transform: "rotate(-135deg)",
                                overflow: "visible",
                            },
                            path: {
                                stroke: "rgb(195, 15, 66)",
                            }
                        }}
                        strokeWidth={8}
                    >
                        <div style={{
                            width: "6vw",
                            height: "6vw",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.1vw",
                            fontSize: "0.5vw",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.1vw",
                            marginBottom: "0.1vw",
                        }}>
                            <div>TransMission</div>
                            <div>Lvl.</div>
                        </div>
                    </CircularProgressbarWithChildren>
                    <CircularProgressbarWithChildren
                        value={props.data.modSuspension}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={5}
                        styles={{
                            root: {
                                width: "6vw",
                                height: "6vw",
                                transform: "rotate(-135deg)",
                                overflow: "visible",
                            },
                            path: {
                                stroke: "rgb(195, 15, 66)",
                            }
                        }}
                        strokeWidth={8}
                    >
                        <div style={{
                            width: "6vw",
                            height: "6vw",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.1vw",
                            fontSize: "0.5vw",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.1vw",
                            marginBottom: "0.1vw",
                        }}>
                            <div>Suspension</div>
                            <div>Lvl.</div>
                        </div>
                    </CircularProgressbarWithChildren>
                </div>
                <div className="divider" style={{}} />
                <Button style={{
                    width: '90%',
                    marginTop: '1vw',
                    backgroundColor: 'rgb(12, 113, 221)',
                    color: 'white',
                    fontWeight: 'bold',
                    borderRadius: '0.5vw',
                    height: '2.5vw',
                    fontSize: '1vw',
                }} onClick={() => {
                    fetchNui('garage:valet', JSON.stringify(props.data));
                }}>
                    Valet
                </Button>
            </div>}
        </Transition>
    )
}