import { Avatar, Transition } from "@mantine/core";
import { TweetProfileData } from "../../../../../types/types";
import Searchbar from "./SearchBar";
import { useState } from "react";
import { useDebouncedCallback } from "@mantine/hooks";
import { fetchNui } from "../../../hooks/fetchNui";
import Profile from "./Profile";

export default function SearchUser(props: { show: boolean, profileData: TweetProfileData, onStartChat?: (user: TweetProfileData) => void }) {
    const [searchValue, setSearchValue] = useState('');
    const [searchResults, setSearchResults] = useState<TweetProfileData[]>([]);

    const handleSearchusers = useDebouncedCallback(async (value: string) => {
        const res = await fetchNui('searchUsers', value);
        setSearchResults(JSON.parse(res as string));
    }, 500);
    const [showProfile, setShowProfile] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState('');

    return (
        <Transition
            mounted={props.show}
            transition="slide-right"
            duration={400}
            timingFunction="ease"
            onEnter={async () => {

            }}
        >
            {(styles) => <div style={{
                ...styles,
                width: '100%',
                height: '91%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
            }}>
                <div style={{
                    width: '100%',
                    height: '14%',
                    backgroundColor: 'rgba(255, 255, 255, 0.19)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    position: 'relative',
                }}>
                    <Avatar size={"2.84vh"} src={props.profileData.avatar.length > 0 ? props.profileData.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} style={{
                        position: 'absolute',
                        left: '3%',
                        bottom: '25%',
                    }} className='clickanimation' onClick={() => {

                    }} />
                    <div style={{
                        position: 'relative',
                        top: '-1.78vh',
                        marginLeft: '0.89vh',
                    }}>
                        <Searchbar mt="" value={searchValue} onChange={(e) => {
                            handleSearchusers(e);
                            setSearchValue(e)
                        }} />
                    </div>
                </div>
                <div style={{
                    width: '100%',
                    height: '85%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                }}>
                    {searchResults && searchResults.map((profile) => {
                        return (
                            <div style={{
                                width: '95%',
                                height: '9%',
                                marginTop: '0.89vh',
                                borderRadius: '1.24vh',
                                backgroundColor: 'rgba(255, 255, 255, 0.19)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingRight: '0.89vh',
                            }}>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    flex: 1,
                                }} onClick={() => {
                                    setSelectedEmail(profile.email);
                                    setShowProfile(true);
                                }}>
                                    <Avatar size={'3.20vh'} src={profile.avatar.length > 0 ? profile.avatar : 'https://cdn.summitrp.gg/uploads/server/phone/emptyPfp.svg'} style={{
                                        marginLeft: '0.89vh',
                                    }} />
                                    <div style={{
                                        marginLeft: '0.89vh', display: 'flex',
                                        flexDirection: 'column',
                                    }}>
                                        <div style={{
                                            fontSize: '1.30vh',
                                            fontWeight: 'bold',
                                            color: 'white',
                                            width: '15.5vh',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                        }}>{profile.displayName} {profile.verified &&
                                            <svg style={{
                                                position: 'relative',
                                                top: '0.27vh',
                                                marginLeft: '0.36vh'
                                            }} width="1.48vh" height="1.39vh" viewBox="0 0 16 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M15.406 5.87311C15.276 5.67418 15.1674 5.46273 15.082 5.24212C15.0074 5.01543 14.9608 4.78092 14.9431 4.54352C14.933 3.96903 14.7623 3.4081 14.4494 2.92096C14.0667 2.47923 13.5681 2.14691 13.0067 1.95944C12.7776 1.87335 12.558 1.76514 12.351 1.63644C12.1715 1.48596 12.0062 1.32002 11.8573 1.14065C11.5029 0.672114 11.0223 0.308145 10.4687 0.0889966C9.90811 -0.0399779 9.32245 -0.021833 8.77146 0.141579C8.27928 0.254203 7.767 0.254203 7.27483 0.141579C6.71421 -0.0272828 6.11713 -0.0454511 5.54677 0.0889966C4.98752 0.305753 4.50133 0.669916 4.14272 1.14065C3.98889 1.32069 3.81846 1.48665 3.63356 1.63644C3.4266 1.76514 3.20692 1.87335 2.97782 1.95944C2.41364 2.1457 1.91224 2.47811 1.52748 2.92096C1.22272 3.41038 1.06008 3.97116 1.05689 4.54352C1.03919 4.78092 0.992574 5.01543 0.918033 5.24212C0.831614 5.45755 0.723059 5.66392 0.594021 5.85809C0.246194 6.34091 0.0407607 6.90724 0 7.49567C0.0435188 8.07891 0.248827 8.63971 0.594021 9.11823C0.726029 9.31072 0.834754 9.51741 0.918033 9.7342C0.985154 9.96684 1.02399 10.2064 1.03375 10.4478C1.04312 11.0224 1.21387 11.5836 1.52748 12.0704C1.91012 12.5121 2.40872 12.8444 2.97011 13.0319C3.19921 13.118 3.41888 13.2262 3.62584 13.3549C3.81074 13.5047 3.98117 13.6706 4.135 13.8507C4.48704 14.3215 4.96836 14.686 5.52363 14.9023C5.7412 14.9668 5.96736 14.9997 6.19479 15C6.54319 14.9892 6.88956 14.9439 7.22854 14.8648C7.71986 14.7452 8.23385 14.7452 8.72517 14.8648C9.28715 15.0272 9.88313 15.0427 10.4532 14.9099C11.0085 14.6935 11.4898 14.329 11.8419 13.8582C11.9957 13.6782 12.1661 13.5122 12.351 13.3624C12.558 13.2337 12.7776 13.1255 13.0067 13.0394C13.5681 12.8519 14.0667 12.5196 14.4494 12.0779C14.763 11.5911 14.9337 11.0299 14.9431 10.4553C14.9529 10.2139 14.9917 9.97436 15.0588 9.74171C15.1452 9.52628 15.2538 9.31991 15.3828 9.12574C15.7376 8.64746 15.951 8.08371 16 7.49567C15.9565 6.91243 15.7512 6.35164 15.406 5.87311Z" fill="#0A84FF" />
                                                <path d="M7.22854 10.5004C7.12701 10.501 7.02637 10.482 6.93238 10.4446C6.83838 10.4073 6.75289 10.3522 6.68081 10.2826L4.36644 8.02901C4.29451 7.95897 4.23745 7.87582 4.19853 7.78431C4.1596 7.6928 4.13956 7.59472 4.13956 7.49567C4.13956 7.29563 4.22117 7.10378 4.36644 6.96233C4.51171 6.82088 4.70874 6.74141 4.91418 6.74141C5.11962 6.74141 5.31664 6.82088 5.46191 6.96233L7.22854 8.69005L10.5381 5.45996C10.6834 5.31851 10.8804 5.23905 11.0858 5.23905C11.2913 5.23905 11.4883 5.31851 11.6336 5.45996C11.7788 5.60141 11.8604 5.79326 11.8604 5.9933C11.8604 6.19334 11.7788 6.38519 11.6336 6.52664L7.77628 10.2826C7.70419 10.3522 7.6187 10.4073 7.52471 10.4446C7.43072 10.482 7.33007 10.501 7.22854 10.5004Z" fill="white" />
                                            </svg>
                                            }</div>
                                        <div style={{
                                            fontSize: '1.07vh',
                                            color: 'white',
                                            lineHeight: '1.24vh',
                                            opacity: 0.5,
                                        }}>
                                            {profile.email}
                                        </div>
                                    </div>
                                </div>
                                <div 
                                    style={{
                                        backgroundColor: '#0A84FF',
                                        color: 'white',
                                        padding: '0.53vh 1.07vh',
                                        borderRadius: '0.53vh',
                                        fontSize: '1.07vh',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                    }}
                                    className="clickanimation"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        props.onStartChat?.(profile);
                                    }}
                                >
                                    Message
                                </div>
                            </div>
                        )
                    })}
                </div>
                <Profile show={showProfile} email={selectedEmail} onClose={() => {
                    setShowProfile(false);
                }} onError={() => {
                    setShowProfile(false);
                }} onRetweetClick={() => { }} onLikeClick={() => { }} onReplyClick={() => { }} />
            </div>}
        </Transition>
    )
}