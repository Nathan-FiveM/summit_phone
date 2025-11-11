import { useRef, useEffect, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Navigation from "./Navigation";
import { Avatar, Checkbox, Stepper, Transition, Button, Card, Stack, Text } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { MultiJobData } from "../../../../../types/types";
import Title from "../../components/Title";
import Searchbar from "../../components/SearchBar";
import InputDialog from "../DarkChat/InputDialog";
import { useNuiEvent } from "../../../hooks/useNuiEvent";

// Jobs
interface PhoneJob {
  id: string;
  label: string;
  description: string;
  coords: { x: number; y: number; z: number };
}

// New interface for the updated groups data structure
interface NewGroupData {
    id: number;
    name: string;
    memberCount: number;
    status?: string;
    stage?: any[];
    leader: number;
    members: number[];
}

interface GroupMember {
    name: string;
    playerId: number;
    isLeader: boolean;
}

interface PlayerData {
    source: number;
}

interface SetupAppData {
    groups: NewGroupData[];
    groupData: GroupMember[];
    inGroup: boolean;
    groupStages: { isDone: boolean, name: string, id: number }[];
}

export default function Groups(props: { onExit: () => void, onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, setLocation } = usePhone();
    const [multiJobsData, setMultiJobsData] = useState<MultiJobData[]>([]);
    const [availableJobs, setAvailableJobs] = useState<PhoneJob[]>([]);
    const [searchValue, setSearchValue] = useState('');
    const [currentJob, setCurrentJob] = useState('');

    const [inputTitle, setInputTitle] = useState('');
    const [inputDescription, setInputDescription] = useState('');
    const [inputPlaceholder, setInputPlaceholder] = useState('');
    const [inputShow, setInputShow] = useState(false);

    const [newGroupData, setNewGroupData] = useState({
        groupName: '',
        groupPassword: '',
        groupAvatar: '',
        groupConfirmPassword: '',
    });

    // Updated state to match new backend structure
    const [groupsData, setGroupsData] = useState<NewGroupData[]>([]);
    const [currentGroupData, setCurrentGroupData] = useState<GroupMember[]>([]);
    const [inGroup, setInGroup] = useState(false);
    const [groupStage, setGroupStage] = useState<{ isDone: boolean, name: string, id: number }[]>([]);
    
    // === HOUSE ROBBERY STATE ===
    const [selectedJob, setSelectedJob] = useState<string>(""); // which job type player is viewing
    const [availableGroups, setAvailableGroups] = useState<any[]>([]);
    const [loadingGroups, setLoadingGroups] = useState<boolean>(false);

    // Auto-fetch available groups for a job type
    useEffect(() => {
    if (!selectedJob) return;

    setLoadingGroups(true);
    fetchNui("groups:getGroupsForJob", { jobType: selectedJob })
        .then((data) => setAvailableGroups((data as any[]) || []))
        .finally(() => setLoadingGroups(false));
    }, [selectedJob]);

    useNuiEvent("updateGroupsApp", (payload: { action: string; data: any }) => {
    const { action, data } = payload;
    console.log("[GROUPS UI] updateGroupsApp received:", action, data);

    switch (action) {
        case "setInGroup":
        setInGroup(Boolean(data));
        break;

        case "setCurrentGroup":
        if (data && Object.keys(data).length > 0) {
            setCurrentGroupData(data.members || []);
            setGroupsData([data]); // ensure we store the current group
        } else {
            setCurrentGroupData([]);
            setGroupsData([]);
        }
        break;

        case "setGroups":
        setGroupsData(Array.isArray(data) ? data : []);
        break;

        case "setGroupJobSteps":
        setGroupStage(Array.isArray(data) ? data : []);
        break;

        default:
        console.warn("[GROUPS UI] Unknown updateGroupsApp action:", action);
        break;
    }
    });
    
    useNuiEvent('setGroups', async (data: NewGroupData[]) => {
        setGroupsData(data);
    });

    useNuiEvent('setCurrentGroup', async (data: GroupMember[]) => {
        setCurrentGroupData(data);
    });

    useNuiEvent('setInGroup', async (data: boolean) => {
        setInGroup(data);
    });

    useNuiEvent('setGroupJobSteps', async (stage: { isDone: boolean, name: string, id: number }[]) => {
        setGroupStage(stage);
    });

    const [playerSource, setPlayerSource] = useState(0);
    const [selectedgroupId, setSelectedGroupId] = useState(0);
    const [selectedPassword, setSelectedPassword] = useState('');

    return (
        <CSSTransition
            nodeRef={nodeRef}
            in={location.app === 'groups'}
            timeout={450}
            classNames="enterandexitfromtop"
            unmountOnExit
            mountOnEnter
            onEntering={async () => {
                props.onEnter();
                setLocation({
                    app: 'groups',
                    page: {
                        ...location.page,
                        groups: 'groups'
                    }
                });
            }}
            onExited={() => {
                props.onExit();
                setLocation({
                    app: location.app,
                    page: {
                        ...location.page,
                        groups: ''
                    }
                });
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
            {/* === GROUPS PAGE === */}
            <Transition
            mounted={location.app === "groups" && location.page.groups === "groups"}
            transition="scale-x"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {
                const playerData = await fetchNui("getPlayerData", "Ok") as PlayerData;
                if (playerData) setPlayerSource(playerData.source || 0);

                const setupData = await fetchNui("getSetupAppData", "Ok") as SetupAppData;
                if (setupData) {
                    setGroupsData(setupData.groups || []);
                    setCurrentGroupData(setupData.groupData || []);
                    setGroupStage(setupData.groupStages || []);
                    // 🔹 Derive inGroup from the data instead of blindly trusting the flag
                    const derivedInGroup =
                    (Array.isArray(setupData.groupData) && setupData.groupData.length > 0) || (Array.isArray(setupData.groupStages) && setupData.groupStages.length > 0);
                    setInGroup(derivedInGroup);
                }

                // ✅ fetch available jobs if not in a group
                if (!inGroup) {
                const jobs = await fetchNui("groups:getAvailableJobs");
                if (jobs) setAvailableJobs(jobs as PhoneJob[]);
                }
                
            }}
            >
            {(styles) => (
                <div
                style={{
                    ...styles,
                    width: "100%",
                    height: "90%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    position: "absolute",
                    zIndex: 1,
                }}
                >
                <div
                    style={{
                    width: "90%",
                    marginTop: "3.56vh",
                    letterSpacing: "0.12vh",
                    display: "flex",
                    alignItems: "center",
                    }}
                >
                    <Title title="Group Jobs" />
                    <svg
                    onClick={() => {
                        setInputTitle("Create Group");
                        setInputDescription("Create a new group");
                        setInputPlaceholder("Group Name");
                        setInputShow(true);
                    }}
                    className="clickanimation"
                    width="2.22vh"
                    height="2.22vh"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    >
                    <path
                        d="M7.55555 12H12M12 12H16.4444M12 12V16.4444M12 12V7.55555M12 22C6.47716 22 2 17.5229 2 12C2 6.47716 6.47716 2 12 2C17.5229 2 22 6.47716 22 12C22 17.5229 17.5229 22 12 22Z"
                        stroke="#0A84FF"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    </svg>
                </div>

                {/* ✅ if NOT in group */}
                {!inGroup ? (
                <>
                    {/* 🏠 House Robbery - Group Listing Section */}
                    {selectedJob === "House Robbery" ? (
                    <div
                        style={{
                        width: "90%",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        color: "#FFF",
                        marginTop: "1vh",
                        }}
                    >
                        <Text fw={700} size="1.6vh" mb="1vh">
                        🏠 House Robbery — Groups
                        </Text>

                        <Button
                        fullWidth
                        color="orange"
                        radius="0.5vh"
                        mb="1vh"
                        onClick={() =>
                            fetchNui("groups:createGroup", { jobType: "House Robbery" })
                        }
                        >
                        Create New Group
                        </Button>

                        {loadingGroups ? (
                        <Text c="gray.5">Loading groups...</Text>
                        ) : availableGroups.length > 0 ? (
                        <div
                            style={{
                            width: "100%",
                            maxHeight: "55vh",
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.8vh",
                            }}
                        >
                            {availableGroups.map((g) => (
                            <div
                                key={g.id}
                                style={{
                                backgroundColor: "rgba(255,255,255,0.08)",
                                borderRadius: "0.53vh",
                                padding: "1vh",
                                }}
                            >
                                <Text fw={600}>{g.jobType || "House Robbery"}</Text>
                                <Text size="1.2vh" c="gray.4">
                                Members: {g.memberCount ?? 0}
                                </Text>
                                <Text size="1.2vh" c="gray.4">
                                Status: {g.status ?? "idle"}
                                </Text>

                                <Button
                                mt="0.8vh"
                                size="xs"
                                color="green"
                                radius="0.4vh"
                                onClick={() => fetchNui("joinGroup", { groupId: g.id })}
                                >
                                Join Group
                                </Button>
                            </div>
                            ))}
                        </div>
                        ) : (
                        <Text c="gray.5">No available groups. Create one to get started!</Text>
                        )}

                        <Button
                        mt="1vh"
                        size="xs"
                        color="gray"
                        variant="light"
                        onClick={() => setSelectedJob("")}
                        >
                        ← Back to Job List
                        </Button>
                    </div>
                    ) : (
                    <>
                        {/* 🧭 DEFAULT JOB LIST SECTION */}
                        <Searchbar
                        value={searchValue}
                        onChange={(e) => setSearchValue(e)}
                        mt="0.53vh"
                        />
                        <div
                        style={{
                            width: "90%",
                            height: "78%",
                            overflowY: "auto",
                            marginTop: "1vh",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: "0.7vh",
                            paddingRight: "0.5vh",
                        }}
                        >
                        {availableJobs
                            .filter((job) =>
                            job.label.toLowerCase().includes(searchValue.toLowerCase())
                            )
                            .map((job, i) => (
                            <div
                                key={i}
                                style={{
                                width: "100%",
                                minHeight: "8vh",
                                backgroundColor: "rgba(255, 255, 255, 0.15)",
                                borderRadius: "0.53vh",
                                padding: "1.0vh 1.1vh",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                }}
                            >
                                {/* LEFT SIDE: Job Info */}
                                <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    justifyContent: "center",
                                    color: "#FFF",
                                    width: "75%",
                                    paddingRight: "1vh",
                                }}
                                >
                                <Text fw={600} size="1.42vh" style={{ marginBottom: "0.4vh" }}>
                                    {job.label}
                                </Text>
                                <Text
                                    size="1.1vh"
                                    c="gray.5"
                                    lineClamp={2}
                                    style={{ marginBottom: "0.3vh" }}
                                >
                                    {job.description}
                                </Text>
                                </div>

                                {/* RIGHT SIDE: Buttons */}
                                <div
                                style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-end",
                                    justifyContent: "flex-end",
                                    gap: "0.4vh",
                                }}
                                >
                                <Button
                                    size="xs"
                                    variant="filled"
                                    color="blue"
                                    radius="0.53vh"
                                    onClick={async () => {
                                    await fetchNui("groups:requestJobInfo", { jobId: job.id });
                                    }}
                                >
                                    Job Info
                                </Button>

                                <Button
                                    size="xs"
                                    variant="filled"
                                    color="orange"
                                    radius="0.53vh"
                                    onClick={async () => {
                                    await fetchNui("groups:setJobWaypoint", { jobId: job.id });
                                    fetchNui("sendPhoneNotification", {
                                        app: "groups",
                                        title: "📍 Waypoint Set",
                                        description: `Navigate to ${job.label} to begin work.`,
                                        timeout: 5000,
                                    });

                                    if (job.label === "House Robbery") {
                                        setSelectedJob("House Robbery");
                                    }
                                    }}
                                >
                                    Set GPS
                                </Button>
                                </div>
                            </div>
                            ))}
                        </div>
                    </>
                    )}
                </>
                ) : (

                <>
                    {/* ✅ if IN group show current group info */}
                    <div style={{ width: "90%", marginTop: "1.78vh", color: "#FFF" }}>
                    <Text fw={600} size="1.48vh">
                        Current Group
                    </Text>

                    {currentGroupData.length > 0 ? (
                        <div
                        style={{
                            marginTop: "0.89vh",
                            backgroundColor: "rgba(255,255,255,0.08)",
                            borderRadius: "0.53vh",
                            padding: "1.2vh",
                        }}
                        >
                        <Text>
                            Name: {groupsData.find((g) => g.id)?.name ?? "Unknown"}
                        </Text>
                        <Text>
                            Members:{" "}
                            {currentGroupData.map((m) => m.name).join(", ") || "None"}
                        </Text>

                        {/* ✅ Progress Display */}
                        {groupStage.length > 0 && (
                            <>
                            <Text mt="sm">Progress:</Text>
                            {groupStage.map((stage, idx) => (
                                <Text key={idx}>
                                {stage.name} -{" "}
                                {stage.isDone ? "✅ Done" : "⏳ In Progress"}
                                </Text>
                            ))}
                            </>
                        )}

                        {/* === BUTTONS SECTION === */}
                        <div
                            style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.7vh",
                            marginTop: "1.2vh",
                            }}
                        >
                            {/* READY FOR JOB */}
                            <Button
                            size="xs"
                            fullWidth
                            radius="0.53vh"
                            color={
                                (groupsData.find((g) => g.status) || {}).status === "queued"
                                ? "gray"
                                : "green"
                            }
                            disabled={
                                !currentGroupData.some((m) => m.isLeader) ||
                                (groupsData.find((g) => g.id)?.name || "")
                                .toLowerCase()
                                .includes("generic")
                            }
                            onClick={() => {
                                const g = groupsData.find((g) => g.id);
                                if (g?.status === "queued") return; // already queued, ignore
                                fetchNui("readyForJob");
                            }}
                            >
                            {(() => {
                                const g = groupsData.find((g) => g.id);
                                if (g?.status === "queued") return "Queued…";
                                if (
                                (g?.name || "").toLowerCase().includes("generic")
                                )
                                return "Not Ready (Generic)";
                                return "Ready for Job";
                            })()}
                            </Button>

                            {/* LEAVE GROUP */}
                            <Button
                            size="xs"
                            fullWidth
                            radius="0.53vh"
                            color="red"
                            onClick={() => {
                                fetchNui("leaveGroupx");
                            }}
                            >
                            Leave Group
                            </Button>

                            {/* DELETE GROUP (Leader Only) */}
                            {currentGroupData.some((m) => m.isLeader) && (
                            <Button
                                size="xs"
                                fullWidth
                                radius="0.53vh"
                                color="orange"
                                onClick={() => {
                                fetchNui("deleteGroup");
                                }}
                            >
                                Delete Group
                            </Button>
                            )}
                        </div>
                        </div>
                    ) : (
                        <Text>No group data available</Text>
                    )}
                    </div>
                </>
                )}

                </div>
            )}
            </Transition>
                <Transition
                    mounted={groupStage && groupStage.length > 0}
                    transition="scale-x"
                    duration={400}
                    timingFunction="ease"
                    onEnter={async () => {

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
                        zIndex: 2,
                        backgroundColor: '#0E0E0E',
                    }}>
                        <div style={{
                            backgroundColor: 'rgba(146, 7, 7, 0)',
                            marginTop: '3.56vh',
                            width: '95%',
                            height: '53.33vh',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                        }}>
                            <Stepper iconSize={37} active={groupStage.findIndex(
                                (stage) => stage.isDone === true
                            ) + 1} orientation="vertical">
                                {groupStage.map((stage, i) => {
                                    return (
                                        <Stepper.Step key={i} label={`Step ${i + 1}`} description={stage.name} />
                                    )
                                })}
                            </Stepper>
                        </div>
                    </div>}
                </Transition>
                <Transition
                    mounted={location.app === 'groups' && location.page.groups === 'jobs'}
                    transition="scale-x"
                    duration={400}
                    timingFunction="ease"
                    onEnter={async () => {
                        const res = await fetchNui('getmultiPleJobs');
                        setMultiJobsData(JSON.parse(res as string).jobsData);
                        setCurrentJob(JSON.parse(res as string).currentJob);
                    }}
                >
                    {(styles) => <div style={{
                        ...styles,
                        width: '100%',
                        height: '90%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        position: 'absolute',
                        zIndex: 1,
                    }}>
                        <div style={{ width: '90%', marginTop: '3.56vh', letterSpacing: '0.12vh' }}><Title title="Job Center" /></div>
                        <Searchbar value={searchValue} onChange={(e) => {
                            setSearchValue(e);
                        }} mt="0.53vh" />
                        <div style={{ width: '90%', height: '80%', overflowY: 'scroll', marginTop: '0.00vh', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {multiJobsData && multiJobsData.filter(
                                (job) => String(job.jobLabel).toLowerCase().includes(String(searchValue).toLowerCase()) || String(job.jobName).toLowerCase().includes(String(searchValue).toLowerCase())
                            ).map((job, i) => {
                                return (
                                    <div style={{
                                        width: '100%',
                                        height: '6.76vh',
                                        backgroundColor: 'rgba(255, 255, 255, 0.18)',
                                        borderRadius: '0.53vh',
                                        paddingLeft: '0.89vh',
                                        paddingTop: '0.53vh',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        marginTop: i === 0 ? '0.89vh' : '0.89vh',
                                    }} key={i}>
                                        <div style={{
                                            display: 'flex',
                                            width: '97%',
                                            justifyContent: 'space-between',
                                        }}>
                                            <div>
                                                <Checkbox
                                                    defaultChecked
                                                    label={job.jobLabel}
                                                    styles={{
                                                        input: {
                                                            outline: 'none',
                                                            color: 'red',
                                                            backgroundColor: 'rgb(100, 100, 100)',
                                                            border: 'none',
                                                        },
                                                        label: {
                                                            fontSize: '1.42vh',
                                                            fontWeight: 500,
                                                            letterSpacing: '0.09vh',
                                                        }
                                                    }}
                                                    checked={job.jobName === currentJob ? true : false}
                                                />
                                                <div style={{
                                                    fontWeight: 400,
                                                    fontSize: '1.07vh',
                                                    letterSpacing: '0.09vh',
                                                    marginTop: '0.53vh',
                                                    borderRadius: '0.53vh',
                                                }}>
                                                    <div style={{ marginTop: '0.18vh' }}>{job.gradeLabel}</div>
                                                </div>
                                            </div>
                                            <div style={{ gap: '0.36vh', marginLeft: '0.36vh', display: 'flex', height: '5.69vh', alignItems: 'end' }}>
                                                <div style={{
                                                    fontWeight: 400,
                                                    fontSize: '1.07vh',
                                                    letterSpacing: '0.09vh',
                                                    backgroundColor: 'rgba(234, 113, 113, 0.4)',
                                                    padding: '0.18vh 0.53vh',
                                                    borderRadius: '0.53vh',
                                                }} onClick={() => {
                                                    fetchNui('deleteMultiJob', job._id);
                                                    setMultiJobsData(multiJobsData.filter((j) => j._id !== job._id));
                                                }} className='clickanimation'>
                                                    <div style={{ marginTop: '0.18vh' }}>Delete</div>
                                                </div>
                                                <div style={{
                                                    fontWeight: 400,
                                                    fontSize: '1.07vh',
                                                    letterSpacing: '0.09vh',
                                                    backgroundColor: 'rgba(159, 243, 178, 0.4)',
                                                    padding: '0.18vh 0.53vh',
                                                    borderRadius: '0.53vh',
                                                }} onClick={async () => {
                                                    const res = fetchNui('changeJobOfPlayer', JSON.stringify({
                                                        jobName: job.jobName,
                                                        grade: job.gradeLevel,
                                                    }));
                                                    if (res) {
                                                        setCurrentJob(job.jobName);
                                                    }
                                                }} className='clickanimation'>
                                                    <div style={{ marginTop: '0.18vh' }}>Change</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>}
                </Transition>
                <Navigation location={location.page.groups} onClick={(e) => {
                    setLocation({
                        app: 'groups',
                        page: {
                            ...location.page,
                            groups: e
                        }
                    })
                }} />
                <InputDialog show={inputShow} placeholder={inputPlaceholder} description={inputDescription} title={inputTitle} onConfirm={async (e: string) => {
                    setInputShow(false);
                    if (inputTitle === 'Create Group') {
                        setNewGroupData({
                            ...newGroupData,
                            groupName: e
                        });
                        setTimeout(() => {
                        }, 1000);
                        setInputTitle('Enter Password');
                        setInputDescription('Enter Password for the group');
                        setInputPlaceholder('Password');
                        setInputShow(true);
                    } else if (inputTitle === 'Enter Avatar') {
                        setNewGroupData({
                            ...newGroupData,
                            groupAvatar: e
                        });
                        setTimeout(() => {
                        }, 1000);
                        setInputTitle('Enter Password');
                        setInputDescription('Enter Password for the group');
                        setInputPlaceholder('Password');
                        setInputShow(true);
                    } else if (inputTitle === 'Enter Password') {
                        setNewGroupData({
                            ...newGroupData,
                            groupPassword: e
                        });
                        setTimeout(() => {
                        }, 1000);
                        setInputTitle('Confirm Password');
                        setInputDescription('Confirm Password for the group');
                        setInputPlaceholder('Confirm Password');
                        setInputShow(true);
                    } else if (inputTitle === 'Confirm Password') {
                        setNewGroupData({
                            ...newGroupData,
                            groupConfirmPassword: e
                        });
                        if (newGroupData.groupPassword === e) {
                            const res = await fetchNui('groups:createGroup', {
                                name: newGroupData.groupName,
                                pass: e,
                            });
                        }
                    } else if (inputTitle === 'Delete Group') {
                        if (String(e).toLowerCase() === 'yes') {
                            const res = await fetchNui('deleteGroup');
                        }
                    } else if (inputTitle === 'Leave Group') {
                        if (String(e).toLowerCase() === 'yes') {
                            const res = await fetchNui('leaveGroupx');
                        }
                    } else if (inputTitle === 'Join Group') {
                        if (String(e)) {
                            const res = await fetchNui('joinGroup', { id: selectedgroupId, pass: e });
                        }
                    }
                }} onCancel={() => {
                    setInputShow(false);
                }} />
            </div>
        </CSSTransition>
    )
}