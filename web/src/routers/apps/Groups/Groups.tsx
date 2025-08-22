import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Navigation from "./Navigation";
import { Avatar, Checkbox, Stepper, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { MultiJobData } from "../../../../../types/types";
import Title from "../../components/Title";
import Searchbar from "../../components/SearchBar";
import InputDialog from "../DarkChat/InputDialog";
import { useNuiEvent } from "../../../hooks/useNuiEvent";

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
                    backgroundColor: '#0E0E0E',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
                className="settings"
            >
                <Transition
                    mounted={location.app === 'groups' && location.page.groups === 'groups'}
                    transition="scale-x"
                    duration={400}
                    timingFunction="ease"
                    onEnter={async () => {
                        // Get player data using the new backend
                        const playerData = await fetchNui('getPlayerData', "Ok") as PlayerData;
                        if (playerData) {
                            setPlayerSource(playerData.source || 0);
                        }

                        // Get setup app data which includes groups and current group info
                        const setupData = await fetchNui('getSetupAppData', "Ok") as SetupAppData;
                        if (setupData) {
                            setGroupsData(setupData.groups || []);
                            setCurrentGroupData(setupData.groupData || []);
                            setInGroup(setupData.inGroup || false);
                            setGroupStage(setupData.groupStages || []);
                        }
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
                        <div style={{
                            width: '90%',
                            marginTop: '3.56vh',
                            letterSpacing: '0.12vh',
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                            <Title title="Groups" />
                            <svg onClick={() => {
                                setInputTitle('Create Group');
                                setInputDescription('Create a new group');
                                setInputPlaceholder('Group Name');
                                setInputShow(true);
                            }} className='clickanimation' width="2.22vh" height="2.22vh" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.55555 12H12M12 12H16.4444M12 12V16.4444M12 12V7.55555M12 22C6.47716 22 2 17.5229 2 12C2 6.47716 6.47716 2 12 2C17.5229 2 22 6.47716 22 12C22 17.5229 17.5229 22 12 22Z" stroke="#0A84FF" strokeWidth="2.5" strokeLinecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <Searchbar value={searchValue} onChange={(e) => {
                            setSearchValue(e);
                        }} mt="0.53vh" />
                        <div style={{
                            width: '90%',
                            height: '80%',
                            overflowY: 'scroll',
                        }}>
                            {groupsData && groupsData.filter(group =>
                                String(group.name).toLowerCase().includes(String(searchValue).toLowerCase())
                            ).map((group, i) => {
                                return (
                                    <div key={i} style={{
                                        width: '100%',
                                        height: '6.22vh',
                                        display: 'flex',
                                        alignItems: 'center',
                                        backgroundColor: 'rgba(255, 255, 255, 0.13)',
                                        marginTop: i === 0 ? '0.89vh' : '0.89vh',
                                        borderRadius: '0.53vh',
                                        position: 'relative'
                                    }}>
                                        <Avatar
                                            src={'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'}
                                            size="4.27vh"
                                            radius="xl"
                                            style={{ marginLeft: '0.89vh' }}
                                        />
                                        <div style={{
                                            height: '63%',
                                            width: '20%',
                                            marginLeft: '0.89vh',
                                            display: 'flex',
                                            flexDirection: 'column',
                                        }}>
                                            <div style={{ fontSize: '1.42vh', width: '17.78vh', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{group.name}</div>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <div style={{ display: 'flex', color: 'rgba(255,255,255, 0.5)', fontSize: '1.42vh', alignItems: 'center', gap: '0.36vh', lineHeight: '0.89vh' }}>
                                                    <svg width="1.48vh" height="1.48vh" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M5.90688 1.71918C5.59825 3.06922 6.4922 5.36849 8.0034 5.36849C9.50396 5.36849 10.3979 3.06922 10.0893 1.71918C9.85515 0.685564 8.93992 0 8.0034 0C7.05624 0 6.15165 0.685564 5.90688 1.71918ZM1.51163 2.66842C1.24557 3.80752 2.01182 5.75873 3.28889 5.75873C4.56596 5.75873 5.3322 3.80752 5.06614 2.66842C4.86394 1.79301 4.08705 1.20237 3.28889 1.20237C2.49072 1.20237 1.71383 1.79301 1.51163 2.66842ZM10.9407 2.66842C10.6746 3.80752 11.4409 5.75873 12.7073 5.75873C13.9843 5.75873 14.7506 3.80752 14.4845 2.66842C14.2823 1.79301 13.5054 1.20237 12.7073 1.20237C11.9198 1.20237 11.1429 1.79301 10.9407 2.66842ZM10.3128 14.7238L11.6431 10.1885C12.4731 7.56229 10.8875 5.94858 8.0034 5.94858C5.10871 5.94858 3.52301 7.56229 4.34247 10.1885L5.68339 14.7238C5.92816 15.4832 6.93918 16 8.0034 16C9.04634 16 10.068 15.4832 10.3128 14.7238ZM3.821 6.67633C3.29953 7.38299 2.79934 8.60646 3.37402 10.4628L4.56596 14.4601C4.20412 14.6711 3.7465 14.7871 3.28889 14.7871C2.38429 14.7871 1.53291 14.3546 1.32007 13.7007L0.181348 9.85102C-0.510398 7.62558 0.830526 6.265 3.28889 6.265C3.57623 6.265 3.86357 6.28609 4.12962 6.32828C4.0232 6.43375 3.91678 6.56032 3.821 6.67633ZM12.7073 6.265C15.1656 6.265 16.5172 7.62558 15.8148 9.85102L14.6761 13.7007C14.4632 14.3546 13.6119 14.7871 12.7073 14.7871C12.2497 14.7871 11.792 14.6711 11.4302 14.4601L12.6115 10.4839C13.1968 8.60646 12.6966 7.38299 12.1645 6.67633C12.0794 6.56032 11.973 6.43375 11.8665 6.32828C12.1326 6.28609 12.4093 6.265 12.7073 6.265Z" fill="#666666" />
                                                    </svg>
                                                    <div style={{ fontSize: '1.24vh' }}>{group.memberCount}</div>
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{
                                            position: 'absolute',
                                            right: '0.89vh',
                                            top: '2.31vh'
                                        }}>
                                            {group.leader === playerSource ? <svg onClick={() => {
                                                setInputTitle('Delete Group');
                                                setInputDescription('Are you sure you want to delete this group?');
                                                setInputPlaceholder('Type Yes to confirm');
                                                setInputShow(true);
                                                setSelectedGroupId(group.id);
                                            }} className='clickanimation' width="1.39vh" height="1.39vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M19.3333 2.66956H13.2667C13.1137 1.91616 12.7048 1.23882 12.1095 0.752297C11.5142 0.265777 10.7689 0 10 0C9.2311 0 8.48584 0.265777 7.89049 0.752297C7.29515 1.23882 6.88634 1.91616 6.73333 2.66956H0.666667C0.489856 2.66956 0.320286 2.73979 0.195262 2.86479C0.0702379 2.9898 0 3.15934 0 3.33612C0 3.5129 0.0702379 3.68244 0.195262 3.80744C0.320286 3.93245 0.489856 4.00267 0.666667 4.00267H19.3333C19.5101 4.00267 19.6797 3.93245 19.8047 3.80744C19.9298 3.68244 20 3.5129 20 3.33612C20 3.15934 19.9298 2.9898 19.8047 2.86479C19.6797 2.73979 19.5101 2.66956 19.3333 2.66956ZM10 1.33645C10.4126 1.33761 10.8148 1.46635 11.1514 1.70502C11.488 1.94368 11.7425 2.28059 11.88 2.66956H8.12C8.25754 2.28059 8.51205 1.94368 8.84862 1.70502C9.1852 1.46635 9.58737 1.33761 10 1.33645ZM16.92 5.38911C16.7986 5.33806 16.6648 5.32412 16.5355 5.34903C16.4061 5.37394 16.2871 5.43659 16.1933 5.52908C16.1315 5.59137 16.0827 5.66523 16.0495 5.74644C16.0163 5.82766 15.9995 5.91462 16 6.00234C16 6.17912 16.0702 6.34866 16.1953 6.47366C16.3203 6.59867 16.4899 6.66889 16.6667 6.66889C16.8435 6.66889 17.013 6.59867 17.1381 6.47366C17.2631 6.34866 17.3333 6.17912 17.3333 6.00234C17.3309 5.82586 17.2618 5.65682 17.14 5.52908C17.0766 5.4684 17.0018 5.42083 16.92 5.38911ZM16.6667 8.002C16.4899 8.002 16.3203 8.07223 16.1953 8.19724C16.0702 8.32224 16 8.49178 16 8.66856V10.6682C16 10.845 16.0702 11.0145 16.1953 11.1396C16.3203 11.2646 16.4899 11.3348 16.6667 11.3348C16.8435 11.3348 17.013 11.2646 17.1381 11.1396C17.2631 11.0145 17.3333 10.845 17.3333 10.6682V8.66856C17.3333 8.49178 17.2631 8.32224 17.1381 8.19724C17.013 8.07223 16.8435 8.002 16.6667 8.002ZM16.6667 12.6679C16.4899 12.6679 16.3203 12.7381 16.1953 12.8631C16.0702 12.9881 16 13.1577 16 13.3344V18.0003C16 18.1771 15.9298 18.3467 15.8047 18.4717C15.6797 18.5967 15.5101 18.6669 15.3333 18.6669H4.66667C4.48986 18.6669 4.32029 18.5967 4.19526 18.4717C4.07024 18.3467 4 18.1771 4 18.0003V6.00234C4 5.82556 3.92976 5.65602 3.80474 5.53101C3.67971 5.40601 3.51014 5.33578 3.33333 5.33578C3.15652 5.33578 2.98695 5.40601 2.86193 5.53101C2.7369 5.65602 2.66667 5.82556 2.66667 6.00234V18.0003C2.66667 18.5307 2.87738 19.0393 3.25245 19.4143C3.62753 19.7893 4.13623 20 4.66667 20H15.3333C15.8638 20 16.3725 19.7893 16.7475 19.4143C17.1226 19.0393 17.3333 18.5307 17.3333 18.0003V13.3344C17.3333 13.1577 17.2631 12.9881 17.1381 12.8631C17.013 12.7381 16.8435 12.6679 16.6667 12.6679Z" fill="#0A84FF" />
                                                <path d="M7.33333 15.3341V6.66889C7.33333 6.49211 7.2631 6.32257 7.13807 6.19757C7.01305 6.07257 6.84348 6.00234 6.66667 6.00234C6.48986 6.00234 6.32029 6.07257 6.19526 6.19757C6.07024 6.32257 6 6.49211 6 6.66889V15.3341C6 15.5109 6.07024 15.6804 6.19526 15.8054C6.32029 15.9304 6.48986 16.0007 6.66667 16.0007C6.84348 16.0007 7.01305 15.9304 7.13807 15.8054C7.2631 15.6804 7.33333 15.5109 7.33333 15.3341ZM10.6667 15.3341V6.66889C10.6667 6.49211 10.5964 6.32257 10.4714 6.19757C10.3464 6.07257 10.1768 6.00234 10 6.00234C9.82319 6.00234 9.65362 6.07257 9.5286 6.19757C9.40357 6.32257 9.33333 6.49211 9.33333 6.66889V15.3341C9.33333 15.5109 9.40357 15.6804 9.5286 15.8054C9.65362 15.9304 9.82319 16.0007 10 16.0007C10.1768 16.0007 10.3464 15.9304 10.4714 15.8054C10.5964 15.6804 10.6667 15.5109 10.6667 15.3341ZM14 15.3341V6.66889C14 6.49211 13.9298 6.32257 13.8047 6.19757C13.6797 6.07257 13.5101 6.00234 13.3333 6.00234C13.1565 6.00234 12.987 6.07257 12.8619 6.19757C12.7369 6.32257 12.6667 6.49211 12.6667 6.66889V15.3341C12.6667 15.5109 12.7369 15.6804 12.8619 15.8054C12.987 15.9304 13.1565 16.0007 13.3333 16.0007C13.5101 16.0007 13.6797 15.9304 13.8047 15.8054C13.9298 15.6804 14 15.5109 14 15.3341Z" fill="#0A84FF" />
                                            </svg> :
                                                group.members.find(member => member === playerSource) ?
                                                    <svg onClick={() => {
                                                        setInputTitle('Leave Group');
                                                        setInputDescription('Are you sure you want to leave this group?');
                                                        setInputPlaceholder('Type Yes to confirm');
                                                        setInputShow(true);
                                                        setSelectedGroupId(group.id);
                                                    }} className='clickanimation' width="1.39vh" height="1.39vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M3.37148 19.998C2.50772 20.028 1.66741 19.7138 1.03522 19.1246C0.403034 18.5354 0.030684 17.7193 0 16.8558L0 3.14417C0.030983 2.28072 0.403424 1.46485 1.03555 0.875709C1.66767 0.286565 2.5078 -0.0276992 3.37148 0.00191875H13.4288C13.6561 0.00191875 13.8741 0.0922071 14.0349 0.252921C14.1956 0.413636 14.2859 0.631611 14.2859 0.858895C14.2859 1.08618 14.1956 1.30416 14.0349 1.46487C13.8741 1.62558 13.6561 1.71587 13.4288 1.71587H3.37148C2.96286 1.68811 2.55976 1.82246 2.24956 2.08983C1.93936 2.35719 1.74705 2.736 1.71431 3.14417V16.8558C1.74733 17.2638 1.93973 17.6425 2.24986 17.9098C2.56 18.1771 2.96293 18.3116 3.37148 18.2841H13.4288C13.6561 18.2841 13.8741 18.3744 14.0349 18.5351C14.1956 18.6958 14.2859 18.9138 14.2859 19.1411C14.2859 19.3683 14.1956 19.5863 14.0349 19.747C13.8741 19.9078 13.6561 19.998 13.4288 19.998H3.37148ZM13.9648 15.1773C13.8042 15.0164 13.714 14.7984 13.714 14.5711C13.714 14.3438 13.8042 14.1258 13.9648 13.9649L17.0734 10.857H6.57152C6.34419 10.857 6.12617 10.7667 5.96542 10.606C5.80467 10.4452 5.71437 10.2273 5.71437 9.99998C5.71437 9.7727 5.80467 9.55472 5.96542 9.39401C6.12617 9.23329 6.34419 9.143 6.57152 9.143H17.0745L13.9648 6.03504C13.8829 5.95594 13.8177 5.86135 13.7728 5.75677C13.7279 5.6522 13.7043 5.53973 13.7034 5.42595C13.7025 5.31216 13.7242 5.19932 13.7674 5.09402C13.8105 4.98872 13.8742 4.89307 13.9547 4.81265C14.0352 4.73222 14.131 4.66863 14.2363 4.62559C14.3417 4.58255 14.4546 4.56092 14.5684 4.56197C14.6822 4.56301 14.7947 4.5867 14.8992 4.63166C15.0038 4.67662 15.0983 4.74195 15.1774 4.82384L19.7488 9.39438C19.8285 9.47387 19.8916 9.56827 19.9347 9.67218C19.9778 9.7761 20 9.88749 20 9.99998C20 10.1125 19.9778 10.2239 19.9347 10.3278C19.8916 10.4317 19.8285 10.5261 19.7488 10.6056L15.1774 15.1761C15.0164 15.3367 14.7984 15.4268 14.5711 15.4268C14.3437 15.4268 14.1257 15.3367 13.9648 15.1761V15.1773Z" fill="#0A84FF" />
                                                    </svg>
                                                    : group.status === "WAITING" ? <svg onClick={() => {
                                                        if (group.status !== "WAITING") {
                                                            fetchNui('showNoti', { app: 'settings', title: 'Groups Error', description: 'Can\'t Join Join Group is Busy !' });
                                                            return
                                                        };
                                                        setInputTitle('Join Group');
                                                        setInputDescription('Are you sure you want to Join this group?');
                                                        setInputPlaceholder('Enter Password');
                                                        setInputShow(true);
                                                        setSelectedGroupId(group.id);
                                                        setSelectedPassword('');
                                                    }} className='clickanimation' width="1.85vh" height="1.85vh" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M4.44444 1.11111C4.44444 0.497461 4.9419 0 5.55555 0H16.6667C18.5077 0 20 1.49239 20 3.33333V16.6667C20 18.5076 18.5076 20 16.6667 20H5.55555C4.9419 20 4.44444 19.5025 4.44444 18.8889C4.44444 18.2752 4.9419 17.7778 5.55555 17.7778H16.6667C17.2804 17.7778 17.7778 17.2804 17.7778 16.6667V3.33333C17.7778 2.71967 17.2803 2.22222 16.6667 2.22222H5.55555C4.9419 2.22222 4.44444 1.72476 4.44444 1.11111Z" fill="#0A84FF" />
                                                        <path d="M0 10C0 9.38636 0.497462 8.8889 1.11111 8.8889H10.6509L8.10321 6.34122C7.66929 5.9073 7.66929 5.20379 8.10321 4.76987C8.53713 4.33595 9.24064 4.33595 9.67456 4.76987L12.5477 7.64298C13.8494 8.94468 13.8494 11.0553 12.5477 12.357L9.67456 15.2301C9.24064 15.664 8.53713 15.664 8.10321 15.2301C7.66929 14.7962 7.66929 14.0927 8.10321 13.6588L10.6508 11.1111H1.11111C0.497462 11.1111 0 10.6137 0 10Z" fill="#0A84FF" />
                                                    </svg> : <>
                                                    </>
                                            }
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>}
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
                        <div style={{ width: '90%', marginTop: '3.56vh', letterSpacing: '0.12vh' }}><Title title="Jobs" /></div>
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