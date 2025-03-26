import { useRef, useState } from "react";
import { CSSTransition } from "react-transition-group";
import { usePhone } from "../../../store/store";
import Navigation from "./Navigation";
import { Checkbox, Transition } from "@mantine/core";
import { fetchNui } from "../../../hooks/fetchNui";
import { MultiJobData } from "../../../../../types/types";
import Title from "../../components/Title";
import Searchbar from "../../components/SearchBar";

export default function Groups(props: { onExit: () => void, onEnter: () => void }) {
    const nodeRef = useRef(null);
    const { location, setLocation } = usePhone();
    const [multiJobsData, setMultiJobsData] = useState<MultiJobData[]>([]);
    const [searchValue, setSearchValue] = useState('');
    const [currentJob, setCurrentJob] = useState('');
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
                        const [groupData, isLeader, jobStatus, jobStage] = res;
                        console.log(groupData, isLeader, inJob);
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
            </div>
        </CSSTransition>
    )
}