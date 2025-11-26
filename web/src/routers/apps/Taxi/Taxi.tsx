import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { Button, Text, TextInput, Textarea, Group, Divider, Badge } from "@mantine/core";
import { usePhone } from "../../../store/store";
import { fetchNui } from "../../../hooks/fetchNui";
import Title from "../../components/Title";
import { useNuiEvent } from "../../../hooks/useNuiEvent";

type RideState = {
    id?: string;
    coords?: { x: number; y: number; z: number };
    passengerName?: string;
    note?: string;
};

type MeterState = {
    fareAmount?: number;
    currentFare?: number;
    distanceTraveled?: number;
};

export default function TaxiApp(props: { onEnter: () => void; onExit: () => void }) {
    const nodeRef = useRef(null);
    const { location, setLocation, phoneSettings } = usePhone();
    const [view, setView] = useState<"passenger" | "driver">("passenger");
    const [note, setNote] = useState("");
    const [ride, setRide] = useState<RideState | null>(null);
    const [queuedRide, setQueuedRide] = useState<RideState | null>(null);
    const [meter, setMeter] = useState<MeterState>({});
    const [fareInput, setFareInput] = useState("");
    const [status, setStatus] = useState<string>("Idle");
    const [driverInfo, setDriverInfo] = useState<{ name?: string; number?: string } | null>(null);

    useNuiEvent("updateTaxiApp", (payload: any) => {
        const { action, data } = payload || {};
        switch (action) {
            case "rideQueued":
                setQueuedRide({
                    id: data?.id,
                    note: data?.note,
                });
                setStatus("Requested");
                break;
            case "rideCancelled":
                setQueuedRide(null);
                if (!ride) setStatus("Idle");
                break;
            case "rideAssigned":
                setRide({
                    id: data?.id,
                    coords: data?.coords,
                    passengerName: data?.passengerName,
                    note: data?.note,
                });
                setQueuedRide(null);
                setStatus("En Route");
                break;
            case "rideCleared":
                setRide(null);
                setStatus("Idle");
                break;
            case "meter":
                setMeter(data || {});
                break;
            case "driverEnroute":
                setDriverInfo({ name: data?.driverName, number: data?.driverNumber });
                setStatus("Driver En Route");
                break;
            case "driverArrived":
                setDriverInfo((prev) => ({ ...prev, name: data?.driverName || prev?.name, number: prev?.number || data?.driverNumber }));
                setStatus("Driver Arrived");
                break;
            default:
                break;
        }
    });

    const requestRide = async () => {
        setQueuedRide({
            note,
        });
        setStatus("Requested");
        await fetchNui("taxi:requestRide", { note });
    };

    const cancelRide = async () => {
        const id = queuedRide?.id;
        setQueuedRide(null);
        setStatus("Idle");
        await fetchNui("taxi:cancelRide", { rideId: id });
    };

    const completeRide = async () => {
        if (!ride?.id) return;
        const amount = fareInput && !Number.isNaN(Number(fareInput)) ? Number(fareInput) : meter.currentFare || 0;
        await fetchNui("taxi:completeRide", { rideId: ride.id, amount });
        setRide(null);
        setFareInput("");
        setStatus("Idle");
    };

    const callDriver = async () => {
        if (!driverInfo?.number) return;
        await fetchNui("callFromDialPad", JSON.stringify({
            number: driverInfo.number,
            _id: phoneSettings?._id || '',
            volume: 50
        }));
    };

    const markArrived = async () => {
        if (!ride?.id) return;
        await fetchNui("taxi:driverArrived", { rideId: ride.id });
    };

    const signIn = async () => {
        await fetchNui("taxi:signIn");
        setStatus("Signed In");
    };

    const readyUp = async () => {
        await fetchNui("taxi:readyForJob");
        setStatus("Queued");
    };

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === "taxi"}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={() => {
                props.onEnter();
                setLocation({ app: "taxi", page: { ...location.page, taxi: "main" } });
                fetchNui("taxi:getStatus");
            }}
            onExited={() => {
                props.onExit();
                setRide(null);
                setStatus("Idle");
            }}
        >
            <div
                ref={nodeRef}
                style={{
                    backgroundColor: "#0E0E0E",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                }}
                className="settings"
            >
                <div style={{ width: "90%", marginTop: "3.5vh", letterSpacing: "0.12vh" }}>
                    <Title title="Taxi" />
                    <Text size="1.2vh" c="gray.4" mt="0.4vh">
                        Request a cab or manage active fares.
                    </Text>
                </div>

                <Group mt="1.6vh" gap="xs">
                    <Button
                        size="xs"
                        radius="0.5vh"
                        variant={view === "passenger" ? "filled" : "light"}
                        color="yellow"
                        styles={{ root: { backgroundColor: view === "passenger" ? '#c9a227' : undefined } }}
                        onClick={() => setView("passenger")}
                    >
                        Passenger
                    </Button>
                    <Button
                        size="xs"
                        radius="0.5vh"
                        variant={view === "driver" ? "filled" : "light"}
                        color="blue"
                        onClick={() => setView("driver")}
                    >
                        Driver
                    </Button>
                    <Badge color={status === "Idle" ? "gray" : "green"} radius="sm">
                        {status}
                    </Badge>
                </Group>

                {view === "passenger" ? (
                    <div style={{ width: "90%", marginTop: "2vh", display: "flex", flexDirection: "column", gap: "1vh" }}>
                        <Textarea
                            label="Pickup Notes"
                            placeholder="Landmarks, color, number of riders..."
                            minRows={3}
                            value={note}
                            onChange={(e) => setNote(e.currentTarget.value)}
                            onFocus={() => fetchNui('disableControls', true)}
                            onBlur={() => fetchNui('disableControls', false)}
                            styles={{ input: { backgroundColor: "#1a1a1a", color: "white" } }}
                        />
                        <Button fullWidth radius="0.6vh" color="yellow" styles={{ root: { backgroundColor: '#c9a227' } }} onClick={requestRide}>
                            Request Taxi
                        </Button>
                        {queuedRide && (
                            <div style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "1vh", borderRadius: "0.6vh" }}>
                                <Text fw={600} size="1.3vh" c="white">
                                    Ride queued
                                </Text>
                                {queuedRide.note && (
                                    <Text size="1.1vh" c="gray.4" mt="0.3vh">
                                        {queuedRide.note}
                                    </Text>
                                )}
                                <Button
                                    mt="0.8vh"
                                    size="xs"
                                    radius="0.5vh"
                                    color="red"
                                    variant="light"
                                    onClick={cancelRide}
                                >
                                    Cancel Request
                                </Button>
                            </div>
                        )}
                        {status === "Requested" && <Text size="1.2vh" c="gray.5">Hang tight, a driver will accept shortly.</Text>}
                        {status === "Driver En Route" && driverInfo && (
                            <div style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "1vh", borderRadius: "0.6vh" }}>
                                <Text fw={600} size="1.3vh" c="white">
                                    Driver en route: {driverInfo.name || "Driver"}
                                </Text>
                                <Group mt="0.6vh" gap="sm">
                                    <Button size="xs" radius="0.5vh" color="blue" variant="light" onClick={callDriver}>
                                        Call Driver
                                    </Button>
                                </Group>
                            </div>
                        )}
                        {status === "Driver Arrived" && driverInfo && (
                            <div style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "1vh", borderRadius: "0.6vh" }}>
                                <Text fw={600} size="1.3vh" c="white">
                                    {driverInfo.name || "Driver"} has arrived and is waiting.
                                </Text>
                                <Group mt="0.6vh" gap="sm">
                                    <Button size="xs" radius="0.5vh" color="blue" variant="light" onClick={callDriver}>
                                        Call Driver
                                    </Button>
                                </Group>
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ width: "90%", marginTop: "2vh", display: "flex", flexDirection: "column", gap: "1vh" }}>
                        <Group gap="sm">
                            <Button size="xs" radius="0.5vh" color="green" onClick={signIn}>
                                Sign In
                            </Button>
                            <Button size="xs" radius="0.5vh" color="orange" onClick={readyUp}>
                                Ready / Re-Queue
                            </Button>
                            <Button size="xs" radius="0.5vh" variant="light" color="gray" onClick={() => fetchNui("taxi:toggleDuty")}>
                                Toggle Duty
                            </Button>
                        </Group>

                        <Divider my="sm" label="Active Ride" labelPosition="left" />
                        {ride ? (
                            <div style={{ backgroundColor: "rgba(255,255,255,0.05)", padding: "1vh", borderRadius: "0.6vh" }}>
                                <Text fw={600} size="1.4vh" c="white">
                                    {ride.passengerName || "Passenger"}
                                </Text>
                                {ride.note && (
                                    <Text size="1.1vh" c="gray.4" mt="0.4vh">
                                        Note: {ride.note}
                                    </Text>
                                )}
                                {ride.coords && (
                                    <Text size="1.1vh" c="gray.5" mt="0.2vh">
                                        GPS set to passenger
                                    </Text>
                                )}
                                <Button mt="0.8vh" size="xs" radius="0.5vh" color="blue" variant="light" onClick={markArrived}>
                                    Mark Arrived
                                </Button>
                            </div>
                        ) : (
                            <Text size="1.2vh" c="gray.5">
                                No active player ride. Queue up to receive one, or you'll get NPC fares.
                            </Text>
                        )}

                        <Divider my="sm" label="Meter" labelPosition="left" />
                        <Group gap="md">
                            <div>
                                <Text size="1.1vh" c="gray.5">
                                    Distance
                                </Text>
                                <Text fw={700} size="1.6vh" c="white">
                                    {(meter.distanceTraveled || 0).toFixed(2)} mi
                                </Text>
                            </div>
                            <div>
                                <Text size="1.1vh" c="gray.5">
                                    Fare
                                </Text>
                                <Text fw={700} size="1.6vh" c="yellow">
                                    ${meter.currentFare || 0}
                                </Text>
                            </div>
                        </Group>
                        <TextInput
                            label="Override Fare ($)"
                            placeholder="Leave empty to use meter"
                            value={fareInput}
                            onChange={(e) => setFareInput(e.currentTarget.value)}
                            styles={{ input: { backgroundColor: "#1a1a1a", color: "white" } }}
                        />
                        <Button fullWidth radius="0.6vh" color="yellow" disabled={!ride?.id} onClick={completeRide}>
                            Send Fare Request
                        </Button>
                    </div>
                )}
            </div>
        </CSSTransition>
    );
}
