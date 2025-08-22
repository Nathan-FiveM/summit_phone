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
                borderTopLeftRadius: '2.67vh',
                borderTopRightRadius: '2.67vh',
            }}>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'start',
                    marginTop: '0.89vh',
                }}>
                    <div style={{
                        fontSize: '1.24vh',
                        color: 'rgba(255, 255, 255, 0.5)',
                        marginLeft: '0.89vh',
                        cursor: 'pointer',
                    }} onClick={() => {
                        props.onExit();
                    }}>Close</div>
                    <div style={{
                        width: '60%',
                        textAlign: 'center',
                        marginLeft: '2.31vh',
                    }}>
                        {props.data.garage?.toUpperCase()}
                    </div>
                </div>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    marginTop: '0.89vh',
                }}>
                    {!imageErrors.has(props.data.category)
                        ? <Image
                            onError={() => handleImageError(props.data.category)}
                            src={`https://cdn.summitrp.gg/uploads/server/phone/${props.data.category?.toUpperCase()}.png`}
                            alt="vehicle"
                            width={180}
                            height={180}
                            style={{ borderRadius: '0.89vh' }}
                        />
                        :
                        <Image
                            onError={() => handleImageError(props.data.category)}
                            src={`https://cdn.summitrp.gg/uploads/server/phone/SPORTS.png`}
                            alt="vehicle"
                            width={180}
                            height={180}
                            style={{ borderRadius: '0.89vh' }}
                        />
                    }
                </div>
                <div style={{
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    gap: '2.31vh',
                    alignItems: 'center',
                }}>
                    <CircularProgressbarWithChildren
                        value={props.data.fuelLevel}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={100}
                        styles={{
                            root: {
                                width: "5.33vh",
                                height: "5.33vh",
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
                            width: "5.33vh",
                            height: "5.33vh",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.18vh",
                            fontSize: "1.07vh",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.18vh",
                            marginBottom: "0.18vh",
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
                                width: "5.33vh",
                                height: "5.33vh",
                                transform: "rotate(-135deg)"
                            },
                            path: {
                                stroke: "rgb(14, 169, 55)",
                            }
                        }}
                        strokeWidth={8}
                    >
                        <div style={{
                            width: "5.33vh",
                            height: "5.33vh",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.18vh",
                            fontSize: "1.07vh",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.18vh",
                            marginBottom: "0.18vh",
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
                                width: "5.33vh",
                                height: "5.33vh",
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
                            width: "5.33vh",
                            height: "5.33vh",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.18vh",
                            fontSize: "1.07vh",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.18vh",
                            marginBottom: "0.18vh",
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
                                width: "5.33vh",
                                height: "5.33vh",
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
                            width: "5.33vh",
                            height: "5.33vh",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.18vh",
                            fontSize: "0.89vh",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.18vh",
                            marginBottom: "0.18vh",
                        }}>
                            Engine
                        </div>
                    </CircularProgressbarWithChildren>
                </div>
                <div className="divider" />
                <div style={{
                    marginTop: '0.89vh',
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    flexWrap: 'wrap',
                    rowGap: '2.31vh',
                    columnGap: '3.56vh',
                    alignItems: 'center',
                }}>
                    <CircularProgressbarWithChildren
                        value={props.data.modEngine}
                        circleRatio={0.75}
                        minValue={0}
                        maxValue={5}
                        styles={{
                            root: {
                                width: "10.67vh",
                                height: "10.67vh",
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
                            width: "10.67vh",
                            height: "10.67vh",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.18vh",
                            fontSize: "0.89vh",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.18vh",
                            marginBottom: "0.18vh",
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
                                width: "10.67vh",
                                height: "10.67vh",
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
                            width: "10.67vh",
                            height: "10.67vh",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.18vh",
                            fontSize: "0.89vh",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.18vh",
                            marginBottom: "0.18vh",
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
                                width: "10.67vh",
                                height: "10.67vh",
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
                            width: "10.67vh",
                            height: "10.67vh",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.18vh",
                            fontSize: "0.89vh",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.18vh",
                            marginBottom: "0.18vh",
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
                                width: "10.67vh",
                                height: "10.67vh",
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
                            width: "10.67vh",
                            height: "10.67vh",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            alignItems: "center",
                            letterSpacing: "0.18vh",
                            fontSize: "0.89vh",
                            textTransform: "uppercase",
                            color: "#FFFFFF",
                            userSelect: "none",
                            marginLeft: "0.18vh",
                            marginBottom: "0.18vh",
                        }}>
                            <div>Suspension</div>
                            <div>Lvl.</div>
                        </div>
                    </CircularProgressbarWithChildren>
                </div>
                <div className="divider" style={{}} />
                <Button style={{
                    width: '90%',
                    marginTop: '1.78vh',
                    backgroundColor: 'rgb(12, 113, 221)',
                    color: 'white',
                    fontWeight: 'bold',
                    borderRadius: '0.89vh',
                    height: '4.44vh',
                    fontSize: '1.78vh',
                }} onClick={() => {
                    fetchNui('garage:valet', JSON.stringify(props.data));
                }}>
                    Valet
                </Button>
            </div>}
        </Transition>
    )
}