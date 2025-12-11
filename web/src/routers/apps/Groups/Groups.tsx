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
  vpn?: boolean;
capacity?: number;     // how many active/queued players
maxCapacity?: number;  // limit from config
}

// New interface for the updated groups data structure
interface NewGroupData {
    id: number;
    name: string;
    memberCount: number;
    status?: string;
    stage?: any[];
    leader: number;
    members: GroupMember[];
    jobType?: string;
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

interface JobMetaEntry {
    label: string;
    icon: string;
    color: string;
    vpn?: boolean;   // <-- optional
}

interface JobInfoData {
    id: string;
    label: string;
    description: string;
    information: string;
    vpn?: boolean;
}

function DynamicQueuePage({
    jobType,
    JobMeta,
    availableGroups,
    loadingGroups,
    setSelectedJob,
    fetchNui
}) {
    const meta = JobMeta[jobType];

    if (!meta) return <Text>No job meta found.</Text>;

    return (
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
                {meta.icon} {meta.label} — Groups
            </Text>

            <Button
                fullWidth
                color={meta.color}
                radius="0.5vh"
                mb="1vh"
                onClick={() =>
                    fetchNui("groups:createGroup", { jobType })
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
                            <Text fw={600}>
                                {meta.icon} {g.name || meta.label}
                            </Text>
                            <Text size="1.2vh" c="gray.4">Members: {g.memberCount ?? 0}</Text>
                            <Text size="1.2vh" c="gray.4">Status: {g.status ?? "idle"}</Text>

                            <Button
                                mt="0.8vh"
                                size="xs"
                                color="green"
                                radius="0.4vh"
                                onClick={() => fetchNui("joinGroup", { groupId: g.id, pass: '' })}
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
                onClick={() => {
                    fetchNui("groups:signOutJob");
                    setSelectedJob("");
                }}
            >
                ← Back to Job List
            </Button>
        </div>
    );
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

    /* const [groupStage, setGroupStage] = useState<{ isDone: boolean, name: string, id: number }[]>([]); */
    
    const [groupStage, setGroupStage] = useState<any[]>([]);
    const [stageRenderKey, setStageRenderKey] = useState(0);
    // === HOUSE ROBBERY STATE ===
    const [selectedJob, setSelectedJob] = useState<string>(""); // which job type player is viewing
    const [availableGroups, setAvailableGroups] = useState<any[]>([]);
    const [loadingGroups, setLoadingGroups] = useState<boolean>(false);
    const [memberRenderKey, setMemberRenderKey] = useState(0);

    const [prettyJobLabel, setPrettyJobLabel] = useState<string>("");
    const [jobInfoData, setJobInfoData] = useState<JobInfoData | null>(null);

    const sortJobs = (jobs: PhoneJob[]) =>
        [...jobs].sort((a, b) => {
            if (!!a.vpn === !!b.vpn) return a.label.localeCompare(b.label);
            return a.vpn ? 1 : -1; // push VPN jobs to the bottom
        });

    const JobMeta: Record<string, JobMetaEntry> = {
        towing: {
            label: "Towing",
            icon: "🚚",
            color: "#c49bff",
        },
        taxi: {
            label: "Taxi Driver",
            icon: "🚕",
            color: "#f4d03f",
        },
        storedelivery: {
            label: "Store Deliveries",
            icon: "📦",
            color: "#ffa31a",
        },
        sani: {
            label: "Sanitation Worker",
            icon: "🧹",
            color: "#7bd76d",
        },
        mining: {
            label: "Mining Crew",
            icon: "⛏️",
            color: "#b7950b",
        },
        chickens: {
            label: "Chicken Farmer",
            icon: "🐔",
            color: "#ffcc80",
        },
        fishing: {
            label: "Fishing",
            icon: "🎣",
            color: "#4cc3ff",
        },
        hunting: {
            label: "Hunting",
            icon: "🏹",
            color: "#a66d4f",
        },
        lumber: {
            label: "Lumberjack",
            icon: "🌲",
            color: "#27ae60",
        },
        panning: {
            label: "Gold Panning",
            icon: "🥇",
            color: "#f1c40f",
        },
        postop: {
            label: "PostOp Worker",
            icon: "📬",
            color: "#ffa31a",
        },

        // VPN Jobs
        chopshop: {
            label: "Chop Shop",
            icon: "🔧",
            color: "#e74c3c",
            vpn: true
        },
        diving: {
            label: "Diving",
            icon: "Dive",
            color: "#00bcd4",
            vpn: true,
        },
        oxyrun: {
            label: "Oxy Run",
            icon: "💊",
            color: "#d35400",
            vpn: true
        },
        taco: {
            label: "Taco Shop",
            icon: "🌮",
            color: "#ffb347",
            vpn: true
        },
        houserobbery: {
            label: "House Robbery",
            icon: "🏠",
            color: "#ff5555",
            vpn: true
        },
    };


    // Auto-fetch available groups for a job type
    // Keep the "job queue" list in sync with the latest groups from the server
    // Server always pushes the full list into `groupsData` via `setGroups`,
    // so we just filter that by jobType here.
    useEffect(() => {
        if (!selectedJob) {
            setAvailableGroups([]);
            return;
        }

        const byJob = (groupsData || []).filter((g: any) => g.jobType === selectedJob);
        setAvailableGroups(byJob);
    }, [selectedJob, groupsData]);

    // Reset the info view when leaving the Groups app
    useEffect(() => {
        if (location.app !== "groups") {
            setJobInfoData(null);
        }
    }, [location.app]);


    useNuiEvent("updateGroupsApp", (payload: { action: string; data: any }) => {
    const { action, data } = payload;
    console.log("[GROUPS UI] updateGroupsApp received:", action, data);

    switch (action) {
        case "setInGroup":
        setInGroup(Boolean(data));
        break;

        case "setCurrentGroup":
        if (data && Object.keys(data).length > 0) {

            setSelectedJob(data.jobType);
            setPrettyJobLabel(JobMeta[data.jobType].label);
            setCurrentGroupData(data.members || []);
            setMemberRenderKey(k => k + 1);
            setGroupsData(prev => {
                const existing = prev.find(g => g.id === data.id);
                if (existing) {
                    return prev.map(g => g.id === data.id ? { ...g, ...data } : g);
                } else {
                    return [...prev, data];
                }
            });


        } else {
            setCurrentGroupData([]);
            setGroupsData(prev => prev);
            setInGroup(false);
        }
        break;




        case "setGroups":
        setGroupsData(Array.isArray(data) ? data : []);
        break;

        case "setGroupJobSteps":
        setGroupStage(Array.isArray(data) ? data : []);
        setStageRenderKey(prev => prev + 1); // ⬅️ forces React re-render
        break;

        case "showJobInfo":
        setJobInfoData(data || null);
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

    useNuiEvent("setPlayerJobState", (jobType: string) => {
        console.log("[Groups UI] Player nghe job changed to:", jobType);

        if (jobType && JobMeta[jobType]) {
            setSelectedJob(jobType);
        }
    });


    const [playerSource, setPlayerSource] = useState(0);
    const [selectedgroupId, setSelectedGroupId] = useState(0);
    const [selectedPassword, setSelectedPassword] = useState('');
    // 🔥 HARDEN UI AGAINST AUTO-RESET WHEN LEAVING GROUP
    useEffect(() => {
        if (!inGroup) {
            // Do NOT reset selectedJob automatically.
            // Let the user manually leave the job queue page.
            // selectedJob remains intact unless user clicks "← Back to Job List"
        }
    }, [inGroup]);

    const handleJobInfo = async (jobId: string) => {
        const info = await fetchNui<JobInfoData>("groups:requestJobInfo", { jobId });

        if (info) {
            setJobInfoData(info);
            return;
        }

        const fallback = availableJobs.find((job) => job.id === jobId);
        if (fallback) {
            setJobInfoData({
                id: fallback.id,
                label: fallback.label,
                description: fallback.description,
                information: fallback.description,
                vpn: Boolean(JobMeta[fallback.id as keyof typeof JobMeta]?.vpn),
            });
        }
    };

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

                    // 🔥 FIX: Do NOT force the UI out of the job queue page
                    // If groupData is empty → user just left a group → KEEP selectedJob
                    if (!derivedInGroup) {
                        setInGroup(false);
                        // DO NOT reset selectedJob
                    } else {
                        setInGroup(true);
                    }

                }

                // ✅ fetch available jobs if not in a group
                if (!inGroup) {
                const jobs = await fetchNui("groups:getAvailableJobs");
                if (jobs) setAvailableJobs(sortJobs(jobs as PhoneJob[]));
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
                    {selectedJob && JobMeta[selectedJob] ? (
                        <DynamicQueuePage
                            jobType={selectedJob}
                            JobMeta={JobMeta}
                            availableGroups={availableGroups}
                            loadingGroups={loadingGroups}
                            setSelectedJob={setSelectedJob}
                            fetchNui={fetchNui}
                        />
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
                        .map((job, i) => {

                            // 🔥 MUST BE HERE — before the return!
                            const meta = JobMeta[job.id as keyof typeof JobMeta];
                            const isVPN = meta?.vpn === true;

                            return (
                                <div
                                    key={i}
                                    style={{
                                        width: "100%",
                                        minHeight: "11vh",          // ⬅️ more breathing room
                                        backgroundColor: isVPN
                                            ? "rgba(255, 80, 80, 0.20)"
                                            : "rgba(255, 255, 255, 0.15)",
                                        borderRadius: "0.75vh",     // ⬅️ more premium card feel
                                        padding: "1.3vh 1.4vh",     // ⬅️ more interior spacing
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "flex-start",   // ⬅️ stop squeezing columns vertically
                                        gap: "1vh",                 // ⬅️ more separation between left & right
                                        border: isVPN
                                            ? "1px solid rgba(255, 80, 80, 0.4)"
                                            : "none",
                                        boxShadow: isVPN
                                            ? "0 0 1vh rgba(255,0,0,0.35)"
                                            : "0 0 0.7vh rgba(0,0,0,0.25)", // ⬅️ optional subtle shadow
                                        transition: "0.2s ease",
                                    }}
                                >

                                    {/* LEFT SIDE: Job Info */}
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            justifyContent: "flex-start",
                                            color: "#FFF",
                                            width: "70%",
                                            paddingRight: "1vh",
                                        }}
                                    >
                                        <Text fw={600} size="1.42vh" style={{ marginBottom: "0.4vh" }}>
                                            {job.label}
                                        </Text>

                                        {isVPN && (
                                            <div
                                                style={{
                                                    background: "rgba(255,80,80,0.25)",
                                                    padding: "0.2vh 0.5vh",
                                                    borderRadius: "0.4vh",
                                                    marginBottom: "0.4vh",
                                                    fontSize: "1vh",
                                                    fontWeight: 600,
                                                    color: "#ff7777"
                                                }}
                                            >
                                                🔒 VPN Required
                                            </div>
                                        )}

                                        <Text
                                            size="1.1vh"
                                            c="gray.5"
                                            lineClamp={2}
                                            style={{ marginBottom: "0.6vh" }}
                                        >
                                            {job.description}
                                        </Text>

                                        {/* Capacity Bar (moved into left column) */}
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "0.45vh",
                                                marginTop: "0.4vh",
                                            }}
                                        >
                                            {[...Array(6)].map((_, idx) => {
                                                const fillThreshold = (job.maxCapacity / 6) * (idx + 1);
                                                const isFilled = job.capacity >= fillThreshold;

                                                return (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            width: "1vh",
                                                            height: "1vh",
                                                            borderRadius: "50%",
                                                            backgroundColor: isFilled
                                                                ? "#ff9f1a"
                                                                : "rgba(255,255,255,0.15)",
                                                            transition: "0.3s",
                                                        }}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>


                                    {/* RIGHT SIDE BUTTONS */}
                                    <div
                                        style={{
                                            display: "flex",
                                            flexDirection: "column",
                                            alignItems: "flex-end",
                                            justifyContent: "flex-start",
                                            gap: "0.7vh",
                                        }}
                                    >
                                        <Button
                                            size="xs"
                                            variant="filled"
                                            color="blue"
                                            radius="0.53vh"
                                            onClick={() => handleJobInfo(job.id)}
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
                                            }}
                                        >
                                            Set GPS
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}

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
                            Job: {
                            JobMeta[groupsData.find((g) => g.id)?.jobType]?.label ?? groupsData.find((g) => g.id)?.jobType ?? "Unknown"
                                }
                        </Text>
                        {/* === MEMBERS PANEL === */}
                        <div
                            key={memberRenderKey}
                            style={{
                                marginTop: "1vh",
                                padding: "1.2vh",
                                backgroundColor: "rgba(255,255,255,0.08)",
                                borderRadius: "0.53vh",
                            }}
                            >
                            <Text fw={600} size="1.35vh" style={{ marginBottom: "0.8vh" }}>
                                Members ({currentGroupData.length})
                            </Text>

                            {currentGroupData.length === 0 && (
                                <Text c="gray.5" size="1.2vh">No members</Text>
                            )}

                            <div
                                style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.8vh",
                                }}
                            >
                                {currentGroupData.map((member, idx) => {
                                const isLeader = member.isLeader;

                                return (
                                    <div
                                    key={`${memberRenderKey}-${idx}`}
                                    style={{
                                        backgroundColor: "rgba(255,255,255,0.06)",
                                        padding: "0.8vh 1vh",
                                        borderRadius: "0.45vh",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                        borderLeft: isLeader
                                        ? "0.35vh solid #e67e22"
                                        : "0.35vh solid transparent",
                                    }}
                                    >
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.9vh" }}>
                                        <Avatar
                                        radius="xl"
                                        size="2.4vh"
                                        src={null}
                                        color={isLeader ? "orange" : "blue"}
                                        />

                                        <div style={{ display: "flex", flexDirection: "column" }}>
                                        <Text fw={500} size="1.25vh">
                                            {member.name}
                                        </Text>

                                        <Text size="1vh" c="gray.5">
                                            ID: {member.playerId <= 0 ? "Offline" : member.playerId}
                                        </Text>
                                        </div>
                                    </div>

                                    {isLeader && (
                                        <Text
                                        size="1.05vh"
                                        fw={600}
                                        style={{
                                            background: "rgba(255,165,0,0.25)",
                                            padding: "0.2vh 0.6vh",
                                            borderRadius: "0.35vh",
                                            color: "#ffb347",
                                        }}
                                        >
                                        Leader
                                        </Text>
                                    )}
                                    </div>
                                );
                                })}
                            </div>
                        </div>



                        {/* ✅ Progress Display */}
                        {groupStage.length > 0 && (
                        <>
                            <Text mt="sm" fw={600} size="1.3vh">
                            Progress:
                            </Text>

                            <div
                            key={`stage-container-${stageRenderKey}`}
                            style={{
                                marginTop: "0.8vh",
                                width: "100%",
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.6vh",
                            }}
                            >
                            {groupStage.map((stage, idx) => {
                                const progress =
                                typeof stage.max === "number" && typeof stage.count === "number"
                                    ? Math.min((stage.count / stage.max) * 100, 100)
                                    : null;

                                return (
                                <div
                                    key={`${stageRenderKey}-${idx}`}
                                    style={{
                                    background: "rgba(255, 255, 255, 0.08)",
                                    borderRadius: "0.4vh",
                                    padding: "0.6vh 0.9vh",
                                    }}
                                >
                                    <div
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                    }}
                                    >
                                    <Text fw={500} size="1.15vh" style={{ color: "#fff" }}>
                                        {stage.name}
                                    </Text>

                                    {progress !== null ? (
                                        <Text size="1.05vh" c="gray.3">
                                        {stage.count}/{stage.max}
                                        </Text>
                                    ) : (
                                        <Text size="1.05vh" c="gray.3">
                                        {stage.isDone ? "✅" : "⏳"}
                                        </Text>
                                    )}
                                    </div>

                                    {progress !== null && (
                                    <div
                                        style={{
                                        marginTop: "0.35vh",
                                        width: "100%",
                                        height: "0.8vh",
                                        background: "rgba(255,255,255,0.15)",
                                        borderRadius: "0.3vh",
                                        overflow: "hidden",
                                        }}
                                    >
                                        <div
                                        style={{
                                            width: `${progress}%`,
                                            height: "100%",
                                            background: progress >= 100 ? "#2ecc71" : "#ffb347",
                                            transition: "width 0.3s ease",
                                        }}
                                        />
                                    </div>
                                    )}
                                </div>
                                );
                            })}

                            {/* === LEAVE / DISBAND BUTTONS AT BOTTOM === */}
                            <div
                                style={{
                                display: "flex",
                                flexDirection: "row",
                                gap: "0.6vh",
                                justifyContent: "space-between",
                                marginTop: "1.2vh",
                                }}
                            >
                                {/* Leave Group */}
                                <Button
                                size="xs"
                                fullWidth
                                radius="0.53vh"
                                color="red"
                                onClick={() => fetchNui("leaveGroup")}
                                >
                                Leave Group
                                </Button>

                                {/* Disband Group (Leader Only) */}
                                {currentGroupData.some((m) => m.isLeader) && (
                                <Button
                                    size="xs"
                                    fullWidth
                                    radius="0.53vh"
                                    color="orange"
                                    onClick={() => {
                                        const g = groupsData.find((g) => g.id);
                                        if (!g) return;
                                        fetchNui("disbandGroup", { groupId: g.id });
                                    }}
                                >
                                    Disband Group
                                </Button>
                                )}
                            </div>
                            </div>
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
                            {/* READY FOR JOB / LEAVE QUEUE */}
                            <style>
                                {`
                                @keyframes spin {
                                0% { transform: rotate(0deg); }
                                100% { transform: rotate(360deg); }
                                }
                                `}
                            </style>
                            <Button
                                size="xs"
                                fullWidth
                                radius="0.53vh"
                                color={
                                    (() => {
                                        const g = groupsData.find((g) => g.id);
                                        const isLeader = currentGroupData.some((m) => m.isLeader);

                                        if (!isLeader) return "gray";                    // non-leader
                                        if (g?.status === "queued" && isLeader) return "orange"; // leader queued
                                        return "green";                                  // leader idle
                                    })()
                                }
                                disabled={
                                    (() => {
                                        const g = groupsData.find((g) => g.id);
                                        const isLeader = currentGroupData.some((m) => m.isLeader);

                                        // generic jobs always disabled
                                        if ((g?.name || "").toLowerCase().includes("generic")) return true;

                                        // non-leaders always disabled
                                        if (!isLeader) return true;

                                        return false; // leader can press
                                    })()
                                }
                                title={
                                    (() => {
                                        const g = groupsData.find((g) => g.id);
                                        if (g?.status === "queued") return "Waiting for job offer…";
                                        return "";
                                    })()
                                }
                                onClick={() => {
                                    const g = groupsData.find((g) => g.id);
                                    const isLeader = currentGroupData.some((m) => m.isLeader);
                                    if (!g) return;

                                    if (g.status === "queued" && isLeader) {
                                        fetchNui("leaveQueue");
                                        return;
                                    }

                                    if (g.status !== "queued") {
                                        fetchNui("readyForJob");
                                    }
                                }}
                            >
                                {(() => {
                                    const g = groupsData.find((g) => g.id);
                                    const isLeader = currentGroupData.some((m) => m.isLeader);
                                    if (!g) return "Ready for Job";

                                    if (g.status === "queued") {
                                        if (isLeader)
                                            return (
                                                <>
                                                    <span className="spinner" style={{
                                                        marginRight: "0.6vh",
                                                        border: "2px solid rgba(255,255,255,0.3)",
                                                        borderTop: "2px solid #ffb347",
                                                        borderRadius: "50%",
                                                        width: "1.2vh",
                                                        height: "1.2vh",
                                                        display: "inline-block",
                                                        animation: "spin 1s linear infinite",
                                                    }}></span>
                                                    Leave Queue
                                                </>
                                            );
                                        return (
                                            <>
                                                <span className="spinner" style={{
                                                    marginRight: "0.6vh",
                                                    border: "2px solid rgba(255,255,255,0.3)",
                                                    borderTop: "2px solid #aaa",
                                                    borderRadius: "50%",
                                                    width: "1.2vh",
                                                    height: "1.2vh",
                                                    display: "inline-block",
                                                    animation: "spin 1s linear infinite",
                                                }}></span>
                                                Queued…
                                            </>
                                        );
                                    }

                                    if ((g.name || "").toLowerCase().includes("generic"))
                                        return "Not Ready (Generic)";
                                    if (!isLeader)
                                        return "Only Leader Can Queue";

                                    return "Ready for Job";
                                })()}
                            </Button>



                            {/* === LEAVE / DISBAND BUTTONS === */}
                            <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                gap: "0.6vh",
                                justifyContent: "space-between",
                            }}
                            >
                            {/* Leave Group */}
                            <Button
                                size="xs"
                                fullWidth
                                radius="0.53vh"
                                color="red"
                                onClick={() => {
                                fetchNui("leaveGroup");
                                }}
                            >
                                Leave Group
                            </Button>

                            {/* Disband Group (Leader Only) */}
                            {currentGroupData.some((m) => m.isLeader) && (
                                <Button
                                size="xs"
                                fullWidth
                                radius="0.53vh"
                                color="orange"
                                onClick={() => {
                                    const g = groupsData.find((g) => g.id);
                                    if (!g) return;
                                    fetchNui("disbandGroup", { groupId: g.id });
                                }}
                                >
                                Disband Group
                                </Button>
                            )}
                            </div>

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
                    >
                    {(styles) => (
                        <div
                        style={{
                            ...styles,
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            position: "absolute",
                            zIndex: 2,
                            backgroundColor: "#0E0E0E",
                        }}
                        >
                        <div
                            style={{
                            marginTop: "3.56vh",
                            width: "95%",
                            height: "53.33vh",
                            overflowY: "auto",
                            overflowX: "hidden",
                            }}
                        >
                            {/* 🟢 Replace Mantine Stepper with Custom Stage Renderer */}
                            {groupStage.map((stage, i) => {
                            const progress =
                                typeof stage.max === "number" && typeof stage.count === "number"
                                ? Math.min((stage.count / stage.max) * 100, 100)
                                : null;

                            return (
                                <div
                                key={i}
                                style={{
                                    background: "rgba(255, 255, 255, 0.08)",
                                    borderLeft: stage.isDone ? "3px solid #2ecc71" : "3px solid #777",
                                    padding: "0.9vh",
                                    borderRadius: "0.4vh",
                                    marginBottom: "0.5vh",
                                }}
                                >
                                <div
                                    style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    }}
                                >
                                    <Text fw={500} size="1.15vh" style={{ color: "#fff" }}>
                                    {stage.name}
                                    </Text>

                                    {progress !== null ? (
                                    <Text size="1.05vh" c="gray.3">
                                        {stage.count}/{stage.max}
                                    </Text>
                                    ) : (
                                    <Text size="1.05vh" c="gray.3">
                                        {stage.isDone ? "✅" : "⏳"}
                                    </Text>
                                    )}
                                </div>

                                {progress !== null && (
                                    <div
                                    style={{
                                        marginTop: "0.35vh",
                                        width: "100%",
                                        height: "0.8vh",
                                        background: "rgba(255,255,255,0.15)",
                                        borderRadius: "0.3vh",
                                        overflow: "hidden",
                                    }}
                                    >
                                    <div
                                        style={{
                                        width: `${progress}%`,
                                        height: "100%",
                                        background: progress >= 100 ? "#2ecc71" : "#ffb347",
                                        transition: "width 0.3s ease",
                                        }}
                                    />
                                    </div>
                                )}
                                </div>
                            );
                            })}

                            {/* === LEAVE / DISBAND BUTTONS AT BOTTOM === */}
                            <div
                            style={{
                                display: "flex",
                                flexDirection: "row",
                                gap: "0.6vh",
                                justifyContent: "space-between",
                                marginTop: "1.2vh",
                            }}
                            >
                            <Button
                                size="xs"
                                fullWidth
                                radius="0.53vh"
                                color="red"
                                onClick={() => fetchNui("leaveGroup")}
                            >
                                Leave Group
                            </Button>

                            {currentGroupData.some((m) => m.isLeader) && (
                                <Button
                                size="xs"
                                fullWidth
                                radius="0.53vh"
                                color="orange"
                                onClick={() => {
                                    const g = groupsData.find((g) => g.id);
                                    if (!g) return;
                                    fetchNui("disbandGroup", { groupId: g.id });
                                }}
                                >
                                Disband Group
                                </Button>
                            )}
                            </div>
                        </div>
                        </div>
                    )}
                    </Transition>

                <Transition
                    mounted={location.app === "groups" && !!jobInfoData}
                    transition="fade"
                    duration={250}
                    timingFunction="ease"
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
                                zIndex: 3,
                                backgroundColor: "#0E0E0E",
                            }}
                        >
                            <div style={{ width: "90%", marginTop: "3.56vh", display: "flex", flexDirection: "column", gap: "1vh" }}>
                                <Title title={jobInfoData?.label || "Job Info"} />

                                {jobInfoData?.vpn && (
                                    <div style={{ alignSelf: "flex-start", background: "rgba(255,80,80,0.2)", color: "#ff7777", padding: "0.35vh 0.7vh", borderRadius: "0.4vh", fontWeight: 600, fontSize: "1.05vh" }}>
                                        VPN Required
                                    </div>
                                )}

                                <Text size="1.15vh" c="gray.5" style={{ lineHeight: 1.4 }}>
                                    {jobInfoData?.description}
                                </Text>

                                {jobInfoData?.information && (
                                    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "0.7vh" }}>
                                        {(() => {
                                            // Prefer newline-separated steps; if none, split sentences instead
                                            const fromNewlines = jobInfoData.information.split(/\r?\n/);
                                            const base = fromNewlines.length > 1 ? fromNewlines : jobInfoData.information.split(/(?<=[.!?])\s+/);
                                            return base
                                                .map((line) => line.trim())
                                                .filter((line) => line.length > 0)
                                                .map((line, idx) => (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            width: "100%",
                                                            backgroundColor: "rgba(255,255,255,0.08)",
                                                            borderRadius: "0.65vh",
                                                            padding: "1vh 1.2vh",
                                                            display: "flex",
                                                            gap: "0.8vh",
                                                            alignItems: "flex-start",
                                                            borderLeft: "0.25vh solid #0A84FF",
                                                        }}
                                                    >
                                                        <div style={{ minWidth: "2vh", height: "2vh", borderRadius: "0.4vh", background: "#0A84FF", color: "#fff", fontSize: "1.1vh", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                                            {idx + 1}
                                                        </div>
                                                        <Text size="1.2vh" c="gray.1" style={{ lineHeight: 1.4 }}>
                                                            {line.endsWith(".") ? line : `${line}.`}
                                                        </Text>
                                                    </div>
                                                ));
                                        })()}
                                    </div>
                                )}

                                <div style={{ display: "flex", gap: "0.8vh", marginTop: "0.4vh" }}>
                                    <Button
                                        size="sm"
                                        radius="0.7vh"
                                        variant="filled"
                                        color="gray"
                                        onClick={() => setJobInfoData(null)}
                                    >
                                        Back to Jobs
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
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
                    setJobInfoData(null);
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
                    } else if (inputTitle === 'Disband Group') {
                        if (String(e).toLowerCase() === 'yes') {
                            const res = await fetchNui('disbandGroup');
                        }
                    } else if (inputTitle === 'Leave Group') {
                        if (String(e).toLowerCase() === 'yes') {
                            const res = await fetchNui('leaveGroup');
                        }
                    } else if (inputTitle === 'Join Group') {
                        if (String(e)) {
                            const res = await fetchNui('joinGroup', { groupId: selectedgroupId, pass: e });
                        }
                    }
                }} onCancel={() => {
                    setInputShow(false);
                }} />
            </div>
        </CSSTransition>
    )
}
