import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Navigation from "./Navigation";
import { Avatar, Checkbox, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { GroupSData, MultiJobData } from "../../../../../types/types";
import Title from "../../components/Title";
import Searchbar from "../../components/SearchBar";
import InputDialog from "../DarkChat/InputDialog";
import { useNuiEvent } from "../../../hooks/useNuiEvent";

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
    const [groupData, setGroupData] = useState<GroupSData>()

    useNuiEvent('groups:refreshApp', async (data: GroupSData) => {
        setGroupData(data);
    });

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
                        const res = await fetchNui('GetGroupsApp', "Ok");
                        //@ts-ignore
                        const [groupData, isLeader, jobStatus, jobStage] = res;
                        setGroupData(groupData);
                        /* console.log(JSON.stringify(groupData), isLeader, JSON.stringify(jobStatus), JSON.stringify(jobStage)); */
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
                            marginTop: '2vw',
                            letterSpacing: '0.07vw',
                            display: 'flex',
                            alignItems: 'center',
                        }}>
                            <Title title="Groups" />
                            <svg onClick={() => {
                                setInputTitle('Create Group');
                                setInputDescription('Create a new group');
                                setInputPlaceholder('Group Name');
                                setInputShow(true);
                            }} className='clickanimation' width="1.25vw" height="1.25vw" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7.55555 12H12M12 12H16.4444M12 12V16.4444M12 12V7.55555M12 22C6.47716 22 2 17.5229 2 12C2 6.47716 6.47716 2 12 2C17.5229 2 22 6.47716 22 12C22 17.5229 17.5229 22 12 22Z" stroke="#0A84FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
                            </svg>
                        </div>
                        <Searchbar value={searchValue} onChange={(e) => {
                            setSearchValue(e);
                        }} mt="0.3vw" />
                        <div style={{
                            width: '90%',
                            height: '80%',
                            overflowY: 'scroll',
                        }}>
                            {Object.values(groupData).map((group, i) => {
                                return (
                                    <div key={i} style={{
                                        width: '100%',
                                        height: '3.5vw',
                                        display: 'flex',
                                        alignItems: 'center',
                                        backgroundColor: 'rgba(255, 255, 255, 0.13)',
                                        marginTop: i === 0 ? '0.5vw' : '0.5vw',
                                        borderRadius: '0.3vw',
                                    }}>
                                        <Avatar
                                            src={group.GLogo.length > 0 ? group.GLogo : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'}
                                            size="2.4vw"
                                            radius="xl"
                                            style={{ marginLeft: '0.5vw' }}
                                        />
                                        <div style={{
                                            height: '75%',
                                            width: '20%',
                                            marginLeft: '0.5vw',
                                            display: 'flex',
                                            flexDirection: 'column',

                                        }}>
                                            <div style={{ display: 'flex', }}>{group.GName}</div>
                                            <div style={{ display: 'flex', color: 'rgba(255,255,255, 0.5)', fontSize: '0.8vw', alignItems: 'center',gap: '0.2vw', lineHeight: '0.5vw' }}>
                                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                    <path d="M5.90688 1.71918C5.59825 3.06922 6.4922 5.36849 8.0034 5.36849C9.50396 5.36849 10.3979 3.06922 10.0893 1.71918C9.85515 0.685564 8.93992 0 8.0034 0C7.05624 0 6.15165 0.685564 5.90688 1.71918ZM1.51163 2.66842C1.24557 3.80752 2.01182 5.75873 3.28889 5.75873C4.56596 5.75873 5.3322 3.80752 5.06614 2.66842C4.86394 1.79301 4.08705 1.20237 3.28889 1.20237C2.49072 1.20237 1.71383 1.79301 1.51163 2.66842ZM10.9407 2.66842C10.6746 3.80752 11.4409 5.75873 12.7073 5.75873C13.9843 5.75873 14.7506 3.80752 14.4845 2.66842C14.2823 1.79301 13.5054 1.20237 12.7073 1.20237C11.9198 1.20237 11.1429 1.79301 10.9407 2.66842ZM10.3128 14.7238L11.6431 10.1885C12.4731 7.56229 10.8875 5.94858 8.0034 5.94858C5.10871 5.94858 3.52301 7.56229 4.34247 10.1885L5.68339 14.7238C5.92816 15.4832 6.93918 16 8.0034 16C9.04634 16 10.068 15.4832 10.3128 14.7238ZM3.821 6.67633C3.29953 7.38299 2.79934 8.60646 3.37402 10.4628L4.56596 14.4601C4.20412 14.6711 3.7465 14.7871 3.28889 14.7871C2.38429 14.7871 1.53291 14.3546 1.32007 13.7007L0.181348 9.85102C-0.510398 7.62558 0.830526 6.265 3.28889 6.265C3.57623 6.265 3.86357 6.28609 4.12962 6.32828C4.0232 6.43375 3.91678 6.56032 3.821 6.67633ZM12.7073 6.265C15.1656 6.265 16.5172 7.62558 15.8148 9.85102L14.6761 13.7007C14.4632 14.3546 13.6119 14.7871 12.7073 14.7871C12.2497 14.7871 11.792 14.6711 11.4302 14.4601L12.6115 10.4839C13.1968 8.60646 12.6966 7.38299 12.1645 6.67633C12.0794 6.56032 11.973 6.43375 11.8665 6.32828C12.1326 6.28609 12.4093 6.265 12.7073 6.265Z" fill="#666666" />
                                                </svg>
                                                <div>{group.Users}</div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
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
                        console.log(JSON.parse(res as string).currentJob);
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
                        <div style={{ width: '90%', marginTop: '2vw', letterSpacing: '0.07vw' }}><Title title="MultiJobs" /></div>
                        <Searchbar value={searchValue} onChange={(e) => {
                            setSearchValue(e);
                        }} mt="0.3vw" />
                        <div style={{ width: '90%', height: '80%', overflowY: 'scroll', marginTop: '0.0vw', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {multiJobsData && multiJobsData.filter(
                                (job) => job.jobLabel.toLowerCase().includes(searchValue.toLowerCase()) || job.jobName.toLowerCase().includes(searchValue.toLowerCase())
                            ).map((job, i) => {
                                return (
                                    <div style={{
                                        width: '100%',
                                        height: '3.8vw',
                                        backgroundColor: 'rgba(255, 255, 255, 0.18)',
                                        borderRadius: '0.3vw',
                                        paddingLeft: '0.5vw',
                                        paddingTop: '0.3vw',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        marginTop: i === 0 ? '0.5vw' : '0.5vw',
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
                                                            fontSize: '0.8vw',
                                                            fontWeight: 500,
                                                            letterSpacing: '0.05vw',
                                                        }
                                                    }}
                                                    checked={job.jobName === currentJob ? true : false}
                                                />
                                                <div style={{
                                                    fontWeight: 400,
                                                    fontSize: '0.6vw',
                                                    letterSpacing: '0.05vw',
                                                    marginTop: '0.3vw',
                                                    borderRadius: '0.3vw',
                                                }}>
                                                    <div style={{ marginTop: '0.1vw' }}>{job.gradeLabel}</div>
                                                </div>
                                            </div>
                                            <div style={{ gap: '0.2vw', marginLeft: '0.2vw', display: 'flex', height: '3.2vw', alignItems: 'end' }}>
                                                <div style={{
                                                    fontWeight: 400,
                                                    fontSize: '0.6vw',
                                                    letterSpacing: '0.05vw',
                                                    backgroundColor: 'rgba(234, 113, 113, 0.4)',
                                                    padding: '0.1vw 0.3vw',
                                                    borderRadius: '0.3vw',
                                                }} onClick={() => {
                                                    fetchNui('deleteMultiJob', job._id);
                                                    setMultiJobsData(multiJobsData.filter((j) => j._id !== job._id));
                                                }} className='clickanimation'>
                                                    <div style={{ marginTop: '0.1vw' }}>Delete</div>
                                                </div>
                                                <div style={{
                                                    fontWeight: 400,
                                                    fontSize: '0.6vw',
                                                    letterSpacing: '0.05vw',
                                                    backgroundColor: 'rgba(159, 243, 178, 0.4)',
                                                    padding: '0.1vw 0.3vw',
                                                    borderRadius: '0.3vw',
                                                }} onClick={async () => {
                                                    const res = fetchNui('changeJobOfPlayer', JSON.stringify({
                                                        jobName: job.jobName,
                                                        grade: job.gradeLevel,
                                                    }));
                                                    if (res) {
                                                        setCurrentJob(job.jobName);
                                                    }
                                                }} className='clickanimation'>
                                                    <div style={{ marginTop: '0.1vw' }}>Change</div>
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
                        setInputTitle('Enter Avatar');
                        setInputDescription('Enter Avatar Link for the group');
                        setInputPlaceholder('Enter Avatar');
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
                            const res = await fetchNui('groups:CreateJobGroup', {
                                name: newGroupData.groupName,
                                logo: newGroupData.groupAvatar,
                                pass: e,
                            });
                        }
                    }
                }} onCancel={() => {
                    setInputShow(false);
                }} />
            </div>
        </CSSTransition>
    )
}